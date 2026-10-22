// Opening (0.129-19.2s) and ending (246.9-252.13s) compositor.
//
// Consumes assets/runtime/opening-assets/source-tracks.json, which
// was prepared earlier and had no consumer: a per-source-frame registration of
// the floral background and of the mirror, plus the inner-glass ellipse, the
// sparkle sequence and the ending wink patch.
//
// The mirror is NOT static: its tracked matrix runs from scale 1.000 at 0.129s
// to 1.120, so a fixed plate puts the glass in the wrong place from about 10s on.
// Layer order matches the source: background, glass/character inside the glass,
// then the frame drawn over the top (which is why the hair is clipped by it).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {drawEndingBars,drawEndingDiamond,ENDING_NATIVE_TIMING} from './ending-native-helper.mjs';
import {drawColorStripes,COLOR_STRIPE_TIMING} from './color-stripes-native.mjs';
import {drawNativeSparkles} from './sparkle-native.mjs';
import {createRequire} from 'node:module';
import {conditionRun,contiguousRuns,sampleLerp,lerp} from './track-smoothing.mjs';
import {drawFashion} from './fashion-scenes.mjs';
import {drawFloralBackground,setCanvasFactory} from './pattern-backgrounds-canvas.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const DATA=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/runtime/opening-assets/source-tracks.json'),'utf8'));
const svgRequire=createRequire(import.meta.url);
const {loadImage:loadMirrorSvg}=svgRequire('@napi-rs/canvas');
const mirrorSvgCache=new Map();
async function mirrorBorder(g,api){
 const file=DATA.mirror_assets.border;
 if(!file.endsWith('.svg'))return api.asset(file);
 const density=Math.max(1,Math.ceil(g.canvas.width/1280));
 const key=file+':'+density;
 if(!mirrorSvgCache.has(key)){
  // Keep the supplied file intact. Its opaque blue mirror group is replaced by
  // the existing animated glass/reflection, while all frame ornaments remain.
  let svg=fs.readFileSync(path.join(ROOT,file),'utf8');
  svg=svg.replace(/<g id="mirror"[^>]*>[\s\S]*?<\/g>/,'');
  svg=svg.replace(/(<svg\b[^>]*\bwidth=")([\d.]+)(")/,(_,a,w,b)=>a+(Number(w)*density)+b)
    .replace(/(<svg\b[^>]*\bheight=")([\d.]+)(")/,(_,a,h,b)=>a+(Number(h)*density)+b);
  mirrorSvgCache.set(key,loadMirrorSvg(Buffer.from(svg)));
 }
 return mirrorSvgCache.get(key);
}

const flat=m=>m?[m[0][0],m[0][1],m[0][2],m[1][0],m[1][1],m[1][2]]:null;
const unflat=v=>[[v[0],v[1],v[2]],[v[3],v[4],v[5]]];

// Same conditioning as the performance tracks: these matrices come off the same
// 23.81Hz tracker and are resampled to 60Hz, so holding a sample would judder.
const rows=(()=>{
  const out=DATA.samples.map(r=>({
    t:r.t,
    background:r.background?r.background.matrix.map(x=>[...x]):null,
    mirror:r.mirror?r.mirror.matrix.map(x=>[...x]):null
  }));
  for(const key of ['background','mirror']){
    let i=0;
    while(i<out.length){
      if(!out[i][key]){i++;continue}
      let j=i+1;
      while(j<out.length&&out[j][key]&&out[j].t-out[j-1].t<=0.06)j++;
      conditionRun(out,i,j,k=>flat(out[k][key]),(k,v)=>{out[k][key]=unflat(v)},{smoothPasses:1});
      i=j;
    }
  }
  // As the stripe wipe covers the mirror, SIFT loses the remaining sliver.
  // Preserve the last registered assembly instead of snapping it to identity.
  for(const key of ['background','mirror']){
    let last=null;
    for(const row of out){if(row.t>19.3)break;if(row[key])last=row[key];else if(last)row[key]=last;}
  }
  return out;
})();

const ELLIPSE=DATA.mirror_assets.inner_ellipse;   // [[cx,cy],[full width,full height],rotation deg]
const BG=DATA.background_template;
const EXPRESSIONS=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/runtime/expression-patches/expression-local-patches.json'),'utf8'));
const REGISTRATION=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/runtime/opening-assets/expression-registration.json'),'utf8'));

// ===========================================================================
// 1. The opening-mirror reflection, measured rather than guessed.
//
// The source's first 17s carry a reflection that sweeps across the glass from
// the upper-left toward the lower-right; the character develops *behind* it, the
// glass then fades back to empty, and a second sweep brings both back together.
// Measurements use mirror-canonical space: each frame is warped by the inverse
// of the tracked mirror matrix so a moving mirror cannot masquerade as a fade.
//
// Geometry. Principal-axis fits of the near-white pixels over 0.63-0.88s give a
// band direction of 144-151 deg (a straight band, not a wedge), so the normal --
// the direction the reflection travels -- is
//     n = (0.515, 0.857),  i.e. 59 deg below horizontal, toward the lower right.
// That is exactly the reviewer's "from the top-left toward the bottom-right".
const REFLECTION_NORMAL=[0.515,0.857];
const GLASS=[ELLIPSE[0][0],ELLIPSE[0][1]];

// The reflection is TWO parallel streaks travelling as one rigid unit, which is
// why they are modelled as one position plus a fixed separation rather than two
// independent tracks. Measured centres of the lower streak, relative to the glass
// centre along the normal:
//   0.546 -171 | 0.587 -159 | 0.629 -135 | 0.671 -99 | 0.713 -61 | 0.754 -19
//   0.796  +27 | 0.838  +73 | 0.879 +125 | 0.921 +167 | 0.963 +209
// and for the second sweep:
//   9.553 -167 | 9.595 -149 | 9.637 -111 | 9.678 -67 | 9.720 -17 | 9.762 +35
//   9.803  +89 | 9.845 +145 | 9.929 +209
// Cross-correlating the 1-D brightness profile between consecutive frames gives
// 354 -> 1183 px/s, i.e. the sweep eases in and never quite settles; the keys
// above reproduce that acceleration rather than a straight line.
const STREAK_GAP=80;        // separation of the two streaks, along the normal
const STREAK_HALF=34;       // half extent of one streak's soft edge
const GLASS_HALF=175;       // glass half extent along the normal (ellipse 280x371)

// Both ends sit well outside the glass (+/-209) so a sweep can start and stop
// without a pop: when no sweep is live there is simply nothing on the glass. The
// extra lead-in key at -320 puts the develop-in's soft edge entirely off the glass
// before the sweep begins, so the very first revealed sliver grows in instead of
// appearing at once.
const SWEEPS=[
  {from:0.440,to:1.040,keys:[[0.440,-320],[0.500,-215],[0.546,-171],[0.587,-159],[0.629,-135],
    [0.671,-99],[0.713,-61],[0.754,-19],[0.796,27],[0.838,73],[0.879,125],
    [0.921,167],[0.963,209],[1.040,285]]},
  {from:9.440,to:10.030,keys:[[9.440,-320],[9.500,-215],[9.553,-167],[9.595,-149],[9.637,-111],
    [9.678,-67],[9.720,-17],[9.762,35],[9.803,89],[9.845,145],[9.929,209],[10.030,285]]}
];

// The second sweep is a change of look as well as a reveal. Probing two mirror
// points 120px either side of the front along the normal: the one behind it is
// blue (167,197,225) at 9.512 and warm (230,219,155) from 9.678, while the one
// ahead stays blue until the front reaches it. So the warm plate is painted with
// the very same reveal mask, which is why the glass turns over exactly under the
// reflection instead of cross-fading on its own.
const PLATE_WARM=[227,216,158];

// The streak's alpha profile across the normal, measured off the leading streak
// at 0.754s while the glass underneath is still empty: opaque core +-6px, half
// maximum at +-18, gone by +-34. It is a soft gradient, never a hard edge.
const STREAK_PROFILE=[[-34,0],[-30,0.06],[-26,0.15],[-22,0.30],[-18,0.50],
  [-14,0.72],[-10,0.92],[-6,1],[6,1],[10,0.92],[14,0.72],[18,0.50],[22,0.30],
  [26,0.15],[30,0.06],[34,0]];

// The character develops BEHIND the sweep: alpha=1 for every normal coordinate
// the front has already passed, 0 ahead of it. Measured across the lower streak
// at 0.754/0.796/0.838s (alpha 1.0 up to the streak, 0.2-0.4 just past it), and
// the soft edge is about as wide as the streak itself.
const REVEAL_LEAD=32;       // reveal front sits just past the lower streak centre
const REVEAL_RAMP=42;       // half-width of the develop-in's soft edge

// Back to an empty glass, measured as the median alpha against the fully revealed
// plate (1.00 at 8.594, 0.82 at 8.636, 0.63 at 8.677, 0.44 at 8.719, 0.25 at
// 8.761, 0.01 at 8.803). Linear over that span.
const FADE_OUT=[8.594,8.810];

// The measured pose schedule places the develop-in inside mirror-empty-open and
// mirror-empty-mid, which carry no character layer. Read placements from
// tracks.json so they are defined in one place.
const TRACKS=JSON.parse(fs.readFileSync(path.join(ROOT,'production/mv/tracks.json'),'utf8'));
const PLACEMENT=Object.fromEntries(TRACKS.scenes.filter(s=>s.opening?.asset).map(s=>[s.id,s.opening]));
// Switch times measured on mirror-glare-fine / mirror-glare-late. `blend` is the
// cross-fade the source itself uses, not a smoothing added here: at 16.267 the
// two poses are both half-visible (a real dissolve between the cosmetic pose and
// the wink), and the eyelids run from open at 5.75 to lidded at 6.13 rather than
// cutting.
const POSES=[
  {t:0.129,id:'mirror-cheeks'},
  {t:5.900,id:'mirror-cheeks-lidded',blend:0.230},
  {t:9.440,id:'mirror-makeup'},
  {t:16.180,id:'mirror-wink',blend:0.171}
];

// Deterministic frame clock for the creator-provided S1 multi-glint motion.
const SPARK_FRAMES=19;
const SPARK_FROM=16.395;
const SOURCE_FPS=24000/1001;

function curveAt(keys,t){
  if(t<=keys[0][0])return keys[0][1];
  const last=keys[keys.length-1];
  if(t>=last[0])return last[1];
  for(let i=1;i<keys.length;i++){
    if(t<=keys[i][0]){
      const [t0,v0]=keys[i-1],[t1,v1]=keys[i];
      return t1>t0?v0+(v1-v0)*(t-t0)/(t1-t0):v1;
    }
  }
  return last[1];
}

// Position of the lower streak along the normal, or null when no sweep is live.
// A sweep's first and last keys are outside the glass, so returning null at the
// window edges is continuous with the streak having already left.
function streakAt(t){
  for(const s of SWEEPS)if(t>=s.from&&t<=s.to)return curveAt(s.keys,t);
  return null;
}

// Reveal front along the normal: closed before the first sweep, open from the end
// of the first sweep until the second begins, open after the second.
function revealFront(t){
  const s=streakAt(t);
  if(s!==null)return s+REVEAL_LEAD;
  if(t<SWEEPS[0].from)return-GLASS_HALF-STREAK_HALF-REVEAL_RAMP;
  return GLASS_HALF+STREAK_HALF+REVEAL_RAMP+1;
}

function charOpacity(t){
  if(t<FADE_OUT[0])return 1;
  if(t<FADE_OUT[1])return 1-(t-FADE_OUT[0])/(FADE_OUT[1]-FADE_OUT[0]);
  if(t<SWEEPS[1].from)return 0;
  return 1;
}

// Layers of the character at this source time: one pose normally, two while the
// source itself is dissolving between poses.
function poseLayers(t){
  let i=0;
  while(i+1<POSES.length&&t>=POSES[i+1].t)i++;
  const k=POSES[i];
  if(k.blend&&i>0&&t<k.t+k.blend){
    const u=(t-k.t)/k.blend;
    if(k.id==='mirror-cheeks-lidded')return [{id:k.id,alpha:1,eyeAlpha:u}];
    return [{id:POSES[i-1].id,alpha:1-u},{id:k.id,alpha:u}];
  }
  return [{id:k.id,alpha:1}];
}

// Gradient axis covering the whole glass plus a streak's soft edge, in mirror
// coordinates. Canvas clamps beyond the outermost stop, which is what makes the
// develop-in fully open or fully closed outside the ramp.
const AXIS=-260,AXIS_SPAN=520;
const axisPoint=s=>[GLASS[0]+REFLECTION_NORMAL[0]*s,GLASS[1]+REFLECTION_NORMAL[1]*s];
const axisFraction=s=>(s-AXIS)/AXIS_SPAN;

// One reusable scratch plate: the develop-in needs a destination-in mask, and a
// 960x540 surface allocated 60 times a second would dominate the frame cost.
let scratch=null;
function scratchCtx(createCanvas,g){
  // Keep the character at the requested output resolution during the wipe.
  // Geometry stays in 960x540 logical coordinates, as on the main compositor.
  const m=g.getTransform(),scale=Math.max(1,Math.min(4,Math.hypot(m.a,m.b)));
  const width=Math.round(960*scale),height=Math.round(540*scale);
  if(!scratch||scratch.width!==width||scratch.height!==height)scratch=createCanvas(width,height);
  const c=scratch.getContext('2d');
  c.setTransform(1,0,0,1,0,0);
  c.globalAlpha=1;
  c.globalCompositeOperation='source-over';
  c.clearRect(0,0,width,height);c.scale(width/960,height/540);
  return c;
}

const apply=(g,m)=>g.transform(m[0][0],m[1][0],m[0][1],m[1][1],m[0][2],m[1][2]);

async function drawPose(g,l,t,api){
  const cheek=l.id==='mirror-cheeks'||l.id==='mirror-cheeks-lidded';
  const p=cheek?PLACEMENT['mirror-cheeks']:l.pose;
  g.save();g.globalAlpha*=l.alpha;
  const im=await api.asset(p.asset);
  g.translate(p.x,p.y);g.scale(p.w/im.width,p.h/im.height);g.drawImage(im,0,0);
  let patch=null;
  if(l.id==='mirror-cheeks-lidded')patch=EXPRESSIONS.cheeks.lidded;
  else if(cheek&&t>=4.13&&t<5.63)patch=REGISTRATION.cheeksRightDown;
  if(patch){g.globalAlpha*=l.eyeAlpha??1;g.drawImage(await api.asset(patch.asset),...patch.source,...patch.destination)}
  g.restore();
}

let endingOverlay;
async function drawEndingPortrait(g,api){
  const cfg=REGISTRATION.ending;
  setCanvasFactory(api.createCanvas);
  drawFloralBackground(g,{variant:'aqua',createCanvas:api.createCanvas,cacheSize:{width:3840,height:2160}});
  const im=await api.asset(cfg.body.asset),[x,y,w,h]=cfg.body.rect;
  g.save();g.translate(x,y);g.scale(w/im.width,h/im.height);g.drawImage(im,0,0);
  // Keep the existing fixed body and local wink exactly aligned.
  if(cfg.winkPatch){const p=cfg.winkPatch;g.drawImage(await api.asset(p.asset),...p.source,...p.destination)}
  g.restore();
}
async function drawEnding(g,t,api){
  const {stripesStart,revealStart,revealFull}=ENDING_NATIVE_TIMING;
  // The underlay switch is concealed by the fully opaque periwinkle square.
  // After that only the native alpha hole changes; the portrait never scales.
  if(t<revealStart)await drawFashion(g,{fashion:{stage:'fashion-finale'}},247.043,api);
  else await drawEndingPortrait(g,api);
  if(t>=revealFull)return;
  const m=g.getTransform(),w=Math.max(1,Math.round(960*Math.hypot(m.a,m.b))),h=Math.max(1,Math.round(540*Math.hypot(m.c,m.d)));
  if(!endingOverlay||endingOverlay.width!==w||endingOverlay.height!==h)endingOverlay=api.createCanvas(w,h);
  const q=endingOverlay.getContext('2d');q.resetTransform();q.clearRect(0,0,w,h);q.globalAlpha=1;q.globalCompositeOperation='source-over';q.scale(w/960,h/540);
  drawEndingBars(q,t);
  if(t>=stripesStart){
    // Entry is reused unchanged; hold at full coverage until the concentric
    // diamond obscures it. A premature capsule exit would uncover the train.
    const elapsed=Math.min(.99,t-stripesStart);
    drawColorStripes(q,elapsed/COLOR_STRIPE_TIMING.totalSeconds);
  }
  drawEndingDiamond(q,t);
  g.drawImage(endingOverlay,0,0,960,540);
}

export async function drawOpening(g,scene,t,api){
  const cfg=scene.opening;
  if(cfg.stage==='ending')return drawEnding(g,t,api);

  const row=sampleLerp(rows,t,(a,b,u)=>({
    background:a.background&&b.background?a.background.map((r,i)=>r.map((v,j)=>lerp(v,b.background[i][j],u))):(a.background??b.background),
    mirror:a.mirror&&b.mirror?a.mirror.map((r,i)=>r.map((v,j)=>lerp(v,b.mirror[i][j],u))):(a.mirror??b.mirror)
  }));

  // 1. floral background, registered by its own tracked matrix
  setCanvasFactory(api.createCanvas);
  g.save();
  if(row.background)apply(g,row.background);
  drawFloralBackground(g,{variant:'mint',createCanvas:api.createCanvas,cacheSize:{width:3840,height:2160},w:BG.draw_size[0],h:BG.draw_size[1]});
  g.restore();

  // 2. mirror assembly, registered by the tracked mirror matrix
  g.save();
  if(row.mirror)apply(g,row.mirror);

  // Layer order, bottom to top:
  //   1. floral background   (drawn above, tracked by the background matrix)
  //   2. solid glass fill    (always present: the character and the empty mirror
  //                           both sit on it)
  //   3. character, clipped to the glass
  //   4. reflection, clipped to the glass, over the character
  //   5. mirror frame, on top of everything and never covered by it
  // The frame is a separate asset for exactly that reason: in the source the
  // hair is clipped by the frame, not drawn over it.
  const [c,axes,rot]=ELLIPSE;
  const clipGlass=()=>{
    g.beginPath();
    g.ellipse(c[0],c[1],axes[0]/2,axes[1]/2,(rot??0)*Math.PI/180,0,Math.PI*2);
    g.clip();
  };

  g.save();clipGlass();
  const [gr,gg,gb]=DATA.mirror_assets.blue_rgb;
  g.fillStyle=`rgb(${gr},${gg},${gb})`;
  g.fillRect(0,0,960,540);
  g.restore();

  // The character layer. Assets and placements come from the same per-scene
  // Scene ranges describe coverage; the measured pose schedule selects the
  // active character layer and places develop-in/fade-out inside the empty spans.
  const opacity=charOpacity(t);
  const front=revealFront(t);
  const open=front>GLASS_HALF+STREAK_HALF+REVEAL_RAMP;
  const warm=t>=SWEEPS[1].from;
  const warmCss=`rgb(${PLATE_WARM[0]},${PLATE_WARM[1]},${PLATE_WARM[2]})`;
  const layers=[];
  for(const l of poseLayers(t)){
    const pose=PLACEMENT[l.id],alpha=opacity*l.alpha;
    if(pose?.asset&&alpha>0)layers.push({id:l.id,pose,alpha,eyeAlpha:l.eyeAlpha});
  }
  if(open){
    // Fully revealed: no mask needed, so the plate change and the character are
    // both plain draws. The developed-in side of the second sweep is the warm look.
    g.save();clipGlass();
    if(warm){g.fillStyle=warmCss;g.fillRect(0,0,960,540)}
    for(const l of layers){
      await drawPose(g,l,t,api);
    }
    g.restore();
  }else if(layers.length||warm){
    // Partial develop-in: paint the warm plate (second sweep only) and the
    // character on the scratch plate, cut them with one soft gradient along the
    // sweep normal, then composite through the glass clip. A hard polygon edge
    // here would pop, and using two different masks would let the plate and the
    // character drift apart.
    const q=scratchCtx(api.createCanvas,g);
    if(warm){q.fillStyle=warmCss;q.fillRect(0,0,960,540)}
    for(const l of layers){
      await drawPose(q,l,t,api);
    }
    q.globalAlpha=1;
    q.globalCompositeOperation='destination-in';
    const [x0,y0]=axisPoint(front-REVEAL_RAMP);
    const [x1,y1]=axisPoint(front+REVEAL_RAMP);
    const mask=q.createLinearGradient(x0,y0,x1,y1);
    mask.addColorStop(0,'rgba(255,255,255,1)');
    mask.addColorStop(1,'rgba(255,255,255,0)');
    q.fillStyle=mask;
    q.fillRect(0,0,960,540);
    q.globalCompositeOperation='source-over';
    g.save();clipGlass();
    g.drawImage(scratch,0,0,960,540);
    g.restore();
  }

  // 3. The reflection sweep: two parallel white streaks, soft-edged, travelling as
  // one rigid unit. Drawn over the character and clipped to the glass, which is
  // what makes the develop-in read as the reflection revealing her.
  const lead=streakAt(t);
  if(lead!==null){
    g.save();clipGlass();
    const [x0,y0]=axisPoint(AXIS);
    const [x1,y1]=axisPoint(AXIS+AXIS_SPAN);
    const grad=g.createLinearGradient(x0,y0,x1,y1);
    let stops=0;
    for(const centre of [lead-STREAK_GAP,lead]){
      for(const [du,a]of STREAK_PROFILE){
        const s=centre+du;
        if(s<=AXIS||s>=AXIS+AXIS_SPAN)continue;
        // White with the measured alpha profile: across the streak at 0.754s the
        // core is (255,255,253) and the skirt blends to the blue plate, so a plain
        // white alpha ramp is the right composition.
        grad.addColorStop(axisFraction(s),`rgba(255,255,255,${a})`);
        stops++;
      }
    }
    // Both streaks can still be off the glass during a sweep's lead-in key; a
    // gradient with no stops is transparent, but skipping the fill is cheaper.
    if(stops){
      g.fillStyle=grad;
      g.fillRect(0,0,960,540);
    }
    g.restore();
  }

  const newRect=DATA.mirror_assets.user_frame_rect;if(newRect){g.save();g.beginPath();g.rect(0,0,960,540);g.ellipse(c[0],c[1],axes[0]/2,axes[1]/2,0,0,Math.PI*2);g.clip('evenodd');g.drawImage(await mirrorBorder(g,api),...newRect);g.restore()}else g.drawImage(await mirrorBorder(g,api),0,0);
  g.restore();

  // 4. Deterministic native sparkle, after the mirror/person/reflection layers.
  // Keep the measured source-frame clock; the helper leaves frame 0 and the last
  // frame transparent so this layer enters and exits without a pop.
  const sparkFrame=Math.floor((t-SPARK_FROM)*SOURCE_FPS);
  if(sparkFrame>=0&&sparkFrame<SPARK_FRAMES)drawNativeSparkles(g,sparkFrame,{totalFrames:SPARK_FRAMES});

}
