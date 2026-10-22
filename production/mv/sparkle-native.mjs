// Deterministic native Canvas rendering of the creator-provided S0/S1 sparkle
// motion. The opening uses S1's small glints; browser controls and playback clock
// are replaced by source-time frame selection.

const TAU = Math.PI * 2;
const REF_W = 300;
const REF_H = 200;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = t => t < 0.5
  ? 4 * t * t * t
  : 1 - Math.pow(-2 * t + 2, 3) / 2;
const rgba = (r, g, b, a) => `rgba(${r}, ${g}, ${b}, ${a})`;

const PULSES = [
  {at:0,x:151,y:61,peakRadius:4.7,startScale:.34,grow:.100,hold:.030,decay:.180,alpha:.50,beam:1.12,aspect:1,tilt:-.030,wave:{delay:.015,duration:.240,from:.5,to:8.5,alpha:.018,w0:.5,w1:2.4,aura:.20}},
  {at:.200,x:178.5,y:93,peakRadius:11.8,startScale:.28,grow:.110,hold:.035,decay:.235,alpha:.86,beam:1.43,aspect:1.055,tilt:-.018,wave:{delay:.035,duration:.440,from:1.5,to:43,alpha:.070,w0:1.7,w1:12,aura:.50}},
  {at:.310,x:202,y:65,peakRadius:7,startScale:.24,grow:.090,hold:.028,decay:.205,alpha:.56,beam:1.19,aspect:1,tilt:.030,wave:{delay:.025,duration:.280,from:1,to:23,alpha:.045,w0:1,w1:7,aura:.50}},
  {at:.560,x:151,y:61,peakRadius:4.7,startScale:.28,grow:.100,hold:.080,decay:.225,alpha:.55,beam:1.13,aspect:1,tilt:-.020,wave:{delay:.020,duration:.220,from:.6,to:10,alpha:.018,w0:.5,w1:2.8,aura:.20}}
];

function sampleStar(pulse, t) {
  const age = t - pulse.at;
  const total = pulse.grow + pulse.hold + pulse.decay;
  if (age < 0 || age >= total) return null;
  let scale, alpha;
  if (age < pulse.grow) {
    const p = age / pulse.grow;
    scale = lerp(pulse.startScale, 1, easeOutCubic(p));
    alpha = pulse.alpha * lerp(.45, 1, smoothstep(0, .72, p));
  } else if (age < pulse.grow + pulse.hold) {
    scale = 1;
    alpha = pulse.alpha;
  } else {
    const p = (age - pulse.grow - pulse.hold) / pulse.decay;
    scale = lerp(1, .16, easeInOutCubic(p));
    alpha = pulse.alpha * Math.pow(1 - p, 1.35);
  }
  if (alpha < .001 || scale < .001) return null;
  return {x:pulse.x,y:pulse.y,radius:pulse.peakRadius*scale,alpha,beam:pulse.beam,rot:pulse.tilt,aspect:pulse.aspect};
}

function sampleWave(pulse, t) {
  const w = pulse.wave;
  const age = t - pulse.at - w.delay;
  const p = age / w.duration;
  if (p <= 0 || p >= 1) return null;
  const fade = smoothstep(0, .1, p) * Math.pow(1 - p, 1.25);
  const alpha = w.alpha * fade;
  if (alpha < .0008) return null;
  return {x:pulse.x,y:pulse.y,radius:lerp(w.from,w.to,easeOutCubic(p)),width:lerp(w.w0,w.w1,p),alpha,auraAlpha:alpha*w.aura};
}

function addSpike(ctx, length, width) {
  ctx.moveTo(-width, 0); ctx.lineTo(width, 0); ctx.lineTo(0, -length); ctx.closePath();
}
function addFourSpikes(ctx, length, width) {
  ctx.beginPath();
  for (let i=0;i<4;i++) { ctx.save(); ctx.rotate(i*Math.PI/2); addSpike(ctx,length,width); ctx.restore(); }
}
function fillRay(ctx, angle, length, width, strength) {
  if (length <= .01) return;
  ctx.save(); ctx.rotate(angle);
  const grad=ctx.createLinearGradient(0,0,length,0);
  grad.addColorStop(0,rgba(255,255,253,strength));
  grad.addColorStop(.1,rgba(255,253,245,strength*.72));
  grad.addColorStop(.38,rgba(255,250,238,strength*.24));
  grad.addColorStop(.74,rgba(255,247,230,strength*.055));
  grad.addColorStop(1,rgba(255,245,225,0));
  ctx.beginPath(); ctx.moveTo(0,-width); ctx.quadraticCurveTo(length*.23,-width*.48,length,0); ctx.quadraticCurveTo(length*.23,width*.48,0,width); ctx.closePath();
  ctx.fillStyle=grad; ctx.fill(); ctx.restore();
}
function drawStar(ctx, s) {
  const r=s.radius; if(r<.08||s.alpha<=.001)return;
  ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(Math.PI/4+s.rot); ctx.scale(s.aspect,1);
  ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=s.alpha;
  const haloR=r*5.1;
  let grad=ctx.createRadialGradient(0,0,0,0,0,haloR);
  grad.addColorStop(0,'rgba(255,253,245,.17)'); grad.addColorStop(.09,'rgba(255,251,238,.105)'); grad.addColorStop(.27,'rgba(255,248,231,.033)'); grad.addColorStop(.56,'rgba(255,246,226,.008)'); grad.addColorStop(1,'rgba(255,244,222,0)');
  ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(0,0,haloR,0,TAU); ctx.fill();
  grad=ctx.createRadialGradient(0,0,0,0,0,r*2.1); grad.addColorStop(0,'rgba(255,252,243,.16)'); grad.addColorStop(.32,'rgba(255,249,232,.06)'); grad.addColorStop(1,'rgba(255,247,228,0)');
  ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(0,0,r*2.1,0,TAU); ctx.fill();
  const ray=Math.max(.38,r*.026);
  fillRay(ctx,0,r*s.beam*1.03,r*.14,.06); fillRay(ctx,Math.PI,r*s.beam*.98,r*.13,.048); fillRay(ctx,Math.PI/2,r*s.beam*.76,r*.11,.038); fillRay(ctx,-Math.PI/2,r*s.beam*.82,r*.115,.04);
  fillRay(ctx,0,r*s.beam*1.1,ray*1.18,.83); fillRay(ctx,Math.PI,r*s.beam*.98,ray*.96,.62); fillRay(ctx,Math.PI/2,r*s.beam*.81,ray*.78,.49); fillRay(ctx,-Math.PI/2,r*s.beam*.88,ray*.85,.54);
  addFourSpikes(ctx,r*1.1,r*.3); ctx.fillStyle='rgba(255,251,238,.085)'; ctx.fill();
  grad=ctx.createRadialGradient(0,0,0,0,0,r); grad.addColorStop(0,'rgba(255,255,255,1)'); grad.addColorStop(.16,'rgba(255,254,249,1)'); grad.addColorStop(.46,'rgba(255,252,242,.92)'); grad.addColorStop(.74,'rgba(255,249,235,.6)'); grad.addColorStop(.92,'rgba(255,245,225,.15)'); grad.addColorStop(1,'rgba(255,244,222,0)');
  addFourSpikes(ctx,r*.96,r*.19); ctx.fillStyle=grad; ctx.fill();
  addFourSpikes(ctx,r*.5,r*.09); ctx.fillStyle='rgba(255,255,253,.9)'; ctx.fill();
  grad=ctx.createRadialGradient(0,0,0,0,0,r*.36); grad.addColorStop(0,'rgba(255,255,255,1)'); grad.addColorStop(.3,'rgba(255,255,252,.66)'); grad.addColorStop(1,'rgba(255,253,244,0)');
  ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(0,0,r*.36,0,TAU); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.92)'; ctx.beginPath(); ctx.arc(0,0,Math.max(.32,r*.034),0,TAU); ctx.fill();
  ctx.restore();
}
function drawPulse(ctx, pulse) {
  const grad=ctx.createRadialGradient(0,0,0,0,0,pulse.radius);
  grad.addColorStop(0,rgba(255,251,240,pulse.alpha*.54)); grad.addColorStop(.3,rgba(255,249,235,pulse.alpha*.58)); grad.addColorStop(.64,rgba(255,246,226,pulse.alpha*.2)); grad.addColorStop(.88,rgba(255,244,222,pulse.alpha*.035)); grad.addColorStop(1,rgba(255,243,221,0));
  ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(0,0,pulse.radius,0,TAU); ctx.fill();
}
function drawWave(ctx, wave) {
  const inner=Math.max(0,wave.radius-wave.width*.75),outer=wave.radius+wave.width*.75;
  if(outer<=.05)return;
  const grad=ctx.createRadialGradient(0,0,inner,0,0,outer);
  grad.addColorStop(0,rgba(255,249,234,0)); grad.addColorStop(.13,rgba(255,251,239,wave.alpha*.035)); grad.addColorStop(.32,rgba(255,253,246,wave.alpha*.23)); grad.addColorStop(.47,rgba(255,254,250,wave.alpha)); grad.addColorStop(.58,rgba(255,252,243,wave.alpha*.28)); grad.addColorStop(.76,rgba(255,249,234,wave.alpha*.045)); grad.addColorStop(1,rgba(255,247,230,0));
  ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(0,0,outer,0,TAU); ctx.fill();
}

/** Draw S1 on the existing transparent scene, using a deterministic source-frame index. */
export function drawNativeSparkles(ctx, frameIndex, { totalFrames = 19, width = 960, height = 540 } = {}) {
  const index=Math.floor(Number(frameIndex));
  if(!Number.isFinite(index)||index<=0||totalFrames<3||index>=totalFrames)return;
  // Keep the first source frame clear, then map the 17 active samples across S1's
  // full pulse span. The last sample reaches the fade endpoint with no residual.
  const normalized=clamp((index-1)/(totalFrames-2),0,1);
  const t=normalized*(.560+.100+.080+.225);
  const unit=Math.min(width/REF_W,height/REF_H),ox=(width-REF_W*unit)/2,oy=(height-REF_H*unit)/2;
  ctx.save(); ctx.translate(ox,oy); ctx.scale(unit,unit); ctx.globalCompositeOperation='lighter';
  for(const pulse of PULSES){
    const wave=sampleWave(pulse,t);
    if(wave){ctx.save();ctx.translate(wave.x,wave.y);drawPulse(ctx,{radius:wave.radius*.86,alpha:wave.auraAlpha});drawWave(ctx,wave);ctx.restore()}
  }
  for(const pulse of PULSES){const star=sampleStar(pulse,t);if(star)drawStar(ctx,star)}
  ctx.restore();
}
