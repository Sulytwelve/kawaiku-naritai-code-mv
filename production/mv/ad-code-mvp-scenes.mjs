// Generated advertisement scenes and native Canvas book display; source hand is a separate alpha.
import {magazineCover} from './magazine-scenes.mjs';
import {drawTealDots} from './pattern-backgrounds-canvas.mjs';
import {drawGeneratedAd,GENERATED_AD_QUADS} from './ad-generated-plates.mjs';
export {GENERATED_AD_QUADS};
const C={line:'#9974c3',pink:'#f8cbdc',cream:'#fff6e7',blue:'#9edff2',dark:'#7770aa'};
const clamp=x=>Math.max(0,Math.min(1,x));
function line(g,x,y,xx,yy,c=C.line,w=1){g.strokeStyle=c;g.lineWidth=w;g.beginPath();g.moveTo(x,y);g.lineTo(xx,yy);g.stroke()}
function rect(g,x,y,w,h,fill=C.pink){g.fillStyle=fill;g.fillRect(x,y,w,h);g.strokeStyle=C.line;g.strokeRect(x,y,w,h)}
function label(g,s,x,y,size=12,color=C.line){g.fillStyle=color;g.font=`${size}px "MV Gothic",sans-serif`;g.fillText(s,x,y)}
function book(g,x,y,w,h,rot,fill){g.save();g.translate(x,y);g.rotate(rot);rect(g,-w/2,-h/2,w,h,fill);rect(g,-w/2+8,-h/2+9,w-16,h-18,'#f6d6e6');label(g,'Honey Honey',-w/2+14,-h/2+33,18);for(let i=0;i<4;i++)line(g,-w/2+15,h/2-25-i*12,w/2-17,h/2-25-i*12,'#bba1ca',3);g.restore()}
async function magazine(g,t,api){const u=clamp((t-221.313)/3.086);g.fillStyle='#dfc8ed';g.fillRect(0,0,960,540);g.save();g.translate(480-18*u,270+8*u);g.rotate((-26+1.5*u)*Math.PI/180);g.scale(1.04+.03*u,1.04+.03*u);g.translate(-480,-270);g.fillStyle='#e1c7ec';g.fillRect(-500,-500,1960,1540);g.fillStyle='#fff8fc';for(let y=-500;y<1100;y+=21)for(let x=-500;x<1500;x+=21){g.beginPath();g.arc(x+(y%42?10:0),y,2,0,Math.PI*2);g.fill()}
 book(g,126,172,210,289,-.07,'#f1dce9');book(g,788,88,237,325,.04,'#c8b8e1');book(g,231,622,227,312,.03,'#edcadb');book(g,1059,435,210,289,.04,'#d4bce7');
 const cover=await magazineCover(6,api);g.save();g.translate(616,330);rect(g,-159,-216,318,432,'#ef99bd');g.drawImage(cover,-149,-206,298,412);g.restore();g.restore()}
async function hand(g,t,api){drawTealDots(g,{createCanvas:api.createCanvas,cacheSize:{width:3840,height:2160}});g.drawImage(await api.asset('assets/third-party-derived/ad-code-assets/source-hand-alpha.png'),0,0,960,540)}
async function wipe(g,t,a,b,from,to,api){await drawGeneratedAd(g,from,t,api);const u=clamp((t-a)/(b-a));g.save();g.beginPath();for(let i=0;i<12;i++){const h=540*clamp(u*1.28-(i%3)*.14);g.rect(i*80,0,80.2,h)}g.clip();if(to==='magazine')await magazine(g,t,api);else await drawGeneratedAd(g,to,t,api);g.restore()}
export async function drawAdCodeMvp(g,scene,t,api){const stage=scene.adCode?.stage??scene.social?.stage;
 if(stage==='city-early'){await drawGeneratedAd(g,stage,t,api);const a=clamp((t-98.25)/.65);if(a>0){g.fillStyle='#ffc7ce';for(let i=0;i<10;i++){g.beginPath();g.arc(i*145-200+a*300,650-a*950,155+(i%3)*22,0,Math.PI*2);g.fill()}if(a>.85){g.save();g.globalAlpha=(a-.85)/.15;g.fillStyle='#f7f4e9';g.fillRect(0,0,960,540);g.restore()}}return}
 if(['city','station','hall'].includes(stage))return drawGeneratedAd(g,stage,t,api);
 if(stage==='diamond'){g.fillStyle='#b5b2fc';g.fillRect(0,0,960,540);const r=820*clamp((t-206.175)/.751);g.save();g.beginPath();g.moveTo(480,270-r);g.lineTo(480+r,270);g.lineTo(480,270+r);g.lineTo(480-r,270);g.closePath();g.clip();await drawGeneratedAd(g,'station',t,api);g.restore();return}
 if(stage==='station-to-hall')return wipe(g,t,210.179,210.512,'station','hall',api);
 if(stage==='hall-to-city')return wipe(g,t,214.766,215.141,'hall','city',api);
 if(stage==='city-to-magazine')return wipe(g,t,220.979,221.313,'city','magazine',api);
 if(stage==='magazine')return magazine(g,t,api);if(stage==='hand')return hand(g,t,api);if(stage==='magazine-hand-dissolve'){await magazine(g,t,api);g.save();g.globalAlpha*=clamp((t-223.899)/.5);await hand(g,t,api);g.restore();return}throw Error('Unsupported ad code MVP stage '+stage)}
