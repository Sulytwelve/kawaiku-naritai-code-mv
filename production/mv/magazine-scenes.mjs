// Rebuilt magazine artwork, source-tracked gallery and the reading / Fight bridge.
import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';
import {drawPlaid,drawFloralBackground,drawTealDots,setCanvasFactory} from './pattern-backgrounds-canvas.mjs';
import {deterministicSmokeMask} from './magazine-smoke-canvas.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');

const DATA=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/runtime/magazine/source-tracks.json'),'utf8'));
const cache=new Map(),clamp=u=>Math.max(0,Math.min(1,u)),lerp=(a,b,u)=>a+(b-a)*u;
const IDs=['magazine-01-kimi','magazine-02-gemini','magazine-03-glm','magazine-04-gpt','magazine-05-qwen'];
function text(g,s,x,y,size,color,font='MV Gothic'){g.fillStyle=color;g.font=`${size}px "${font}"`;g.fillText(s,x,y)}
function poly(g,p){g.beginPath();p.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath()}
function near(rows,t){let lo=0,hi=rows.length;while(lo<hi){let m=(lo+hi)>>1;if(rows[m].t<=t)lo=m+1;else hi=m}return rows[Math.max(0,lo-1)]}
export async function magazineCover(id,{asset,createCanvas}){
 if(cache.has(id))return cache.get(id);setCanvasFactory(createCanvas);const c=createCanvas(1320,1816),g=c.getContext('2d');g.scale(4,4);g.fillStyle='#f8f3ef';g.fillRect(0,0,330,454);
 const clean=`assets/runtime/magazine/cover-background-${id}.png`;
 if(id===1)drawPlaid(g,{designWidth:330,designHeight:454,cacheSize:{width:1320,height:1816},createCanvas});
 else if(id===3)drawFloralBackground(g,{variant:'mint',designWidth:330,designHeight:454,cacheSize:{width:1320,height:1816},createCanvas});
 else if(id===4)drawFloralBackground(g,{variant:'mutedTeal',designWidth:330,designHeight:454,cacheSize:{width:1320,height:1816},createCanvas});
 else if(fs.existsSync(path.join(ROOT,clean)))g.drawImage(await asset(clean),0,0,330,454);
 else{
  // Background drawing is a provisional reconstruction until clean original cover plates arrive.
  const colors=['#ffedee','#fff5f5','#daffe4','#b1e3d2','#e4e2f2','#f8f8fc'];g.fillStyle=colors[id-1];g.fillRect(0,0,330,454);
  g.strokeStyle=id===1?'#f4c2c8':'#d9d0e0';g.lineWidth=id===1?6:.6;
  if(id===1){for(let x=-460;x<800;x+=22){g.beginPath();g.moveTo(x,0);g.lineTo(x+454,454);g.stroke();g.beginPath();g.moveTo(x,0);g.lineTo(x-454,454);g.stroke()}}
  else if(id===3||id===4){for(let y=0;y<454;y+=39)for(let x=0;x<330;x+=39){g.fillStyle=id===3?'#f1adc3':'#87bdac';g.beginPath();for(let a=0;a<6;a++){let q=a*Math.PI/3;g.ellipse(x+Math.cos(q)*5,y+Math.sin(q)*5,5,4,q,0,Math.PI*2)}g.fill();g.fillStyle='#fff2a3';g.beginPath();g.arc(x,y,2.5,0,Math.PI*2);g.fill()}}
  else{for(let y=-100;y<600;y+=13){g.beginPath();g.moveTo(0,y);g.lineTo(330,y+50);g.stroke()}if(id===2||id===6){g.lineWidth=1;for(let x=-400;x<800;x+=45){g.beginPath();g.moveTo(165,180);g.lineTo(x,454);g.stroke()}}}
 }
 const titles=['HoneyHoney','HONEY HONEY','HoneyHoney','HONEY HONEY','HONEY HONEY','HONEY HONEY'];const cols=['#8764ca','#ff5697','#eaa3b9','#fff','#f6cf25','#8b64c0'];
 text(g,titles[id-1],14,52,id===3?34:35,cols[id-1]);text(g,String(id).padStart(2,'0'),14,92,38,id===6?'#ec8db6':'#8c73be');text(g,'¥828',270,78,12,cols[id-1]);
 const mother=await asset(id===6?'assets/visuals/a-cover.png':`assets/visuals/fashion-models/${IDs[id-1]}.png`);
 const hh=447,ww=mother.width/mother.height*hh;g.drawImage(mother,(330-ww)/2,8,ww,hh);
 const a=[['knit girls','今冬のモテニット','#fa4e99',51,365],['Basic style','ベーシックマニュアル','#8b6bbd',34,360],['Spring color','春色で毎日明るく♪','#8e8bb6',42,337],['Girls Style','王道モテ・スタイル','#ffd65a',43,332],['SUMMER BLUE','夏だからこそ着たい♪','#5e80e5',32,355],['Want to be','可愛くなりたい♪','#987bd4',39,357]][id-1];
 text(g,a[0],14,a[4],a[3],a[2]);text(g,a[1],30,a[4]+20,12,a[2]);g.strokeStyle='#8a78b9';g.lineWidth=1.4;g.strokeRect(.7,.7,328.6,452.6);cache.set(id,c);return c;
}
// ---------------------------------------------------------------------------
// Six covers share one strip coordinate. Source observations are consolidated
// before rendering, so a tracker dropout never switches a cover's identity.
const RIGID=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/runtime/magazine/gallery-rigid-fit.json'),'utf8'));
const SMOKE=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/runtime/magazine/smoke-reveal.json'),'utf8'));
function stripAt(t){
 const a=SMOKE.frames,p=near(a,t),i=a.indexOf(p),q=a[Math.min(i+1,a.length-1)];
 const u=q.t>p.t?clamp((t-p.t)/(q.t-p.t)):0;
 return {x:lerp(p.x,q.x,u),mask:p.mask.map((v,j)=>lerp(v,q.mask[j],u))};
}
function rigidAt(t){
 const a=RIGID.keys;
 if(t<=a[0].t)return a[0];if(t>=a.at(-1).t)return a.at(-1);
 let lo=0,hi=a.length;while(lo<hi){let m=(lo+hi)>>1;if(a[m].t<=t)lo=m+1;else hi=m}
 const p=a[lo-1],q=a[lo],u=(t-p.t)/(q.t-p.t);
 return{x:lerp(p.x,q.x,u),y:lerp(p.y,q.y,u),s:lerp(p.s,q.s,u)};
}
const STRIP_REF=74.2;                    // inside the still stretch before the first advance
// The covers all share one template size, so one base matrix serves all six; only
// x varies. Scale and y come from the track row nearest the reference time, where
// cover 1 is tracked.
const STRIP_BASE=(()=>{
  const r=near(DATA.rows,STRIP_REF);
  const q=r.covers.find(c=>c.id===1)??near(DATA.rows,73.6).covers.find(c=>c.id===1);
  const m=q?q.matrix:[[1,0,300],[0,1,60]];
  return{a:m[0][0],b:m[0][1],c:m[1][0],d:m[1][1],ty:m[1][2]};
})();
function gallerySlots(t){
 const strip=stripAt(t),z=t>=RIGID.keys[0].t?rigidAt(t):null;
 const join=clamp((t-85.5)/(RIGID.keys[0].t-85.5));
 // One queue transform is shared by all six covers AND their smoke veils.
 // Slot identity and the source mask clock live in queue-local coordinates:
 // a veil waits at its source progress until its own slot reaches the recorded
 // absolute time, then advances on the same normalized 60-step clock. No mask
 // gets a screen-space anchor or a transform that can drift independently.
 const commonMatrix=z?[z.s,0,0,z.s,z.x,z.y]:[STRIP_BASE.a,STRIP_BASE.c,STRIP_BASE.b,STRIP_BASE.d,lerp(strip.x,RIGID.keys[0].x,join),STRIP_BASE.ty];
 const [a,b,c,d]=commonMatrix,det=a*d-b*c;
 return Array.from({length:6},(_,slot)=>{
  const id=slot+1,localX=strip.x+SMOKE.offsets[slot];
  const boundary=RIGID.keys[0].x+slot*RIGID.pitch*RIGID.keys[0].s;
  const screenOffset=z?slot*RIGID.pitch*z.s:lerp(SMOKE.offsets[slot],boundary-RIGID.keys[0].x,join);
  const localOffset=z?[slot*RIGID.pitch,0]:[d*screenOffset/det,-b*screenOffset/det];
  const x=z?z.x+screenOffset:lerp(localX,boundary,join),scale=z?z.s:STRIP_BASE.a;
  const matrix=[a,b,c,d,commonMatrix[4]+a*localOffset[0]+c*localOffset[1],commonMatrix[5]+b*localOffset[0]+d*localOffset[1]];
  return{id,slot,x,y:matrix[5],scale,matrix,commonMatrix,localOffset,maskIndex:strip.mask[slot],visible:!(x>960||x+330*scale<0)};
 });
}
const localToScreen=([a,b,c,d,e,f],[x,y])=>[a*x+c*y+e,b*x+d*y+f];
export function magazineSmokeDebugAt(t){
 const cover=[[0,0],[330,0],[330,454],[0,454]],smoke=[[-5,-7],[335,-7],[335,461],[-5,461]];
 return gallerySlots(Math.min(t,92.7)).map(slot=>({
  id:slot.id,slot:slot.slot,visible:slot.visible,maskIndex:slot.maskIndex,
  frameIndex:Math.round(slot.maskIndex*60/SMOKE.maskFiles.length),
  coverCenter:localToScreen(slot.matrix,[165,227]),smokeAnchor:localToScreen(slot.matrix,[165,227]),
  coverPolygon:cover.map(p=>localToScreen(slot.matrix,p)),smokePolygon:smoke.map(p=>localToScreen(slot.matrix,p)),
  matrix:slot.matrix,
 }));
}
async function gallery(g,t,api,shrink=1){
 setCanvasFactory(api.createCanvas);
 drawTealDots(g,{createCanvas:api.createCanvas,cacheSize:{width:3840,height:2160}});
 // Only the covers recede; the wallpaper above is drawn at its own scale.
 //
 // Motion blur is a REAL blur here, not stacked semi-transparent copies. An earlier
 // revision composited 5 taps across a scale interval, which reads as ghosting and --
 // because the condition was `shrink<1`, which stays true after the shrink settles at
 // 0.44 -- left the ghosts on screen permanently. That is the artefact the review
 // caught at 86.37/86.54/86.70.
 //
 // The blur is driven by an explicit curve measured from the source's sharpness and
 // is exactly zero once the movement stops, so nothing can linger.
 const blurPx=blurAt(t);
 if(blurPx>0.3)g.filter='blur('+blurPx.toFixed(2)+'px)';
 // Source has exactly six covers. At 74s the left side is empty wallpaper and
 // at 85.5s the right side is empty; modulo tiling introduced spurious covers.
 // During the zoom-out a single shared camera fit positions ALL six together,
 // including its recentering. Source scale continues to settle after 86.35s.
 const placements=gallerySlots(t);
 g.save();g.transform(...placements[0].commonMatrix);
 for(const placement of placements){
  const {id,localOffset,maskIndex:sourceMaskIndex,visible}=placement;
  if(!visible)continue;
  g.save();g.translate(...localOffset);
  g.fillStyle='#a2a3da';g.fillRect(7,9,330,454);g.drawImage(await magazineCover(id,api),0,0,330,454);
  // Keep the source-track mask index as the reveal clock, but replace template
  // bitmaps with a fixed-seed Canvas alpha field. The veil stays in cover-local
  // coordinates; padded edges cover the same small registration bleed as before.
  if(t<RIGID.keys[0].t&&Number.isFinite(sourceMaskIndex)&&sourceMaskIndex<SMOKE.maskFiles.length){
   // Source mask progress is interpolated between source rows, then normalized
   // to a fixed 60-step frame clock so the same pixels render for any seek order.
   const smokeFrame=Math.round(sourceMaskIndex*60/SMOKE.maskFiles.length);
   const smoke=deterministicSmokeMask(smokeFrame,60,api.createCanvas);
   if(smoke)g.drawImage(smoke,-5,-7,340,468);
  }
  g.restore();
 }
 g.restore();
 if(blurPx>0.3)g.filter='none';
}
// When the foreground girl arrives (85.95s) the whole gallery recedes: the covers
// shrink into a row of small magazines behind her.
//
// Measured on the source frame at 86.6s against the normal layout:
//   cover width  ~330 -> ~136   and pitch 405 -> ~190, i.e. one uniform scale of
//   about 0.44 (the two ratios differ a little because the settled row is a
//   re-layout, but a single scale is very close);
//   cover tops   9 -> 157  and bottoms 516 -> 370.
// Scaling about (480, 260) by 0.44 maps those rows to 155 and 373, which matches
// the measurement, so the transform is a plain scale about the frame centre and
// needs no extra translation.
// Cover-layer motion blur, in px. Peak at 86.03s (the source's sharpness bottoms out
// at 4.91 there) and back to zero by 86.40s: the review is explicit that once the
// camera has settled on the protagonist nothing moves and nothing may stay blurred.
// Deliberately weaker than the source. The source is 24fps and needs a heavy blur to
// read as motion; the delivery is 60fps, where the extra temporal resolution already
// carries the motion. Matching the source's blur magnitude here would only cost
// clarity (the previous 9px peak measured SHARPER-loss than the source itself).
// So: a light aid that follows the speed, and is exactly zero once movement stops.
const BLUR_CURVE=[{t:85.80,v:0},{t:85.87,v:3},{t:86.03,v:4.5},{t:86.20,v:3.5},
  {t:86.33,v:1.5},{t:86.40,v:0},{t:92.90,v:0}];
function blurAt(t){
  return sampleLerpTyped(BLUR_CURVE,t);
}
function sampleLerpTyped(rows,t){
  if(t<=rows[0].t)return rows[0].v;
  if(t>=rows[rows.length-1].t)return rows[rows.length-1].v;
  let lo=0,hi=rows.length;
  while(lo<hi){const m=(lo+hi)>>1;if(rows[m].t<=t)lo=m+1;else hi=m}
  const a=rows[Math.max(0,lo-1)],b=rows[Math.min(rows.length-1,lo)];
  return b.t>a.t?a.v+(b.v-a.v)*(t-a.t)/(b.t-a.t):a.v;
}
const SHRINK_FROM=85.85,SHRINK_TO=86.35,SHRINK_MIN=0.44;
function shrinkAt(t){
  if(t<=SHRINK_FROM)return 1;
  if(t>=SHRINK_TO)return SHRINK_MIN;
  return lerp(1,SHRINK_MIN,(t-SHRINK_FROM)/(SHRINK_TO-SHRINK_FROM));
}
export async function drawMagazine(g,scene,t,api){
 await gallery(g,Math.min(t,92.7),api,shrinkAt(t));
 if(t>=85.95&&t<92.9){
  const a=clamp((t-85.95)/.3),p='assets/visuals/a-magazine-daydream.png';g.save();g.globalAlpha*=a;
  // She flies in from the LEFT. Measured on the source: her centroid runs 187px at
  // 86.03s -> 486 at 86.08 -> 622 at 86.20 -> 723 at 86.78, i.e. left to right,
  // arriving by about 86.45s. Previously she was drawn at a fixed x and only faded
  // in, which is why her entry read as a pop rather than a move.
  // Her centroid is already at 187px by 86.03s and at 486 by 86.08, so the move
  // starts about 85.80 and is finished by 86.35 -- an earlier 85.98-86.45 window
  // left her off-screen while the source already had her on frame.
  // Measured lag: her yellow-outfit centroid ran ~70-75px behind the source across
  // the entry (86.03: 393 vs 244, 86.12: 549 vs 479, 86.25: 644 vs 569), so the
  // resting x is nudged right by that amount.
  const inU=clamp((t-85.80)/0.55);
  // Eye registration at 89.1s: replacement pupils ~795px on the 1672px
  // mother map to 476px with x=20,w=960; the source pupil midpoint is ~474px.
  const dx=(1-inU)*(-900);
  // She arrives with heavy motion blur, not a sharp slide: the source frames at
  // 86.03-86.20 are strongly smeared along x. Five weighted taps over a ~20ms
  // shutter, the same construction used for the photo cards and the tv-room exit.
  // Speed falls to zero as she lands, so the blur fades out on its own.
  // Real blur, not stacked copies: speed falls to zero as she lands, so the blur
  // ends with the motion and leaves no ghost.
  const speed=(900/0.55)*(1-inU);
  const smear=Math.min(7,speed*0.005);
  if(fs.existsSync(path.join(ROOT,p))){
   const img=await api.asset(p);
   if(smear>0.3)g.filter='blur('+smear.toFixed(2)+'px)';
   g.drawImage(img,20+dx,27,960,540);
   if(smear>0.3)g.filter='none';
  }
  // Missing new mother is intentionally not replaced by an unrelated home pose.
  g.save();g.fillStyle='#fff9ef';g.strokeStyle='#9192c1';g.lineWidth=1.3;g.beginPath();g.moveTo(590,45);g.bezierCurveTo(577,20,600,0,625,-5);g.bezierCurveTo(630,-35,675,-35,690,-10);g.bezierCurveTo(720,-15,740,0,741,25);g.bezierCurveTo(770,43,765,80,747,92);g.bezierCurveTo(750,117,723,135,698,130);g.bezierCurveTo(680,150,646,145,634,130);g.bezierCurveTo(606,136,589,115,591,93);g.bezierCurveTo(570,80,571,58,590,45);g.closePath();g.fill();g.stroke();g.beginPath();g.ellipse(587,134,10,5,0,0,Math.PI*2);g.ellipse(570,151,4,2,0,0,Math.PI*2);g.fill();g.stroke();if(fs.existsSync(path.join(ROOT,'assets/visuals/b-thought-laugh.png')))g.drawImage(await api.asset('assets/visuals/b-thought-laugh.png'),600,-8,130,130);text(g,'HA',602,72,17,'#eca7b2');text(g,'HA',712,74,17,'#eca7b2');g.restore();
  g.restore();
 }
 if(scene.magazine.stage==='fight'){
  const x=-((t-92.65)*1500)%960;g.fillStyle='#c9e2ff';g.fillRect(0,0,960,540);
  for(let i=-2;i<4;i++){g.fillStyle=i%2?'#e4a4fa':'#a792f4';poly(g,[[x+i*600+180,-100],[x+i*600-220,270],[x+i*600+180,640],[x+i*600+360,640],[x+i*600-40,270],[x+i*600+360,-100]]);g.fill()}
  // Placement derived from the source frame at 93.2s: her content lands ~355px wide
  // with its centre at about (495, 282) in the 960x540 design space. The asset file
  // is square (1254x1254) but its content is 976x1195, so the draw box is square and
  // the content aspect (0.817) is preserved automatically -- do NOT stretch it to a
  // box of a different shape.
  const p='assets/visuals/a-fight-chibi.png';if(fs.existsSync(path.join(ROOT,p)))g.drawImage(await api.asset(p),245,60,456,456);
  g.save();g.translate(534,117);g.rotate(.2);g.strokeStyle='#e9a2d2';g.lineWidth=5;g.font='bold italic 62px "MV Gothic"';g.strokeText('Fight!',0,0);g.fillStyle='#ffd1e9';g.fillText('Fight!',0,0);g.restore();
 }
}
