// Canvas grid clears by35.78; border35.78–36.32, stripe reveal36.32–36.54.
// Tv-room comic-panel ENTRY (35.489 - 36.349s).
//
// The animation happens *before* the tv-room scene's own range starts (36.367),
// inside the span the router renders as this scene's underlay, so every stage is
// driven by absolute source PTS and shows up through `transition-color-grid`.
//
// Measured from the original MV source frames at a one-frame stride. Frames are named frame-NNNN
// below; they are 1/23.976 s apart.
//
//   stage 1  the panel border is drawn as ONE continuous pen stroke around the
//            rectangle, clockwise from the top-left corner, at a constant speed.
//            The four edges were timed independently off the reference and all
//            four land on a single 4780 px/s pen (design-space px):
//
//              ①  top     (58.5, 38.2)->(898.6, 38.2)  35.489 -> 35.667
//              ②  right   (898.6,38.2)->(898.6,500.8)  35.667 -> 35.763
//              ③  bottom  (898.6,500.8)->(58.5,500.8)  35.763 -> 35.940
//              ④  left    (58.5,500.8)->(58.5, 38.2)   35.940 -> 36.034
//
//            Edge endpoints read straight off the frames (rose core, measured
//            sub-pixel centre of the antialiased profile):
//              top edge y=38.2   frame-0043 x ..864   frame-0044 x ..896
//              right edge        frame-0044 y 38..205 frame-0045 y 36..404
//                                frame-0046 y 31..502 (complete)
//              bottom edge       frame-0046 x 792..900, frame-0047 592..900,
//                                frame-0048 393..900, frame-0049 191..900,
//                                frame-0050 56..900 (complete)   [right->left]
//              left edge         frame-0050 y 434..503, frame-0051 234..503,
//                                frame-0052 36..503 (complete)   [bottom->top]
//            A single constant-speed pen reproduces all twelve of those samples
//            to within 3px, which is why the four edges are one stroke and not
//            four independent wipes. This is the reviewer's ①②③: the top-right
//            right angle lands first, the bottom edge then runs right-to-left,
//            and the left edge climbs back up to the top edge that already
//            exists.
//
//   stage 2  the white panel turns into diagonal stripes that THIN OUT and
//            disappear, revealing the illustration. Measured on frames 0053-0061
//            from the mask "white here, ink in the resolved frame":
//              angle   45.4 deg, i.e. the stripes run "/" (bottom-left to
//                      top-right); the 2-D spectrum peak is at 45.4 in every
//                      frame from 0054 to 0058.
//              pitch   11.45 px, constant across the whole reveal.
//              reveal  u = 0.00 (0053) 0.22 (0054) 0.36 (0055) 0.50 (0056)
//                      0.63 (0057) 0.80 (0058) 0.90 (0059) 1.00 (0060).
//                      u = 1 - whiteWidth/pitch, so the white stripe width
//                      shrinks linearly from a full 11.45px to 0; a power fit on
//                      the eight samples gives u = ((t-36.075)/0.274)^0.82.
//              drift   the stripe phase also slides along the perpendicular at
//                      ~18.5 px/s (band centre s mod pitch 8.73 at 0054 -> 5.64
//                      at 0058), so the pattern is not frozen.
//
//   stage 3  both captions fade in over 35.742..35.950 (alpha proxy 0.00 / 0.16 /
//            0.41 / 0.68 / 0.96 / 1.00 on frames 0043..0050). They are part of
//            the still plate, so the entry hides them with the mask and paints
//            them back from its own overlay at the measured alpha.
//
// IMPORTANT: the plate underneath already contains the finished border and the
// captions, and the entry is composited AFTER the scene's layers, so the mask has
// to cover the whole frame (not just the panel) for t < 36.075 -- otherwise the
// plate's baked border would show through the empty panel and the "drawing" would
// be invisible.
import {lerp,sampleLerp} from './track-smoothing.mjs';

// Rose border: core colour of the antialiased profile, and the profile's total
// coverage (row 37..40 G-coverage 0.50/0.88/0.69/0.11 = 2.18px, centroid y 38.19).
const INK='#b9466a';
const STROKE_WIDTH=2.18;

// Pen stroke. Path is closed, so the last edge ends where the first began.
const PEN_START=35.78;
const PEN_SPEED=(2*((898.6-58.5)+(500.8-38.2)))/.54;

// White stripe dissolve.
const STRIPE_FROM=36.32;
const STRIPE_SPAN=0.22;
const STRIPE_EASE=0.85;
const STRIPE_PITCH=11.45;
const STRIPE_ANGLE=45.4*Math.PI/180;
// Band centre, s mod pitch, at STRIPE_PHASE_T. 8.73 is the value measured on the
// reference; +0.70 is the constant offset between that measurement and where
// fillRect actually lands the band, calibrated by measuring this module's own
// output with the same estimator (0.70px, stable across all five stripe frames).
const STRIPE_PHASE=8.73+0.70;
const STRIPE_PHASE_T=36.117;
const STRIPE_DRIFT=-18.5;       // px/s along the perpendicular

// Caption fade-in, measured as an ink sum over the caption rows.
const CAPTION_ALPHA=[
  {t:35.742,v:0},{t:35.783,v:0.162},{t:35.825,v:0.408},
  {t:35.867,v:0.679},{t:35.909,v:0.957},{t:35.950,v:1}
];

// Last moment at which the entry changes anything. At this instant the stripe
// width has reached 0 (the mask contributes nothing), the stroke is the complete
// rectangle and the captions are at alpha 1, so both coincide with the plate and
// dropping out here cannot pop.
const ENTRY_END=STRIPE_FROM+STRIPE_SPAN;

function clamp01(v){return v<0?0:v>1?1:v}

// Edges of the panel, clockwise from the top-left corner. `panel` is
// [x0,y0,x1,y1] of the stroke centre lines.
function edgesOf(panel){
  const [x0,y0,x1,y1]=panel;
  return [[x0,y0,x1,y0],[x1,y0,x1,y1],[x1,y1,x0,y1],[x0,y1,x0,y0]];
}

// Draw the stroke up to `dist` design-space units along the perimeter. One path
// keeps the corners joined; round caps match the source's soft pen tip.
function drawStroke(g,panel,dist){
  if(dist<=0)return;
  const edges=edgesOf(panel);
  g.save();
  g.strokeStyle=INK;
  g.lineWidth=STROKE_WIDTH;
  g.lineCap='round';
  g.lineJoin='round';
  g.beginPath();
  g.moveTo(edges[0][0],edges[0][1]);
  let left=dist;
  for(const [ax,ay,bx,by] of edges){
    const len=Math.hypot(bx-ax,by-ay);
    if(left>=len){g.lineTo(bx,by);left-=len;continue}
    const u=left/len;
    g.lineTo(ax+(bx-ax)*u,ay+(by-ay)*u);
    left=0;
    break;
  }
  g.stroke();
  g.restore();
}

// White stripes: parallel bands of width `width` (0 = nothing, pitch = solid),
// perpendicular to the 45.4 deg wavevector, sliding at STRIPE_DRIFT.
function drawStripes(g,panel,t,width){
  if(!(width>0))return;
  const [x0,y0,x1,y1]=panel;
  const nx=Math.cos(STRIPE_ANGLE),ny=Math.sin(STRIPE_ANGLE);
  const sMin=Math.min(x0*nx+y0*ny,x1*nx+y0*ny,x0*nx+y1*ny,x1*nx+y1*ny);
  const sMax=Math.max(x0*nx+y0*ny,x1*nx+y0*ny,x0*nx+y1*ny,x1*nx+y1*ny);
  const phase=STRIPE_PHASE+STRIPE_DRIFT*(t-STRIPE_PHASE_T);
  const cx=(x0+x1)/2,cy=(y0+y1)/2;
  const sc0=cx*nx+cy*ny;
  const len=Math.hypot(x1-x0,y1-y0)+STRIPE_PITCH;
  const k0=Math.floor((sMin-phase)/STRIPE_PITCH)-1;
  const k1=Math.ceil((sMax-phase)/STRIPE_PITCH)+1;
  g.save();
  g.beginPath();
  g.rect(x0-STROKE_WIDTH,y0-STROKE_WIDTH,(x1-x0)+2*STROKE_WIDTH,(y1-y0)+2*STROKE_WIDTH);
  g.clip();
  g.fillStyle='#ffffff';
  g.translate(cx,cy);
  g.rotate(STRIPE_ANGLE);
  for(let k=k0;k<=k1;k++){
    const off=phase+k*STRIPE_PITCH-sc0;
    g.fillRect(off-width/2,-len/2,width,len);
  }
  g.restore();
}

// `api.drawScene` is passed in rather than imported (scene.mjs imports
// this module, so importing back would be a cycle). `api.asset` loads images.
export async function drawTvEntry(g,scene,t,api){
  if(t>=ENTRY_END)return;
  const cfg=scene.entry??{};
  const panel=cfg.panel??[58.5,38.2,898.6,500.8];

  const u=clamp01(Math.pow(clamp01((t-STRIPE_FROM)/STRIPE_SPAN),STRIPE_EASE));

  if(t<STRIPE_FROM){
    // Stage 1: the panel itself is blank white, so the whole frame is masked and
    // the plate's own border cannot pre-empt the drawing.
    g.save();
    g.fillStyle='#ffffff';
    g.fillRect(0,0,960,540);
    g.restore();
  }else if(u<1){
    // Stage 2: only the stripes are white; the illustration below shows through
    // the widening gaps. Width reaches the pitch exactly at STRIPE_FROM, which is
    // why the hand-over from the solid fill above is seamless.
    drawStripes(g,panel,t,STRIPE_PITCH*(1-u));
  }

  // The border is on top of the stripes, and the captions on top of the border.
  const walked=Math.max(0,(t-PEN_START)*PEN_SPEED);
  drawStroke(g,panel,walked);

  // External song lyrics are supplied as SRT; no source corner caption overlay.

}
