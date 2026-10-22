// Crisp, code-drawn pink dot fields shared by the memory and friends scenes.
export const FRIEND_DENSE_DOT_SCALE=1/Math.sqrt(2);

export function drawPinkDotsPattern(g,t=116.017,options={}){
 const scale=options.spacingScale??1;
 const spacingX=options.spacingX??47*scale,spacingY=options.spacingY??45*scale;
 const width=options.width??960,height=options.height??540;
 const originX=options.originX??-70*scale,originY=options.originY??-30*scale;
 const radius=options.radius??3.8,phase=options.phase??116.017;
 const speed=options.driftSpeed??7,drift=speed?((t-phase)*speed)%spacingX:0;
 const stagger=options.stagger??(23/47);
 g.fillStyle=options.background??'#efc7d7';g.fillRect(0,0,width,height);
 g.fillStyle=options.dotColor??'#fff';
 for(let y=originY;y<height+spacingY;y+=spacingY){
  const row=Math.floor(y/spacingY);
  for(let x=originX;x<width+spacingX;x+=spacingX){
   g.beginPath();g.arc(x+(row%2)*spacingX*stagger-drift,y,radius,0,Math.PI*2);g.fill();
  }
 }
}

export function drawMemoryPinkDots(g,t){
 drawPinkDotsPattern(g,t,{
  spacingX:10,spacingY:9,originX:-20,originY:-9,stagger:.5,
  radius:2.25,background:'#f9c9f4',dotColor:'#fff',driftSpeed:0
 });
}
