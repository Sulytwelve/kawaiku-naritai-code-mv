import {drawSnsMvp} from './social-mvp-scenes.mjs';
import {drawAdCodeMvp} from './ad-code-mvp-scenes.mjs';
import {drawColorGridCanvas} from './color-grid-canvas.mjs';
import {drawColorStripes} from './color-stripes-native.mjs';
// Source-coordinate compositor and scene dispatcher for the MV.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {drawPostPhone,drawSearchFeed,drawPerspectivePanel} from './social-ui.mjs';
import {drawFashion} from './fashion-scenes.mjs';
import {drawSocial as drawSocialScene} from './social-scenes.mjs';
import {drawTitle} from './title-scenes.mjs';
import {drawPhotos} from './photo-scenes.mjs';
import {drawPerformance} from './performance-scenes.mjs';
import {drawAds} from './ad-scenes.mjs';
import {drawMagazine} from './magazine-scenes.mjs';
import {drawInteraction} from './interaction-scenes.mjs';
import {drawFriends} from './friend-scenes.mjs';
import {drawOpening} from './opening-scenes.mjs';
import {drawR10} from './r10-scenes.mjs';
import {drawTvEntry} from './tvroom-entry.mjs';
import {drawR52,drawBurst} from './r52-scenes.mjs';
import {drawCoreTransition} from './core-transition-scenes.mjs';
import {drawHome} from './home-scenes.mjs';
import {drawBookshop} from './bookshop-scenes.mjs';
import {drawFriendAdSquare,FRIEND_AD_SQUARE} from './friend-ad-square-transition.mjs';
import {drawTrainSeatBackground} from './train-seat-background-canvas.mjs';
import {registerFontSlot} from './font-slots.mjs';
import {loadAsset} from './load-asset.mjs';
const require=createRequire(import.meta.url);
export const {createCanvas,loadImage,GlobalFonts}=require('@napi-rs/canvas');
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const SOURCE={width:960,height:540,fps:24000/1001,firstPTS:.129,lastFramePTS:252.130,endPTS:252.171};
export const sanaToReference=t=>Math.max(SOURCE.firstPTS,Math.min(SOURCE.lastFramePTS,t-.064));
export const tracks=JSON.parse(fs.readFileSync(path.join(ROOT,'production/mv/tracks.json'),'utf8'));
const windowsFonts=process.platform==='win32'?path.join(process.env.WINDIR||'C:/Windows','Fonts'):null;
// Missing fonts are recorded by font-slots.mjs and warned about once at startup;
// they must never abort coverage or a bounded render.
registerFontSlot({slot:'MV Gothic',family:'MV Gothic',env:'MV_FONT_PATH',defaultPath:windowsFonts?path.join(windowsFonts,'msyh.ttc'):null,defaultSource:'platform-default'});
// SourceDisplay contains Chinese glyphs; Japanese credits intentionally keep MV Gothic fallback.
registerFontSlot({slot:'SourceDisplay',family:'SourceDisplay',env:'MV_SOURCE_FONT_PATH',defaultPath:path.join(ROOT,'assets/fonts/汉仪跳跳体简5.0.ttf'),defaultSource:'repository-default'});
const cache=new Map();
export async function asset(relative){if(!cache.has(relative)){cache.set(relative,loadAsset(path.join(ROOT,relative),relative));if(cache.size>96)cache.delete(cache.keys().next().value)}else{const v=cache.get(relative);cache.delete(relative);cache.set(relative,v)}return await cache.get(relative)}
// A sequence may be inline or a path to a JSON file, so long per-frame mappings
// (transition pack playback) stay out of tracks.json.
const seqCache=new Map();
function sequenceAt(ref){
 if(typeof ref!=='string')return ref;
 if(!seqCache.has(ref))seqCache.set(ref,JSON.parse(fs.readFileSync(path.join(ROOT,ref),'utf8')));
 return seqCache.get(ref);
}
export function sequenceFrame(sequence,t){
 const rows=sequence.frames;if(!rows?.length)throw new Error('Empty source-frame sequence');
 if(sequence.loop){const d=sequence.end-rows[0].t;if(!(d>0))throw new Error('Loop requires explicit end');t=rows[0].t+((t-rows[0].t)%d+d)%d}
 let lo=0,hi=rows.length;while(lo<hi){const mid=(lo+hi)>>>1;if(rows[mid].t<=t)lo=mid+1;else hi=mid}return rows[Math.max(0,lo-1)];
}
const lerp=(a,b,t)=>a+(b-a)*t;
function ease(t,mode){if(mode==='hold')return 0;if(mode==='smooth')return t*t*(3-2*t);return t}
// Keyframe times are source PTS, never rounded output-frame times.
export function at(keys,t,defaults={}){
 if(!keys?.length)return {...defaults};
 if(t<=keys[0].t)return {...defaults,...keys[0]};
 let b=keys.findIndex(k=>k.t>t);if(b<0)return {...defaults,...keys.at(-1)};
 const a=keys[b-1],z=keys[b],u=ease((t-a.t)/(z.t-a.t),z.ease);
 const out={...defaults,...a};for(const k of Object.keys(z))if(typeof z[k]==='number'&&k!=='t')out[k]=lerp(a[k]??defaults[k]??z[k],z[k],u);return out;
}
function polygon(g,points){g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath()}
async function splitImage(relative,side,points){
 const key=relative+'#'+side+JSON.stringify(points);if(cache.has(key))return await cache.get(key);
 const img=await asset(relative),c=createCanvas(img.width,img.height),g=c.getContext('2d');g.drawImage(img,0,0);
 g.globalCompositeOperation=side==='inside'?'destination-in':'destination-out';polygon(g,points);g.fill();cache.set(key,c);return c;
}
export async function drawLayer(g,layer,t){
 if(layer.visible&&!(t>=layer.visible[0]&&t<layer.visible[1]))return;
 const p=at(layer.keys,t,{x:0,y:0,w:960,h:540,alpha:1,rotate:0});
 if(p.alpha<=0)return;
 const relative=layer.sequence?sequenceFrame(layer.sequence,t).asset:layer.asset;
 const img=layer.split?await splitImage(relative,layer.split.side,layer.split.points):await asset(relative);
 g.save();g.globalAlpha*=p.alpha;
 if(layer.clip){polygon(g,layer.clip);g.clip()}
 if(layer.clipEllipse){g.beginPath();g.ellipse(...layer.clipEllipse,0,0,Math.PI*2);g.clip()}
 if(layer.affine)g.transform(...layer.affine);
 g.translate(p.x,p.y);if(p.rotate)g.rotate(p.rotate*Math.PI/180);
 g.drawImage(img,0,0,p.w,p.h);
 // Patch is cropped from a variant onto a fixed body; expression variants never replace the body.
 for(const q of layer.patches??[]){if(t<q.visible[0]||t>=q.visible[1])continue;const patch=await asset(q.asset);g.drawImage(patch,...q.source,...q.destination)}
 g.restore();
}
function maskTransition(g,tr,t){
 const p=at(tr.keys,t,{x:480,y:270,r:0,w:0,h:0,rotate:0});
 if(tr.type==='diamond'){g.translate(p.x,p.y);g.rotate((45+p.rotate)*Math.PI/180);g.beginPath();g.rect(-p.r/2,-p.r/2,p.r,p.r);g.clip();g.rotate(-(45+p.rotate)*Math.PI/180);g.translate(-p.x,-p.y)}
 else if(tr.type==='circle'){g.beginPath();g.arc(p.x,p.y,p.r,0,Math.PI*2);g.clip()}
 else if(tr.type==='rect'){g.beginPath();g.rect(p.x,p.y,p.w,p.h);g.clip()}
 else throw new Error('Unsupported source mask '+tr.type);
}
async function drawSocial(g,scene,t){
 if(scene.social.type==='sns-mvp'){await drawSnsMvp(g,scene,t,{asset,createCanvas});return}
 if(scene.social.type==='mv-ads'){await drawAds(g,scene,t);return}
 if(scene.social.type==='mv-social'){await drawSocialScene(g,scene,t,{asset,createCanvas});return}
 if(scene.social.type==='post'){
  const phone=createCanvas(376,540),q=phone.getContext('2d');
  drawPostPhone(q,{...scene.social,photo:await asset(scene.social.photo),avatar:scene.social.avatar?await asset(scene.social.avatar):null,scrollY:at(scene.social.keys,t,{scrollY:0}).scrollY});g.drawImage(phone,292,0);
 }else if(scene.social.type==='perspective'){
  const panel=createCanvas(400,650),q=panel.getContext('2d');drawSearchFeed(q,{photos:await Promise.all(scene.social.photos.map(asset)),query:scene.social.query});
  let quad=scene.social.quad;
  if(scene.social.quadKeys){const keys=scene.social.quadKeys;let i=keys.findIndex(k=>k.t>t);if(i===0)quad=keys[0].quad;else if(i<0)quad=keys.at(-1).quad;else{const a=keys[i-1],b=keys[i],u=(t-a.t)/(b.t-a.t);quad=a.quad.map((p,j)=>p.map((v,k)=>lerp(v,b.quad[j][k],u)))}}
  drawPerspectivePanel(g,panel,quad);
  if(!scene.social.foregroundThumb)throw new Error('Angled phone requires restored foreground thumb');
  const thumb=await asset(scene.social.foregroundThumb);g.drawImage(thumb,0,0,960,540);
 }
}
export async function drawScene(g,scene,t,{qa=false,skipLegacyDiamond=false,backgroundTime=t}={}){
 if(!scene.ready&&!qa)throw new Error(`Scene ${scene.id} is an internal draft`);
 g.save();const cam=at(scene.camera,t,{x:0,y:0,scale:1,rotate:0});g.translate(cam.x,cam.y);g.scale(cam.scale,cam.scale);g.rotate(cam.rotate*Math.PI/180);
 // Content that a transition pack animation is composited over. The pack frames
 // carry transparency where the outgoing/incoming shot must show through, so the
 // underlying scene has to be drawn first or those areas come out empty.
 for(const u of scene.underlay??[]){
  if(t<u.from||t>=u.to)continue;
  if(u.color){g.fillStyle=u.color;g.fillRect(0,0,960,540);break}
  const under=tracks.scenes.find(s=>s.id===u.scene);
  if(!under)throw new Error(`Scene ${scene.id} underlay references unknown scene ${u.scene}`);
  await drawScene(g,under,t,{qa});
  break;
 }
 if(scene.trainSeatBackground){
  drawTrainSeatBackground(g,{t:backgroundTime,thoughts:scene.trainSeatBackground.thoughts??false});
 }else if(scene.colorStripes){
  const [start,end]=scene.range;
  drawColorStripes(g,(t-start)/(end-start));
 }else if(scene.background||scene.backgroundSequence){const bg=await asset(scene.backgroundSequence?sequenceFrame(sequenceAt(scene.backgroundSequence),t).asset:scene.background);g.drawImage(bg,0,0,960,540)}
 else {g.fillStyle=scene.color??'#fff';g.fillRect(0,0,960,540)}
 if(scene.colorGrid){if(t<36.32){await drawScene(g,tracks.scenes.find(x=>x.id==='fashion-first'),Math.min(t,33.999),{qa});drawColorGridCanvas(g,t)}else await drawScene(g,tracks.scenes.find(x=>x.id==='tv-room'),t,{qa})}
 if(scene.adCode)await drawAdCodeMvp(g,scene,t,{asset,createCanvas});
 if(scene.bookshop)await drawBookshop(g,scene,t,{asset,createCanvas});
 if(scene.home)await drawHome(g,scene,t,{asset,createCanvas,drawScene,tracks,qa});
 if(scene.opening)await drawOpening(g,scene,t,{asset,createCanvas});
 if(scene.r10)await drawR10(g,scene,t,{asset,createCanvas,drawScene,tracks,qa});
 if(scene.coreTransition)await drawCoreTransition(g,scene,t,{asset,createCanvas,drawScene,tracks,qa});
 if(scene.r52)await drawR52(g,scene,t,{asset,createCanvas,drawScene,tracks,qa});
 if(scene.burst)await drawBurst(g,scene,t,{asset,createCanvas,
  drawScene:(cg,cs,ct,options={})=>drawScene(cg,cs,ct,{...options,backgroundTime}),tracks,qa});
 if(scene.fashion)await drawFashion(g,scene,t,{asset,createCanvas});
 if(scene.title)await drawTitle(g,scene,t,{asset,createCanvas});
 if(scene.photo?.type==='mv-photos')await drawPhotos(g,scene,t,{asset,createCanvas});
 if(scene.performance)await drawPerformance(g,scene,t,{asset,createCanvas});
 if(scene.magazine)await drawMagazine(g,scene,t,{asset,createCanvas});
 if(scene.interaction)await drawInteraction(g,scene,t,{asset,createCanvas});
 if(scene.friends)await drawFriends(g,scene,t,{asset,createCanvas,skipLegacyDiamond});
 for(const layer of scene.layers??[])await drawLayer(g,layer,t);
 // The panel entry masks what is already composited (the still plate carries the
 // finished border and captions), so it must run after the layers, not before.
 if(scene.entry)await drawTvEntry(g,scene,t,{asset,createCanvas,drawScene,tracks,qa});
 if(scene.social)await drawSocial(g,scene,t);
 for(const layer of scene.foregroundLayers??[])await drawLayer(g,layer,t);
 g.restore();
}
export async function renderReference(pts,{width=3840,height=2160,qa=false,watermark=qa,canvas=null}={}){
 const c=canvas??createCanvas(width,height),g=c.getContext('2d');if(c.width!==width||c.height!==height)throw Error('Reusable canvas dimensions mismatch');g.resetTransform();g.clearRect(0,0,width,height);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.scale(width/960,height/540);
 const scene=tracks.scenes.find(s=>pts>=s.range[0]&&pts<s.range[1]);
 if(!scene)throw new Error(`No reconstructed scene at source PTS ${pts.toFixed(3)}. Whole-film render is disabled.`);
 if(pts>=FRIEND_AD_SQUARE.start&&pts<FRIEND_AD_SQUARE.end){
  await drawFriendAdSquare(g,pts,{
   drawOutgoing:()=>drawScene(g,tracks.scenes.find(s=>s.id==='friends-glance-laugh'),pts,{qa,skipLegacyDiamond:true}),
   drawIncoming:()=>drawScene(g,tracks.scenes.find(s=>s.id==='ad-station'),pts,{qa}),
  });
 }else await drawScene(g,scene,pts,{qa});
 for(const tr of tracks.transitions??[]){
  if(pts<tr.range[0]||pts>=tr.range[1])continue;
  const incoming=tracks.scenes.find(s=>s.id===tr.incoming);if(!incoming)throw new Error('Missing transition target');
  g.save();if(tr.type==='dissolve')g.globalAlpha=at(tr.keys,pts,{alpha:0}).alpha;else maskTransition(g,tr,pts);
  await drawScene(g,incoming,pts,{qa});g.restore();
  for(const layer of tr.foreground??[])await drawLayer(g,layer,pts);
 }
 if(watermark){g.fillStyle='rgba(10,18,30,.76)';g.fillRect(0,514,960,26);g.fillStyle='#fff';g.font='13px "MV Gothic"';g.fillText(`INTERNAL DRAFT · ${scene.id} · source PTS ${pts.toFixed(3)} · assets/timing not final`,12,532)}
 return c;
}
export function completion(){
 const plan=JSON.parse(fs.readFileSync(path.join(ROOT,'production/mv/plan.json'),'utf8'));
 const ready=tracks.scenes.filter(s=>s.ready);
 return {renderReady:plan.render_ready&&tracks.renderReady,implementedDraftScenes:tracks.scenes.length,certifiedScenes:ready.length,plannedEvents:plan.shots_and_events.length,reason:'All event ranges, source trajectories, layers and replacement subimages must be covered before final render.'};
}
