// Deterministic native Canvas rendering of the creator-provided color-stripe motion.
// The UI/RAF clock is removed. Eight alternating capsules use fixed row delays
// and one enter -> opaque hold -> same-direction exit pass; there is no looping.

const BAND_COUNT = 8;
const COLORS = ['#B2B6FF', '#8CFFDF'];
const ENTRY_ROW_DELAY = 0.08;
const EXIT_ROW_DELAY = 0.015;
const ENTER_SECONDS = 0.19;
const HOLD_END_SECONDS = 1.0;
const EXIT_START_SECONDS = 1.0;
const EXIT_SECONDS = 0.44;
const TOTAL_SECONDS = 1.565;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, u) => a + (b - a) * u;

function capsule(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  const r = Math.min(radius, height / 2, width / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export const COLOR_STRIPE_TIMING = Object.freeze({
  totalSeconds: TOTAL_SECONDS,
  enterSeconds: ENTER_SECONDS,
  holdEndSeconds: HOLD_END_SECONDS,
  exitStartSeconds: EXIT_START_SECONDS,
  exitSeconds: EXIT_SECONDS,
  entryRowDelay: ENTRY_ROW_DELAY,
  exitRowDelay: EXIT_ROW_DELAY,
  opaqueAtSourceSwitch: 18.25 - 17.435,
});

/** Draw the transparent capsule wipe over its current underlay. Progress is
 * normalized over the existing 17.435–19.000 source-PTS scene range. */
export function drawColorStripes(ctx, progress, { width = 960, height = 540 } = {}) {
  const elapsed = clamp(Number(progress) || 0, 0, 1) * TOTAL_SECONDS;
  const bandHeight = height / BAND_COUNT;
  const radius = bandHeight / 2;
  const bandWidth = width * 1.5;
  const coveredX = -width * 0.25;

  for (let i = 0; i < BAND_COUNT; i++) {
    const movesRight = i % 2 === 0;
    const delay = i * ENTRY_ROW_DELAY;
    const localEntry = elapsed - delay;
    let x;

    if (localEntry < 0) continue;
    if (localEntry < ENTER_SECONDS) {
      const startX = movesRight ? -bandWidth : width;
      x = lerp(startX, coveredX, localEntry / ENTER_SECONDS);
    } else {
      x = coveredX;
      const exitDelay = i * EXIT_ROW_DELAY;
      const localExit = elapsed - EXIT_START_SECONDS - exitDelay;
      if (localExit > 0) {
        if (localExit >= EXIT_SECONDS) continue;
        const endX = movesRight ? width : -bandWidth;
        x = lerp(coveredX, endX, localExit / EXIT_SECONDS);
      }
    }

    ctx.beginPath();
    capsule(ctx, x, i * bandHeight, bandWidth, bandHeight + 0.5, radius);
    ctx.fillStyle = COLORS[movesRight ? 0 : 1];
    ctx.fill();
  }
}
