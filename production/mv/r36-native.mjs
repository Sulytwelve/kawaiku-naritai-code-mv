/*
 * R36 过场 · 反向遮罩版
 *
 * 原片结构（逐像素实测）：
 *   1. 紫色场 (196,168,236) 铺满；
 *   2. 中间是一条“透明缝”，不是蓝带：114.60 时缝只有 1px，缝内 alpha=0（露出后面的视频）；
 *   3. 缝是锯齿轮廓，边缘 #C6C3FF；缝绕中心逆时针转 90°，同时从 1px 张开到整屏；
 *   4. 115.0 以后是另一条锯齿波（淡紫 191,190,252），从中间细线放大到铺满，粉色核心 (255,221,245) 后出现。
 *
 * 所以蓝不是画上去的，是透明缝后面的底。
 */
// Native Canvas rendering of the creator-provided wave animation.
// Every value is a pure function of source PTS. No browser clock or recorded frames.
  'use strict';

  var START = 114.0;
  var END = 116.1;
  var FPS = 24000 / 1001;
  var FRAME = 1001 / 24000;

  var BLOCK_IN = 114.0;
  var BLOCK_FADE0 = 114.82;
  var BLOCK_FADE1 = 114.86;

  var MASK_IN = 114.54;
  var MASK_FADE1 = 114.60;
  var MASK_OUT = 114.95;
  var SLIT0 = 114.60;
  var SLIT1 = 114.78;

  var BAND_IN = 114.93;
  var BAND_FULL = 115.30;
  var BAND_T0 = 8;
  var BAND_T1 = 540;

  var PINK0 = 115.18;
  var PINK_T0 = 7;

  var CX = 480;
  var CY = 270;
  var SLIT_CX = 595;
  var PERIOD = 250;
  var AMP = 127;
  var BASE_PERIOD = 42;
  var BASE_AMP = 21;
  var BAND_PERIOD = 250;
  var BAND_AMP = 127;
  var PHASE = 19;

  var PURPLE = 'rgb(196,168,236)';
  var EDGE = 'rgb(198,195,255)';   // #C6C3FF
  var LAV = 'rgb(191,190,252)';
  var PINK = 'rgb(255,221,245)';
  var BLUE_REF = 'rgb(133,156,255)';

  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, u) { return a + (b - a) * u; };
  var smooth = function (u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };

  function ramp(rows, t) {
    if (t <= rows[0][0]) return rows[0][1];
    if (t >= rows[rows.length - 1][0]) return rows[rows.length - 1][1];
    for (var i = 1; i < rows.length; i++) {
      if (t <= rows[i][0]) {
        var t0 = rows[i - 1][0], v0 = rows[i - 1][1];
        var t1 = rows[i][0], v1 = rows[i][1];
        return v0 + (v1 - v0) * (t - t0) / (t1 - t0);
      }
    }
    return rows[rows.length - 1][1];
  }

  // ---------- 彩块段 ----------
  var LEAN = 0.1625;
  var PINK_BLOCK = [252, 168, 200];
  var MINT_BLOCK = [144, 232, 200];
  var LAV_BLOCK = [196, 168, 236];
  var BLUE_BLOCK = [136, 152, 248];
  var EDGE_P = [[114.0, 1010], [114.112, 420], [114.141, 345], [114.310, 86], [114.470, 48], [114.560, -100], [114.950, -100]];
  var EDGE_M = [[114.0, 1550], [114.112, 900], [114.141, 854], [114.224, 576], [114.310, 240], [114.470, 96], [114.560, -100], [114.950, -100]];
  var EDGE_L = [[114.0, 1900], [114.112, 1220], [114.310, 931], [114.390, 797], [114.470, 346], [114.560, 80], [114.640, 25], [114.700, 0], [114.800, -50], [114.950, -50]];
  var EDGE_B = [[114.780, 960], [114.850, 470], [114.890, 105], [114.930, 48], [114.950, 0]];

  function edgePath(g, xEdge, lean) {
    g.beginPath();
    g.moveTo(xEdge + lean * (0 - 270), 0);
    g.lineTo(xEdge + lean * (540 - 270), 540);
    g.lineTo(960, 540);
    g.lineTo(960, 0);
    g.closePath();
  }

  function blocksAlpha(t) {
    if (t < BLOCK_FADE0) return 1;
    if (t >= BLOCK_FADE1) return 0;
    return 1 - smooth((t - BLOCK_FADE0) / (BLOCK_FADE1 - BLOCK_FADE0));
  }

  function drawBlocks(g, t) {
    var a = blocksAlpha(t);
    if (a <= 0) return;
    var paint = function (rows, colour) {
      var x = ramp(rows, t);
      if (x - Math.abs(LEAN * 270) >= 960) return;
      g.save();
      edgePath(g, x, LEAN);
      g.clip();
      g.globalAlpha = a;
      g.fillStyle = colour;
      g.fillRect(0, 0, 960, 540);
      g.restore();
    };
    paint(EDGE_P, 'rgb(' + PINK_BLOCK.join(',') + ')');
    paint(EDGE_M, 'rgb(' + MINT_BLOCK.join(',') + ')');
    paint(EDGE_L, 'rgb(' + LAV_BLOCK.join(',') + ')');
    paint(EDGE_B, 'rgb(' + BLUE_BLOCK.join(',') + ')');
  }

  // ---------- 透明缝 ----------
  function zig(x, period, amp) {
    var p = period === undefined ? BAND_PERIOD : period;
    var a = amp === undefined ? BAND_AMP : amp;
    var u = (((x + PHASE) % p) + p) % p / p;
    var tri = u < 0.5 ? u * 2 : (1 - u) * 2;
    return a * (tri - 0.5);
  }

  // Preserve dense primary slit; the independent later wave uses period250.
  function scaleAt(t) {
    if (t <= SLIT0) return 1;
    return 1 + 0.18 * smooth((t - SLIT0) / (SLIT1 - SLIT0));
  }

  // 缝宽：1px 张开到整屏（原片 720p 实测 ×0.75）
  var SLIT_W = [
    [114.54, 0.5],
    [114.60, 1],
    [114.70, 8],
    [114.72, 24],
    [114.76, 50],
    [114.80, 100],
    [114.85, 540],
    [114.90, 800],
    [114.95, 800]
  ];

  function slitWidth(t) { return ramp(SLIT_W, t); }

  function slitAngle(t) {
    if (t <= SLIT0) return 90;
    if (t >= SLIT1) return 0;
    return 90 * (1 - smooth((t - SLIT0) / (SLIT1 - SLIT0)));
  }

  function maskAlpha(t) {
    if (t < MASK_IN) return 0;
    if (t < MASK_FADE1) return smooth((t - MASK_IN) / (MASK_FADE1 - MASK_IN));
    return 1;
  }

  function slitOutline(g,w,ang,period,amp,cx=0,cy=0) {
    var half=w/2,xs=[-1400],step=period/2,cs=Math.cos(ang*Math.PI/180),sn=Math.sin(ang*Math.PI/180);
    for(var k=Math.ceil((-1400+PHASE)/step);k*step-PHASE<1400;k++)xs.push(k*step-PHASE);
    xs.push(1400);g.beginPath();
    const point=(x,y,first=false)=>{const px=cx+cs*x-sn*y,py=cy+sn*x+cs*y;if(first)g.moveTo(px,py);else g.lineTo(px,py)};
    xs.forEach((x,i)=>point(x,-half+zig(x,period,amp),i===0));
    xs.slice().reverse().forEach(x=>point(x,half+zig(x,period,amp)));g.closePath();
  }

  function drawMask(g, t) {
    if (t < MASK_IN || t > MASK_OUT) return;
    var w = slitWidth(t);
    var ang = slitAngle(t);
    var s = scaleAt(t);
    var period = BASE_PERIOD * s;
    var amp = BASE_AMP * s;
    g.save();
    g.globalAlpha = maskAlpha(t);

    edgePath(g, ramp(EDGE_L,t), LEAN);g.clip();
    g.fillStyle = PURPLE;
    g.fillRect(0, 0, 960, 540);

    g.save();
    g.globalCompositeOperation = 'destination-out';
    slitOutline(g, w, ang, period, amp,SLIT_CX,CY);
    g.fill();
    g.restore();

    g.save();
    g.strokeStyle = EDGE;
    g.lineWidth = w < 3 ? 0 : 1.25;
    g.globalAlpha *= smooth((w-3)/5);
    g.lineJoin = 'miter';
    slitOutline(g, w, ang, period, amp,SLIT_CX,CY);
    g.stroke();
    g.restore();

    g.restore();
  }

  // ---------- 第二条锯齿波 ----------
  function bandThickness(t) {
    if (t < BAND_IN) return 0;
    var tau = (BAND_FULL - BAND_IN) / Math.log2(BAND_T1 / BAND_T0);
    return Math.min(800, BAND_T0 * Math.pow(2, (t - BAND_IN) / tau));
  }

  function pinkThickness(t) {
    if (t < PINK0) return 0;
    return Math.min(800, PINK_T0 * Math.pow(2, (t - PINK0) / FRAME));
  }

  function ribbon(g, th, colour) {slitOutline(g,th,0,BAND_PERIOD,BAND_AMP);g.fillStyle=colour;g.fill();}

  function drawBand(g, t) {
    if (t < BAND_IN) return;
    var th = bandThickness(t);
    var pt = pinkThickness(t);
    g.save();
    g.translate(CX, CY);
    ribbon(g, th, LAV);
    if (pt > 0.6) ribbon(g, pt, PINK);
    g.restore();
  }

  export function drawR36BluePlate(g,t){
    if(t<114.54)return;g.save();edgePath(g,ramp(EDGE_L,t),LEAN);g.clip();g.fillStyle=BLUE_REF;g.fillRect(0,0,960,540);g.restore();
  }
  // Independent mask canvas is allocated by the compositor at OUTPUT density;
  // destination-out only clears this isolated overlay, never the actual underlay.
  function draw(g,t,opts={}) {
    if(t<BLOCK_IN) return;
    const q=opts.maskContext;
    if(!q)throw new Error('R36 requires an isolated output-density overlay context');
    q.save();drawBlocks(q,t);drawMask(q,t);if(opts.wave!==false)drawBand(q,t);q.restore();
    g.drawImage(q.canvas,0,0,960,540);
  }

  function params(t) {
    return {
      t: t,
      angle: slitAngle(t),
      slit: slitWidth(t),
      band: bandThickness(t),
      pink: pinkThickness(t),
      blockAlpha: blocksAlpha(t),
      maskAlpha: maskAlpha(t)
    };
  }

  var api = {
    START: START,
    END: END,
    WAVE_IN: BAND_IN,
    WAVE_OUT: 116.017,
    FPS: FPS,
    BLOCK_IN: BLOCK_IN,
    MASK_IN: MASK_IN,
    MASK_OUT: MASK_OUT,
    ROT0: SLIT0,
    ROT1: SLIT1,
    PINK0: PINK0,
    CX: CX,
    CY: CY,
    PERIOD: PERIOD,
    AMP: AMP,
    draw: draw,
    params: params,
    slitWidth: slitWidth,
    slitAngle: slitAngle,
    bandThickness: bandThickness,
    pinkThickness: pinkThickness,
    thickness: bandThickness,
    pinkAt: pinkThickness,
    lavenderAt: function (t) { return t >= BAND_IN ? bandThickness(t) : 0; }
  };

  export {api as R36Native, draw as drawR36Overlay, drawMask as drawR36Mask, drawBlocks as drawR36Blocks, drawBand as drawR36Band};
