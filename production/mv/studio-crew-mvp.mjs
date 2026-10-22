import {drawStudioEquipmentCanvas} from './studio-equipment-canvas.mjs';
// Source-set equipment is drawn separately from these character layers.
const keys={
 minimax:[[44.58,470,8,245,545],[46.7,310,0,245,545],[47.502,188,28,215,500],[47.85,-50,12,230,530],[48.294,-360,-20,260,570]],
 glm:[[44.58,450,90,520,450],[46.7,420,60,500,450],[47.502,388,56,488,450],[47.95,530,60,510,450],[48.294,690,65,520,450],[48.586,1010,70,530,450]],
 grok:[[46.25,410,35,250,480],[47.502,335,35,285,480],[48.294,332,35,290,480],[48.586,295,35,310,480],[49.003,215,35,325,480],[49.253,85,35,340,480],[49.503,-90,35,350,480],[49.795,-450,35,360,480]]
};
function box(rows,t){if(t<=rows[0][0])return rows[0].slice(1);if(t>=rows.at(-1)[0])return rows.at(-1).slice(1);let i=rows.findIndex(r=>r[0]>t),a=rows[i-1],b=rows[i],u=(t-a[0])/(b[0]-a[0]);return a.slice(1).map((v,j)=>v+(b[j+1]-v)*u)}
async function sprite(g,asset,crop,rect,api){const im=await api.asset(asset);const [x,y,w,h]=rect,hh=h,ww=h*crop[2]/crop[3];g.drawImage(im,...crop,x+(w-ww)/2,y,ww,hh)}
export async function drawStudioCrewMvp(g,t,api){
 if(t<44.582||t>=49.795)return;
 // A is drawn by caller. Before 47.25s draw GLM then MiniMax; afterward reverse them.
 if(t>=46.25){const exit=t>=49.17;await sprite(g,exit?'assets/visuals/grok-hairstylist-exit.png':'assets/visuals/grok-hairstylist-back.png',exit?[267,0,913,941]:[544,0,678,941],box(keys.grok,t),api)}
 const drawGlm=async()=>{if(t<48.586){const r=box(keys.glm,t),hx=r[0]+r[2]*110/1672,hy=r[1]+r[3]*850/941;g.save();g.fillStyle='#c8e4fa';g.strokeStyle='#829ec8';g.lineWidth=1.3;g.beginPath();g.moveTo(hx-360,hy-20);g.lineTo(hx+140,hy+8);g.lineTo(hx+95,hy+74);g.lineTo(hx-240,hy+74);g.closePath();g.fill();g.stroke();g.restore();const im=await api.asset('assets/visuals/glm-reflector-assistant-full.png'),scale=.60*r[2]/488;g.drawImage(im,hx-18*scale,hy-550*scale,im.width*scale,im.height*scale)}};
 const drawMini=async()=>{if(t<48.294)await sprite(g,'assets/visuals/minimax-photographer-back.png',[290,48,710,1151],box(keys.minimax,t),api)};
 if(t<47.25){await drawGlm();await drawMini()}else{await drawMini();await drawGlm()}
 drawStudioEquipmentCanvas(g,t);

}
