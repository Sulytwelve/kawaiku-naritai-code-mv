// Whole-film and bounded-range renderer for the Kawaii Naritai MV.
// Coverage, output-clock ranges, source-clock ranges, and sidecar subtitles
// share this entry point. Uncovered footage is rejected unless explicitly filled.
//
//   node production/mv/render-film.mjs --coverage
//   node production/mv/render-film.mjs --range 143 153 --width 1920 --qa
//   node production/mv/render-film.mjs --out deliverables/... --srt ja
//
// Output clock = complete Sana song from t=0. Source PTS = song t -0.064,
// clamped to the first/last source frame. No full-film head or tail trim.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {ROOT,SOURCE,tracks,renderReference,completion,createCanvas} from './scene.mjs';
import {filmClock,SANA_SECONDS} from './film-clock.mjs';

const args=process.argv.slice(2);
const arg=(k,d)=>{const n=args.indexOf(k);return n<0?d:args[n+1]};
const has=k=>args.includes(k);

// Source PTS = song seconds - offset, clamped to the visible source frame span.
// Record this parameter explicitly when changing the song or reference timing.
const AUDIO_OFFSET=Number(arg('--audio-offset','0.064'));

const width=Number(arg('--width','3840')),height=width*9/16;
const fps=Number(arg('--fps','60'));
// --fill-gaps draws an unmistakable slate over uncovered ranges so a full-length
// review draft can be watched end to end. It implies --qa and can never reach a
// delivery path, because a slate is not reconstructed footage.
const fillGaps=has('--fill-gaps');
const previewRelease=has('--preview-release');
const qa=has('--qa')||fillGaps||previewRelease;

const FRAME_STEP=1001/24000;                 // 23.976 source frame grid
const FILM_START=SOURCE.firstPTS;            // 0.129
const FILM_FRAMES=Math.round((SOURCE.lastFramePTS-FILM_START)/FRAME_STEP)+1;   // 6043
const clock=filmClock(SOURCE,{fps,offset:AUDIO_OFFSET});
const FILM_SECONDS=clock.seconds;
const OUT_FRAMES=clock.frames;

// ASSET_INDEX.audio accepts a project-relative path or an assets/audio filename.
const audioDeclared=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/ASSET_INDEX.json'),'utf8')).audio;
const audioRelFromRoot=audioDeclared.includes('/')?audioDeclared:`assets/audio/${audioDeclared}`;
const audioPath=path.join(ROOT,audioRelFromRoot);
if(!has('--coverage')&&!has('--dry-run')&&!has('--no-audio')&&!fs.existsSync(audioPath))throw new Error(`Audio track declared by ASSET_INDEX.audio not found: ${audioRelFromRoot}`);

function coverageAt(p){
  const scene=tracks.scenes.find(s=>p>=s.range[0]&&p<s.range[1]);
  if(scene)return{kind:'scene',id:scene.id,ready:!!scene.ready};
  const tr=(tracks.transitions??[]).find(x=>p>=x.range[0]&&p<x.range[1]);
  if(tr)return{kind:'transition',id:tr.incoming,ready:false};
  return null;
}

// Collapse per-frame coverage into runs so gaps are reported as intervals.
function scanCoverage(){
  const runs=[];
  for(let k=0;k<OUT_FRAMES;k++){
    const p=clock.sourceAtFrame(k);
    const c=coverageAt(p);
    const key=c?`${c.kind}:${c.id}:${c.ready}`:'gap';
    const last=runs.at(-1);
    if(last&&last.key===key){last.endFrame=k;last.end=p}
    else runs.push({key,kind:c?c.kind:'gap',id:c?.id??null,ready:!!c?.ready,startFrame:k,endFrame:k,start:p,end:p});
  }
  return runs.map(r=>({...r,seconds:(r.endFrame-r.startFrame+1)/fps}));
}

function reportCoverage(runs){
  const gaps=runs.filter(r=>r.kind==='gap');
  const drafts=runs.filter(r=>r.kind==='scene'&&!r.ready);
  const ready=runs.filter(r=>r.kind==='scene'&&r.ready);
  const trans=runs.filter(r=>r.kind==='transition');
  const sum=rs=>rs.reduce((a,b)=>a+b.seconds,0);
  console.log(`film            : ${FILM_FRAMES} source frames, ${FILM_SECONDS.toFixed(3)}s, output ${OUT_FRAMES} @ ${fps}fps = ${(OUT_FRAMES/fps).toFixed(3)}s`);
  console.log(`source PTS span : ${FILM_START} .. ${SOURCE.lastFramePTS}`);
  console.log('');
  console.log(`  covered, scene ready : ${sum(ready).toFixed(3)}s  (${(100*sum(ready)/FILM_SECONDS).toFixed(1)}%)`);
  console.log(`  covered, draft scene : ${sum(drafts).toFixed(3)}s  (${(100*sum(drafts)/FILM_SECONDS).toFixed(1)}%)`);
  console.log(`  covered, transition  : ${sum(trans).toFixed(3)}s  (${(100*sum(trans)/FILM_SECONDS).toFixed(1)}%)`);
  console.log(`  UNCOVERED (render throws here): ${sum(gaps).toFixed(3)}s  (${(100*sum(gaps)/FILM_SECONDS).toFixed(1)}%)`);
  console.log('');
  console.log(`Gaps (${gaps.length} intervals):`);
  for(const g of gaps)console.log(`  ${g.start.toFixed(3)} .. ${g.end.toFixed(3)}   ${g.seconds.toFixed(3)}s   frames ${g.startFrame}..${g.endFrame}`);
  console.log('');
  console.log(`Draft scenes: ${drafts.length} run(s). ${!qa&&drafts.length?'Non-QA render will throw at the first one (scene.ready=false).':'--qa supplied, drafts render with the watermark.'}`);
  return{runs,gaps,drafts,ready,transitionRuns:trans,
    seconds:{ready:sum(ready),draft:sum(drafts),transition:sum(trans),gap:sum(gaps),total:FILM_SECONDS}};
}

// --- SRT: song time -> output video time ---------------------------------
function srtTime(seconds){
  const ms=Math.max(0,Math.round(seconds*1000));
  const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;
}
function parseSrt(text){
  const toSec=(h,mi,se,ms)=>Number(h)*3600+Number(mi)*60+Number(se)+Number(ms)/1000;
  return text.replace(/\r/g,'').split(/\n{2,}/).map(b=>b.trim()).filter(Boolean).map(b=>{
    const lines=b.split('\n');
    const m=lines[1]?.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    if(!m)return null;
    return{text:lines.slice(2).join('\n'),start:toSec(m[1],m[2],m[3],m[4]),end:toSec(m[5],m[6],m[7],m[8])};
  }).filter(Boolean);
}
function writeShiftedSrt(sourceRelative,outPath,shift){
  const cues=parseSrt(fs.readFileSync(path.join(ROOT,sourceRelative),'utf8'));
  const shifted=cues.map(c=>({...c,start:c.start-shift,end:c.end-shift})).filter(c=>c.end>0);
  const body=shifted.map((c,i)=>`${i+1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n');
  fs.mkdirSync(path.dirname(outPath),{recursive:true});
  fs.writeFileSync(outPath,body,'utf8');
  return{cues:cues.length,written:shifted.length,firstStart:shifted[0]?.start,lastEnd:shifted.at(-1)?.end};
}

// --- coverage -------------------------------------------------------------
const coverage=scanCoverage();
const report=reportCoverage(coverage);
const covJson=path.join(ROOT,'qa/mv/film-coverage.json');
fs.mkdirSync(path.dirname(covJson),{recursive:true});
fs.writeFileSync(covJson,JSON.stringify({
  generatedFor:'mv_v2 whole-film entry',
  fps,frames:OUT_FRAMES,filmSeconds:FILM_SECONDS,sourceFrames:FILM_FRAMES,
  sourceSpan:[FILM_START,SOURCE.lastFramePTS],
  outputClock:'Complete Sana seconds from0',audioSeekSeconds:0,songSeconds:SANA_SECONDS,sourceMapping:'clamp(songSeconds - audioOffset, firstPTS, lastFramePTS)',audioOffset:AUDIO_OFFSET,
  seconds:report.seconds,
  gaps:report.gaps.map(g=>({start:g.start,end:g.end,seconds:g.seconds})),
  ...completion()
},null,2));

if(has('--coverage')){console.log(`\ncoverage written: ${path.relative(ROOT,covJson)}`);process.exit(0)}

// --- range: --range A B, or --range-start / --range-end --------------------
const rangeArg=arg('--range',null);
const outputRangeArg=arg('--output-range',null);
const outputRangeStartFrame=outputRangeArg===null?0:Math.round(Number(outputRangeArg)*fps);
const outputRangeEndFrame=outputRangeArg===null?0:Math.round(Number(args[args.indexOf('--output-range')+2])*fps);
if(outputRangeArg!==null&&(!Number.isFinite(outputRangeEndFrame)||outputRangeStartFrame<0||outputRangeEndFrame<=outputRangeStartFrame||outputRangeEndFrame>OUT_FRAMES))throw new Error('Invalid --output-range; use an increasing range within the complete film clock.');
const isFull=rangeArg===null&&!has('--range-start')&&!has('--range-end')&&outputRangeArg===null;
const rangeStart=rangeArg!==null?Number(rangeArg):Number(arg('--range-start',FILM_START));
const rangeEnd=rangeArg!==null?Number(args[args.indexOf('--range')+2]):Number(arg('--range-end',SOURCE.lastFramePTS));
const startPTS=outputRangeArg!==null?clock.sourceAtFrame(outputRangeStartFrame):isFull?FILM_START:Math.max(FILM_START,rangeStart);
const endPTS=outputRangeArg!==null?clock.sourceAtFrame(outputRangeEndFrame-1):isFull?SOURCE.lastFramePTS:Math.min(SOURCE.lastFramePTS,rangeEnd);
const n=outputRangeArg!==null?outputRangeEndFrame-outputRangeStartFrame:isFull?OUT_FRAMES:Math.max(1,Math.round((endPTS-startPTS)*fps)+1);
const AUDIO_SEEK=outputRangeArg!==null?outputRangeStartFrame/fps:isFull?0:startPTS+AUDIO_OFFSET;
const framePTS=k=>outputRangeArg!==null?clock.sourceAtFrame(outputRangeStartFrame+k):isFull?clock.sourceAtFrame(k):Math.min(SOURCE.lastFramePTS,startPTS+k/fps);

// Refuse anything we cannot draw, rather than emitting a film with holes.
if(!qa){
  const uncovered=[];
  for(let k=0;k<n;k++){
    const p=framePTS(k),c=coverageAt(p);
    if(!c||!c.ready)uncovered.push(p);
  }
  if(uncovered.length){
    console.error(`\nREFUSED: ${uncovered.length} of ${n} frames are uncovered or not ready `+
      `(first at source PTS ${uncovered[0].toFixed(3)}).`);
    console.error('Fill the gaps / flip scenes to ready, or pass --qa for an internal draft pass.');
    process.exit(2);
  }
}

const out=path.resolve(ROOT,arg('--out',isFull
  ?'deliverables/EXT-01_Kawaiku_Naritai_mv_v2_4K60.mp4'
  :'qa/mv/composition/film-range.mp4'));
if(out===path.join(ROOT,'deliverables/EXT-01_Kawaiku_Naritai_DeepSeek_4K60_AV1.mp4'))throw new Error('REFUSED: preserved v1 delivery is immutable. Use a distinct mv_v2 filename.');
if(isFull&&!qa&&!completion().renderReady)throw new Error('REFUSED: whole-film readiness gate is false. Complete visual/audio/technical QA before final export.');
// A slate is a review aid, never a deliverable.
if(fillGaps&&out.startsWith(path.join(ROOT,'deliverables')+path.sep)){
  console.error('REFUSED: --fill-gaps cannot write into deliverables/. Choose a path under qa/mv.');
  process.exit(2);
}
fs.mkdirSync(path.dirname(out),{recursive:true});
const includeAudio=!has('--no-audio');
const encoder=arg('--encoder','av1_amf');
const audioDuration=n/fps;

const ffargs=['-hide_banner','-y','-f','rawvideo','-pix_fmt','rgba','-s',`${width}x${height}`,'-r',String(fps),'-i','pipe:0'];
if(includeAudio){if(AUDIO_SEEK>0)ffargs.push('-ss',String(AUDIO_SEEK));ffargs.push('-i',audioPath)}
ffargs.push('-map','0:v:0');
if(includeAudio)ffargs.push('-map','1:a:0','-t',String(audioDuration));
ffargs.push('-c:v',encoder);
if(encoder==='av1_amf')ffargs.push('-quality',arg('--quality','balanced'),'-b:v',arg('--bitrate','24M'));
else ffargs.push('-preset',arg('--preset','fast'),'-crf',arg('--crf','19'));
ffargs.push('-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709');
if(includeAudio)ffargs.push('-af',`apad=whole_dur=${audioDuration}`,'-c:a','aac','-b:a','256k','-ar','44100');
ffargs.push('-movflags','+faststart',out);

console.log(`\nrendering ${n} frames  ${width}x${height} @ ${fps}fps`);
console.log(`  source PTS   ${startPTS.toFixed(3)} .. ${framePTS(n-1).toFixed(3)}`);
console.log(`  output       ${path.relative(ROOT,out)}`);
console.log(`  audio        ${includeAudio?`${audioRelFromRoot}; seek ${AUDIO_SEEK.toFixed(3)}s (${isFull?'complete song from zero':'source-range preview'})`:'none'}`);

// av1_amf codes to a multiple of 16: a 960x540 request came back as 960x544 with
// a 30:17 display aspect. A delivery must never be silently padded.
const padded=encoder==='av1_amf'&&(width%16!==0||height%16!==0);
if(padded){
  const msg=`av1_amf will pad ${width}x${height} to a multiple of 16 (coded ${Math.ceil(width/16)*16}x${Math.ceil(height/16)*16}). Use a multiple-of-16 size, or --encoder libx264.`;
  if(isFull&&!qa)throw new Error(`REFUSED: ${msg}`);
  console.warn(`WARNING: ${msg}`);
}

if(has('--dry-run')){const plan={isFull,frames:n,fps,seconds:n/fps,audioSeekSeconds:AUDIO_SEEK,sourcePTSAtFirstFrame:framePTS(0),sourcePTSAtLastFrame:framePTS(n-1),songSeconds:SANA_SECONDS,ffmpegArgs:ffargs,rendered:false};fs.writeFileSync(path.join(ROOT,'qa/mv/film-render-plan.json'),JSON.stringify(plan,null,2));console.log(JSON.stringify(plan,null,2));process.exit(0)}
const ff=spawn(arg('--ffmpeg',process.env.FFMPEG_PATH||'ffmpeg'),ffargs,{stdio:['pipe','ignore','pipe'],windowsHide:true});
let log='';ff.stderr.on('data',b=>{log+=b;if(log.length>200000)log=log.slice(-200000)});
// A dead encoder must surface its stderr, not an EPIPE from the pipe write.
ff.stdin.on('error',()=>{});
const began=performance.now();let aborted=false;
ff.on('exit',code=>{if(code!==0)aborted=true});

const canvas=createCanvas(width,height);
const slateCtx=canvas.getContext('2d');
// Full-frame, high-contrast, unmistakably not footage.
function drawSlate(p,reason){
  const g=slateCtx;
  g.resetTransform();
  g.fillStyle='#14161c';g.fillRect(0,0,width,height);
  g.fillStyle='#ffd23f';g.fillRect(0,height*0.42,width,height*0.16);
  g.fillStyle='#14161c';g.textAlign='center';
  g.font=`bold ${Math.round(width/34)}px "MV Gothic"`;
  g.fillText('GAP - NOT YET RECONSTRUCTED',width/2,height*0.50);
  g.font=`${Math.round(width/70)}px "MV Gothic"`;
  g.fillText(`source PTS ${p.toFixed(3)}   ${reason}`,width/2,height*0.555);
  g.textAlign='left';
}

for(let k=0;k<n;k++){
  if(aborted)break;
  const p=framePTS(k);
  const cov=coverageAt(p);
  const drawable=cov&&(cov.ready||qa);
  try{
    if(drawable)await renderReference(p,{width,height,qa,watermark:qa&&!previewRelease,canvas});
    else if(fillGaps)drawSlate(p,cov?'draft scene, not certified':'no reconstructed scene');
    else throw new Error(`uncovered source PTS ${p.toFixed(3)}`);
    const buf=canvas.data();
    if(!ff.stdin.write(buf))await once(ff.stdin,'drain');
  }catch(e){
    if(aborted||e.code==='EPIPE')break;
    ff.kill();throw e;
  }
  if(k%600===0)console.log(JSON.stringify({frame:k,total:n,pts:+p.toFixed(3),
    elapsedSeconds:+((performance.now()-began)/1000).toFixed(1),
    fps:+(k/((performance.now()-began)/1000)).toFixed(2)}));
}
if(!aborted)ff.stdin.end();
const[code]=await once(ff,'close');
if(code)throw new Error(`ffmpeg exited ${code}\n--- ffmpeg args ---\n${ffargs.join(' ')}\n--- ffmpeg stderr ---\n${log.slice(-3000)}`);
const wall=(performance.now()-began)/1000;

// --- optional deliverables alongside the video ---------------------------
const extra={};
if(has('--srt')){
  const which=arg('--srt','ja');
  const src=which==='bilingual'?'assets/subtitles/KAWAIKU NARITAI.bilingual.srt':'assets/subtitles/KAWAIKU NARITAI.ja.srt';
  const srtOut=out.replace(/\.mp4$/,'')+`.${which}.srt`;
  extra.srt={source:src,...writeShiftedSrt(src,srtOut,AUDIO_SEEK),out:path.relative(ROOT,srtOut)};
}
const renderReport={out:path.relative(ROOT,out),width,height,fps,frames:n,wallSeconds:+wall.toFixed(2),
  renderFps:+(n/wall).toFixed(3),encoder,qa,previewRelease,gapFill:fillGaps,
  gapSeconds:fillGaps?report.seconds.gap:0,
  audio:includeAudio?{asset:audioRelFromRoot,seekSeconds:+AUDIO_SEEK.toFixed(4),offset:AUDIO_OFFSET,firstPTS:FILM_START,completeSong:isFull,songSeconds:SANA_SECONDS,outputClock:isFull?'Sana seconds from0':'source range'}:null,
  ...extra,ffmpegArgs:ffargs,...completion()};
fs.writeFileSync(out+'.render.json',JSON.stringify(renderReport,null,2));
console.log(JSON.stringify(renderReport,null,2));
