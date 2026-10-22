// Original-code replacement for the pastel color-grid transition.
// Design space is 960x540. Draw after the outgoing fashion scene; from 35.2s
// onward this module owns the white field and the separately drawn TV frame.
const COLUMNS=[
  {w:134,c:'#f3b7cb',delay:0.000,skew:-7},
  {w:102,c:'#bde8d5',delay:0.021,skew:5},
  {w:153,c:'#fff0aa',delay:0.008,skew:-4},
  {w:92,c:'#d9c9ed',delay:0.032,skew:8},
  {w:167,c:'#b9d6f1',delay:0.014,skew:-6},
  {w:127,c:'#c6b5e4',delay:0.039,skew:4},
  {w:185,c:'#f0bfd0',delay:0.026,skew:-3}
];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=v=>{v=clamp(v);return v*v*(3-2*v)};
const mix=(a,b,u)=>a+(b-a)*u;

function drawExpandingGrid(g,t){
  let x=0;
  for(let i=0;i<COLUMNS.length;i++){
    const col=COLUMNS[i],w=col.w;
    const u=ease((t-34.20-col.delay)/(.40-col.delay));
    const h=270*u;
    g.fillStyle=col.c;
    // Slightly overlap adjacent rectangles to prevent antialiased hairline gaps.
    const left=Math.max(0,x-.35),right=Math.min(960,x+w+.35),cw=right-left;
    const top=270-h,bottom=270;
    // Alternating slanted shoulders keep the grid from reading as a rigid checker.
    const d=col.skew*(1-u);
    g.beginPath();g.moveTo(left,top);g.lineTo(right,top+d);g.lineTo(right,bottom);g.lineTo(left,bottom-d);g.closePath();g.fill();
    g.beginPath();g.moveTo(left,bottom-d);g.lineTo(right,bottom);g.lineTo(right,bottom+h+d);g.lineTo(left,bottom+h);g.closePath();g.fill();
    x+=w;
  }
}

function drawExitingGrid(g,t){
  const u=ease((t-35.20)/.58);
  // Each half needs only one half-screen of travel to clear the canvas.
  const dy=270*u;
  let x=0;
  for(let i=0;i<COLUMNS.length;i++){
    const col=COLUMNS[i],w=col.w;
    // A small time offset gives the columns a soft, staggered departure.
    const stagger=ease((t-35.20-col.delay*.55)/(.58-col.delay*.55));
    const d=col.skew*(1-stagger);
    g.fillStyle=col.c;
    const left=Math.max(0,x-.35),right=Math.min(960,x+w+.35);
    g.beginPath();g.moveTo(left,-dy);g.lineTo(right,-dy+d);g.lineTo(right,270-d-dy);g.lineTo(left,270-dy);g.closePath();g.fill();
    g.beginPath();g.moveTo(left,270+dy);g.lineTo(right,270-d+dy);g.lineTo(right,540+dy);g.lineTo(left,540+dy+d);g.closePath();g.fill();
    x+=w;
  }
}

function drawTvBorder(g,t,panel){
  const [x0,y0,x1,y1]=panel,perimeter=2*((x1-x0)+(y1-y0));
  const u=clamp((t-35.78)/.54),distance=perimeter*u;
  if(distance<=0)return;
  const edges=[[x0,y0,x1,y0],[x1,y0,x1,y1],[x1,y1,x0,y1],[x0,y1,x0,y0]];
  g.save();g.beginPath();g.moveTo(x0,y0);let remaining=distance;
  for(const [ax,ay,bx,by] of edges){const length=Math.hypot(bx-ax,by-ay);if(remaining>=length){g.lineTo(bx,by);remaining-=length;continue}const q=remaining/length;g.lineTo(mix(ax,bx,q),mix(ay,by,q));break}
  g.strokeStyle='#b9466a';g.lineWidth=2.18;g.lineCap='round';g.lineJoin='round';g.stroke();g.restore();
}

/**
 * Draw the pastel grid and TV-frame transition over an already rendered scene.
 * Returns true when this module owns visible pixels; callers may pass
 * `{panel:[x0,y0,x1,y1]}` as the optional api override for frame registration.
 */
export function drawColorGridCanvas(g,t,api={}){
  if(t<34.20||t>=36.367)return false;
  g.save();
  if(t<34.60){drawExpandingGrid(g,t)}
  else if(t<35.20){
    // The held grid is an opaque full-screen field.
    let x=0;for(const col of COLUMNS){g.fillStyle=col.c;g.fillRect(x,0,col.w+.4,540);x+=col.w}
  }
  else {
    // From the exit onward, paint white first so the outgoing TV underlay cannot
    // leak into the widening center gap.
    g.fillStyle='#fff';g.fillRect(0,0,960,540);
    if(t<35.78)drawExitingGrid(g,t);
    else drawTvBorder(g,t,api.panel??[58.5,38.2,898.6,500.8]);
  }
  g.restore();return true;
}
