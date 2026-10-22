/**
 * renderer-canvas2d.js — Canvas 2D 渲染器
 *
 * 与 WebGL 版共用同一份场景数据，只是把 SDF 换成路径。
 * 同样以「设计单位」作图（短边 = 1），由 ctx 变换负责缩放，
 * 所以放大到任意倍率依旧是矢量边缘。
 */

const TAU = Math.PI * 2;

export function createCanvas2DRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D 不可用');

  const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

  function resize(cssW, cssH, dpr) {
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return { w, h };
  }

  /**
   * 一个色块 = 扇形 ∪ 半圆头，合成一条路径一次填充，
   * 避免两个子图形在抗锯齿边缘上叠出接缝。
   */
  function drawComet(ctx, phi, halfAngle, radius, head, color) {
    let drew = false;
    ctx.beginPath();

    if (halfAngle > 1e-4 && radius > 1e-4) {
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, phi - halfAngle, phi + halfAngle);
      ctx.closePath();
      drew = true;
    }
    if (head > 1e-4) {
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, head, phi - Math.PI / 2, phi + Math.PI / 2);
      ctx.closePath();
      drew = true;
    }

    if (!drew) return;
    ctx.fillStyle = rgb(color);
    ctx.fill();
  }

  /** 笔迹：圆头圆弧 */
  function drawArc(ctx, arc) {
    if (arc.r <= 0 || arc.span <= 1e-4 || arc.width <= 0) return;
    ctx.save();
    ctx.globalAlpha *= arc.alpha;
    ctx.strokeStyle = rgb(arc.color);
    ctx.lineWidth = arc.width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, arc.r, arc.a0, arc.a1, false);
    ctx.stroke();
    ctx.restore();
  }

  function render(scene, view, dpr) {
    const { w, h } = resize(view.w, view.h, dpr);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // 设计单位 → 设备像素
    const s = view.scale * dpr;
    ctx.setTransform(s, 0, 0, s, view.cx * dpr, view.cy * dpr);

    // 与 WebGL 完全一致的层序：圆盘 → 粉 → 蓝 → 笔迹
    if (scene.disc.r > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, scene.disc.r, 0, TAU);
      ctx.fillStyle = rgb(scene.disc.color);
      ctx.fill();
    }

    const [pink, blue] = scene.comets;
    drawComet(ctx, pink.phi, pink.sectA, pink.sectR, pink.head, pink.color);
    drawComet(ctx, blue.phi, blue.sectA, blue.sectR, blue.head, blue.color);

    for (const arc of scene.arcs) drawArc(ctx, arc);
  }

  return {
    kind: 'canvas2d',
    label: 'Canvas 2D',
    render,
    dispose() {},
  };
}
