// Native4K reconstruction for original source PTS206.175–227.777.
// Private image cache is bounded to three full frames, avoiding whole-sequence native retention.
import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';import{loadAsset}from'./load-asset.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=n=>JSON.parse(fs.readFileSync(path.join(ROOT,'assets/runtime/ad-assets',n),'utf8'));const BASE=read('base-scenes.json'),DIAMOND=read('diamond-radius.json'),MAG=read('magazine-sequence.json');let STRIPS=null,EARLY=null;const cache=new Map();
async function img(rel){if(cache.has(rel)){const v=cache.get(rel);cache.delete(rel);cache.set(rel,v);return v}const im=await loadAsset(path.join(ROOT,rel),rel);cache.set(rel,im);while(cache.size>3)cache.delete(cache.keys().next().value);return im}
function val(keys,t){if(t<=keys[0][0])return keys[0].slice(1);for(let i=1;i<keys.length;i++){if(t<=keys[i][0]){const a=keys[i-1],b=keys[i],u=(t-a[0])/(b[0]-a[0]);return a.slice(1).map((x,j)=>x+(b[j+1]-x)*u)}}return keys.at(-1).slice(1)}
function nearest(rows,t){return rows.reduce((a,b)=>Math.abs(a.t-t)<=Math.abs(b.t-t)?a:b)}
async function base(g,n,t){if(n==='magazine'){const q=nearest(MAG,t);g.drawImage(await img(q.asset),0,0,960,540);g.drawImage(await img('assets/runtime/ad-assets/magazine-projected-4k.png'),q.x,q.y,1024,600);return}g.drawImage(await img(BASE[n].asset),0,0,960,540)}
export async function drawAds(g,scene,t){
 const stage=scene.social.stage;
 if(stage==='city-early'){if(!EARLY)EARLY=read('city-early-sequence.json');const q=nearest(EARLY,t);g.drawImage(await img(q.asset),0,0,960,540);if(t<98.795){g.drawImage(await img('assets/runtime/ad-assets/city-early-adverts-4k.png'),q.x,q.y,960,600);g.drawImage(await img(q.front),0,0,960,540)}}
 else if(stage==='diamond'){g.fillStyle='#b5b2fc';g.fillRect(0,0,960,540);const r=val(DIAMOND,t)[0];g.save();g.beginPath();g.moveTo(480,270-r);g.lineTo(480+r,270);g.lineTo(480,270+r);g.lineTo(480-r,270);g.closePath();g.clip();await base(g,'station',t);g.restore()}
 else if(stage==='strips'){if(!STRIPS)STRIPS=read('strip-frames-4k.json');const candidates=STRIPS.filter(r=>Math.abs(r.t-t)<.07);if(!candidates.length)throw Error('No tracked ad source strip frame at '+t);g.drawImage(await img(nearest(candidates,t).asset),0,0,960,540)}
 else if(stage==='magazine-hand-dissolve'){const a=Math.max(0,Math.min(1,(t-223.899)/.5));await base(g,'magazine',t);g.save();g.globalAlpha*=a;await base(g,'hand',t);g.restore()}
 else if(BASE[stage])await base(g,stage,t);else throw Error('Unknown ad mv stage '+stage);
}
