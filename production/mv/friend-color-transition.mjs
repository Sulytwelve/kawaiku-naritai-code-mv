// Native transparent 03 effect; historical friend-color-bands.json is not read.
import {drawFriendLayeredMask,FRIEND_LAYERED_TIMING} from './friend-layered-mask-native.mjs';
export const FRIEND_TRANSITION={start:FRIEND_LAYERED_TIMING.start,coverFrom:FRIEND_LAYERED_TIMING.blueFull,
 switch:FRIEND_LAYERED_TIMING.switch,coverTo:FRIEND_LAYERED_TIMING.revealStart,end:FRIEND_LAYERED_TIMING.end};
let scratch=null;
export function drawFriendColorTransition(g,t,api){
 const m=g.getTransform(),scale=Math.max(1,Math.min(4,Math.hypot(m.a,m.b)));
 const w=Math.round(960*scale),h=Math.round(540*scale);
 if(!scratch||scratch.width!==w||scratch.height!==h)scratch=api.createCanvas(w,h);
 const q=scratch.getContext('2d');q.resetTransform();q.globalAlpha=1;q.globalCompositeOperation='source-over';q.clearRect(0,0,w,h);
 drawFriendLayeredMask(q,t,{width:w,height:h});g.drawImage(scratch,0,0,960,540);
}
