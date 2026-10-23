// Source-tracked paper figures. Original actors are used solely for numeric registration/masks.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {drawTitleOverlay,drawDessertScroll} from './title-scenes.mjs';
import {sampleFinaleFifo} from './finale-fifo.mjs';
import {createRequire} from 'node:module';
import {drawTealMotifs,drawFloralBackground,setCanvasFactory} from './pattern-backgrounds-canvas.mjs';
const require=createRequire(import.meta.url);
const {loadImage:loadSvgImage}=require('@napi-rs/canvas');
let riceBowlPromise;
async function riceBowl(){return riceBowlPromise??=(async()=>{const svg=fs.readFileSync(path.join(ROOT,'assets/props/dafeiyu-rice-bowl/dafeiyu-rice-bowl-no-logo.svg'));return loadSvgImage('data:image/svg+xml;base64,'+svg.toString('base64'))})()}
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const shadowCache=new Map();
async function shadowSprite(style,color,{asset,createCanvas}){const key=style.asset+color;if(shadowCache.has(key))return shadowCache.get(key);const im=await asset(style.asset),c=createCanvas(im.width,im.height),q=c.getContext('2d');q.drawImage(im,0,0);q.globalCompositeOperation='source-in';q.fillStyle=color;q.fillRect(0,0,c.width,c.height);shadowCache.set(key,c);return c}
let DATA;function data(){return DATA??=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/runtime/fashion/render-data.json'),'utf8'))}
const mix=(a,b,u)=>a+(b-a)*u;
function matrixAt(keys,t){if(!keys.length)return [[1,0,0],[0,1,0]];let j=keys.findIndex(k=>k.t>t);if(j===0)return keys[0].matrix;if(j<0)return keys.at(-1).matrix;const a=keys[j-1],b=keys[j],u=(t-a.t)/(b.t-a.t);return a.matrix.map((r,i)=>r.map((v,k)=>mix(v,b.matrix[i][k],u)))}
function apply(g,m){g.transform(m[0][0],m[1][0],m[0][1],m[1][1],m[0][2],m[1][2])}
const appearance={1:[27.40,27.80],2:[29.03,29.68],3:[31.20,31.95],4:[99.45,99.80],5:[103.65,104.30],6:[107.65,108.30],7:[179.90,180.20],8:[184.25,184.90],9:[188.30,188.95]};
function title(g,alpha){
 if(alpha<=0)return;g.save();g.globalAlpha*=alpha;g.fillStyle='#8b65be';g.textAlign='center';g.font='bold 68px "MV Gothic"';g.fillText('可愛くなりたい',480,234);g.font='bold 38px "MV Gothic"';g.fillText('想要变得可爱',480,285);g.font='19px "MV Gothic"';g.fillText('歌：鎖那（Sana）',748,277);g.textAlign='left';g.font='21px "MV Gothic"';for(const[i,s]of['作詞：shito, Gom','作曲：shito','編曲：HoneyWorks'].entries())g.fillText(s,218,370+i*28);for(const[i,s]of['ギター：Oji','キーボード：cake','動画：モゲラッタ'].entries())g.fillText(s,570,370+i*28);g.restore();
}
export async function drawFashion(g,scene,t,{asset,createCanvas}){
 const d=data(),group=d.groups.find(x=>x.id===scene.fashion.stage);if(!group)throw new Error('Unknown fashion stage');
 if(group.id==='fashion-first')await drawDessertScroll(g,t,{asset,createCanvas});
 else {
  const camKeys=group.camera_repair_scope?group.camera_keys:group.camera_keys.filter(k=>k.inliers>=10&&Math.abs(k.matrix[0][2])<120&&Math.abs(k.matrix[1][2])<120);
  const cam=group.id==='fashion-finale'?[[1,0,0],[0,1,0]]:matrixAt(camKeys,t);g.save();apply(g,cam);
  if(group.id==='fashion-second'){
   setCanvasFactory(createCanvas);
   drawTealMotifs(g,{fishImage:await riceBowl(),createCanvas,cacheSize:{width:3840,height:2160}});
  }else if(group.id==='fashion-third'||group.id==='fashion-finale'){
   const rect=group.background_rect??[0,0,960,540],[x,y,w,h]=rect;
   const variant=group.id==='fashion-third'?'fashionPink':'finale';
   drawFloralBackground(g,{variant,createCanvas,designWidth:w,designHeight:h,
    cacheSize:{width:Math.round(w*4),height:Math.round(h*4)},x,y,w,h});
  }else{
   const bg=await asset(group.background);g.drawImage(bg,...(group.background_rect??[0,0,960,540]));
   if(group.extend_background_edges){const e=group.extend_background_edges,W=bg.width,H=bg.height;g.drawImage(bg,0,0,1,H,-e,0,e,540);g.drawImage(bg,W-1,0,1,H,960,0,e,540);g.drawImage(bg,0,0,W,1,0,-e,960,e);g.drawImage(bg,0,H-1,W,1,0,540,960,e);g.drawImage(bg,0,0,1,1,-e,-e,e,e);g.drawImage(bg,W-1,0,1,1,960,-e,e,e);g.drawImage(bg,0,H-1,1,1,0,540,e,e);g.drawImage(bg,W-1,H-1,1,1,960,540,e,e)}
  }
  g.restore();
 }
 if(group.id==='fashion-first')await drawTitleOverlay(g,t,{asset},Math.max(0,1-(t-27.55)/.9));
 const samples=d.source_samples.filter(r=>r.t>=group.range[0]&&r.t<=group.range[1]);
 const finalePoses=group.id==='fashion-finale'?sampleFinaleFifo(t,d.styles):null;
 for(const style of d.styles){
  const final=!!finalePoses,a=appearance[style.style];
  const rows=final?[]:samples.flatMap(r=>r.figures.filter(f=>f.style===style.style).map(f=>({t:r.t,matrix:f.matrix})));
  if(!final&&!rows.length)continue;
  if(!final&&(t<(a?.[0]??rows[0].t)||t>group.range[1]))continue;
  const m=final?finalePoses.find(p=>p.style===style.style).matrix:matrixAt(rows,t);g.save();apply(g,m);
  if(!final&&a&&t<a[1]){
   const u=Math.max(0,Math.min(1,(t-a[0])/(a[1]-a[0])));
   if([2,3,5,6,8,9].includes(style.style)){g.translate(style.reference_size[0]/2,0);g.scale(Math.max(.001,Math.sin(u*Math.PI/2)),1);g.translate(-style.reference_size[0]/2,0)}
   else g.globalAlpha*=u;
  }
  const [rw,rh]=style.reference_size;
  if(!style.asset){g.fillStyle='#b6bec8';g.fillRect(rw*.25,10,rw*.5,rh-20);g.fillStyle='#17243b';g.font='18px "MV Gothic"';g.fillText(`PENDING F${style.style}`,0,rh/2);g.restore();continue}
  const im=await asset(style.asset),hh=rh*.96,ww=im.width/im.height*hh,x=(rw-ww)/2,y=rh*.99-hh;
  // Native white paper plus the original bottom-right colored drop shadow.
  const color=group.id==='fashion-second'?'#b9bef4':group.id==='fashion-third'?'#b1a8e5':group.id==='fashion-finale'?'#ea9ed3':'#9abde8';const shade=await shadowSprite(style,color,{asset,createCanvas});g.drawImage(shade,x+12,y+14,ww,hh);g.drawImage(im,x,y,ww,hh);g.restore();
 }
}
export function drawTitle(g,t){const progress=Math.max(0,Math.min(1,(t-19.1)/2.3));title(g,progress)}
