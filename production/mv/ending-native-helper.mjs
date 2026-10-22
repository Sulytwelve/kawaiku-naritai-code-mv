// Transparent geometry only; actual performers and backgrounds belong to the compositor.
// Native extraction: original/js/transitions.js SHA in import-sha256.json.
// Source PTS replaces the web player clock; no demo assets or backgrounds.
  'use strict';

  var W = 1280;
  var H = 720;

  var C = {
    green:       '#BCDD3F',
    lightPurple: '#A198F3',
    blue:        '#7F91EF',
    peach:       '#FFA297',
    yellow:      '#FFE478',
    sand:        '#F7E6BC',
    salmon:      '#FC7D86',
    brightGreen: '#7FDB6D',
    mint:        '#90F2D9',
    lavender:    '#B1BAFF',
    pink:        '#FACCD0',
    periwinkle:  '#BDC1F7'
  };

  /* ---------------------------------------------------------------- */
  /* 缓动                                                              */
  /* ---------------------------------------------------------------- */

  function clamp01(v) {
    return v < 0 ? 0 : (v > 1 ? 1 : v);
  }

  function easeInOutCubic(t) {
    t = clamp01(t);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function easeOutQuad(t) {
    t = clamp01(t);
    return 1 - (1 - t) * (1 - t);
  }

  /* ---------------------------------------------------------------- */
  /* 场景一：三横条入场                                                */
  /* ---------------------------------------------------------------- */
  /*
   * 结构不是“三条纯色横条”，而是：
   *   每一行 = 一条底色带 + 若干 508px 宽的色块，从右侧逐层滑入、压在前一层上。
   *
   * 色块位置用指数缓出：
   *   x(t) = target + (x0 - target) * exp(-(t - delay) / tau)
   * 这一条曲线同时解释了参考里“先冲进来、再慢慢蹭到位”的手感；
   * 不同 tau 让三行的拖尾长度不一样。
   *
   * 行与行之间原本是 8–16px 的背景缝；按照要求直接把三行拼成连续色块，
   * 上下各多画 0.5px，避免高 DPI 下的发丝缝。
   */
  var ROW_TOP = 260;
  var ROW_H = 65;

  var ROWS = [
    {
      y: ROW_TOP + ROW_H * 0,
      base: C.green,
      edge0: 512,
      edgeTau: 0.090,
      bars: [
        { color: C.lightPurple, x0: 1264, target: 96, tau: 0.060, delay: 0, width: 508 }
      ]
    },
    {
      y: ROW_TOP + ROW_H * 1,
      base: C.blue,
      edge0: 190,
      edgeTau: 0.090,
      bars: [
        { color: C.peach,  x0: 1166, target: 202,  tau: 0.045, delay: 0.04, width: 508 },
        { color: C.yellow, x0: 1400, target: 808,  tau: 0.045, delay: 0.19, width: 508 },
        { color: C.mint,   x0: 1300, target: 1000, tau: 0.060, delay: 0.35, width: 508 }
      ]
    },
    {
      /*
       * 第三行是一条「色块列车」：底色本身就是沙色，鲑红、亮绿、鲑红
       * 依次压在它上面。这样 SD 条滑到左边时不会再露出一截底色，
       * 也不会出现参考里那条透明缝。
       */
      y: ROW_TOP + ROW_H * 2,
      base: C.sand,
      edge0: 868,
      edgeTau: 0.095,
      bars: [
        { color: C.salmon,      x0: 868,  target: 397,  tau: 0.080, delay: 0,    width: 508 },
        { color: C.sand,        x0: 1136, target: -116, tau: 0.055, delay: 0,    width: 508 },
        { color: C.brightGreen, x0: 2152, target: 560,  tau: 0.055, delay: 0.06, width: 508 },
        { color: C.salmon,      x0: 2660, target: 1072, tau: 0.050, delay: 0.10, width: 508 }
      ]
    }
  ];

  /*
   * 三阶 Gamma 型位移：先停、再扫、最后长尾。
   *   g(u) = 1 - e^-u (1 + u + u²/2)
   * u=0 时速度为 0，所以色块不会一上来就冲出去；u 大时慢慢蹭到 target。
   * 这是参考里“画笔拖过去”的手感，比单纯 ease-out 更接近。
   */
  function gamma3(u) {
    if (u <= 0) return 0;
    return 1 - Math.exp(-u) * (1 + u + u * u / 2);
  }

  function barX(bar, t) {
    var u = Math.max(0, t - bar.delay) / bar.tau;
    return bar.target + (bar.x0 - bar.target) * (1 - gamma3(u));
  }

  function drawBars(ctx, t, opts) {
    opts = opts || {};

    for (var r = 0; r < ROWS.length; r++) {
      var row = ROWS[r];
      var edge = Math.max(0, row.edge0 * Math.exp(-t / row.edgeTau));

      ctx.save();
      ctx.beginPath();
      ctx.rect(edge, row.y - 1, W - edge, ROW_H + 2);
      ctx.clip();

      ctx.fillStyle = row.base;
      ctx.fillRect(0, row.y - 0.5, W, ROW_H + 1);

      for (var i = 0; i < row.bars.length; i++) {
        var bar = row.bars[i];
        var x = barX(bar, t);
        ctx.fillStyle = bar.color;
        /* 右侧多 0.5px 覆盖下一块，保证边界是一条干净的直线 */
        ctx.fillRect(x - 0.5, row.y - 0.5, bar.width + 1, ROW_H + 1);
      }

      ctx.restore();
    }
  }

  /* ---------------------------------------------------------------- */
  /* 场景二：中心菱形                                                  */
  /* ---------------------------------------------------------------- */
  /*
   * 时间轴（秒，对应参考的 46 帧 / 23.976fps）：
   *   0.00–0.50  粉色正方形一边放大一边旋转 45°→135°（屏幕上看起来像菱形）
   *   0.30–0.58  紫色正方形从同中心长出来，盖满整屏
   *   0.50–0.79  粉色保持
   *   0.79–1.17  粉色按 1-p³ 收缩到 0
   *   1.17–1.61  反向菱形遮罩放大，露出主角（固定 1:1 图像，不缩放）
   *   1.61–2.60  保持
   *
   * 粉色和紫色用同一个旋转角，紫色只是更大、更晚、更快。
   */
  var CENTER_X = W / 2;
  var CENTER_Y = H / 2;

  var GROW_END = 0.50;
  var HOLD_END = 0.79;
  var SHRINK_END = 1.17;
  var REVEAL_START = 1.17;
  var REVEAL_END = 1.60;
  var PINK_MAX = 690;

  function diamondPath(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
  }

  function squarePath(ctx, cx, cy, side, angleDeg) {
    var a = angleDeg * Math.PI / 180;
    var c = Math.cos(a);
    var s = Math.sin(a);
    var h = side / 2;
    var pts = [[-h, -h], [h, -h], [h, h], [-h, h]];

    ctx.beginPath();
    for (var i = 0; i < 4; i++) {
      var x = cx + pts[i][0] * c - pts[i][1] * s;
      var y = cy + pts[i][0] * s + pts[i][1] * c;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawDiamond(ctx, t, opts) {
    opts = opts || {};

    /* 粉色正方形的旋转：45° → 135°，与放大共用一条 S 曲线 */
    var growP = clamp01(t / GROW_END);
    var growE = easeInOutCubic(growP);
    var angle = 45 + 90 * growE;

    /*
     * 紫色覆盖层：从粉色当前大小「长出来」，所以 0.28s 时它和粉色完全重合，
     * 不会凭空弹出一圈紫边；随后它加速反超，最终盖满画幅。
     */
    if (t >= 0.28) {
      var pinkNow = 24 + (PINK_MAX - 24) * growE;
      var periP = clamp01((t - 0.28) / 0.35);
      var periSide = pinkNow + (1750 - pinkNow) * easeInOutCubic(periP);
      ctx.fillStyle = C.periwinkle;
      squarePath(ctx, CENTER_X, CENTER_Y, periSide, angle);
      ctx.fill();
    }

    /* 粉色主体 */
    var side = 0;
    if (t < HOLD_END) {
      side = 24 + (PINK_MAX - 24) * growE;
    } else if (t < SHRINK_END) {
      var p = clamp01((t - HOLD_END) / (SHRINK_END - HOLD_END));
      side = PINK_MAX * (1 - p * p * p);
    }

    if (side > 0.01) {
      ctx.fillStyle = C.pink;
      squarePath(ctx, CENTER_X, CENTER_Y, side, angle);
      ctx.fill();
    }

    // Punch a genuine alpha hole. The actual final portrait is drawn once by
    // the pipeline beneath this layer and never resized by the reveal.
    if(t>=REVEAL_START){
      var rp=clamp01((t-REVEAL_START)/(REVEAL_END-REVEAL_START));
      // A centered axis-aligned diamond covers corners at r=W/2+H/2,
      // not at the Euclidean diagonal used by the browser demo's image swap.
      var radius=(W+H+2)/2*easeOutQuad(rp);
      ctx.save();ctx.globalCompositeOperation='destination-out';
      diamondPath(ctx,CENTER_X,CENTER_Y,radius);ctx.fill();ctx.restore();
    }
  }

  /* ---------------------------------------------------------------- */

  export const EndingNative={W,H,COLORS:C,drawBars,drawDiamond};
  export const ENDING_NATIVE_TIMING=Object.freeze({barsStart:247.100,stripesStart:247.500,diamondStart:248.200,revealStart:249.370,revealFull:249.800});
  export function drawEndingBars(g,sourcePTS){
    if(sourcePTS<ENDING_NATIVE_TIMING.barsStart)return;
    g.save();g.scale(960/W,540/H);drawBars(g,sourcePTS-ENDING_NATIVE_TIMING.barsStart);g.restore();
  }
  export function drawEndingDiamond(g,sourcePTS){
    if(sourcePTS<ENDING_NATIVE_TIMING.diamondStart)return;
    g.save();g.scale(960/W,540/H);drawDiamond(g,sourcePTS-ENDING_NATIVE_TIMING.diamondStart);g.restore();
  }
