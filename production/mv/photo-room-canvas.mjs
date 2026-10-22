// Native Canvas room and braided cord. No source-video pixels or raster tiles.
let room;
export function drawPhotoRoom(g,{createCanvas}){
 if(!room){
  room=createCanvas(3840,2160);const q=room.getContext('2d');q.scale(4,4);
  q.fillStyle='#f9dce8';q.fillRect(0,0,960,540);
  q.fillStyle='#f2d0e1';q.beginPath();q.moveTo(0,0);q.lineTo(960,0);q.lineTo(960,49);q.lineTo(0,95);q.fill();
  q.strokeStyle='#d4b4d5';q.lineWidth=1.2;q.beginPath();q.moveTo(0,95);q.lineTo(960,49);q.stroke();
  // Quiet wall panels and a suggested window, deliberately below photo contrast.
  q.fillStyle='#f4d7e9';q.fillRect(0,110,960,370);
  q.strokeStyle='#e7c3db';q.lineWidth=1.2;
  for(let x=45;x<1000;x+=190){q.beginPath();q.moveTo(x,110);q.lineTo(x,480);q.stroke()}
  q.strokeRect(34,137,180,286);q.strokeRect(39,142,170,276);
  q.fillStyle='#e7e8f6';q.fillRect(41,144,166,272);
  q.strokeStyle='#d6c5e2';q.lineWidth=4;q.beginPath();q.moveTo(124,144);q.lineTo(124,416);q.moveTo(41,280);q.lineTo(207,280);q.stroke();
  q.fillStyle='#f6e8ef';q.fillRect(0,480,960,60);q.fillStyle='#e3bfd4';q.fillRect(0,478,960,3);
  q.strokeStyle='#eccfdf';q.lineWidth=1;for(let x=-200;x<1200;x+=160){q.beginPath();q.moveTo(x,540);q.lineTo(480+(x-480)*.87,481);q.stroke()}
  q.fillStyle='#fff3e9';q.strokeStyle='#dbc6df';q.lineWidth=1.1;
  for(const [x,y] of [[192,26],[645,9]]){q.beginPath();q.ellipse(x,y,18,4,0,0,Math.PI*2);q.fill();q.stroke()}
 }
 g.drawImage(room,0,0,960,540);
}
export function drawBraidedPhotoCord(g,{y=67,shift=0,alpha=1}={}){
 if(alpha<=0)return;g.save();g.globalAlpha*=alpha;
 g.lineCap='round';g.lineJoin='round';
 g.beginPath();g.moveTo(-25,y);g.lineTo(985,y);g.strokeStyle='#b888a3';g.lineWidth=15;g.stroke();
 g.strokeStyle='#f7d598';g.lineWidth=12;g.stroke();
 g.save();g.beginPath();g.roundRect(-25,y-6,1010,12,6);g.clip();
 const period=22,phase=((shift%period)+period)%period;
 for(let strand=0;strand<3;strand++){
  g.beginPath();for(let x=-30;x<=990;x+=.8){const yy=y+4.6*Math.sin((x+phase)/period*Math.PI*2+strand*Math.PI*2/3);if(x===-30)g.moveTo(x,yy);else g.lineTo(x,yy)}
  g.strokeStyle='#c09576';g.lineWidth=4.1;g.stroke();
  g.strokeStyle=['#ffe9ae','#f2c680','#fff1c7'][strand];g.lineWidth=2.7;g.stroke();
 }
 g.restore();g.restore();
}
