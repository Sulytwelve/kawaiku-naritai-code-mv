// Separate A/B source tracks inside the original green/red recollection panels.
import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';
import{conditionRun,contiguousRuns,sampleLerp,lerp}from'./track-smoothing.mjs';
import{drawFloralBackground}from'./pattern-backgrounds-canvas.mjs';
import{drawTrainSeatEntryWorld}from'./train-seat-background-canvas.mjs';
import{trainEntryState}from'./train-entry-camera.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const DATA=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/runtime/interaction/source-tracks.json'),'utf8'));
const PANEL=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/runtime/interaction/panel-registration.json'),'utf8'));
const clamp=u=>Math.max(0,Math.min(1,u));
function poly(g,p){g.beginPath();p.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath()}
function near(rows,t){let lo=0,hi=rows.length;while(lo<hi){let m=(lo+hi)>>1;if(rows[m].t<=t)lo=m+1;else hi=m}return rows[Math.max(0,lo-1)]}

// Person registrations retain their source motion. Panel perimeters below have
// fixed angular correspondence, so screen clipping and changing hull vertex
// counts no longer force source-cadence holds or independent corner jumps.
const PERSON=new Map();
function personRows(id){
 if(!PERSON.has(id)){
  const rows=DATA.rows.flatMap(r=>r.people.filter(q=>q.id===id).map(q=>{const matrix=q.matrix.map(x=>[...x]);matrix[1][2]+=trainEntryState(r.t).cameraY;return{t:r.t,matrix}}));
  for(const[i,j]of contiguousRuns(rows))
   conditionRun(rows,i,j,k=>rows[k].matrix.flat(),(k,v)=>{rows[k].matrix=[v.slice(0,3),v.slice(3,6)]},{smoothPasses:1});
  PERSON.set(id,rows);
 }
 return PERSON.get(id);
}
function apply(g,m){g.transform(m[0][0],m[1][0],m[0][1],m[1][1],m[0][2],m[1][2])}
// A ray-indexed perimeter has a fixed correspondence even when the source hull
// has 3..10 corners or is clipped by the screen. Interpolate these points rather
// than holding each freshly detected polygon for 2–3 output frames.
function perimeter(p,n=128){
 const xs=p.map(x=>x[0]),ys=p.map(x=>x[1]),c=[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2],out=[];
 for(let i=0;i<n;i++){
  const a=i/n*Math.PI*2,dx=Math.cos(a),dy=Math.sin(a);let best=Infinity;
  for(let j=0;j<p.length;j++){
   const u=p[j],v=p[(j+1)%p.length],ex=v[0]-u[0],ey=v[1]-u[1],det=dx*ey-dy*ex;if(Math.abs(det)<1e-8)continue;
   const qx=u[0]-c[0],qy=u[1]-c[1],r=(qx*ey-qy*ex)/det,s=(qx*dy-qy*dx)/det;
   if(r>=0&&s>=-1e-8&&s<=1+1e-8)best=Math.min(best,r);
  }
  out.push([c[0]+dx*best,c[1]+dy*best]);
 }return out;
}
// Existing observed panel/local character animation is converted once into
// world coordinates. One analytic camera then moves all the layers together.
const POLYGONS=[0,1].map(k=>DATA.rows.filter(r=>r.hexagons[k]?.length>=3).map(r=>({t:r.t,points:perimeter(r.hexagons[k].map(([x,y])=>[x,y+trainEntryState(r.t).cameraY]))})));
const RED_ROWS=PANEL.panels[1].rows.filter(r=>r.accepted&&r.score>.9).map(r=>{const matrix=r.matrix.map(x=>[...x]);matrix[1][2]+=trainEntryState(r.t).cameraY;return{...r,matrix}});
function panelAt(k,t){const rows=POLYGONS[k];if(t<rows[0].t||t>rows.at(-1).t)return null;return sampleLerp(rows,t,(a,b,u)=>({points:a.points.map((p,i)=>p.map((v,j)=>lerp(v,b.points[i][j],u)))})).points}
function inset(p,d){
 const area=p.reduce((a,v,i)=>a+v[0]*p[(i+1)%p.length][1]-v[1]*p[(i+1)%p.length][0],0),sign=Math.sign(area);
 return p.map((v,i)=>{const a=p[(i+p.length-1)%p.length],b=p[(i+1)%p.length];let x=v[0]-a[0],y=v[1]-a[1],s=Math.hypot(x,y);const n0=[-y/s*sign,x/s*sign];x=b[0]-v[0];y=b[1]-v[1];s=Math.hypot(x,y);const n1=[-y/s*sign,x/s*sign],nx=n0[0]+n1[0],ny=n0[1]+n1[1],z=Math.max(.05,nx*n1[0]+ny*n1[1]);return[v[0]+d*nx/z,v[1]+d*ny/z]});
}
function polygonPanel(g,p,color,border){g.save();g.translate(6,9);g.filter='blur(3px)';poly(g,p);g.fillStyle='rgba(130,128,82,.16)';g.fill();g.restore();poly(g,p);g.fillStyle=border;g.fill();const inner=inset(p,14);poly(g,inner);g.fillStyle=color;g.fill();return inner}
// Layer assignment and z-order.
//
// The two tracked ids cross once, at about 155.85s:
//   id 0 tx: +215.7 (154.8) -> +7.8 (155.8) -> -37.0 (156.3), i.e. RIGHT to LEFT
//   id 1 tx: -181.7 (154.8) -> -8.7 (155.8) -> +42.5 (156.4), i.e. LEFT to RIGHT
// In the source A enters from the right walking left and Claude walks left to
// right, so id 0 is A and id 1 is Claude. An earlier revision had this inverted,
// which put Claude where A belongs.
//
// Both assets are EXTERNAL: generated with the GPT Web image model, not by the
// Codex/GPT-Image path used for the rest of assets/visuals. They are separate
// layers precisely so the occlusion is controllable.
//
// Placement notes (from review):
//  - A is the female lead and must read as SHORTER than Claude, so her sprite is
//    drawn smaller (304 vs 310 tall) and sits lower in the panel.
//  - The native profile eyes are registered against frame-0012 (155.842s).
//    A's earlier x=300 anchor put her ~180px to the right of her tracked slot.
const PASSING={
 0:{asset:'assets/visuals/a-passing-gptweb.png',x:121,y:176,w:228,h:304},
 1:{asset:'assets/visuals/b-passing-gptweb.png',x:304,y:175,w:233,h:310}
};
async function person(g,id,t,api){
 const spec=PASSING[id];
 if(!spec)return;
 const r=sampleLerp(personRows(id),t,(a,b,u)=>({matrix:a.matrix.map((row,i)=>row.map((v,j)=>lerp(v,b.matrix[i][j],u)))}));
 g.save();apply(g,r.matrix);
 g.drawImage(await api.asset(spec.asset),spec.x,spec.y,spec.w,spec.h);
 g.restore();
}
export async function drawInteraction(g,scene,t,api){
 const row=near(DATA.rows,t);g.fillStyle='#eeffa5';g.fillRect(0,0,960,540);
 const state=trainEntryState(t);g.save();g.translate(0,-state.cameraY);
 drawTrainSeatEntryWorld(g,{t,state});
 // The seated people share the train world's constant origin. No independent
 // entrance offset, visibility switch, or late snap at the scene boundary.
 g.save();g.translate(0,state.trainWorldY);g.drawImage(await api.asset('assets/visuals/pair-calm.png'),-60.48,13.5,1017.6,572.4);g.restore();
 const green=panelAt(0,t);if(green){const inner=polygonPanel(g,green,'#fff596','#95e757');g.save();poly(g,inner);g.clip();g.strokeStyle='rgba(255,255,230,.85)';g.lineWidth=1;for(let x=-700;x<1300;x+=5){g.beginPath();g.moveTo(x,540);g.lineTo(x+540,0);g.stroke()}await person(g,1,t,api);await person(g,0,t,api);g.restore()}
 const red=panelAt(1,t);if(red){const inner=polygonPanel(g,red,'#e99aa9','#ef527f');g.save();poly(g,inner);g.clip();const r=sampleLerp(RED_ROWS,Math.min(t,162.014),(a,b,u)=>({matrix:a.matrix.map((p,i)=>p.map((v,j)=>lerp(v,b.matrix[i][j],u)))}));apply(g,r.matrix);drawFloralBackground(g,{variant:'redPanel',createCanvas:api.createCanvas,cacheSize:{width:3840,height:2160}});g.drawImage(await api.asset('assets/visuals/a-blush-brush.png'),130,135,780,438.75);g.restore()}
 if(row.cloud.length){g.fillStyle='#fff';const cy=trainEntryState(row.t).cameraY;for(const p of row.cloud){poly(g,p.map(([x,y])=>[x,y+cy]));g.fill()}}
 g.restore();
}
