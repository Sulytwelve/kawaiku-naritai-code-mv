// Social source section: all times are original MV PTS, coordinates 960 x 540.
// Source backgrounds/casing/hand remain sampled originals; new photos and UI draw at the caller resolution.
import {drawSearchFeed,drawPerspectivePanel} from './social-ui.mjs';
import fs from 'node:fs';import path from 'node:path';import{fileURLToPath}from'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const CIRCLE=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/runtime/core-transitions/sns-circle-actual-pts.json'),'utf8')).rows;
const source=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/runtime/social-assets/source-layers.json'),'utf8'));
const lerp=(a,b,u)=>a+(b-a)*u;
function value(keys,t){if(t<=keys[0][0])return keys[0].slice(1);for(let i=1;i<keys.length;i++){if(t<=keys[i][0]){const a=keys[i-1],b=keys[i],u=(t-a[0])/(b[0]-a[0]);return a.slice(1).map((v,j)=>lerp(v,b[j+1],u))}}return keys.at(-1).slice(1)}
function nearest(rows,t){let i=0;while(i+1<rows.length&&Math.abs(rows[i+1].t-t)<Math.abs(rows[i].t-t))i++;return rows[i]}
function text(g,s,x,y,size=16,c='#111',bold=false){g.fillStyle=c;g.font=`${bold?'bold ':''}${size}px "MV Gothic", "Microsoft YaHei",sans-serif`;g.fillText(s,x,y)}
function cover(g,img,x,y,w,h){const s=Math.max(w/img.width,h/img.height);g.save();g.beginPath();g.rect(x,y,w,h);g.clip();g.drawImage(img,x+(w-img.width*s)/2,y+(h-img.height*s)/2,img.width*s,img.height*s);g.restore()}
function heart(g,x,y,size=19,filled=false){g.save();g.translate(x,y);g.scale(size/20,size/20);g.beginPath();g.moveTo(10,17);g.bezierCurveTo(-5,7,0,-4,9,3);g.bezierCurveTo(18,-4,27,7,10,17);g.strokeStyle='#353d3b';g.fillStyle='#1f2725';g.lineWidth=1.2;if(filled)g.fill();else g.stroke();g.restore()}
const POSTS={selfie:{likes:'8,628',body:['换了新发型和浅色开衫，','好像也有一点点不一样了。']},sisters:{likes:'17,828',body:['和朋友来看演出啦～','今晚要尽情享受！']},study:{likes:'9,617',body:['大家一起学习！','考试加油……']}};
function drawContent(g,{variant,photo,avatar}){
 const v=POSTS[variant];g.fillStyle='#fff';g.fillRect(0,0,330,650);cover(g,avatar,0,0,43,33);text(g,'deepseek_dafeiyu',60,24,17,'#111',true);cover(g,photo,0,36,330,330);
 heart(g,5,380);g.beginPath();g.arc(49,390,10,0,Math.PI*2);g.lineTo(62,402);g.lineTo(53,399);g.strokeStyle='#353d3b';g.lineWidth=1.2;g.stroke();g.fillStyle='#b9bfbd';g.fillRect(0,408,330,.8);heart(g,4,420,11,true);text(g,'赞  '+v.likes,21,433,17,'#111',true);
 text(g,'deepseek_dafeiyu',0,460,16,'#111',true);v.body.forEach((s,i)=>text(g,s,0,483+i*21));text(g,variant==='study'?'查看全部58条评论':'查看全部评论',0,532,15,'#969b98');text(g,'whale_note  今天也要加油！',0,562,15);text(g,'star_today  好可爱！',0,588,15);text(g,'rainy_book  一起努力吧。',0,614,15);
}
export const SOCIAL_PHOTO_KEYS={
 selfie:[[116.601,77],[117.018,74],[118.019,68],[119.019,61],[119.728,57],[119.770,51],[119.812,32],[119.854,-12],[119.895,-85],[119.937,-178],[119.979,-247],[120.020,-314]],
 sisters:[[119.728,690],[119.770,684],[119.812,665],[119.854,621],[119.895,548],[119.937,455],[119.979,386],[120.020,319],[120.062,267],[120.104,227],[120.145,195],[120.187,169],[120.229,149],[120.312,119],[120.479,92],[120.770,87],[120.979,85],[121.980,76],[122.981,67],[123.982,58],[124.566,52],[124.607,48],[124.649,30],[124.691,-10],[124.733,-74],[124.774,-154],[124.816,-239],[124.858,-302]],
 study:[[124.566,668],[124.607,664],[124.649,646],[124.691,606],[124.733,542],[124.774,462],[124.816,377],[124.858,310],[124.899,254],[124.941,211],[124.983,176],[125.024,148],[125.066,126],[125.108,108],[125.150,95],[125.191,85],[125.233,78],[125.275,72],[125.316,69],[125.483,67],[125.984,65],[126.984,61],[127.985,57],[128.986,53],[129.987,49],[130.988,46],[131.989,42],[132.989,38],[133.490,36]]
};
export async function drawSocial(g,scene,t,{asset,createCanvas}){
 const stage=scene.social.stage;
 if(stage==='posts'){
  const row=nearest(source.sns,t),bg=await asset(row.asset);g.drawImage(bg,0,0,960,540);
  let[x,y,w,h]=value(source.aperture,t);g.save();g.beginPath();g.rect(x,y,w,h);g.clip();
  const vars=t<119.728?['selfie']:t<120.6?['selfie','sisters']:t<124.566?['sisters']:t<125.5?['sisters','study']:['study'];
  const avatar=await asset('assets/visuals/sns-selfie.png');
  for(const variant of vars){const photo=await asset(`assets/visuals/sns-${variant}.png`);g.save();if(t<116.601){const [sc,py]=value([[116.017,.16,250],[116.225,.52,187],[116.267,.654,166],[116.309,.734,155],[116.351,.804,130],[116.392,.843,112],[116.434,.872,105],[116.476,.917,92],[116.517,.947,86],[116.559,.979,80],[116.601,1,77]],t);g.translate(480-165*sc,py-36*sc);g.scale(sc,sc)}else{g.translate(315,value(SOCIAL_PHOTO_KEYS[variant],t)[0]-36)}drawContent(g,{variant,photo,avatar});g.restore()}
  g.restore();if(row.foreground)g.drawImage(await asset(row.foreground),0,0,960,540);
 }else if(stage==='bridge'){
   // Drawn in code, not stitched from source frames: this is a plain geometric
   // transition, and the source frames carry burned-in karaoke lyrics that must not be
   // reproduced (the lyrics ship as the external SRT instead). Same reasoning as the
   // 'reveal' stage below, which is already procedural.
   //
   // Measured off the source at 960x540:
   //   background left [221,225,233], right [158,166,198], split at x=479
   //   disc [211,182,254], ring [97,112,168]
   //   disc R    16,38,82,276,376,434,560 (grows hard from ~133.70)
   //   ring outer 129,133,136 -> collapses to ~24 at 133.69 -> then 47,62,74,100,111,119
   //   ring thick  21,13,6   ->  8,30,37,40,42,39,33
   // The thin-large-outline to small-thick-donut swap happens inside 0.05s in the source,
   // so it is modelled as a fast continuous collapse rather than a jump.
   const lerpRow=(rows)=>{
    if(t<=rows[0][0])return rows[0][1];
    if(t>=rows[rows.length-1][0])return rows[rows.length-1][1];
    for(let k=1;k<rows.length;k++)if(t<=rows[k][0]){
     const [t0,v0]=rows[k-1],[t1,v1]=rows[k];
     return v0+(v1-v0)*(t-t0)/(t1-t0);
    }
    return rows[rows.length-1][1];
   };
   const DISC=CIRCLE.map(r=>[r.t,r.disc]);
   const ROUT=CIRCLE.map(r=>[r.t,r.ringOuter]);
   const RTHK=CIRCLE.map(r=>[r.t,r.ringOuter-r.ringInner]);
   g.save();
   g.fillStyle='rgb(221,225,233)';g.fillRect(0,0,479,540);
   g.fillStyle='rgb(158,166,198)';g.fillRect(479,0,481,540);
   g.fillStyle='rgb(211,182,254)';
   g.beginPath();g.arc(480,270,Math.max(0.5,lerpRow(DISC)),0,Math.PI*2);g.fill();
   const ro=lerpRow(ROUT),th=lerpRow(RTHK);
   g.strokeStyle='rgb(97,112,168)';g.lineWidth=Math.max(1,th);
   g.beginPath();g.arc(480,270,Math.max(1,ro-th/2),0,Math.PI*2);g.stroke();
   g.restore();
 }else if(stage==='angle'||stage==='reveal'){
  const dx=-(t-135.033)*6.67;
  if(stage==='reveal'){
   const r=value([[134.199,1],[134.241,8],[134.282,14],[134.324,22],[134.366,34],[134.407,51],[134.449,73],[134.491,104],[134.532,145],[134.574,195],[134.616,262],[134.658,352],[134.699,473],[134.741,637],[134.783,850]],t)[0];
   g.fillStyle='#d3b6fe';g.fillRect(0,0,960,540);g.save();g.beginPath();g.arc(480,270,r,0,Math.PI*2);g.clip();await drawPink(g,dx,{asset});g.translate(dx,0);await drawAngle(g,{asset,createCanvas});g.restore();
   const[ri,ro]=value([[134.199,93,120],[134.282,104,124],[134.366,115,129],[134.407,118,130],[134.491,125,132],[134.574,132,133],[134.658,134.5,134.5]],t);if(ro-ri>.1){g.strokeStyle='#6170a8';g.lineWidth=ro-ri;g.beginPath();g.arc(480,270,(ri+ro)/2,0,Math.PI*2);g.stroke()}
  }else{await drawPink(g,dx,{asset});g.save();g.translate(dx,0);await drawAngle(g,{asset,createCanvas});g.restore();}
 }else if(stage==='portrait'||stage==='dissolve'){
  g.drawImage(await asset('assets/runtime/social-assets/pink-clean.png'),0,0,960,540);
  const a=stage==='dissolve'?Math.max(0,Math.min(1,(t-138.411)/.5)):1;
  if(a<1){g.save();g.globalAlpha*=1-a;g.translate(-(t-135.033)*6.67,0);await drawAngle(g,{asset,createCanvas});g.restore()}
  const endFade=t>=142.581?Math.max(0,1-(t-142.581)/.417):1;
  g.save();g.globalAlpha*=a*endFade;g.drawImage(await asset('assets/visuals/a-phone.png'),-(t-139.036)*6.67,23,960,540);g.restore();
 }else throw Error('Unknown mv-social stage '+stage);
}
async function drawPink(g,dx,{asset}){const p=await asset('assets/runtime/social-assets/pink-clean.png');for(const x of [dx-960,dx,dx+960])g.drawImage(p,x,0,960,540)}
let panel=null;
async function drawAngle(g,{asset,createCanvas}){
 g.drawImage(await asset('assets/runtime/social-assets/angled-phone-shell-clean.png'),0,0,960,540);
 g.drawImage(await asset('assets/runtime/social-assets/feed-perspective-4k.png'),0,0,960,540);
 g.drawImage(await asset('assets/third-party-derived/social-assets/foreground-thumb.png'),0,0,960,540);
 g.save();g.translate(490,182);g.rotate(-26*Math.PI/180);['今天也在认真记录生活。','浅色开衫，好像很适合她呢。','','照片也只是生活中的一个瞬间，','每个人都在慢慢变得更好。'].forEach((s,i)=>text(g,s,0,i*25,17,'#76b6ca'));g.restore();
}
export const SOCIAL_SOURCE_LAYER_INDEX=source;
