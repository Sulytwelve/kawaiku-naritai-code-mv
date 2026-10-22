// Whole-film and bounded-range renderer for the Kawaiku Naritai MV.
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
import {resolveEncoding,probeEncoder,probeEncoderPixels,probeOutputPixelFormat,SUPPORTED_ENCODERS,EncodingError} from './encoding.mjs';
import {resolveSrtLanguage,parseSrt,cropCues,serializeSrt,SRT_LANGUAGES,SrtError} from './srt.mjs';
import {fontStatuses,reportFontWarnings} from './font-slots.mjs';
import {resolveAudioInput,AudioInputError} from './audio-input.mjs';

const args=process.argv.slice(2);
const has=k=>args.includes(k);

// --- CLI values -----------------------------------------------------------
// Every documented value-taking flag is read through tokenAfter(): a missing
// next token or a following flag (`--srt --no-audio`) is a missing value, never
// a value. Contract violations are REFUSED before coverage or encoding starts.
class CliError extends Error{constructor(message){super(message);this.name='CliError';this.code='INVALID_CLI_VALUE'}}

const VALUE_HINTS={
  '--srt':`expected one of ${SRT_LANGUAGES.join(', ')}`,
  '--encoder':`expected one of ${SUPPORTED_ENCODERS.join(', ')}`,
  '--bit-depth':'expected 8 or 10',
  '--quality':'expected a non-empty quality preset, for example balanced or speed',
  '--bitrate':'expected a bitrate such as 24M or 8000k',
  '--preset':'expected a non-empty encoder preset, for example fast or veryfast',
  '--crf':'expected an integer between 0 and 51',
  '--ffmpeg':'expected a path to an ffmpeg executable',
  '--out':'expected an output file path',
  '--audio-offset':'expected song seconds, for example 0.064',
  '--width':'expected a positive pixel width, for example 320',
  '--fps':'expected a positive frame rate, for example 60',
  '--range':'expected two source-PTS seconds, for example 44 56',
  '--range-start':'expected a source-PTS second value',
  '--range-end':'expected a source-PTS second value',
  '--output-range':'expected two output-clock seconds, for example 44 44.5',
};

function missingValue(flag,detail){
  const hint=VALUE_HINTS[flag]??'expected a value';
  throw new CliError(`missing value for ${flag} (${hint})${detail?`; ${detail}`:''}. Refusing to treat a flag as a value.`);
}

function tokenAfter(flag,offset=1){
  const index=args.indexOf(flag);
  if(index<0)return undefined;
  const token=args[index+offset];
  // An empty token (for example --out "") is as unusable as a missing one and
  // would otherwise resolve to the repository root or to zero.
  if(token===undefined||token==='')missingValue(flag);
  if(token.startsWith('--'))missingValue(flag,`found ${JSON.stringify(token)} instead`);
  return token;
}

function valueOf(flag,fallback){
  const token=tokenAfter(flag);
  return token===undefined?fallback:token;
}

function numberOption(flag,fallback,{min=-Infinity,max=Infinity,integer=false}={}){
  const raw=valueOf(flag,fallback);
  const value=typeof raw==='number'?raw:Number(raw);
  if(!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value))){
    throw new CliError(`invalid ${flag} value ${JSON.stringify(raw)}; ${VALUE_HINTS[flag]??'expected a number'}.`);
  }
  return value;
}

function pairOf(flag){
  const index=args.indexOf(flag);
  if(index<0)return null;
  const first=tokenAfter(flag,1);
  const second=args[index+2];
  if(second===undefined||second===''||second.startsWith('--'))missingValue(flag,'the second value is missing');
  return [first,second];
}

function rangeOption(flag){
  const pair=pairOf(flag);
  if(pair===null)return null;
  const values=pair.map(Number);
  if(!values.every(Number.isFinite)){
    throw new CliError(`invalid ${flag} values ${JSON.stringify(pair)}; ${VALUE_HINTS[flag]}.`);
  }
  return{start:values[0],end:values[1]};
}

function parseCli(){
  const outputRange=rangeOption('--output-range');
  const range=rangeOption('--range');
  const rangeStart=has('--range-start')?numberOption('--range-start',undefined):null;
  const rangeEnd=has('--range-end')?numberOption('--range-end',undefined):null;
  const width=numberOption('--width',3840,{min:1,integer:true});
  // The frame height is width*9/16. A width that does not make that a whole,
  // even number reaches FFmpeg as a fractional rawvideo size ("Invalid frame
  // size: 1000x562.5"), so refuse it before planning or encoding.
  const height=width*9/16;
  if(!Number.isInteger(height)||height%2!==0){
    throw new CliError(`invalid --width ${width}; height would be ${height}, but the 16:9 output needs a whole even height, so use a multiple of 32 (for example 320, 640, 1280, 1920 or 3840).`);
  }
  const fps=numberOption('--fps',60,{min:1});
  const audioOffset=numberOption('--audio-offset',0.064);
  const encoder=valueOf('--encoder','libx264');
  const bitDepth=valueOf('--bit-depth','8');
  const srt=has('--srt')?valueOf('--srt'):null;
  // Only explicit flags become overrides; encoding.mjs fills the documented
  // defaults (libx264 fast/crf 19, av1_amf balanced/24M) for everything else.
  const overrides={};
  if(has('--preset'))overrides.preset=valueOf('--preset');
  if(has('--crf'))overrides.crf=valueOf('--crf');
  if(has('--quality'))overrides.quality=valueOf('--quality');
  if(has('--bitrate'))overrides.bitrate=valueOf('--bitrate');
  return{outputRange,range,rangeStart,rangeEnd,width,fps,audioOffset,encoder,bitDepth,srt,overrides,
    ffmpeg:valueOf('--ffmpeg',process.env.FFMPEG_PATH||'ffmpeg'),
    out:valueOf('--out',null)};
}

// Module-level runtime context so ERROR paths always name the chosen FFmpeg and
// encoder even when the failure happened before the render loop started.
let ffmpegPath='ffmpeg';
let encoding=null;

function refuse(message){
  console.error(`REFUSED: ${message}`);
  process.exit(2);
}

// Set once the output path is known and the encoder actually starts. A failed
// run must not leave a 0-byte or half-written file at --out, but an existing
// file from an earlier run is never deleted just because this run failed.
let outputPath=null;
let outputPreexisted=true;
let outputStarted=false;
let encoderProcess=null;

// A frame error can happen while ffmpeg is still between spawn and opening
// --out: unlinking immediately lets the child recreate a tiny header file
// after the cleanup message. Wait until the encoder is gone before removing,
// with a timer fallback so a wedged child cannot hide the failure.
let incompleteOutputCleanupStarted=false;
function exitAfterIncompleteOutputCleanup(){
  if(incompleteOutputCleanupStarted)return;
  incompleteOutputCleanupStarted=true;
  const child=encoderProcess;
  const childAlive=child&&child.exitCode===null&&child.signalCode===null;
  const finish=()=>{
    if(outputStarted&&outputPath&&!outputPreexisted){
      try{
        fs.rmSync(outputPath,{force:true});
        console.error(`  removed      ${path.relative(ROOT,outputPath)} (incomplete output from this run)`);
      }catch(error){
        console.error(`  warning      could not remove ${path.relative(ROOT,outputPath)}: ${error.message}`);
      }
    }
    process.exit(1);
  };
  if(!childAlive)return finish();
  child.once('close',finish);
  child.kill('SIGKILL');
  const timer=setTimeout(finish,3000);
  if(typeof timer.unref==='function')timer.unref();
}

function runtimeFailure(message,{stderrTail=null,argsLine=null}={}){
  if(incompleteOutputCleanupStarted)return; // already scheduled once; let the cleanup finish own the exit
  console.error(`ERROR: ${message}`);
  console.error(`  ffmpeg       ${ffmpegPath}`);
  console.error(`  encoder      ${encoding?`${encoding.encoder} (${encoding.bitDepth}-bit, ${encoding.outputPixelFormat})`:'not resolved'}`);
  if(argsLine)console.error(`  ffmpeg args  ${argsLine}`);
  const tail=stderrTail===null||stderrTail===undefined?'':String(stderrTail);
  if(tail.trim()!=='')console.error(`--- ffmpeg stderr (last 3000 chars) ---\n${tail.slice(-3000)}`);
  exitAfterIncompleteOutputCleanup();
}

let cli;
try{
  cli=parseCli();
}catch(error){
  if(error instanceof CliError)refuse(error.message);
  throw error;
}

// --fill-gaps draws an unmistakable slate over uncovered ranges so a full-length
// review draft can be watched end to end. It implies --qa and can never reach a
// delivery path, because a slate is not reconstructed footage.
const fillGaps=has('--fill-gaps');
const previewRelease=has('--preview-release');
const qa=has('--qa')||fillGaps||previewRelease;
const dryRun=has('--dry-run');
const coverageOnly=has('--coverage');
const includeAudio=!has('--no-audio');
// Existence is enforced only for a real encode with sound; --dry-run, --coverage
// and --no-audio must work without the media. The plan still reports the planned
// audio track and its truthful `exists` flag.
const audioInputRequired=includeAudio&&!dryRun&&!coverageOnly;

// I01: one WARNING per unavailable font slot, never once per frame. Missing
// fonts fall back to the platform family and must not abort coverage or render.
reportFontWarnings();

const width=cli.width,height=width*9/16;
const fps=cli.fps;
// Source PTS = song seconds - offset, clamped to the visible source frame span.
// Record this parameter explicitly when changing the song or reference timing.
const AUDIO_OFFSET=cli.audioOffset;
ffmpegPath=cli.ffmpeg;
// ffprobe is only needed to verify the encoded stream. Prefer FFPROBE_PATH or a
// sibling of the chosen FFmpeg executable, then fall back to PATH.
const ffprobePath=process.env.FFPROBE_PATH||(()=>{
  if(!ffmpegPath.includes(path.sep)&&!ffmpegPath.includes('/'))return 'ffprobe';
  const sibling=path.join(path.dirname(path.resolve(ffmpegPath)),process.platform==='win32'?'ffprobe.exe':'ffprobe');
  return fs.existsSync(sibling)?sibling:'ffprobe';
})();

// I02/S01/E01/E02 contract checks: resolve every user-selectable encoder,
// bit depth, subtitle language and audio override before any scan or encoding.
// Illegal values exit 2 here, which also covers --dry-run.
let srtChoice=null;
let audioInput;
try{
  encoding=resolveEncoding({encoder:cli.encoder,bitDepth:cli.bitDepth,overrides:cli.overrides});
  if(cli.srt!==null)srtChoice=resolveSrtLanguage(cli.srt);
  audioInput=resolveAudioInput({root:ROOT,envAudioPath:process.env.MV_AUDIO_PATH,enabled:audioInputRequired});
}catch(error){
  if(error instanceof EncodingError||error instanceof SrtError||error instanceof AudioInputError)refuse(error.message);
  throw error;
}
for(const warning of encoding.warnings)console.warn(`WARNING: ${warning}`);
for(const note of encoding.notes)console.log(`NOTE: ${note}`);

const FRAME_STEP=1001/24000;                 // 23.976 source frame grid
const FILM_START=SOURCE.firstPTS;            // 0.129
const FILM_FRAMES=Math.round((SOURCE.lastFramePTS-FILM_START)/FRAME_STEP)+1;   // 6043
const clock=filmClock(SOURCE,{fps,offset:AUDIO_OFFSET});
const FILM_SECONDS=clock.seconds;
const OUT_FRAMES=clock.frames;

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
  const draftFlags=['--qa','--preview-release','--fill-gaps'].filter(flag=>has(flag));
  const draftNote=!qa
    ?'Non-QA render will throw at the first one (scene.ready=false).'
    :`${draftFlags.join(' + ')} supplied; drafts render ${previewRelease?'without the watermark':'with the watermark'}${fillGaps?'; uncovered gaps get a slate':''}.`;
  console.log(`Draft scenes: ${drafts.length} run(s). ${draftNote}`);
  return{runs,gaps,drafts,ready,transitionRuns:trans,
    seconds:{ready:sum(ready),draft:sum(drafts),transition:sum(trans),gap:sum(gaps),total:FILM_SECONDS}};
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

if(coverageOnly){console.log(`\ncoverage written: ${path.relative(ROOT,covJson)}`);process.exit(0)}

// --- range: --range A B, or --range-start / --range-end --------------------
const outputRange=cli.outputRange;
const rangeArg=cli.range;
const outputRangeStartFrame=outputRange===null?0:Math.round(outputRange.start*fps);
const outputRangeEndFrame=outputRange===null?0:Math.round(outputRange.end*fps);
if(outputRange!==null&&(!Number.isFinite(outputRangeEndFrame)||outputRangeStartFrame<0||outputRangeEndFrame<=outputRangeStartFrame||outputRangeEndFrame>OUT_FRAMES))refuse('invalid --output-range; use an increasing range within the complete film clock.');
const isFull=rangeArg===null&&cli.rangeStart===null&&cli.rangeEnd===null&&outputRange===null;
const rangeStart=rangeArg!==null?rangeArg.start:cli.rangeStart??FILM_START;
const rangeEnd=rangeArg!==null?rangeArg.end:cli.rangeEnd??SOURCE.lastFramePTS;
const startPTS=outputRange!==null?clock.sourceAtFrame(outputRangeStartFrame):isFull?FILM_START:Math.max(FILM_START,rangeStart);
const endPTS=outputRange!==null?clock.sourceAtFrame(outputRangeEndFrame-1):isFull?SOURCE.lastFramePTS:Math.min(SOURCE.lastFramePTS,rangeEnd);
const n=outputRange!==null?outputRangeEndFrame-outputRangeStartFrame:isFull?OUT_FRAMES:Math.max(1,Math.round((endPTS-startPTS)*fps)+1);
const AUDIO_SEEK=outputRange!==null?outputRangeStartFrame/fps:isFull?0:startPTS+AUDIO_OFFSET;
const framePTS=k=>outputRange!==null?clock.sourceAtFrame(outputRangeStartFrame+k):isFull?clock.sourceAtFrame(k):Math.min(SOURCE.lastFramePTS,startPTS+k/fps);

// A source-PTS range is only meaningful while it advances inside the reference
// span. Without this check an inverted or out-of-span --range silently planned a
// single frame and logged a contradictory span.
if(outputRange===null&&!isFull&&!(endPTS>startPTS)){
  refuse(`invalid --range; the clipped span ${startPTS.toFixed(3)} .. ${endPTS.toFixed(3)} is empty. Use increasing source-PTS values within ${FILM_START} .. ${SOURCE.lastFramePTS}.`);
}

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

const out=path.resolve(ROOT,cli.out??(isFull
  ?'deliverables/EXT-01_Kawaiku_Naritai_mv_v2_4K60.mp4'
  :'qa/mv/composition/film-range.mp4'));
// Windows compares paths case-insensitively and silently drops trailing dots
// and spaces from each segment, so `Deliverables/slate.mp4`,
// `deliverables./slate.mp4` and `...AV1.mp4.` all reach the same files. Canonicalize
// every comparison key the same way before applying the delivery guards.
const pathKey=p=>{
  const resolved=path.resolve(p);
  if(process.platform!=='win32')return resolved;
  return resolved.split(path.sep)
    .map((segment,index)=>index===0?segment.toLowerCase():segment.replace(/[. ]+$/,'').toLowerCase())
    .join(path.sep);
};
const deliverablesDir=pathKey(path.join(ROOT,'deliverables'));
if(pathKey(out)===pathKey(path.join(ROOT,'deliverables/EXT-01_Kawaiku_Naritai_DeepSeek_4K60_AV1.mp4')))refuse('preserved v1 delivery is immutable. Use a distinct mv_v2 filename.');
if(isFull&&!qa&&!completion().renderReady)refuse('whole-film readiness gate is false. Complete visual/audio QA before final export.');
// A slate is a review aid, never a deliverable.
if(fillGaps&&(pathKey(out)===deliverablesDir||pathKey(out).startsWith(deliverablesDir+path.sep)))refuse('--fill-gaps cannot write into deliverables/. Choose a path under qa/mv.');
if(fs.existsSync(out)&&fs.statSync(out).isDirectory())refuse(`--out must name a file, not the existing directory ${path.relative(ROOT,out)||'.'}.`);
fs.mkdirSync(path.dirname(out),{recursive:true});
outputPath=out;
outputPreexisted=fs.existsSync(out);
const audioDuration=n/fps;

// --- subtitles: validate before encoding, write after the video -----------
// The window is the video interval on the song clock, [AUDIO_SEEK, +n/fps).
// Whole-film shift is 0; --no-audio never zeroes the subtitle shift.
const subtitleDuration=audioDuration;
let subtitleCues=null;
let subtitles;
if(srtChoice){
  const sourcePath=path.join(ROOT,srtChoice.source);
  const sourceExists=fs.existsSync(sourcePath);
  const base={
    enabled:true,language:srtChoice.language,source:srtChoice.source,
    shiftSeconds:AUDIO_SEEK,durationSeconds:subtitleDuration,timeBase:'song',
    window:{startSeconds:AUDIO_SEEK,endSeconds:AUDIO_SEEK+subtitleDuration},
  };
  if(dryRun){
    // Planning only: never read cues, so stats must stay null rather than 0.
    subtitles={...base,sourceExists,stats:null,reason:'dry-run does not read cue data'};
  }else{
    let text;
    try{text=fs.readFileSync(sourcePath,'utf8')}
    catch(error){refuse(`cannot read subtitle source ${srtChoice.source}: ${error.message}`)}
    let parsed;
    try{parsed=parseSrt(text)}
    catch(error){
      if(error instanceof SrtError)refuse(`cannot parse subtitle source ${srtChoice.source}: ${error.message}`);
      throw error;
    }
    if(!parsed.length)refuse(`subtitle source ${srtChoice.source} contains no parseable cues.`);
    const cropped=cropCues(parsed,{shiftSeconds:AUDIO_SEEK,durationSeconds:subtitleDuration});
    // A window with no lyrics is a legitimate export, not an error: the crop
    // already dropped everything outside it. Write an empty SRT and report the
    // zero count instead of refusing a soundtrack-only segment.
    subtitleCues=cropped.cues;
    subtitles={...base,sourceExists:true,stats:cropped.stats,
      reason:cropped.cues.length?null:'no cues inside the output window'};
  }
}else{
  subtitles={enabled:false,language:null,source:null,shiftSeconds:null,durationSeconds:null,
    timeBase:null,window:null,sourceExists:null,stats:null,reason:'--srt was not supplied'};
}

const audioPath=audioInput.resolvedPath;
const audioLabel=audioInput.relativePath??audioInput.resolvedPath;
const ffargs=['-hide_banner','-y','-f','rawvideo','-pix_fmt','rgba','-s',`${width}x${height}`,'-r',String(fps),'-i','pipe:0'];
if(includeAudio){if(AUDIO_SEEK>0)ffargs.push('-ss',String(AUDIO_SEEK));ffargs.push('-i',audioPath)}
ffargs.push('-map','0:v:0');
if(includeAudio)ffargs.push('-map','1:a:0','-t',String(audioDuration));
// codecArgs already carries -c:v and the quality flags; pixel format and the
// SDR/BT.709 tags must follow it, or 10-bit output would be squeezed back to 8.
ffargs.push(...encoding.codecArgs,...encoding.pixelFormatArgs,...encoding.colorArgs);
if(includeAudio)ffargs.push('-af',`apad=whole_dur=${audioDuration}`,'-c:a','aac','-b:a','256k','-ar','44100');
ffargs.push('-movflags','+faststart',out);

const encoderPlan={
  name:encoding.encoder,family:encoding.family,backend:encoding.backend,
  params:encoding.codecArgs.slice(2),bitDepth:encoding.bitDepth,
  inputPixelFormat:encoding.inputPixelFormat,outputPixelFormat:encoding.outputPixelFormat,
  color:{primaries:encoding.colorArgs[1],trc:encoding.colorArgs[3],colorspace:encoding.colorArgs[5]},
  paddingUnit:encoding.paddingUnit,ignoredOptions:encoding.ignoredOptions,
  warnings:encoding.warnings,notes:encoding.notes,
};
const audioPlan={
  // `enabled` is the planned output track; `inputRequired` is the
  // resolveAudioInput() existence gate, which is off for dry-run/coverage.
  enabled:includeAudio,inputRequired:audioInputRequired,
  source:audioInput.source,variable:audioInput.variable,declared:audioInput.declared,
  // A deliberate environment override is reported as the absolute path it was
  // resolved to; manifest input stays root-relative for readability.
  path:audioInput.source==='environment'?audioInput.resolvedPath:(audioInput.relativePath??audioInput.resolvedPath),
  relativePath:audioInput.relativePath,exists:audioInput.exists,
  seekSeconds:AUDIO_SEEK,reason:audioInput.reason,
};

console.log(`\nrendering ${n} frames  ${width}x${height} @ ${fps}fps`);
console.log(`  source PTS   ${startPTS.toFixed(3)} .. ${framePTS(n-1).toFixed(3)}`);
console.log(`  output       ${path.relative(ROOT,out)}`);
console.log(`  audio        ${includeAudio?`${audioLabel}; seek ${AUDIO_SEEK.toFixed(3)}s (${isFull?'complete song from zero':'source-range preview'}; source=${audioInput.source}${audioInput.variable?`, variable=${audioInput.variable}`:''})`:'none (--no-audio; song input disabled)'}`);
console.log(`  clock        ${outputRange!==null?`song clock ${outputRange.start} .. ${outputRange.end}s`:`source PTS ${startPTS.toFixed(3)} .. ${endPTS.toFixed(3)}`}`);
console.log(`  audio seek   ${AUDIO_SEEK.toFixed(3)}s${audioInputRequired?'':' (existence not required)'}`);
console.log(`  duration     ${subtitleDuration.toFixed(3)}s`);
if(subtitles.enabled){
  const countLabel=subtitles.stats
    ?`${subtitles.stats.output} ${subtitles.stats.output===1?'cue':'cues'} (${subtitles.stats.input} in / ${subtitles.stats.input-subtitles.stats.output} dropped)`
    :'cue data not read (--dry-run)';
  console.log(`  subtitles    ${subtitles.language}  ${countLabel}`);
  console.log(`  subtitles    shift ${subtitles.shiftSeconds.toFixed(3)}s  duration ${subtitles.durationSeconds.toFixed(3)}s  time base song`);
}else{
  console.log('  subtitles    disabled (no --srt)');
}

// The AMF encoder codes to a multiple of 16: a 960x540 request came back as
// 960x544 with a 30:17 display aspect. A delivery must never be silently padded.
const padded=encoding.paddingUnit!==null&&(width%encoding.paddingUnit!==0||height%encoding.paddingUnit!==0);
if(padded){
  const msg=`${encoding.encoder} will pad ${width}x${height} to a multiple of ${encoding.paddingUnit} (coded ${Math.ceil(width/encoding.paddingUnit)*encoding.paddingUnit}x${Math.ceil(height/encoding.paddingUnit)*encoding.paddingUnit}). Use a multiple-of-${encoding.paddingUnit} size, or --encoder libx264.`;
  if(isFull&&!qa)refuse(msg);
  console.warn(`WARNING: ${msg}`);
}

if(dryRun){
  const plan={isFull,frames:n,fps,seconds:n/fps,audioSeekSeconds:AUDIO_SEEK,
    sourcePTSAtFirstFrame:framePTS(0),sourcePTSAtLastFrame:framePTS(n-1),
    songSeconds:SANA_SECONDS,ffmpegArgs:ffargs,rendered:false,
    encoder:encoderPlan,probe:null,formatProbe:null,audio:audioPlan,fonts:fontStatuses(),subtitles};
  fs.writeFileSync(path.join(ROOT,'qa/mv/film-render-plan.json'),JSON.stringify(plan,null,2));
  console.log(JSON.stringify(plan,null,2));
  process.exit(0);
}

// E01: a listed encoder is necessary but not sufficient (the hardware backend
// may still fail to initialize), so the real encode keeps the stderr path too.
console.log(`encoder probe    ${encoding.encoder} via ${ffmpegPath} -hide_banner -encoders`);
const probe=await probeEncoder(ffmpegPath,encoding.encoder);
if(!probe.listed)runtimeFailure(`FFmpeg cannot encode with ${encoding.encoder}: ${probe.detail}`,{stderrTail:probe.stderrTail});
const encoderProbe={...probe,note:'scope is the FFmpeg encoder list only; a listed encoder does not prove that the hardware backend initializes.'};

// E02: -pix_fmt is a request, not a guarantee. Check the build's format list
// first (refuse before encoding), then verify the actual stream afterwards.
const formatProbe=await probeEncoderPixels(ffmpegPath,encoding.encoder);
if(formatProbe.pixelFormatListRead&&!formatProbe.supported.includes(encoding.outputPixelFormat)){
  runtimeFailure(`${encoding.encoder} in this FFmpeg build does not list ${encoding.outputPixelFormat}; supported pixel formats: ${formatProbe.supported.join(', ')}. Use a supported bit depth/encoder, or a build that provides ${encoding.outputPixelFormat}.`,{stderrTail:formatProbe.stderrTail});
}
if(!formatProbe.pixelFormatListRead)console.warn(`WARNING: could not read the supported pixel formats for ${encoding.encoder}; relying on the post-encode ffprobe check. ${formatProbe.detail}`);

const ff=spawn(ffmpegPath,ffargs,{stdio:['pipe','ignore','pipe'],windowsHide:true});
encoderProcess=ff;
let log='',spawnError=null,aborted=false;
// Resolve on either event: a failed spawn may emit 'error' without a usable
// 'close' code, and once(ff,'close') would reject and hide the real cause.
const closed=new Promise(resolve=>{
  ff.once('close',code=>resolve({code}));
  ff.once('error',error=>resolve({error}));
});
ff.stderr.on('data',b=>{log+=b;if(log.length>200000)log=log.slice(-200000)});
// A dead encoder must surface its stderr, not an EPIPE from the pipe write.
ff.stdin.on('error',()=>{});
ff.on('error',error=>{spawnError=error;aborted=true});
ff.on('exit',code=>{if(code!==0)aborted=true});
// Only a real spawn can have touched --out; a failed start must not trigger the
// incomplete-output cleanup.
ff.on('spawn',()=>{outputStarted=true});

// Backpressure waits must not outlive the encoder: if ffmpeg dies between two
// frames, 'drain' may never fire and an un-raced await would strand the process
// (Node exits 13 on an unsettled top-level await) instead of reporting stderr.
async function writeFrame(buffer){
  if(ff.stdin.destroyed)throw new Error('ffmpeg stdin is already closed');
  if(ff.stdin.write(buffer))return;
  await Promise.race([once(ff.stdin,'drain').catch(()=>{}),closed]);
}

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

const began=performance.now();
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
    await writeFrame(buf);
  }catch(e){
    if(aborted||e.code==='EPIPE')break;
    ff.kill();
    runtimeFailure(`frame ${k} at source PTS ${p.toFixed(3)} failed: ${e.message}`,{stderrTail:log,argsLine:ffargs.join(' ')});
    // runtimeFailure now waits for the encoder to close before removing --out;
    // stop rendering here so the scheduling path is the only thing left to run.
    aborted=true;
    break;
  }
  if(k%600===0)console.log(JSON.stringify({frame:k,total:n,pts:+p.toFixed(3),
    elapsedSeconds:+((performance.now()-began)/1000).toFixed(1),
    fps:+(k/((performance.now()-began)/1000)).toFixed(2)}));
}
if(!aborted)ff.stdin.end();
const closeResult=await closed;
if(spawnError||closeResult.error){
  const error=spawnError??closeResult.error;
  runtimeFailure(`cannot start FFmpeg at ${ffmpegPath}: ${error?.message??'unknown spawn failure'}. Check --ffmpeg or FFMPEG_PATH.`,{stderrTail:log});
}
if(closeResult.code){
  // Windows can report a negative ffmpeg exit as its unsigned 32-bit value.
  const shown=closeResult.code>2147483647?closeResult.code-4294967296:closeResult.code;
  runtimeFailure(`ffmpeg exited ${shown} while encoding ${encoding.encoder} (${encoding.outputPixelFormat}).`,{stderrTail:log,argsLine:ffargs.join(' ')});
}
const wall=(performance.now()-began)/1000;

// E02: confirm the encoded stream really has the requested pixel format. FFmpeg
// may auto-select another format and still exit 0, so a mismatch is reported as
// a failure and no SRT/sidecar is written for an unverified output.
console.log(`format check     ${encoding.outputPixelFormat} via ${ffprobePath}`);
const actualOutput=await probeOutputPixelFormat(out,{ffprobePath});
if(actualOutput.verified&&actualOutput.pixelFormat!==encoding.outputPixelFormat){
  runtimeFailure(`requested ${encoding.outputPixelFormat} but ffprobe reports ${actualOutput.pixelFormat} for ${path.relative(ROOT,out)}; the encoder did not honour the pixel format.`,{argsLine:ffargs.join(' ')});
}
if(!actualOutput.verified){
  console.warn(`WARNING: could not verify the encoded pixel format with ffprobe; requested ${encoding.outputPixelFormat}. ${actualOutput.detail}`);
}

// --- optional deliverables alongside the video ---------------------------
const extra={};
if(srtChoice&&subtitleCues){
  const srtOut=out.replace(/\.mp4$/,'')+`.${srtChoice.language}.srt`;
  fs.mkdirSync(path.dirname(srtOut),{recursive:true});
  fs.writeFileSync(srtOut,serializeSrt(subtitleCues),'utf8');
  extra.srt={source:srtChoice.source,cues:subtitles.stats.input,written:subtitles.stats.output,
    firstStart:subtitles.stats.firstStartMs===null?null:subtitles.stats.firstStartMs/1000,
    lastEnd:subtitles.stats.lastEndMs===null?null:subtitles.stats.lastEndMs/1000,
    out:path.relative(ROOT,srtOut)};
  subtitles={...subtitles,out:path.relative(ROOT,srtOut)};
}
const renderReport={out:path.relative(ROOT,out),width,height,fps,frames:n,wallSeconds:+wall.toFixed(2),
  renderFps:+(n/wall).toFixed(3),encoder:encoding.encoder,qa,previewRelease,gapFill:fillGaps,
  gapSeconds:fillGaps?report.seconds.gap:0,
  audio:{enabled:includeAudio,asset:audioLabel,source:audioInput.source,variable:audioInput.variable,
    declared:audioInput.declared,path:audioInput.relativePath??audioInput.resolvedPath,
    seekSeconds:+AUDIO_SEEK.toFixed(4),offset:AUDIO_OFFSET,firstPTS:FILM_START,
    completeSong:includeAudio&&isFull,songSeconds:SANA_SECONDS,
    outputClock:isFull?'Sana seconds from0':'source range'},
  encoding:encoderPlan,fonts:fontStatuses(),subtitles,encoderProbe,formatProbe,actualOutput,ffprobePath,
  ...extra,ffmpegArgs:ffargs,...completion()};
fs.writeFileSync(out+'.render.json',JSON.stringify(renderReport,null,2));
console.log(JSON.stringify(renderReport,null,2));
