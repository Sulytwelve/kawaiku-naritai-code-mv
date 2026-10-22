// Deterministic, cacheable smoke overlays for the six-cover reveal.
// The spatial fields are fixed; only a normalized mask-frame threshold changes.
const SCALE=1,PAD_X=5,PAD_Y=7,COVER_W=330,COVER_H=454;
const W=(COVER_W+PAD_X*2)*SCALE,H=(COVER_H+PAD_Y*2)*SCALE;
const cache=new Map();
let fields=null;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
function hash(x,y){const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n)}
function noise(x,y){
 const ix=Math.floor(x),iy=Math.floor(y),fx=smooth(x-ix),fy=smooth(y-iy);
 const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);
 return (a+(b-a)*fx)+((c+(d-c)*fx)-(a+(b-a)*fx))*fy;
}
function fbm(x,y){let value=0,amp=.5,freq=1,sum=0;for(let i=0;i<4;i++){value+=noise(x*freq,y*freq)*amp;sum+=amp;amp*=.5;freq*=2}return value/sum}
function smoothAlpha(x){return smooth(clamp(x))}

// Large, fixed local tear seeds make the reveal break into broad pieces rather
// than only pinholes. Their centers, radii, start times, and growth rates never
// change between calls or playback order.
const SEEDS=[
 {x:45,y:86,r:7,start:.18,grow:55},{x:135,y:46,r:9,start:.27,grow:64},
 {x:267,y:112,r:8,start:.23,grow:58},{x:78,y:221,r:6,start:.32,grow:70},
 {x:222,y:268,r:10,start:.21,grow:62},{x:119,y:378,r:8,start:.36,grow:61},
 {x:293,y:398,r:7,start:.29,grow:56},{x:180,y:174,r:5,start:.43,grow:47},
];
function prepareFields(){
 if(fields)return fields;
 const count=W*H,n1=new Float32Array(count),n2=new Float32Array(count),radial=new Float32Array(count),
  dRect=new Float32Array(count),seedDistances=SEEDS.map(()=>new Float32Array(count));
 const cx=COVER_W/2,cy=COVER_H/2,hx=cx+PAD_X,hy=cy+PAD_Y,maxR=Math.hypot(hx,hy)+2;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=y*W+x,lx=(x+.5)/SCALE-PAD_X,ly=(y+.5)/SCALE-PAD_Y,px=lx-cx,py=ly-cy;
  const q1=fbm(lx*.035,ly*.035),q2=fbm(lx*.075+41,ly*.075+17);
  n1[i]=q1;n2[i]=q2;radial[i]=Math.hypot(px,py);
  const dx=Math.abs(px)-hx,dy=Math.abs(py)-hy;
  dRect[i]=Math.hypot(Math.max(dx,0),Math.max(dy,0))+Math.min(Math.max(dx,dy),0);
  for(let k=0;k<SEEDS.length;k++){
   const s=SEEDS[k];seedDistances[k][i]=Math.hypot(lx-s.x,ly-s.y)-s.r;
  }
 }
 fields={n1,n2,radial,dRect,seedDistances,maxR};return fields;
}

/**
 * Return a padded, cover-local smoke overlay for frameIndex/totalFrames.
 * Index 0 is the intact soft-edged veil; index totalFrames is fully gone.
 * A 60-step normalized clock interpolates source mask-index progress smoothly.
 */
export function deterministicSmokeMask(frameIndex,totalFrames,createCanvas){
 if(!Number.isInteger(totalFrames)||totalFrames<1)throw new Error('totalFrames must be a positive integer');
 const index=Math.max(0,Math.min(totalFrames,Math.round(frameIndex))),p=index/totalFrames;
 if(p>=1)return null;
 if(cache.has(index))return cache.get(index);
 const f=prepareFields(),canvas=createCanvas(W,H),g=canvas.getContext('2d'),im=g.createImageData(W,H),px=im.data;
 for(let i=0,j=0;i<f.n1.length;i++,j+=4){
  const q=f.n1[i],pinhole=f.n2[i],edgeSlope=66+(q-.5)*60; // strictly positive: no pixel can reappear
  const edge=f.dRect[i]+p*edgeSlope;
  const edgeA=smoothAlpha(.5-edge/1.5); // 1.5 local-pixel feather
  const threshold=.91-.46*p;
  const noiseHole=smoothAlpha((threshold+.018-pinhole)/.036);
  let seedHole=1;
  for(let k=0;k<SEEDS.length;k++){
   const s=SEEDS[k],u=s.start>=1?0:smooth((p-s.start)/(1-s.start));
   const a=p<s.start?1:smoothAlpha((f.seedDistances[k][i]-s.grow*u+1.5)/3);
   if(a<seedHole)seedHole=a;
  }
  const collapse=smooth((p-.48)/.52),radius=f.maxR*(1-collapse)+1.5;
  const warped=f.radial[i]+(q-.5)*28*p;
  const radialA=smoothAlpha(.5+(radius-warped)/1.5);
  const lateFade=1-smooth((p-.92)/.08);
  const alpha=Math.round(255*edgeA*noiseHole*seedHole*radialA*lateFade);
  px[j]=246;px[j+1]=243;px[j+2]=251;px[j+3]=alpha;
 }
 g.putImageData(im,0,0);cache.set(index,canvas);return canvas;
}

export function smokeCacheInfo(){return{size:cache.size,indices:[...cache.keys()].sort((a,b)=>a-b),dimensions:[W,H]}}
