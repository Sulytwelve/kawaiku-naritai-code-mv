// Original bookshop reframe: hand -> close framing -> wide framing.
// Each framing moves the registered background, Claude, closed cover and grip
// together. Dissolves composite complete groups at native output resolution.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {drawAds} from './ad-scenes.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const DATA=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/runtime/bookshop/registration.json'),'utf8'));
const clamp=x=>Math.max(0,Math.min(1,x));
const ALPHAS=(()=>{let entry=0,wide=0;return DATA.alphas.map(r=>{
 // Suppress the measured colour/registration noise floor outside each
 // monotone source dissolve. Keep raw measurements in registration.json.
 const e=r.entryAlpha<.01?0:r.entryAlpha>=.97?1:r.entryAlpha;
 const w=r.wideAlpha<=.03?0:r.wideAlpha>=.96?1:r.wideAlpha;
 entry=Math.max(entry,e);wide=Math.max(wide,w);return {...r,entryAlpha:entry,wideAlpha:wide};
})})();
function values(t){
 const rows=ALPHAS;let i=0;while(i+1<rows.length&&rows[i+1].t<=t)i++;
 if(i+1===rows.length)return rows[i];const a=rows[i],b=rows[i+1],u=clamp((t-a.t)/(b.t-a.t));
 return {entryAlpha:a.entryAlpha+(b.entryAlpha-a.entryAlpha)*u,wideAlpha:a.wideAlpha+(b.wideAlpha-a.wideAlpha)*u};
}
function camera(stage,t){const m=DATA[stage+'Matrix'].map(r=>r.slice()),c=DATA.translationCurves?.[stage];if(c)m[0][2]+=c.x0+c.vx*(t-c.t0);return m}
function apply(g,m){g.transform(m[0][0],m[1][0],m[0][1],m[1][1],m[0][2],m[1][2])}
async function framing(g,stage,t,api){
 const bg=await api.asset(DATA.background),body=await api.asset(DATA.body);
 g.save();apply(g,camera(stage,t));
 g.drawImage(bg,0,0,960,540);
 // Original slow pan reaches beyond the source plate by a few pixels. Extend
 // its edge, without scaling the whole background or inventing a new camera.
 g.drawImage(bg,bg.width-1,0,1,bg.height,960,0,12,540);
 g.drawImage(bg,0,0,1,bg.height,-12,0,12,540);
 const[x,y,w,h]=DATA.bodyRect;g.translate(x,y);g.scale(w/body.width,h/body.height);
 g.drawImage(body,0,0);
 g.drawImage(await api.asset(DATA.cover),...(DATA.coverDestination??[0,0,body.width,body.height]));
 g.drawImage(await api.asset(DATA.grip),0,0);
 g.restore();
}
let plate=null;
function scratch(g,api){
 const tr=g.getTransform(),s=Math.max(1,Math.min(4,Math.hypot(tr.a,tr.b))),w=Math.round(960*s),h=Math.round(540*s);
 if(!plate||plate.width!==w||plate.height!==h)plate=api.createCanvas(w,h);
 const q=plate.getContext('2d');q.resetTransform();q.globalAlpha=1;q.globalCompositeOperation='source-over';q.clearRect(0,0,w,h);q.scale(w/960,h/540);return q;
}
export async function drawBookshop(g,scene,t,api){
 const p=values(t),entry=clamp(p.entryAlpha),wide=clamp(p.wideAlpha);
 if(entry<1){
  await drawAds(g,{social:{stage:'hand'}},Math.min(t,227.777));
  if(entry>0){const q=scratch(g,api);await framing(q,'close',t,api);g.save();g.globalAlpha*=entry;g.drawImage(plate,0,0,960,540);g.restore()}
  return;
 }
 if(wide>=1){await framing(g,'wide',t,api);return}
 await framing(g,'close',t,api);
 if(wide>0){const q=scratch(g,api);await framing(q,'wide',t,api);g.save();g.globalAlpha*=wide;g.drawImage(plate,0,0,960,540);g.restore()}
}
