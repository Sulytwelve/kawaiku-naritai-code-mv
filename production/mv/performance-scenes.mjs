// The four memory cards and the two fixed-body, locally animated prayer close-ups.
import fs from 'node:fs';import path from 'node:path';import{fileURLToPath}from'node:url';
import{drawPhotos}from'./photo-scenes.mjs';
import{drawMemoryPinkDots}from'./pinkdots-canvas.mjs';
import{conditionWindows,conditionBody,sampleLerp,lerp,affineFromQuad}from'./track-smoothing.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const data=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/runtime/performance/performance-data.json'),'utf8'));
const patches=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/runtime/expression-patches/expression-local-patches.json'),'utf8'));
const clamp=u=>Math.max(0,Math.min(1,u));
function polygon(g,p){g.beginPath();p.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath()}
function affine(g,m){g.transform(m[0][0],m[1][0],m[0][1],m[1][1],m[0][2],m[1][2])}

// The card art is authored at 4x the 208x387 source-card size.
const CARD_W=208,CARD_H=387,CARD_SS=4;
const cardSpecs=[
 {asset:'memory-sport-side',color:'#ffc1e1',border:'#5840a5',rect:[0,32,208,416]},
 {asset:'memory-sport-front',color:'#fff5a4',border:'#df709d',rect:[0,50,208,416]},
 {asset:'memory-home-stretch',color:'#a9eff8',border:'#4dadb4',rect:[-13,5,234,351]},
 {asset:'memory-home-roller',color:'#d7ff8e',border:'#9474b7',rect:[0,28,208,416]}
];

// --- temporal conditioning -------------------------------------------------
// performance-data.json holds one tracked sample per 23.81Hz source frame
// while the compositor emits 60Hz. Every track is despiked, lightly smoothed
// and then interpolated; holding the nearest sample instead is what made the
// cards freeze for 2-3 output frames and then jump.
const windowsRows=conditionWindows(data.windows);
const bodyRows=conditionBody(data.body_tracks);

const cards=new Map();
async function card(n,api){
 if(cards.has(n))return cards.get(n);
 const spec=cardSpecs[n],c=api.createCanvas(CARD_W*CARD_SS,CARD_H*CARD_SS),g=c.getContext('2d');
 g.scale(CARD_SS,CARD_SS);g.fillStyle=spec.color;g.fillRect(0,0,208,387);
 if(n===2)g.drawImage(await api.asset('assets/runtime/performance/floor-magazine.png'),127,171,83,67);
 const im=await api.asset(`assets/visuals/${spec.asset}.png`);
 g.drawImage(im,...spec.rect);g.strokeStyle=spec.border;g.lineWidth=2;g.strokeRect(1,1,206,385);
 cards.set(n,c);return c;
}
async function memory(g,t,api){
 drawMemoryPinkDots(g,t);
 const row=sampleLerp(windowsRows,t,(a,b,u)=>({quads:a.quads.map((q,n)=>{
  const z=b.quads[n];
  // A null earlier bracket means the card is not tracked yet: never interpolate
  // across the appearance boundary, or the card pops in two frames early.
  if(!q)return null;
  if(!z)return q;
  return q.map((c,i)=>[lerp(c[0],z[i][0],u),lerp(c[1],z[i][1],u)]);
 })}));
 if(!row)return;
 for(let n=0;n<4;n++){
  const q=row.quads[n];if(!q)continue;
  const im=await card(n,api);
  const m=affineFromQuad(q,CARD_W*CARD_SS,CARD_H*CARD_SS);
  if(!m)continue;
  g.save();affine(g,m);g.drawImage(im,0,0);g.restore();
 }
}
async function localPatch(g,p,api){if(!p?.asset)return;const im=await api.asset(p.asset);g.drawImage(im,...p.source,...p.destination.map((v,i)=>v*(i%2?540/941:960/1672)))}
async function body(g,t,api){
 const first=t<100,rows=bodyRows.filter(r=>first?r.t<100:r.t>100);
 const observed=sampleLerp(rows,t,(a,b,u)=>({
  matrix:a.matrix.map((r,i)=>r.map((v,j)=>lerp(v,b.matrix[i][j],u))),
  mouth:u<0.5?a.mouth:b.mouth
 }));
 let m=observed.matrix.map(r=>[...r]);
 // The tiny initial visible edge cannot be feature-matched. Continue into the first reliable sample.
 if(first&&t<70.979){const u=clamp((t-70.604)/.375);m=[[1.225,0,-24.7+(1-u)*1030],[0,1.225,-63]]}
 if(!first&&t<148.169){const u=clamp((t-147.793)/.376);m=[[1,0,0],[0,1,47+(1-u)*570]]}
 g.save();affine(g,m);g.translate(0,30);g.drawImage(await api.asset('assets/visuals/a-clasped-base.png'),0,0,960,540);
 const mouth=patches.mouths[observed.mouth];await localPatch(g,mouth,api);
 if(!first&&t>=151.43){g.save();g.globalAlpha*=clamp((t-151.43)/.16);await localPatch(g,patches.eyes.open,api);g.restore()}
 g.restore();
}
async function geometry(g,t,api){
 const f='assets/runtime/performance/geometry-vectors.json';let d=geometry.data;if(!d)geometry.data=d=JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
 const r=sampleLerp(d.frames,t,(a,b,u)=>a);
 g.fillStyle=r.base;g.fillRect(0,0,960,540);for(const p of r.polygons){polygon(g,p.points);g.fillStyle=p.color;g.fill()}
}
export async function drawPerformance(g,scene,t,api){
 const first=scene.performance.stage==='first-prayer';
 if(first){
  if(t<71.021){await drawPhotos(g,{photo:{stage:'outgoing'}},t,api);g.save();g.globalAlpha*=clamp((t-70.604)/.417);await geometry(g,t,api);g.restore()}
  else await geometry(g,t,api);
  await body(g,t,api);
 }else{
  await memory(g,Math.min(t,147.75),api);
  if(t>=147.793){if(t>151.43){g.save();g.globalAlpha*=clamp((t-151.43)/.24);drawMemoryPinkDots(g,t);g.restore()}await body(g,t,api)}
 }
}
