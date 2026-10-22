import {drawDenseFriendPinkDots} from './social-mvp-ui.mjs';
import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';import{drawFashion}from'./fashion-scenes.mjs';
import {drawFriendColorTransition,FRIEND_TRANSITION} from './friend-color-transition.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const clamp=u=>Math.max(0,Math.min(1,u));
function polygon(g,p){g.beginPath();p.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath()}
async function talk(g,t,api){drawDenseFriendPinkDots(g,t);g.drawImage(await api.asset('assets/visuals/b-back-edge.png'),0,0,960,540);g.drawImage(await api.asset('assets/visuals/ca-friend-talk.png'),-15,0,960,540)}
async function glance(g,t,api){g.fillStyle='#f0ffa8';g.fillRect(0,0,960,540);g.drawImage(await api.asset('assets/visuals/b-lookback.png'),0,0,960,540)}
async function laugh(g,t,api){drawDenseFriendPinkDots(g,t);g.drawImage(await api.asset('assets/visuals/a-nervous-laugh.png'),35,20,960,540)}
export async function drawFriends(g,scene,t,api){
 if(t<FRIEND_TRANSITION.end){
  if(t<FRIEND_TRANSITION.switch)await drawFashion(g,{fashion:{stage:'fashion-third'}},Math.min(t,195.98),api);
  else await talk(g,t,api);
  drawFriendColorTransition(g,t,api);
 }
 else if(t<201.42)await talk(g,t,api);
 else if(t<201.67){await talk(g,t,api);g.save();g.globalAlpha*=clamp((t-201.42)/.25);await glance(g,t,api);g.restore()}
 else if(t<204.0)await glance(g,t,api);
 else if(t<204.257){await glance(g,t,api);g.save();g.globalAlpha*=clamp((t-204)/.257);await laugh(g,t,api);g.restore()}
 else await laugh(g,t,api);
 if(t>205.34&&!api.skipLegacyDiamond){const u=clamp((t-205.34)/.835),r=u*1350;g.save();g.translate(480,270);g.rotate((1-u)*1.4);g.fillStyle='#b5b2fc';g.fillRect(-r/2,-r/2,r,r);g.restore()}
}
