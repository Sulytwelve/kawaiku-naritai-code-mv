// Only exported screen textures are composited here: no film-time SNS text layout.
import {drawSnsBackground} from './social-mvp-ui.mjs';
import {drawPerspectivePanel} from './social-mvp-project.mjs';
import {drawSocial} from './social-scenes.mjs';
import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';import{createRequire}from'node:module';
const require=createRequire(import.meta.url),{loadImage}=require('@napi-rs/canvas');
const EXPORT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../assets/runtime/social-web-export');let manifest,lastName,lastImage,firstImage,angleLayer;
export const SNS_MVP_RANGE=[116.017,142.998];
const ease=u=>1-(1-Math.min(1,Math.max(0,u)))**3;
async function screen(t){manifest??=JSON.parse(fs.readFileSync(path.join(EXPORT,'timeline.json'),'utf8'));const k=Math.min(manifest.frames.length-1,Math.max(0,Math.floor((t-manifest.start)*60+1e-5))),name=manifest.frames[k];if(lastName!==name){lastName=name;lastImage=await loadImage(path.join(EXPORT,name))}return lastImage}
function poly(g,q,fill){g.fillStyle=fill;g.beginPath();g.moveTo(...q[0]);for(const p of q.slice(1))g.lineTo(...p);g.closePath();g.fill()}
async function bakePhoneGeometry(g,t,{asset,createCanvas}){
 if(!angleLayer){firstImage??=await loadImage(path.join(EXPORT,'screen-phone.png'));const phone=createCanvas(1290,2700),c=phone.getContext('2d');c.scale(3,3);
 c.fillStyle='#9493a5';c.beginPath();c.roundRect(0,0,430,900,58);c.fill();const rim=c.createLinearGradient(0,0,430,900);rim.addColorStop(0,'#e0e0ed');rim.addColorStop(.15,'#9f9ba9');rim.addColorStop(.6,'#32323b');rim.addColorStop(1,'#c0bdcb');c.strokeStyle=rim;c.lineWidth=3;c.stroke();c.fillStyle='#111218';c.beginPath();c.roundRect(4,4,422,892,55);c.fill();c.save();c.beginPath();c.roundRect(11,11,408,878,49);c.clip();c.fillStyle='#fff';c.fillRect(11,11,408,878);c.drawImage(firstImage,11,57,408,856.8);c.fillStyle='#fff';c.fillRect(11,11,408,46);c.font='bold 13px Arial';c.fillStyle='#111';c.fillText('9:41',37,37);c.fillRect(343,29,3,6);c.fillRect(349,26,3,9);c.fillRect(355,23,3,12);c.strokeStyle='#111';c.lineWidth=1;c.strokeRect(383,25,22,10);c.fillRect(385,27,17,6);c.fillRect(406,28,2,4);c.fillStyle='#040405';c.beginPath();c.roundRect(159,21,112,30,16);c.fill();c.fillStyle='#16213b';c.beginPath();c.arc(253,36,5,0,Math.PI*2);c.fill();c.fillStyle='#111';c.beginPath();c.roundRect(145,874,140,5,3);c.fill();c.restore();
 angleLayer=createCanvas(3840,2160);const a=angleLayer.getContext('2d');a.scale(4,4);const q=[[110,132],[415,82],[865,640],[420,691]],d=[-12,10];
 // Project one CLOSED rounded aluminium slab, then sweep it continuously from
 // the rear plane to the front plane. The union is a solid volume, including
 // the top-left rounded end: no background can show through the side wall.
 const rear=createCanvas(860,1800),r=rear.getContext('2d');r.scale(2,2);const metal=r.createLinearGradient(0,0,80,900);metal.addColorStop(0,'#d1c8d6');metal.addColorStop(.12,'#9f93a9');metal.addColorStop(.36,'#6a5d79');metal.addColorStop(.7,'#8e819d');metal.addColorStop(1,'#53475f');r.fillStyle=metal;r.beginPath();r.roundRect(0,0,430,900,58);r.fill();const slab=createCanvas(3840,2160),sg=slab.getContext('2d');sg.scale(4,4);drawPerspectivePanel(sg,rear,q,{columns:14,rows:28});
 a.save();a.shadowColor='rgba(54,30,61,.35)';a.shadowBlur=16;a.shadowOffsetX=12;a.shadowOffsetY=12;a.drawImage(slab,d[0],d[1],960,540);a.restore();
 for(let i=48;i>=0;i--){const z=i/48;a.drawImage(slab,d[0]*z,d[1]*z,960,540)}
 // Continuous side-face shading, clipped to the actual swept opaque volume.
 // This overlay stays in the left wall; front glass is drawn afterwards.
 const left=f=>[q[0][0]+(q[3][0]-q[0][0])*f,q[0][1]+(q[3][1]-q[0][1])*f];
 const wall=[left(.085),left(.96),left(.96).map((v,j)=>v+d[j]),left(.085).map((v,j)=>v+d[j])];const mid=left(.4),wg=a.createLinearGradient(mid[0],mid[1],mid[0]-13.43,mid[1]+7.44);wg.addColorStop(0,'#c3b7cd');wg.addColorStop(.25,'#95859f');wg.addColorStop(.75,'#685875');wg.addColorStop(1,'#40354c');poly(a,wall,wg);
 // All three keys are seated on the same solid side face, halfway through its
 // thickness. Each body is narrower than the wall and follows the rail.
 for(const [u,v]of[[.20,.255],[.315,.39],[.44,.515]]){const point=f=>{const p=left(f);return[p[0]+d[0]*.53,p[1]+d[1]*.53]};a.lineCap='round';a.strokeStyle='#3f344b';a.lineWidth=4.5;a.beginPath();a.moveTo(...point(u));a.lineTo(...point(v));a.stroke();a.strokeStyle='#cbbfd6';a.lineWidth=2;a.stroke()}
 fs.writeFileSync(path.join(EXPORT,'sidewall-once.png'),angleLayer.toBuffer('image/png'));fs.writeFileSync(path.join(EXPORT,'phone-front-base.png'),phone.toBuffer('image/png'));
 drawPerspectivePanel(a,phone,q,{columns:14,rows:28});
 }
 g.save();g.translate(-(t-135.033)*6.67,0);g.drawImage(angleLayer,0,0,960,540);g.drawImage(await asset('assets/third-party-derived/social-assets/foreground-thumb.png'),0,0,960,540);g.restore();
}
export async function preparePhoneHardware(env){const c=env.createCanvas(960,540);await bakePhoneGeometry(c.getContext('2d'),135.033,env)}
let phoneManifest,phoneSidewall,lastPhoneName,lastPhoneImage;
async function drawAngle(g,t,{asset}){
 phoneManifest??=JSON.parse(fs.readFileSync(path.join(EXPORT,'phone-timeline.json'),'utf8'));phoneSidewall??=await loadImage(path.join(EXPORT,'sidewall-once.png'));
 const k=Math.max(0,Math.min(phoneManifest.frames.length-1,Math.floor((t-phoneManifest.start)*60+1e-5))),name=phoneManifest.frames[k];if(lastPhoneName!==name){lastPhoneName=name;lastPhoneImage=await loadImage(path.join(EXPORT,'phone-projected',name))}
 g.save();g.translate(-(t-135.033)*6.67,0);g.drawImage(phoneSidewall,0,0,960,540);g.drawImage(lastPhoneImage,0,0,960,540);g.drawImage(await asset('assets/third-party-derived/social-assets/foreground-thumb.png'),0,0,960,540);g.restore();
}
export async function drawSnsMvp(g,scene,t,env){const{asset}=env,stage=scene.social?.stage??(t<133.49?'posts':t<134.199?'bridge':t<134.824?'reveal':t<138.411?'angle':t<138.911?'dissolve':'portrait');
 if(stage==='posts'){drawSnsBackground(g,t);const sc=.18+.82*ease((t-116.017)/.584);g.save();g.translate(480,270);g.scale(sc,sc);g.translate(-188,-270);g.save();g.shadowColor='rgba(54,44,86,.32)';g.shadowBlur=12;g.shadowOffsetX=12;g.shadowOffsetY=10;g.fillStyle='#fff';g.fillRect(0,0,376,539.56);g.restore();g.beginPath();g.rect(0,0,376,539.56);g.clip();g.drawImage(await screen(t),0,0,376,539.56);g.restore();return}
 if(stage==='bridge')return drawSocial(g,{social:{stage:'bridge'}},t,env);
 drawSnsBackground(g,t,true);if(stage==='reveal'){g.fillStyle='#d3b6fe';g.fillRect(0,0,960,540);g.save();g.beginPath();g.arc(480,270,4+1050*ease((t-134.199)/.625)**2,0,Math.PI*2);g.clip();drawSnsBackground(g,t,true);await drawAngle(g,t,env);g.restore();return}
 if(stage==='angle')return drawAngle(g,t,env);
 const a=stage==='dissolve'?Math.min(1,Math.max(0,(t-138.411)/.5)):1;if(a<1){g.save();g.globalAlpha*=1-a;await drawAngle(g,t,env);g.restore()}g.save();g.globalAlpha*=a*(t<142.581?1:Math.max(0,1-(t-142.581)/.417));g.drawImage(await asset(scene.social?.portraitAsset??'assets/visuals/a-phone-iphone17.png'),-(t-139.036)*6.67,23,960,540);g.restore();
}
