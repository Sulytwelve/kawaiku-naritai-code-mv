// Flat orthogonal train interior. All shapes are native Canvas paths at output
// density; there are no source screenshots, generated plates, or raster caches.
export const TRAIN_SEAT_COLORS=Object.freeze({wall:'#ffdcee',lime:'#ebf7a2',seat:'#fccbff',
 trim:'#fbdfff',line:'#d09ad6',highlight:'#fff0ff',thought:'#dfe8ff',thoughtLine:'#a6b2f0'});
const clamp=x=>Math.max(0,Math.min(1,x)),mix=(a,b,u)=>a+(b-a)*u;
export function trainSeatLayout(t=164){
 // The original reaction shot changes framing during its flower dissolve.
 // Both actor passes receive this SAME background time and geometry.
 const v=clamp((t-175.817)/.417),u=v*v*(3-2*v);
 return {wallEdge:mix(684,618,u),seatEnd:mix(862,790,u),
  capTop:269,capBottom:mix(281,279,u),stripeBottom:mix(326,319,u),
  armTop:mix(213,-8,u),armWidth:mix(22,9,u),handleX:mix(893,889,u),
  handleBottom:mix(442,435,u),doorJamb:mix(902,904,u),u};
}
export function drawTrainThoughtRings(g,{leading=false}={}){
 const c=TRAIN_SEAT_COLORS;
 g.save();g.fillStyle=c.thought;g.strokeStyle=c.thoughtLine;g.lineWidth=5;
 const rings=leading?[[360,-128,54,28,-.12],[322,-67,19,11,-.30],[310,-26,12,7,-.35]]:[];
 rings.push([300,42,16,7,-.35],[330,6,28,13,-.14]);
 for(const[cx,cy,rx,ry,angle]of rings){g.beginPath();g.ellipse(cx,cy,rx,ry,angle,0,Math.PI*2);g.fill();g.stroke()}
 g.restore();
}
function line(g,x,y,xx,yy,color,w=1){g.strokeStyle=color;g.lineWidth=w;g.beginPath();g.moveTo(x,y);g.lineTo(xx,yy);g.stroke()}
export function drawTrainSeatBackground(g,{t=164,thoughts=false}={}){
 const c=TRAIN_SEAT_COLORS,p=trainSeatLayout(t);
 g.save();
 // A whole-canvas opaque field also covers the moving entry's internal edges.
 g.fillStyle=c.lime;g.fillRect(0,0,960,540);
 g.fillStyle=c.wall;g.fillRect(0,0,p.wallEdge,p.capTop);
 // The cap and colour strip have identical y at both ends: no perspective.
 g.fillStyle=c.trim;g.fillRect(0,p.capTop,p.seatEnd,p.capBottom-p.capTop);
 line(g,0,p.capTop,p.seatEnd,p.capTop,c.line,1.1);
 line(g,0,p.capTop+2,p.seatEnd,p.capTop+2,c.highlight,.8);
 line(g,0,p.capBottom,p.seatEnd,p.capBottom,c.line,1.1);
 g.fillStyle=c.seat;g.fillRect(0,p.stripeBottom,p.seatEnd,540-p.stripeBottom);
 line(g,0,p.stripeBottom,p.seatEnd,p.stripeBottom,c.line,1.2);
 line(g,0,p.stripeBottom+1.6,p.seatEnd,p.stripeBottom+1.6,c.highlight,.7);
 // Vertical end of the seat/backrest; distinct from the door's pull handle.
 g.fillStyle=c.trim;g.fillRect(p.seatEnd,p.armTop,p.armWidth,548-p.armTop);
 line(g,p.seatEnd,p.armTop,p.seatEnd,540,c.line,1.2);
 line(g,p.seatEnd,p.armTop,p.seatEnd+p.armWidth,p.armTop,c.line,1.2);
 line(g,p.seatEnd+p.armWidth,p.armTop,p.seatEnd+p.armWidth,540,c.line,1.1);
 line(g,p.seatEnd+2,p.armTop+2,p.seatEnd+2,540,c.highlight,.8);
 // Flat door jamb and its inset highlight, all vertical and parallel.
 g.fillStyle=c.trim;g.fillRect(p.doorJamb,0,11,540);
 line(g,p.doorJamb,0,p.doorJamb,540,c.line,1.1);
 line(g,p.doorJamb+10,0,p.doorJamb+10,540,c.line,1.1);
 line(g,p.doorJamb+2,0,p.doorJamb+2,540,c.highlight,1);
 // Long narrow U-shaped pull. The shallow curve is the handle's rounded foot,
 // not a skewed plane. It remains independent of the colour-strip endpoint.
 const x=p.handleX,b=p.handleBottom;
 g.fillStyle=c.trim;g.strokeStyle=c.line;g.lineWidth=1.15;
 g.beginPath();g.moveTo(x-5,p.armTop);g.lineTo(x-5,b-5);g.quadraticCurveTo(x-5,b,x-12,b);
 g.lineTo(x-21,b);g.lineTo(x-21,b-7);g.lineTo(x-12,b-7);g.lineTo(x-12,p.armTop);g.closePath();g.fill();g.stroke();
 line(g,x-9,p.armTop+1,x-9,b-8,c.highlight,1);
 line(g,x-19,b-3,x-8,b-3,c.highlight,.8);
 if(thoughts)drawTrainThoughtRings(g);
 g.restore();
}
export function drawTrainSeatEntryWorld(g,{t,state}){
 const c=TRAIN_SEAT_COLORS,top=state.fasciaLocalTop;
 g.save();g.translate(0,state.trainWorldY);
 g.save();g.globalAlpha*=state.opacity;
 drawTrainSeatBackground(g,{t,thoughts:false});
 // The upper fascia is the same train wall, extending above the final crop.
 // It is already below frame before the first camera rise, then holds its
 // screen top at y415. Its source-timed fade is separate from camera motion.
 g.save();g.beginPath();g.rect(0,top,960,-top);g.clip();
 g.fillStyle=c.wall;g.fillRect(0,top,960,-top);
 g.strokeStyle=c.line;g.lineWidth=2.3;
 for(const[x,w]of[[-4,689],[695,135],[842,97]])g.strokeRect(x,top+8,w,-top+3);
 line(g,0,top+1,960,top+1,c.highlight,1.2);
 g.restore();
 g.restore();
 // A thought chain spans the fascia and final shot. Camera motion naturally
 // carries its large cue out while revealing the two calm-shot rings.
 drawTrainThoughtRings(g,{leading:true});
 g.restore();
}
