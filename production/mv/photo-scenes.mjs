// Five original-photo slots -> held Claude photograph. Source PTS, 960x540 drawing coordinates.
// Every new image is drawn from its full-resolution mother image into the caller's 4K context.
import fs from 'node:fs';import path from 'node:path';import{fileURLToPath}from'node:url';
import {drawPhotoRoom,drawBraidedPhotoCord} from './photo-room-canvas.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const DATA=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/runtime/photo-assets/layer-index.json'),'utf8'));
const lerp=(a,b,u)=>a+(b-a)*u,clamp=x=>Math.max(0,Math.min(1,x));
function value(keys,t){if(t<=keys[0][0])return keys[0].slice(1);for(let i=1;i<keys.length;i++){if(t<=keys[i][0]){const a=keys[i-1],b=keys[i],u=(t-a[0])/(b[0]-a[0]);return a.slice(1).map((v,j)=>lerp(v,b[j+1],u))}}return keys.at(-1).slice(1)}
function rawMatrix(i,t){const keys=DATA.tracks[i-1].keys;if(t<=keys[0].t)return [...keys[0].m];if(t>=keys.at(-1).t)return [...keys.at(-1).m];let hi=keys.findIndex(k=>k.t>t);const a=keys[hi-1],b=keys[hi],u=(t-a.t)/(b.t-a.t);return a.m.map((v,j)=>lerp(v,b.m[j],u))}
function multiply(a,b){return[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]]}
function inverse(a){const z=a[0]*a[3]-a[1]*a[2];return[a[3]/z,-a[1]/z,-a[2]/z,a[0]/z,(a[2]*a[5]-a[3]*a[4])/z,(a[1]*a[4]-a[0]*a[5])/z]}
const BEFORE_ANCHOR={3:55.508,4:58.01,5:61.013},AFTER_ANCHOR={1:55.508,2:58.01,3:61.013,4:64.015};
function matrix(i,t){const keys=DATA.tracks[i-1].keys;
 // Invisible/offscreen photos have no SIFT evidence. Their common paper-strip motion is
 // recovered from the adjacent visible photo, never held frozen at the last partial match.
 if(t<keys[0].t&&i>=3){const q=i-1,a=BEFORE_ANCHOR[i],relative=multiply(inverse(rawMatrix(q,a)),rawMatrix(i,a));return multiply(matrix(q,t),relative)}
 if(t>keys.at(-1).t&&i<5){const q=i+1,a=AFTER_ANCHOR[i],relative=multiply(inverse(rawMatrix(q,a)),rawMatrix(i,a));return multiply(matrix(q,t),relative)}
 return rawMatrix(i,t);
}
function polygon(g,q){g.beginPath();q.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath()}

// ---------------------------------------------------------------------------
// Photo strip = a fixed viewport over ONE continuous sequence.
//
// The cards hang on a single rope that is pulled left, so the only correct model
// is a constant pitch plus one shared displacement:
//
//     left(k, t) = X0 + (k-1)*PITCH - (cum(t) - cum(REF))
//
// Every card's own SIFT track was being used for x before, and those tracks
// desynchronise (at 57.4s cards 3,4,5 read about -700px/s while 1,2 read 0). That
// is exactly the "1, 2, gap, 3 -> then 2, 3, 4" re-ordering the review reported:
// a gap opens mid-sequence and the strip looks like it is swapping cards rather
// than sliding. Per-card x is therefore discarded; only y, scale and rotation are
// still taken from the tracks.
//
// The pitch was not uniform in the tracked rest poses either (gaps 387.4, 386.0,
// 404.0, 398.0), so the grid is regularised here on purpose.
const SLIDE=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/runtime/photo-assets/slide-curve.json'),'utf8'));
const SLIDE_REF=56.0;      // inside a stretch where the strip is still
const PITCH=393.875;       // mean spacing of the tracked rest poses at SLIDE_REF
let cardBase=null;
function cumAt(t){
  const f=SLIDE.frames;
  if(t<=f[0].t)return f[0].cum;
  if(t>=f[f.length-1].t)return f[f.length-1].cum;
  let lo=0,hi=f.length;
  while(lo<hi){const m=(lo+hi)>>1;if(f[m].t<=t)lo=m+1;else hi=m}
  const a=f[Math.max(0,lo-1)],b=f[Math.min(f.length-1,lo)];
  return b.t>a.t?a.cum+(b.cum-a.cum)*(t-a.t)/(b.t-a.t):a.cum;
}
// Per-card x offset that lands its left edge on the uniform grid at SLIDE_REF,
// computed once, lazily, because OUTER is declared further down the file.
function cardBaseBuild(){
  const lefts=[1,2,3,4,5].map(id=>{
    const m=matrix(id,SLIDE_REF),o=DATA.templates[id-1].origin;
    const xs=OUTER[id-1].map(([x,y])=>[x-o[0],y-o[1]]).map(([x,y])=>m[0]*x+m[2]*y+m[4]);
    return Math.min(...xs);
  });
  const mean=lefts.reduce((a,b)=>a+b,0)/lefts.length;
  const X0=mean-2*PITCH;                 // card 3 sits on the mean
  return [1,2,3,4,5].map((id,k)=>{
    const m=matrix(id,SLIDE_REF);
    return m[4]+((X0+k*PITCH)-lefts[k]); // offset that reaches the grid position
  });
}
// y, scale, rotation and shear stay tracked; only x comes from the strip.
function stripMatrix(id,t){
  if(!cardBase)cardBase=cardBaseBuild();
  const m=matrix(id,t);
  m[4]=cardBase[id-1]-(cumAt(t)-cumAt(SLIDE_REF));
  return m;
}
function label(g,s,x,y,size,color,outline=null){g.font=`${size}px "MV Gothic", "Microsoft YaHei",sans-serif`;g.lineJoin='round';if(outline){g.strokeStyle=outline;g.lineWidth=2.8;g.strokeText(s,x,y)}g.fillStyle=color;g.fillText(s,x,y)}
function bubble(g,x,y,rx,ry,lines,c='#7283d8',font=18){g.save();g.strokeStyle=c;g.lineWidth=1.4;g.fillStyle='rgba(255,255,250,.87)';g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();g.stroke();g.textAlign='center';lines.forEach((s,i)=>label(g,s,x,y-(lines.length-1)*(font+3)/2+font*.35+i*(font+3),font,c));g.restore()}
function doodles(g,id){
 if(id===1){g.save();g.strokeStyle='#fff';g.lineWidth=2.4;g.beginPath();g.ellipse(60,112,36,90,.04,0,Math.PI*2);g.stroke();g.textAlign='center';['遥','控','器'].forEach((s,i)=>label(g,s,60,70+i*36,25,'#fff'));g.restore()}
 else if(id===2){bubble(g,49,43,42,38,['今天也','一起吃！'],'#6a89d8',15);bubble(g,265,43,42,38,['只和你','说哦～'],'#6a89d8',15);g.save();g.textAlign='center';label(g,'谢谢款待',84,305,23,'#fff','#f4a5d3');label(g,'面包',234,305,23,'#fff','#f4a5d3');g.beginPath();g.moveTo(277,303);g.bezierCurveTo(261,294,269,283,277,291);g.bezierCurveTo(285,283,293,294,277,303);g.strokeStyle='#f4a5d3';g.lineWidth=5;g.stroke();g.strokeStyle='#fff';g.lineWidth=2;g.stroke();g.restore()}
 else if(id===3){label(g,'欸～～！？',10,32,26,'#fff','#e7a5d5');label(g,'不会吧──',28,311,24,'#fff');label(g,'！？',277,103,25,'#fff','#68bbdb')}
 else if(id===4){bubble(g,125,68,65,56,['明明记得','不是这样','说好的呢！'],'#e0a2a0',17);bubble(g,265,69,47,63,['有时候','就是会','这样嘛。'],'#748bdd',17);bubble(g,43,247,40,66,['才','不','是！'],'#718add',23);label(g,'最差劲～',160,298,26,'#65a362','#fff')}
 else if(id===5){label(g,'王子大人',12,42,25,'#fff','#e5a0a4');g.save();g.strokeStyle='#fff';g.lineWidth=1.8;g.beginPath();g.ellipse(251,72,45,29,0,0,Math.PI*2);g.stroke();label(g,'早安～',217,80,21,'#fff');g.restore()}
}
const OUTER=[[[295,84],[658,89],[650,516],[286,505]],[[275,84],[637,79],[643,507],[284,509]],[[297,78],[661,84],[652,514],[289,510]],[[310,83],[674,84],[674,512],[305,511]],[[316,83],[672,80],[666,508],[314,505]]];
const PEG=[[[471,10],[493,10],[489,143],[467,141]],[[442,9],[463,7],[482,140],[460,143]],[[481,0],[502,6],[469,136],[448,131]],[[475,8],[495,3],[530,139],[509,145]],[[487,16],[510,16],[510,145],[487,145]]];
const CAPTIONS=[['↓ 懒得动，遥控器好远 ↓','#db8d96'],['两个人，偷偷聊了很多','#b28ade'],['有些事，还是不想被发现','#83b982'],['像平常一样，也会拌嘴','#d99185'],['烦恼少女，找到了她的王子','#718096']];
function peg(g,id,alpha){if(alpha<=0)return;const o=DATA.templates[id-1].origin,q=PEG[id-1].map(([x,y])=>[x-o[0],y-o[1]]);g.save();g.globalAlpha*=alpha;polygon(g,q);g.fillStyle='rgba(255,239,190,.94)';g.shadowColor='rgba(107,73,89,.15)';g.shadowBlur=1.4;g.shadowOffsetY=1;g.fill();g.shadowColor='transparent';g.lineWidth=.65;g.strokeStyle='#c1a785';g.stroke();g.save();polygon(g,q);g.clip();const a=q[0],b=q[1],c=q[2],d=q[3];for(let u=.15;u<1;u+=.18){g.beginPath();g.moveTo(lerp(a[0],b[0],u),lerp(a[1],b[1],u));g.lineTo(lerp(d[0],c[0],u),lerp(d[1],c[1],u));g.strokeStyle='rgba(255,255,245,.25)';g.lineWidth=.4;g.stroke()}g.restore();g.restore()}
async function photo(g,id,t,alpha,{asset},offset=0){
 if(alpha<=0)return;const spec=DATA.templates[id-1],m=stripMatrix(id,t);m[4]+=offset;
 const [ox,oy]=spec.origin,outer=OUTER[id-1].map(([x,y])=>[x-ox,y-oy]);
 // Reject offscreen cards without fetching an image or allocating a canvas.
 const xs=outer.map(([x,y])=>m[0]*x+m[2]*y+m[4]);if(Math.max(...xs)<-40||Math.min(...xs)>1000)return;
 g.save();g.globalAlpha*=alpha;g.transform(...m);polygon(g,outer);g.fillStyle='#f6f3df';g.fill();g.strokeStyle='#a4a09b';g.lineWidth=1.25;g.stroke();
 g.save();polygon(g,spec.inner);g.clip();const img=await asset(spec.asset),[ix,iy,iw,ih]=spec.image_rect,scale=Math.max(iw/img.width,ih/img.height);g.drawImage(img,ix+(iw-img.width*scale)/2,iy+(ih-img.height*scale)/2,img.width*scale,img.height*scale);if(id!==5||t<66.9)doodles(g,id);g.restore();
 polygon(g,spec.inner);g.strokeStyle='#a2a19a';g.lineWidth=1;g.stroke();
 const[c,co]=CAPTIONS[id-1],xmin=Math.min(...outer.map(p=>p[0])),xmax=Math.max(...outer.map(p=>p[0])),bottom=Math.max(...outer.map(p=>p[1]));g.save();g.textAlign='center';let size=20;while(size>14){g.font=`${size}px "MV Gothic", "Microsoft YaHei",sans-serif`;if(g.measureText(c).width<xmax-xmin-28)break;size-=.5}label(g,c,(xmin+xmax)/2,bottom-24,size,co);g.restore();peg(g,id,id<5?1:1-clamp((t-66.6)/.35));g.restore();
}
let motionSample=null,motionSum=null;
async function motionPhoto(g,id,t,a,api){
 const W=g.canvas.width,H=g.canvas.height;
 if(!motionSample||motionSample.width!==W||motionSample.height!==H){motionSample=api.createCanvas(W,H);motionSum=api.createCanvas(W,H)}
 const q=motionSample.getContext('2d'),z=motionSum.getContext('2d');z.setTransform(1,0,0,1,0,0);z.clearRect(0,0,W,H);z.globalCompositeOperation='lighter';
 // Average premultiplied samples additively. Successive source-over alpha trails would
 // incorrectly make moving cream frames translucent, even where all samples overlap.
 for(const[u,w]of[[-.017,.16],[-.008,.22],[0,.45],[.008,.17]]){
  q.setTransform(1,0,0,1,0,0);q.clearRect(0,0,W,H);q.setTransform(W/960,0,0,H/540,0,0);await photo(q,id,t+u,1,api);z.globalAlpha=w;z.drawImage(motionSample,0,0);
 }
 z.globalAlpha=1;g.save();g.globalAlpha*=a;g.drawImage(motionSum,0,0,960,540);g.restore();
}
async function chain(g,t,api){
 const fade=1-clamp((t-65.85)/.98);
 drawBraidedPhotoCord(g,{y:67,shift:cumAt(t)-cumAt(SLIDE_REF),alpha:fade});
 for(let id=1;id<=5;id++){
  const a=id<5?fade:1-clamp((t-67.03)/.61);if(a<=0)continue;
  // Native repeated sub-frame positions reproduce the rapid source slide's directional smear.
  const m1=stripMatrix(id,t-.014),m2=stripMatrix(id,t+.014),velocity=(m2[4]-m1[4])/.028;
  if(Math.abs(velocity)>800&&t<63)await motionPhoto(g,id,t,a,api);
  else await photo(g,id,t,a,api);
 }
}
export async function drawPhotos(g,scene,t,{asset,createCanvas}){
 drawPhotoRoom(g,{createCanvas});
 if(t<67.65)await chain(g,t,{asset,createCanvas});
 if(t>=67.018){const a=clamp((t-67.018)/.584),end=scene.photo.stage==='outgoing'?1-clamp((t-70.604)/.417):1;g.save();g.globalAlpha*=a*end;g.drawImage(await asset('assets/visuals/photo-chain/photo-06-a-holding-claude.png'),-(t-68.019)*6.67,0,960,540);g.restore()}
}
export const PHOTO_SOURCE_LAYER_INDEX=DATA;
