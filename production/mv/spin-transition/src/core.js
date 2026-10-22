/**
 * core.js — 时间轴 / 场景模型（纯数学，不碰 DOM、不碰 GPU）
 *
 * 坐标约定：设计单位，屏幕短边 = 1.0，原点在画面正中，y 轴朝下。
 * 渲染器只负责把设计单位映射到像素，所以同一份场景可以任意缩放而不失真。
 *
 * 动作构成（对照参考 R281–R306 逐帧标定）：
 *   1. 薰衣草圆盘      —— 底盘，从针尖大的点长成铺满画面，再缩回点
 *   2. 蓝 / 粉 扇形色块 —— 互为 180°，沿自转轴张开合拢（像雨刷），负责「擦除」
 *   3. 蓝 / 粉 半圆头   —— 平切边垂直于自转轴，负责收束时露出的「虹膜」
 *   4. 白 / 绿 两段弧   —— 一支旋转的「时针」扫出来的笔迹，不是预置圆环
 */

/* ------------------------------------------------------------------ */
/* 调色板（实测自参考 PNG）                                             */
/* ------------------------------------------------------------------ */
export const PALETTE = {
  blue:   [0xbd, 0xcc, 0xfe], // 长春花蓝
  pink:   [0xfd, 0x79, 0xf5], // 荧光粉
  violet: [0xbd, 0xb0, 0xfd], // 薰衣草紫（底盘）
  white:  [0xff, 0xff, 0xff],
  green:  [0xb9, 0xf0, 0x5f], // 青柠绿（笔迹）
};

export const DESIGN_ASPECT = 772 / 434;
export const FRAME_COUNT = 25;
export const DEFAULT_DURATION = (FRAME_COUNT - 1) / 24; // ≈ 1.0s @ 24fps

const TAU = Math.PI * 2;
const PI = Math.PI;
const D2R = PI / 180;

/* ------------------------------------------------------------------ */
/* 单调三次 Hermite 插值（Fritsch–Carlson）                             */
/* 关键帧再密也不会过冲，比逐段 smoothstep 顺滑                         */
/* ------------------------------------------------------------------ */
export function createTrack(values, { loop = false } = {}) {
  const n = values.length;
  if (n < 2) return () => values[0] ?? 0;

  const xs = values.map((_, i) => i / (n - 1));
  const ys = values.slice();

  const d = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);

  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }

  return function sample(t) {
    if (loop) t = t - Math.floor(t);
    else t = t < 0 ? 0 : t > 1 ? 1 : t;
    if (t <= 0) return ys[0];
    if (t >= 1) return ys[n - 1];

    let i = 0;
    while (i < n - 2 && t > xs[i + 1]) i++;

    const h = xs[i + 1] - xs[i];
    const u = (t - xs[i]) / h;
    const u2 = u * u;
    const u3 = u2 * u;

    return (2 * u3 - 3 * u2 + 1) * ys[i]
         + (u3 - 2 * u2 + u) * h * m[i]
         + (-2 * u3 + 3 * u2) * ys[i + 1]
         + (u3 - u2) * h * m[i + 1];
  };
}

/* ------------------------------------------------------------------ */
/* 关键帧表：25 个采样点，索引 i ↔ 参考第 i+1 帧                        */
/* ------------------------------------------------------------------ */

/** 自转轴朝向（度）。0=右，-90=上，-180=左（屏幕坐标） */
const T_SPIN = [
  -90, -92, -96, -101, -107, -113, -120, -126, -131, -135,
  -136, -134, -144, -168, -180, -183, -184, -184, -184, -184,
  -184, -184, -184, -184, -184
];

/** 薰衣草圆盘半径（实测：中心行弦长/2 ÷ 434） */
const T_DISC = [
  0.009, 0.014, 0.028, 0.041, 0.052, 0.078, 0.115, 0.172, 0.253, 0.392,
  0.550, 0.700, 0.850, 0.950, 1.000, 0.900, 0.836, 0.680, 0.400, 0.219,
  0.129, 0.076, 0.041, 0.018, 0.018,
];

/** 蓝色半圆头半径 */
const T_HEAD_B = [
  0.002, 0.002, 0.003, 0.003, 0.004, 0.004, 0.005, 0.006, 0.008, 0.010,
  0.030, 0.150, 0.620, 0.960, 1.240, 0.720, 0.366, 0.175, 0.088, 0.041,
  0.014, 0.006, 0.004, 0.002, 0.002,
];

/** 粉色半圆头半径（收束时比蓝色「晚半拍」，参考里粉色一直更大） */
const T_HEAD_P = [
  0.002, 0.002, 0.003, 0.003, 0.004, 0.004, 0.005, 0.006, 0.008, 0.011,
  0.034, 0.170, 0.700, 1.000, 1.280, 0.860, 0.717, 0.412, 0.212, 0.118,
  0.060, 0.032, 0.012, 0.004, 0.002,
];

/**
 * 扇形半张角（度）：0.6° 就是一根发丝，90° 变成半平面。
 * 粉色比蓝色早张开 —— 参考里始终是粉色先甩出去、蓝色跟上。
 * f10 处粉色恰好是 45°，形成一个贴着画面正右/正下边的象限，与实测吻合。
 */
const T_SECT_A_B = [
  0.6, 0.8, 1.2, 1.8, 2.6, 3.6, 5.5, 8, 12, 18,
  24, 90, 90, 90, 90, 84, 72, 60, 48, 38,
  28, 20, 13, 7, 4
];
const T_SECT_A_P = [
  0.8, 1.2, 1.8, 2.6, 4.2, 6.5, 10, 16, 22, 26,
  38, 90, 90, 90, 90, 86, 74, 62, 50, 40,
  30, 21, 14, 8, 4
];

/** 扇形外半径（真正负责把画面擦掉的那一层） */
const T_SECT_R_B = [
  0.52, 0.53, 0.54, 0.55, 0.56, 0.55, 0.54, 0.56, 0.64, 0.94,
  1.35, 2.1, 2.9, 3.1, 3.2, 0.6, 0.2, 0.05, 0.01, 0,
  0, 0, 0, 0, 0
];
const T_SECT_R_P = [
  0.52, 0.53, 0.54, 0.55, 0.56, 0.55, 0.54, 0.56, 0.62, 0.9,
  1.3, 2.05, 2.85, 3.08, 3.18, 0.65, 0.22, 0.06, 0.01, 0,
  0, 0, 0, 0, 0
];

/**
 * 笔迹半径：全程贴着 0.29（≈126px，正好是画面正右/正左那两个小点的半径），
 * 到 f14 随着整体收束一次性收半 —— 所以最后那一帧看到的是一个缩小的圆。
 */
const T_ARC_R = [
  0.29, 0.29, 0.29, 0.29, 0.29, 0.29, 0.29, 0.29, 0.29, 0.29,
  0.29, 0.29, 0.29, 0.22, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0
];

/** 笔迹不透明度 */
const T_ARC_A = [
  0.0, 0.55, 0.85, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
  1.0, 1.0, 1.0, 1.0, 0.7, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0
];

/**
 * 两条弧 = 两支同时起笔的「时针」，各自钉在一个点上向逆时针方向展开：
 *   绿笔的起点在画面**正右**（0°），向上扫，最后铺满整个上半圆；
 *   白笔的起点在画面**正左**（180°），向下扫，最后铺满整个下半圆。
 * 所以看起来是"从两侧中间钻出来"，一路长到彼此对接成一个整圆，再随整体缩小。
 *
 * 表里存的是「已经画出的角度」，位置由固定的 tail 角 + 逆时针方向推导。
 */
const ARC_GREEN_TAIL = 0;    // 度
const ARC_WHITE_TAIL = 180;  // 度

const T_SPAN_G = [ // 绿笔已画角度
  0, 1, 2, 5, 8, 12, 18, 26, 38, 57,
  90, 122, 150, 180, 180, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0,
];
const T_SPAN_W = [ // 白笔已画角度
  0, 1, 3, 5, 9, 13, 20, 29, 43, 68,
  104, 131, 158, 180, 180, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0,
];

const track = {
  spin: createTrack(T_SPIN),
  disc: createTrack(T_DISC),
  headB: createTrack(T_HEAD_B),
  headP: createTrack(T_HEAD_P),
  sectAB: createTrack(T_SECT_A_B),
  sectAP: createTrack(T_SECT_A_P),
  sectRB: createTrack(T_SECT_R_B),
  sectRP: createTrack(T_SECT_R_P),
  arcR: createTrack(T_ARC_R),
  arcA: createTrack(T_ARC_A),
  spanG: createTrack(T_SPAN_G),
  spanW: createTrack(T_SPAN_W),
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * 采样任意时刻的场景状态（所有长度都是短边比例，角度为弧度，y 向下）
 * @param {number} t 0..1
 */
export function sampleScene(t) {
  const u = clamp01(t);

  const spin = track.spin(u) * D2R;
  const discR = Math.max(0, track.disc(u));
  const arcR = Math.max(0, track.arcR(u));
  const arcA = track.arcA(u);

  /**
   * 一个色块 = 扇形（擦除用）∪ 半圆头（收束时的「虹膜」）。
   * 扇形半径和半圆头取较大值，收束阶段自然退化成半圆。
   */
  const comet = (id, phi, head, alphaDeg, wipeR, color) => {
    const a = Math.max(0, alphaDeg) * D2R;
    const R = Math.max(Math.max(0, head), Math.max(0, wipeR));
    return { id, phi, head: Math.max(0, head), sectA: a, sectR: R, color };
  };

  /**
   * 一段笔迹：起点角 tail 固定不动，逆时针方向已经画了 span 度。
   * a0/a1 始终保持 a0 < a1，渲染侧按「从 a0 逆时针到 a1」处理。
   */
  const arc = (id, color, r, tailDeg, spanDeg, width) => {
    const span = Math.max(0, spanDeg) * D2R;
    const tail = tailDeg * D2R;
    return { id, r, width, tail, span, a0: tail - span, a1: tail, color, alpha: arcA };
  };

  return {
    t: u,
    spin,
    disc: { r: discR, color: PALETTE.violet },
    comets: [
      comet('pink', spin + PI, track.headP(u), track.sectAP(u), track.sectRP(u), PALETTE.pink),
      comet('blue', spin, track.headB(u), track.sectAB(u), track.sectRB(u), PALETTE.blue),
    ],
    // 绿笔从正右向上扫满上半圆，白笔从正左向下扫满下半圆，最后对接成整圆
    arcs: [
      arc('green', PALETTE.green, arcR, ARC_GREEN_TAIL, track.spanG(u), 0.0135),
      arc('white', PALETTE.white, arcR, ARC_WHITE_TAIL, track.spanW(u), 0.0115),
    ],
  };
}

/* ------------------------------------------------------------------ */
/* 视图映射：设计单位 → 像素                                            */
/* ------------------------------------------------------------------ */
export function computeView(w, h, opt = {}) {
  const { mode = 'cover', zoom = 1, panX = 0, panY = 0 } = opt;
  const aspect = mode === 'fill' ? w / h : DESIGN_ASPECT;

  let scale;
  if (mode === 'contain') scale = Math.min(w / aspect, h);
  else if (mode === 'fill') scale = h;
  else scale = Math.max(w / aspect, h);

  scale *= zoom;

  return {
    w, h, aspect, scale, zoom, mode,
    cx: w / 2 + panX,
    cy: h / 2 + panY,
  };
}

export const frameToTime = (i) => clamp01((i - 1) / (FRAME_COUNT - 1));
export const timeToFrame = (t) => Math.round(clamp01(t) * (FRAME_COUNT - 1)) + 1;

export { clamp01, TAU };
