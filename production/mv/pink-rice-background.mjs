const TILE_W=960,TILE_H=540;
const cache=new Map();

function roundRect(g,x,y,w,h,r){g.beginPath();g.roundRect(x,y,w,h,r)}
function stroked(g,color='#d99caf',width=2){g.strokeStyle=color;g.lineWidth=width;g.lineJoin='round';g.lineCap='round';g.stroke()}
function filled(g,color){g.fillStyle=color;g.fill()}
function drawMacaron(g,x,y,s,body,cream='#fff4df',tilt=0){
 g.save();g.translate(x,y);g.rotate(tilt);
 g.fillStyle='rgba(161,91,119,.12)';g.beginPath();g.ellipse(1,14*s,33*s,11*s,0,0,Math.PI*2);g.fill();
 g.beginPath();g.ellipse(0,7*s,31*s,14*s,0,0,Math.PI*2);g.fillStyle=cream;g.fill();stroked(g,'#d9a8ad',1.4*s);
 g.beginPath();g.ellipse(0,-1*s,32*s,14*s,0,0,Math.PI*2);g.fillStyle=body;g.fill();stroked(g,'#d58fa5',1.5*s);
 g.beginPath();g.ellipse(0,-5*s,24*s,6*s,0,Math.PI,Math.PI*2);g.fillStyle='rgba(255,255,255,.35)';g.fill();
 g.restore();
}
function drawJelly(g,x,y,s,color,angle=0){
 g.save();g.translate(x,y);g.rotate(angle);g.beginPath();g.ellipse(0,0,19*s,12*s,0,0,Math.PI*2);g.fillStyle=color;g.fill();stroked(g,'rgba(191,111,142,.58)',1.4*s);
 g.beginPath();g.ellipse(-5*s,-4*s,5*s,2.2*s,-.4,0,Math.PI*2);g.fillStyle='rgba(255,255,255,.56)';g.fill();g.restore();
}
function drawCupcake(g,x,y,s,icing='#f6abc2',cup='#fff0d5'){
 g.save();g.translate(x,y);g.scale(s,s);
 g.beginPath();g.moveTo(-34,3);g.lineTo(30,3);g.lineTo(23,48);g.quadraticCurveTo(0,57,-26,48);g.closePath();g.fillStyle=cup;g.fill();stroked(g,'#dca4ad',2);
 for(let xx=-20;xx<=18;xx+=13){g.beginPath();g.moveTo(xx,8);g.lineTo(xx*.78,47);g.strokeStyle='rgba(213,157,164,.55)';g.lineWidth=1.5;g.stroke()}
 g.beginPath();g.moveTo(-35,7);g.bezierCurveTo(-48,-1,-30,-9,-28,-17);g.bezierCurveTo(-24,-34,-4,-30,0,-22);g.bezierCurveTo(8,-43,34,-31,28,-14);g.bezierCurveTo(48,-3,34,8,27,8);g.closePath();g.fillStyle=icing;g.fill();stroked(g,'#d98fa9',2);
 g.beginPath();g.ellipse(0,-21,5,3,0,0,Math.PI*2);g.fillStyle='#ffe99b';g.fill();
 g.restore();
}
function drawCakeSlice(g,x,y,s){
 g.save();g.translate(x,y);g.scale(s,s);
 g.beginPath();g.moveTo(-47,1);g.lineTo(30,-19);g.lineTo(30,30);g.lineTo(-47,49);g.closePath();g.fillStyle='#f5c4a8';g.fill();stroked(g,'#d995a4',2);
 g.beginPath();g.moveTo(-47,1);g.lineTo(30,-19);g.lineTo(49,-2);g.lineTo(-28,20);g.closePath();g.fillStyle='#fff2d9';g.fill();stroked(g,'#d995a4',2);
 g.beginPath();g.moveTo(-28,20);g.lineTo(49,-2);g.lineTo(49,16);g.lineTo(-28,39);g.closePath();g.fillStyle='#f6a9c1';g.fill();stroked(g,'#d995a4',1.5);
 g.beginPath();g.ellipse(37,-8,6,8,.3,0,Math.PI*2);g.fillStyle='#e96c88';g.fill();stroked(g,'#cf718a',1.2);
 g.restore();
}
function drawTart(g,x,y,s){
 g.save();g.translate(x,y);g.scale(s,s);
 g.beginPath();g.ellipse(0,16,40,16,0,0,Math.PI*2);g.fillStyle='#e6b17e';g.fill();stroked(g,'#ce8e7e',1.5);
 g.beginPath();g.ellipse(0,8,38,15,0,0,Math.PI*2);g.fillStyle='#fff0c9';g.fill();stroked(g,'#d9a18a',1.5);
 for(const [dx,dy,r,c] of [[-16,4,7,'#ec7f91'],[0,-1,8,'#f0c45e'],[16,4,7,'#d984a9'],[0,10,6,'#f29a6f']]){g.beginPath();g.arc(dx,dy,r,0,Math.PI*2);g.fillStyle=c;g.fill()}
 g.restore();
}
function drawDessertTile(canvas){
 const g=canvas.getContext('2d');g.scale(canvas.width/TILE_W,canvas.height/TILE_H);
 g.fillStyle='#ffedf2';g.fillRect(0,0,TILE_W,TILE_H);
 // soft textile grain and tiny candy sprinkles
 for(let y=12;y<TILE_H;y+=24)for(let x=9+(Math.floor(y/24)%2)*12;x<TILE_W;x+=24){g.beginPath();g.arc(x,y,1.15,0,Math.PI*2);g.fillStyle='rgba(216,139,164,.15)';g.fill()}
 const sprinkles=[[70,118,-.4,'#e99cb4'],[870,130,.5,'#d5b1d8'],[180,347,.8,'#efb16f'],[745,344,-.6,'#b3d6c6'],[405,474,.3,'#e99cb4'],[550,80,-.5,'#e8c66f'],[910,450,.4,'#b6d7d0'],[45,455,-.2,'#dbabd8']];
 for(const [x,y,a,c] of sprinkles){g.save();g.translate(x,y);g.rotate(a);roundRect(g,-7,-1.5,14,3,2);filled(g,c);g.restore()}
 // Stable, roomy arrangement; the title's central band stays visually quiet.
 drawMacaron(g,133,203,.83,'#e9a0b7','#fff2df',-.16);
 drawMacaron(g,803,205,.9,'#c8b1dd','#fff0d9',.1);
 drawCupcake(g,280,425,.84,'#f3a8c0','#fff0d9');
 drawCakeSlice(g,515,426,.86);
 drawTart(g,720,432,.87);
 drawMacaron(g,870,484,.63,'#f1c37e','#fff3dd',-.12);
 drawJelly(g,97,424,.92,'#ed8ca5',-.35);drawJelly(g,170,466,.75,'#f4c55f',.32);
 drawJelly(g,404,486,.78,'#b8d7c5',-.18);drawJelly(g,623,480,.88,'#c8add9',.22);
 drawJelly(g,825,389,.77,'#f3a47c',-.3);drawJelly(g,904,350,.66,'#ec9db8',.18);
 // A small cream swirl motif gives the empty upper corners a dessert cue.
 for(const [x,y,s] of [[74,68,.55],[884,72,.62]]){g.save();g.translate(x,y);g.beginPath();g.moveTo(-17,10);g.bezierCurveTo(-28,-2,-12,-8,-8,-17);g.bezierCurveTo(-1,-28,15,-19,10,-8);g.bezierCurveTo(22,-4,22,9,13,12);g.closePath();g.fillStyle='#fff8ec';g.fill();stroked(g,'#e2a8b6',1.5);g.restore()}
}
function getTile(createCanvas,ratio){
 const key=`${Math.round(ratio*100)/100}`;
 if(!cache.has(key)){const c=createCanvas(Math.round(TILE_W*ratio),Math.round(TILE_H*ratio));drawDessertTile(c);cache.set(key,c)}
 return cache.get(key);
}

// Backward-compatible export name; riceImage is intentionally ignored. The title
// scene retains its measured continuous pan and infinite tiled background.
export async function drawPinkRiceBackground(g,t,{createCanvas}){
 const scaleX=Math.hypot(g.getTransform().a,g.getTransform().b)||1;
 const ratio=Math.max(1,Math.min(4,scaleX));
 const tile=getTile(createCanvas,ratio),ox=((t-19)*-14.37)%TILE_W,oy=((t-19)*-16.67)%TILE_H;
 const sx=ox>0?ox-TILE_W:ox,sy=oy>0?oy-TILE_H:oy;
 for(let y=sy;y<540;y+=TILE_H)for(let x=sx;x<960;x+=TILE_W)g.drawImage(tile,x,y,TILE_W,TILE_H);
}
