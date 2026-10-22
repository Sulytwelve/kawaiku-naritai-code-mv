// Offline Canvas SNS mock. Fixed fictional posts; every frame is a pure function of time.
import {drawPinkDotsPattern,FRIEND_DENSE_DOT_SCALE} from './pinkdots-canvas.mjs';
export const SNS_POSTS=[
 {id:'selfie',name:'大肥鱼',handle:'deepseek_dafeiyu',text:['换了新发型和浅色开衫，','好像也有一点点不一样了。'],likes:'8,628',reply:'129',comment:'小星光  好可爱，今天也闪闪发光！'},
 {id:'sisters',name:'大肥鱼',handle:'deepseek_dafeiyu',text:['和朋友来看演出啦～','今晚要尽情享受！'],likes:'17.8K',reply:'268',comment:'路过的鲸鱼  今晚一起享受音乐吧！'},
 {id:'study',name:'大肥鱼',handle:'deepseek_dafeiyu',text:['大家一起学习！','考试加油……'],likes:'9,617',reply:'58',comment:'rainy_book  一起努力，考试顺利！'}
];
const txt=(g,s,x,y,size=15,color='#0f1419',bold=false)=>{g.font=`${bold?'bold ':''}${size}px "MV Gothic","Microsoft YaHei",sans-serif`;g.fillStyle=color;g.fillText(s,x,y)};
function cover(g,img,x,y,w,h,r=0){if(!img)return;const s=Math.max(w/img.width,h/img.height);g.save();g.beginPath();g.roundRect(x,y,w,h,r);g.clip();g.drawImage(img,x+(w-img.width*s)/2,y+(h-img.height*s)/2,img.width*s,img.height*s);g.restore()}
function icon(g,kind,x,y){g.save();g.translate(x,y);g.strokeStyle='#536471';g.lineWidth=1.4;g.beginPath();if(kind===0){g.roundRect(0,0,15,12,5);g.moveTo(4,12);g.lineTo(2,16);g.lineTo(9,12)}else if(kind===1){g.moveTo(0,4);g.lineTo(13,4);g.lineTo(10,0);g.moveTo(15,12);g.lineTo(2,12);g.lineTo(5,16)}else if(kind===2){g.moveTo(8,15);g.bezierCurveTo(-7,6,1,-5,8,2);g.bezierCurveTo(16,-5,23,6,8,15)}else{g.moveTo(0,14);g.lineTo(0,9);g.moveTo(6,14);g.lineTo(6,3);g.moveTo(12,14);g.lineTo(12,0)}g.stroke();g.restore()}
export const POST_HEIGHT=592;
export function drawSnsFeed(g,{photos,scroll=0,width=400,height=650,header=true}={}){
 g.save();g.beginPath();g.rect(0,0,width,height);g.clip();g.scale(width/400,width/400);g.fillStyle='#fff';g.fillRect(0,0,400,650);g.save();g.beginPath();g.rect(0,header?57:0,400,650);g.clip();g.translate(0,(header?57:0)-scroll);
 SNS_POSTS.forEach((p,i)=>{const y=i*POST_HEIGHT;cover(g,photos[0],12,y+15,35,35,18);txt(g,p.name,56,y+30,16,'#0f1419',true);txt(g,'@'+p.handle+' · '+(i+1)+'小时',56,y+49,11,'#536471');txt(g,'•••',370,y+28,14,'#536471');p.text.forEach((s,k)=>txt(g,s,56,y+73+k*22,15));cover(g,photos[i],56,y+110,330,330,13);for(let k=0;k<4;k++)icon(g,k,58+k*86,y+454);txt(g,p.reply,79,y+466,11,'#536471');txt(g,'228',165,y+466,11,'#536471');txt(g,p.likes,251,y+466,11,'#536471');txt(g,'12万',337,y+466,11,'#536471');g.fillStyle='#eff3f4';g.fillRect(56,y+484,330,1);txt(g,'回复',56,y+509,12,'#536471');txt(g,p.comment,56,y+534,12);txt(g,'显示更多回复',56,y+561,12,'#1d9bf0');g.fillStyle='#eff3f4';g.fillRect(0,y+POST_HEIGHT-1,400,1)});g.restore();
 if(header){g.fillStyle='rgba(255,255,255,.97)';g.fillRect(0,0,400,57);g.strokeStyle='#0f1419';g.lineWidth=2.5;g.beginPath();g.moveTo(190,7);g.lineTo(207,27);g.moveTo(208,7);g.lineTo(190,27);g.stroke();txt(g,'为你推荐',91,48,13,'#0f1419',true);txt(g,'正在关注',272,48,13,'#536471');g.fillStyle='#1d9bf0';g.fillRect(80,54,76,3);g.fillStyle='#eff3f4';g.fillRect(0,57,400,1)}g.restore();
}
export function drawBow(g,x,y,s=1){g.save();g.translate(x,y);g.scale(s,s);g.fillStyle='#a0dbef';for(const sign of [-1,1]){g.save();g.scale(sign,1);g.beginPath();g.moveTo(0,0);g.bezierCurveTo(32,-40,77,-50,85,-24);g.bezierCurveTo(91,-3,44,17,0,8);g.fill();g.beginPath();g.moveTo(3,3);g.bezierCurveTo(29,27,59,52,102,58);g.lineTo(81,80);g.bezierCurveTo(37,67,8,30,-4,9);g.fill();g.restore()}g.beginPath();g.roundRect(-11,-11,22,28,6);g.fill();g.restore()}
export function drawPinkDots(g,t=116.017,options={}){return drawPinkDotsPattern(g,t,options)}
export function drawDenseFriendPinkDots(g,t=116.017){return drawPinkDots(g,t,{spacingScale:FRIEND_DENSE_DOT_SCALE})}
export function drawSnsBackground(g,t,pink=false){if(pink)return drawPinkDots(g,t);g.fillStyle='#e6c4ef';g.fillRect(0,0,960,540);const drift=(t-116.017)*7;
 for(let x=-200;x<1200;x+=150){g.fillStyle='#f8f0fc';g.fillRect(x-drift%150,0,4,540);g.fillRect(x+10-drift%150,0,3,540);g.fillStyle='#fff';for(let y=0;y<600;y+=28){g.beginPath();g.arc(x+36-drift%150,y,5,0,Math.PI*2);g.fill();g.beginPath();g.arc(x+60-drift%150,y+14,7,0,Math.PI*2);g.fill()}for(let y=-120;y<650;y+=220)drawBow(g,x+95-drift%150,y+((Math.floor(x/150)%2)*105),1.05)}
}
