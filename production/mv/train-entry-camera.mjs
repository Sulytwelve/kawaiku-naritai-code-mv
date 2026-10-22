// One large-world vertical camera for the complete passing -> train entry.
// Absolute reference PTS. Finite timing/extent parameters measured from source;
// no frame-specific camera keys or accumulated frame deltas.
export const TRAIN_ENTRY=Object.freeze({
 firstStart:157.218,firstEnd:158.094,firstTravel:177.2,firstBezier:[.1805,.6008],
 secondStart:161.847,secondEnd:162.597,secondTravel:610.25,secondBezier:[.6023,.4803],
 fasciaHoldTop:415,fadeStart:157.969,fadeEnd:158.636,
});
const clamp=x=>Math.max(0,Math.min(1,x));
const cubic=(t,a,b)=>3*(1-t)**2*t*a+3*(1-t)*t*t*b+t**3;
function ease(x,[x1,x2]){x=clamp(x);if(x===0||x===1)return x;let a=0,b=1;for(let i=0;i<32;i++){const q=(a+b)/2;if(cubic(q,x1,x2)<x)a=q;else b=q}return cubic((a+b)/2,0,1)}
export function trainEntryState(t){
 const c=TRAIN_ENTRY,first=ease((t-c.firstStart)/(c.firstEnd-c.firstStart),c.firstBezier),second=ease((t-c.secondStart)/(c.secondEnd-c.secondStart),c.secondBezier);
 const cameraY=c.firstTravel*first+c.secondTravel*second;
 const trainWorldY=c.firstTravel+c.secondTravel;
 const fasciaLocalTop=c.fasciaHoldTop-c.secondTravel;
 return{first,second,cameraY,trainWorldY,trainY:trainWorldY-cameraY,
  fasciaLocalTop,wallTop:trainWorldY+fasciaLocalTop-cameraY,
  opacity:clamp((t-c.fadeStart)/(c.fadeEnd-c.fadeStart))};
}
