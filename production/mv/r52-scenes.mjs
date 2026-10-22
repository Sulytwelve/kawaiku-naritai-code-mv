// R52 uses the actual source PTS and independent horizontal endpoints in ten54px slots.
// Corrected measured colours are retained; the aggregate colour-coverage floor
// mixed the outgoing room into the stripe mask and is intentionally not a geometry curve.
import {lerp,sampleLerp} from './track-smoothing.mjs';
import fs from 'node:fs';import path from 'node:path';import{fileURLToPath}from'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const BAND=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/runtime/core-transitions/r52-horizontal-bands.json'),'utf8'));
export async function drawR52(g,scene,t,api){
 const cfg=scene.r52??{},id=t<BAND.switchPTS?cfg.under:cfg.over;
 const under=api.tracks.scenes.find(s=>s.id===id);
 if(!under)throw Error('Missing R52 underlay '+id);
 await api.drawScene(g,under,t,api);
 const row=sampleLerp(BAND.rows,t,(a,b,u)=>({bands:a.bands.map((p,i)=>p.map((v,j)=>lerp(v,b.bands[i][j],u)))}));
 for(let i=0;i<10;i++){const[x0,x1]=row.bands[i];if(x1<=x0)continue;g.fillStyle=`rgb(${BAND.colors[i].join(',')})`;g.fillRect(x0,i*54,x1-x0,54)}
}

// Original175.817–176.234 cross-dissolve and observed flower cloud, replacing the stand-in.
const CLOUD=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/runtime/core-transitions/seated-burst.json'),'utf8')).rows;
function cloudAt(t){let lo=0,hi=CLOUD.length;while(lo<hi){let m=(lo+hi)>>1;if(CLOUD[m].t<=t)lo=m+1;else hi=m}return CLOUD[Math.max(0,lo-1)]}
export async function drawBurst(g,scene,t,api){
 const cfg=scene.burst??{},before=api.tracks.scenes.find(s=>s.id===cfg.under),after=api.tracks.scenes.find(s=>s.id===cfg.over);
 if(!before||!after)throw Error('Missing seated burst under/over');
 const a=Math.max(0,Math.min(1,(t-175.817)/.417));
 await api.drawScene(g,before,175.775,{qa:api.qa});
 if(a>0){g.save();g.globalAlpha*=a;await api.drawScene(g,after,Math.max(t,176.35),{qa:api.qa});g.restore()}
 if(t>=175.88&&t<176.28)for(const layer of cloudAt(t).layers){g.beginPath();for(const p of layer.contours){p.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath()}g.fillStyle=layer.color;g.fill('evenodd')}
}
