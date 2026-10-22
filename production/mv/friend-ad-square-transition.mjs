// One analytic square coordinate system for the friend -> station transition.
// Logical canvas: 960 x 540. Time is absolute reference PTS, not clip-local time.
// No source pixels, traced polygons, frame lookup, or stateful accumulation.
export const FRIEND_AD_SQUARE = Object.freeze({
  start:205.258, growthEnd:205.592, pivot:206.184, end:206.926,
  cx:480, cy:270, pink:'#ff8bd2', lavender:'#b3b6ff',
  pinkSide:540, outerRadius:766.5, outerStart:205.466232, outerTau:.0869534,
  growthBezier:[.583,.512,.0646,.946], revealBezier:[.09,.51,.59,1],
  shrinkExponent:3.2,
});
const clamp=x=>Math.max(0,Math.min(1,x));
const cubic=(t,a,b)=>3*(1-t)**2*t*a+3*(1-t)*t*t*b+t**3;
// Fixed-count bisection gives deterministic evaluation of a single timing curve.
function bezier(x,[x1,y1,x2,y2]){
  x=clamp(x);if(x===0||x===1)return x;
  let lo=0,hi=1;
  for(let i=0;i<32;i++){const u=(lo+hi)/2;if(cubic(u,x1,x2)<x)lo=u;else hi=u}
  return cubic((lo+hi)/2,y1,y2);
}
export function friendAdSquareGeometry(t){
  const c=FRIEND_AD_SQUARE;
  const growth=bezier((t-c.start)/(c.growthEnd-c.start),c.growthBezier);
  const shrink=clamp((t-c.growthEnd)/(c.pivot-c.growthEnd));
  const incoming=t>=c.pivot;
  const reveal=incoming?bezier((t-c.pivot)/(c.end-c.pivot),c.revealBezier):0;
  const innerSide=incoming?Math.SQRT2*750*reveal:
    c.pinkSide*growth*(1-Math.expm1(c.shrinkExponent*shrink)/Math.expm1(c.shrinkExponent));
  const outerRadius=c.outerRadius*(1-Math.exp(-Math.max(0,t-c.outerStart)/c.outerTau));
  return {incoming,growth,innerSide,outerSide:Math.SQRT2*outerRadius,
    angle:(45+90*growth)*Math.PI/180,cx:c.cx,cy:c.cy};
}
export async function drawFriendAdSquare(g,t,{drawOutgoing,drawIncoming}){
  const c=FRIEND_AD_SQUARE,p=friendAdSquareGeometry(t);
  // The underlay changes only when the square is opaque across all four corners.
  // The central aperture is exactly zero at that instant.
  if(p.incoming)await drawIncoming();else await drawOutgoing();
  g.save();g.translate(p.cx,p.cy);g.rotate(p.angle);
  if(!p.incoming&&p.innerSide>0){g.fillStyle=c.pink;g.fillRect(-p.innerSide/2,-p.innerSide/2,p.innerSide,p.innerSide)}
  if(p.outerSide>p.innerSide){
    g.fillStyle=c.lavender;g.beginPath();
    g.rect(-p.outerSide/2,-p.outerSide/2,p.outerSide,p.outerSide);
    // evenodd is the central reverse mask, evaluated directly at this time.
    if(p.innerSide>0)g.rect(-p.innerSide/2,-p.innerSide/2,p.innerSide,p.innerSide);
    g.fill('evenodd');
  }
  g.restore();
}
