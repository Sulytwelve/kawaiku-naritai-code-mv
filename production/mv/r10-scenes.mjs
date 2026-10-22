// R10: the tv-room exit and the reading scene's entry (39.546 - 40.696s).
//
// Measured against frame-accurate stills from the original MV:
//
//   phase 1  the tv-room is squashed vertically into the top `top(t)` rows while
//            white fills everything below. `top` was read off the frame where the
//            first 98%-white scanline appears, and it falls 540 -> 8 over
//            39.545..40.120s with a strong ease (slow, fast, slow).
//   phase 2  a small rotated square grows at the centre and the reading scene
//            unfolds inside it. The saturated-pixel count jumps 1647 -> 5362
//            between 40.245 and 40.287s, so the unfold is almost instantaneous
//            at the end; the growth before that is slow.
//   phase 3  the reading scene sits at full size from 40.287s.
import {lerp,sampleLerp} from './track-smoothing.mjs';

// Measured white-boundary position, in 960x540 design space. Already clean, so it
// is interpolated directly rather than run through the despiking chain.
const TOP=[
  {t:39.545,v:540},{t:39.578,v:482},{t:39.620,v:446},{t:39.662,v:381},
  {t:39.703,v:278},{t:39.745,v:195},{t:39.787,v:142},{t:39.828,v:105},
  {t:39.870,v:65},{t:39.912,v:62},{t:39.954,v:52},{t:39.995,v:23},
  {t:40.037,v:16},{t:40.079,v:11},{t:40.120,v:8},{t:40.700,v:8}
];

// The square is already present, small, by 40.037s (1690 saturated pixels), so the
// unfold starts as soon as the white sweep has essentially finished.
const UNFOLD_FROM=39.900;

// Half-diagonal of the mask's diamond hole, in design space.
//
// Measured from the source: the revealed area is the diamond's own area (2*h^2),
// which pins h directly at each frame --
//
//     39.90 -> 2688px2 -> h=37      40.16 ->  8386px2 -> h=65
//     39.95 -> 4402px2 -> h=47      40.24 -> 17784px2 -> h=94
//     40.04 -> 5831px2 -> h=54      40.29 -> 50485px2 -> h=159
//
// and 2*159^2 = 50562 matches the measured 50485, which confirms the model. Past
// 40.29 the measurement saturates (the diamond has covered the whole sampled band),
// so the final ramp to full coverage is extrapolated: a diamond needs h >= 750 to
// reach the frame's corners, since |dx|+|dy| = 480+270 there.
const HOLE=[
  {t:39.860,v:20},{t:39.900,v:37},{t:39.950,v:47},{t:40.040,v:54},
  {t:40.160,v:65},{t:40.240,v:94},{t:40.290,v:159},{t:40.380,v:420},
  {t:40.470,v:900},{t:40.700,v:900}
];
function halfDiagonal(t){
  return sampleLerp(HOLE,t,(a,b,u)=>({v:lerp(a.v,b.v,u)})).v;
}

function clipSquare(g,half){
  const cx=480,cy=260;
  g.beginPath();
  g.moveTo(cx,cy-half);g.lineTo(cx+half,cy);g.lineTo(cx,cy+half);g.lineTo(cx-half,cy);
  g.closePath();
}

// `api.drawScene` is passed in rather than imported: scene.mjs imports
// this module, so importing back would be a cycle.
// The incoming shot's panel outline: a tilted quadrilateral whose left edge leans
// (top-left 342 -> bottom-left 431). The source DRAWS this border as thin blue
// segments during the transition -- it is part of the animation, not a stray
// overlay. Measured from the frames: a vertical blue line settles at x~899 spanning
// ~480px, with horizontals at y~20 and y~516.
const QUAD=[[342,21],[900,21],[900,516],[431,516]];
// Per-edge draw windows, read off the reference frames: the top-right right angle
// arrives first (39.87), the bottom edge is drawn right-to-left next (39.95 shows it
// at y~538 entering from below), and the leaning left edge closes the shape last.
const EDGE_T=[[39.860,39.960],[39.860,39.990],[39.930,40.110],[40.000,40.200]];
const HALF_FULL=900;   // half-diagonal at which the hole covers the whole quadrilateral
const OUTLINE='#6a7fd6';

function edgeProgress(t,i){
  const [a,b]=EDGE_T[i];
  return Math.max(0,Math.min(1,(t-a)/(b-a)));
}
function drawOutline(g,t){
  g.save();
  g.strokeStyle=OUTLINE;g.lineWidth=1.6;g.lineCap='round';
  for(let i=0;i<4;i++){
    const u=edgeProgress(t,i);
    if(u<=0)continue;
    const [x0,y0]=QUAD[i],[x1,y1]=QUAD[(i+1)%4];
    g.beginPath();g.moveTo(x0,y0);g.lineTo(x0+(x1-x0)*u,y0+(y1-y0)*u);g.stroke();
  }
  g.restore();
}

// Vertical motion blur for the outgoing shot, as an explicit curve.
//
// Deriving the blur from the speed of the measured `top` curve gets the timing
// wrong: that curve still shows ~950px/s at 39.87s, so a speed-driven blur smears
// the 65px-tall remnant badly, while the source is already crisp there. Measured
// relative sharpness (mean |Laplacian| over the room strip, higher = sharper) is
// monotonic across the exit:
//
//     39.62 -> 2.59   39.70 -> 2.90   39.79 -> 3.06
//     39.87 -> 4.19   39.95 -> 5.43   40.04 -> 5.90
//
// so the blur is heaviest at the START and decays to nothing, which is the
// opposite of what the speed curve implies. The curve below is driven by those
// measurements directly.
// sampleLerp requires {t,v} rows. Passing bare [t,v] pairs leaves `.t` undefined,
// the binary search degenerates, and the blend returns NaN -- which silently
// transforms the canvas to nothing rather than throwing.
const BLUR=[{t:39.545,v:44},{t:39.62,v:40},{t:39.70,v:34},{t:39.79,v:26},
  {t:39.87,v:8},{t:39.95,v:0},{t:40.70,v:0}];
const BLUR_TAPS=[[-2,.12],[-1,.22],[0,.32],[1,.22],[2,.12]];

export async function drawR10(g,scene,t,api){
  const cfg=scene.r10??{};
  const under=api.tracks.scenes.find(s=>s.id===cfg.under);
  const over=api.tracks.scenes.find(s=>s.id===cfg.over);
  if(!under||!over)throw new Error(`R10 scene is missing ${!under?'under':'over'} reference`);

  // sampleLerp's third argument is a BLEND function (a,b,u), not a projector:
  // passing `r=>r.v` silently turns the curve into a step function.
  const topAt=x=>sampleLerp(TOP,x,(a,b,u)=>({v:lerp(a.v,b.v,u)})).v;
  const top=topAt(t);

  // The outgoing shot TRANSLATES upward and leaves through the top; it is not
  // squashed. Review correction: "39.500从下往上是平移的，不是挤压". The white
  // boundary `top` is the shot's own bottom edge as it rises, which is why it runs
  // 540 -> 8: at the end all but the last 8px has gone off the top.
  const dy=540-top;
  const smear=sampleLerp(BLUR,t,(a,b,u)=>({v:lerp(a.v,b.v,u)})).v;

  const drawUnder=async()=>{
    if(smear<2){
      g.save();
      g.beginPath();g.rect(0,0,960,Math.max(0,top));g.clip();
      g.translate(0,-dy);
      await api.drawScene(g,under,t,api);
      g.restore();
      return;
    }
    for(const [k,w] of BLUR_TAPS){
      const off=dy+k*smear/2;
      g.save();
      g.globalAlpha*=w;
      g.beginPath();g.rect(0,0,960,Math.max(0,top));g.clip();
      g.translate(0,-off);
      await api.drawScene(g,under,t,api);
      g.restore();
    }
  };

  if(t<UNFOLD_FROM){
    await drawUnder();
    g.fillStyle=cfg.paper??'#ffffff';
    g.fillRect(0,Math.max(0,top),960,540-Math.max(0,top));
    drawOutline(g,t);
    return;
  }

  // Phase 2/3. Two independent constraints, per the review:
  //
  //   * the OUTER irregular quadrilateral is the visible region and stays white
  //     outside it, always;
  //   * INSIDE it, the illustration is covered by a white mask with a diamond hole
  //     punched at the centre, and the hole grows until it fills the quadrilateral.
  //
  // A pixel shows the illustration only when it is inside the quadrilateral AND
  // inside the current hole. Clipping to the quad and then filling white everywhere
  // except the hole satisfies both at once. The illustration keeps its natural
  // coordinates and scale -- review correction: "不要把菱形当作独立图片缩放，也
  // 不要让人物插画超出不规则四边形边界".
  const half=halfDiagonal(t);
  g.fillStyle=cfg.paper??'#ffffff';
  g.fillRect(0,0,960,540);                 // outside the quad stays white
  g.save();
  g.beginPath();
  QUAD.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));
  g.closePath();
  g.clip();
  await api.drawScene(g,over,t,api);       // natural size, never rescaled
  if(half<HALF_FULL){
    g.beginPath();
    g.rect(0,0,960,540);
    // The hole is centred on the quadrilateral, not on the canvas.
    const cx=(QUAD[0][0]+QUAD[1][0]+QUAD[2][0]+QUAD[3][0])/4;
    const cy=(QUAD[0][1]+QUAD[1][1]+QUAD[2][1]+QUAD[3][1])/4;
    g.moveTo(cx,cy-half);g.lineTo(cx+half,cy);g.lineTo(cx,cy+half);g.lineTo(cx-half,cy);g.closePath();
    g.fillStyle=cfg.paper??'#ffffff';
    g.fill('evenodd');
  }
  g.restore();
  // The outgoing shot's remnant sits above the mask, then the outline on top.
  if(top<540){
    g.save();
    g.beginPath();g.rect(0,0,960,Math.max(0,top));g.clip();
    g.translate(0,-dy);
    await api.drawScene(g,under,t,api);
    g.restore();
  }
  drawOutline(g,t);
}
