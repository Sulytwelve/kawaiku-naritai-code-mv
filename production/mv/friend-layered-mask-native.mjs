// 03: transparent geometry, shared by the film and the derived browser demo.
// Underlay performers/backgrounds are deliberately outside this module.
import {EndingNative} from './ending-native-helper.mjs';
export const FRIEND_LAYERED_TIMING=Object.freeze({start:195.25,blueStart:195.98,blueFull:196.251,
 greenStart:196.17,greenFull:196.453,yellowStart:196.42,yellowFull:196.63,
 duplicateStart:196.626,duplicateEnd:197.043,purpleStart:196.75,purpleFull:197.21,
 switch:196.4,revealStart:197.21,end:197.669});
export const FRIEND_LAYERED_COLORS=Object.freeze({blue:'#7d84ed',green:'#c7f6a7',yellow:'#fdfda7',purple:'#b69cf7'});
const clamp=x=>Math.max(0,Math.min(1,x));
const outQuad=x=>1-(1-clamp(x))**2;
function logistic(t,a,b,center,k){if(t<=a)return 0;if(t>=b)return 1;const s=x=>1/(1+Math.exp(-k*(x-center)));return(s(t)-s(a))/(s(b)-s(a))}
function gamma3(u){return u<=0?0:1-Math.exp(-u)*(1+u+u*u/2)}
export function friendLayeredState(t){
 const c=FRIEND_LAYERED_TIMING;
 return{blue:outQuad((t-c.blueStart)/(c.blueFull-c.blueStart)),
  green:outQuad((t-c.greenStart)/(c.greenFull-c.greenStart)),
  yellow:outQuad((t-c.yellowStart)/(c.yellowFull-c.yellowStart)),
  duplicate:outQuad((t-c.duplicateStart)/(c.duplicateEnd-c.duplicateStart)),
  purple:logistic(t,c.purpleStart,c.purpleFull,196.918,30),
  opening:logistic(t,c.revealStart,c.end,197.453,35)};
}
function centerBlock(g,progress,color,angle=0){
 if(progress<=0)return;
 const a=angle*Math.PI/180,W=1280,H=720;
 // Normal projection at progress 1 covers every corner, including rotation.
 const full=H*Math.abs(Math.cos(a))+W*Math.abs(Math.sin(a))+4;
 g.save();g.translate(W/2,H/2);g.rotate(a);g.fillStyle=color;
 g.fillRect(-1600,-full*progress/2,3200,full*progress);g.restore();
}
function row(g,index,t,y,h){
 if(h<=0)return;
 const local=t-FRIEND_LAYERED_TIMING.start,entryStart=index===1?0:.09;
 const edge=1280*(1-gamma3(Math.max(0,local-entryStart)/.065));
 if(edge>=1280-.00001)return;
 g.save();g.beginPath();g.rect(edge,y,1280-edge,h+.5);g.clip();
 if(index===1){
  // Paint this row alone. Stretching the whole three-row painter would carry
  // its adjacent row's 0.5px overlap into the duplicated centre boundary.
  // Preserve the measured middle-row columns and gamma3 with unchanged x geometry.
  const C=EndingNative.COLORS;
  g.beginPath();g.rect(Math.max(0,190*Math.exp(-local/.09)),y,1280,h+.5);g.clip();
  g.fillStyle=C.blue;g.fillRect(0,y,1280,h+.5);
  for(const [color,x0,target,tau,delay]of[[C.peach,1166,202,.045,.04],[C.yellow,1400,808,.045,.19],[C.mint,1300,1000,.060,.35]]){
   const x=target+(x0-target)*(1-gamma3(Math.max(0,local-delay)/tau));g.fillStyle=color;g.fillRect(x-.5,y,509,h+.5);
  }
 }else{
  g.translate(0,y);g.scale(1,h/65);g.translate(0,-(260+65*index));EndingNative.drawBars(g,local);
 }
 g.restore();
}
/** Draw ONLY onto a cleared transparent effect surface. Fixed 1280x720 design
 * geometry is scaled directly to any requested output density. */
export function drawFriendLayeredMask(g,t,{width=960,height=540}={}){
 const c=FRIEND_LAYERED_TIMING;if(t<c.start||t>=c.end)return;
 const p=friendLayeredState(t),C=FRIEND_LAYERED_COLORS;
 g.save();g.scale(width/1280,height/720);
 if(t<c.revealStart){
  centerBlock(g,p.blue,C.blue,-2);
  centerBlock(g,p.green,C.green,4.7);
  centerBlock(g,p.yellow,C.yellow);
  const d=p.duplicate,top=260-400*d,bottom=390+405*d;
  row(g,0,t,top,65);
  // The two copies meet at y360 and have identical column/time parameters.
  // Paint their union once: an internal subpixel clip would otherwise tint a
  // seam by drawing the row's base and foreground with fractional coverage.
  // This is the exact same-colour union, with no spacing or added cover strip.
  row(g,1,t,top+65,bottom-(top+65));
  row(g,2,t,bottom,65);
  // Purple is above every strip and every lower expansion.
  centerBlock(g,p.purple,C.purple);
 }else{
  // No lower layers are drawn after the full purple cover. The real alpha hole
  // therefore exposes the pipeline scene, never old strips/blue/green/yellow.
  g.fillStyle=C.purple;g.fillRect(0,0,1280,720);
  g.globalCompositeOperation='destination-out';
  const h=724*p.opening;g.fillRect(-2,360-h/2,1284,h);
 }
 g.restore();
}
