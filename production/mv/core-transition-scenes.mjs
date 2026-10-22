// R36 native continuous Canvas wipe; R67 retained source-PTS contour wipe.
import {drawR36Overlay,drawR36BluePlate} from './r36-native.mjs';
import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=n=>JSON.parse(fs.readFileSync(path.join(ROOT,`assets/runtime/core-transitions/${n}.json`),'utf8')).rows;
const DATA={r67:read('r67')};
let r36Overlay;
async function nativeR36(g,t,api){
 // Source has a flat blue transition plate behind the transparent slit; the
 // SNS itself enters at116.017 after the full pink hold. This is not demo UI.
 if(t<114.82){const under=api.tracks.scenes.find(s=>s.id==='fashion-second');await api.drawScene(g,under,Math.min(t,114.10),{qa:api.qa})}
 else{g.fillStyle='rgb(133,156,255)';g.fillRect(0,0,960,540)}
 drawR36BluePlate(g,t);
 const m=g.getTransform(),w=Math.max(1,Math.round(960*Math.hypot(m.a,m.b))),h=Math.max(1,Math.round(540*Math.hypot(m.c,m.d)));
 if(!r36Overlay||r36Overlay.width!==w||r36Overlay.height!==h)r36Overlay=api.createCanvas(w,h);
 const q=r36Overlay.getContext('2d');q.resetTransform();q.clearRect(0,0,w,h);q.globalAlpha=1;q.globalCompositeOperation='source-over';q.scale(w/960,h/540);
 drawR36Overlay(g,t,{maskContext:q});
}

const full=rows=>rows.find(r=>r.coverage>.9995)?.t??Infinity;
function sample(rows,t){let lo=0,hi=rows.length;while(lo<hi){let m=(lo+hi)>>1;if(rows[m].t<=t)lo=m+1;else hi=m}return rows[Math.max(0,lo-1)]}
function trace(g,rows){for(const layer of rows.layers){g.beginPath();for(const p of layer.contours){p.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath()}g.fillStyle=layer.color;g.fill('evenodd')}}
export async function drawCoreTransition(g,scene,t,api){
 const kind=scene.coreTransition.stage;
 if(kind==='r36')return nativeR36(g,t,api);
 const rows=DATA[kind],row=sample(rows,t),opaqueAt=full(rows);
 {
  const incoming=t>=opaqueAt;const under=api.tracks.scenes.find(s=>s.id===(incoming?'fashion-finale':'bookshop'));
  await api.drawScene(g,under,incoming?Math.max(232.781,t):Math.min(231.55,t),{qa:api.qa});
 }
 if(t>=rows[0].t)trace(g,row);
}
