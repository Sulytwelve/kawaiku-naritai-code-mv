import {createRequire} from 'node:module';
import path from 'node:path';
import {drawPinkRiceBackground} from './pink-rice-background.mjs';
const require=createRequire(import.meta.url);
const {GlobalFonts}=require('@napi-rs/canvas');
const titleFont=process.env.MV_TITLE_FONT_PATH||(process.platform==='win32'?path.join(process.env.WINDIR||'C:/Windows','Fonts','YuGothM.ttc'):null);
try{if(titleFont)GlobalFonts.registerFromPath(titleFont,'TitleRound')}catch{}
// ---------------------------------------------------------------------------
// Pink dessert artboard: preserve the previously measured infinite scroll.
//
// The 19-34s background is one dessert plate panned very slowly. Measured across
// 19-34s from the original MV with two independent
// methods that agree to under 0.05 px/s:
//   * sub-pixel masked cross-correlation at 2/3/4/6 s baselines, with the search
//     window bounded well below the plate's repeat so it cannot lock onto another
//     copy of the same motif (per-frame SIFT registration did exactly that and
//     produced ~600 px phantom jumps);
//   * the pack's own SIFT registration keys (title-data background_keys over
//     19-27.3s, fashion camera keys over 27.3-34s), fitted independently.
// Result: the CONTENT travels (-14.37, -16.67) px/s in 960x540 space, i.e. toward
// the UPPER-LEFT at 22.0 px/s. The plate is laid down at scale 0.9866.
//
// Rendered as a modular tile: the plate is blitted on a grid whose offset is the
// accumulated displacement wrapped modulo the plate size. The infinite tiling is
// periodic with period (W,H), so wrapping the offset does not move a single pixel
// on screen; the motion stays continuous and monotonic forever.
export async function drawDessertScroll(g,t,ctx){
 await drawPinkRiceBackground(g,t,{createCanvas:ctx.createCanvas});
}
export async function drawTitleOverlay(g,t,{asset},alpha=1){
 if(alpha<=0)return;
 const reveal=Math.max(0,Math.min(1,(t-19.30)/(22.02-19.30)));
 const outro=Math.max(0,Math.min(1,(27.36-t)/(27.36-27.19)));
 g.save();g.globalAlpha*=alpha*outro;
 if(reveal>0&&outro>0){
  const right=94+reveal*770;g.beginPath();g.rect(0,0,right,540);g.clip();
  const title='可愛くなりたい';g.textAlign='center';g.textBaseline='alphabetic';g.font='700 104px "TitleRound"';
  const titleX=480,titleY=226;g.shadowColor='rgba(145,94,165,.22)';g.shadowBlur=8;g.shadowOffsetY=3;
  g.lineJoin='round';g.lineWidth=3;g.strokeStyle='#fffafd';g.strokeText(title,titleX,titleY);g.fillStyle='#7857ad';g.fillText(title,titleX,titleY);
  g.shadowColor='transparent';g.shadowBlur=0;g.shadowOffsetY=0;
  // A small heart accent keeps the playful original title cue without raster fragments.
  const heartX=titleX-g.measureText(title).width/2+g.measureText('可愛く').width+g.measureText('な').width*.52;
  const heartY=titleY-76;g.save();g.translate(heartX,heartY);g.scale(.66,.66);g.rotate(-.08);g.fillStyle='#e57eaa';g.beginPath();g.moveTo(0,7);g.bezierCurveTo(-19,-5,-18,-20,-7,-21);g.bezierCurveTo(0,-22,3,-17,4,-14);g.bezierCurveTo(13,-26,28,-17,22,-6);g.bezierCurveTo(18,1,8,7,0,14);g.closePath();g.fill();g.restore();
  g.textAlign='center';g.font='700 48px "SourceDisplay"';g.lineWidth=2;g.strokeStyle='#fffafd';g.strokeText('想要变得可爱',480,283);g.fillStyle='#7857ad';g.fillText('想要变得可爱',480,283);
  if(t>21){g.textAlign='left';g.font='19px "MV Gothic"';g.fillStyle='#9c6597';g.fillText('歌：鎖那（Sana）',700,277)}
 }
 g.restore();
 const credits=['作詞：shito, Gom','作曲：shito','編曲：HoneyWorks','ギター：Oji','キーボード：cake','動画：モゲラッタ'];
 for(let i=0;i<6;i++){g.save();g.globalAlpha*=alpha*Math.max(0,Math.min(1,(t-23.3)/1.1));g.fillStyle='#9c6597';g.font='23px "MV Gothic"';g.textAlign='left';g.fillText(credits[i],i<3?218:570,370+(i%3)*28);g.restore()}
}
export async function drawTitle(g,scene,t,ctx){
 await drawDessertScroll(g,t,ctx);
 await drawTitleOverlay(g,t,ctx);
}
