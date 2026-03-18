/**
 * EmoteRenderer — Canvas-drawn emote visual effects
 *
 * Each emote plays a 3-second animation above the character.
 * No emoji — everything is drawn procedurally on canvas.
 */

import type { EmoteType } from '../multiplayer/types';

const EMOTE_DURATION = 3000;

/**
 * Draw an emote visual effect above a character.
 * @param ctx - Canvas context
 * @param emote - Which emote to draw
 * @param cx - Center X (screen coords, above character head)
 * @param cy - Center Y (screen coords)
 * @param unit - Render unit scale
 * @param elapsedMs - Time since emote started (0–3000)
 * @param frameCount - Global frame counter for animation
 */
export function drawEmoteEffect(
  ctx: CanvasRenderingContext2D,
  emote: EmoteType,
  cx: number,
  cy: number,
  unit: number,
  elapsedMs: number,
  frameCount: number,
): void {
  if (elapsedMs >= EMOTE_DURATION) return;

  const t = elapsedMs / EMOTE_DURATION; // 0→1 normalized progress

  ctx.save();

  switch (emote) {
    case 'wave':
      drawWave(ctx, cx, cy, unit, t, frameCount);
      break;
    case 'cheer':
      drawCheer(ctx, cx, cy, unit, t, frameCount);
      break;
    case 'gg':
      drawGG(ctx, cx, cy, unit, t, frameCount);
      break;
    case 'brb':
      drawBRB(ctx, cx, cy, unit, t);
      break;
    case 'focus':
      drawFocus(ctx, cx, cy, unit, t, frameCount);
      break;
  }

  ctx.restore();
}

/** 3 oscillating arc lines radiating from character */
function drawWave(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, unit: number,
  t: number, frameCount: number,
): void {
  const fadeOut = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
  ctx.globalAlpha = fadeOut * 0.8;
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = Math.max(1, unit * 0.8);
  ctx.lineCap = 'round';

  for (let i = 0; i < 3; i++) {
    const phase = (frameCount * 0.08) + i * 2.1;
    const radius = unit * (4 + t * 8 + i * 3);
    const swing = Math.sin(phase) * 0.3;
    const startAngle = -Math.PI * 0.6 + swing + i * 0.2;
    const endAngle = -Math.PI * 0.15 + swing + i * 0.2;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.stroke();
  }
}

/** 8 golden diamond shapes expanding outward with fade */
function drawCheer(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, unit: number,
  t: number, frameCount: number,
): void {
  const fadeOut = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
  const expandT = Math.min(t * 2, 1); // expand quickly

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + frameCount * 0.02;
    const dist = unit * (3 + expandT * 12);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const size = unit * (1.5 + Math.sin(frameCount * 0.1 + i) * 0.5);

    ctx.globalAlpha = fadeOut * (0.6 + Math.sin(i + frameCount * 0.05) * 0.3);
    ctx.fillStyle = i % 2 === 0 ? '#FFD700' : '#FFA500';

    // Diamond shape
    ctx.beginPath();
    ctx.moveTo(cx + dx, cy + dy - size);
    ctx.lineTo(cx + dx + size * 0.6, cy + dy);
    ctx.lineTo(cx + dx, cy + dy + size);
    ctx.lineTo(cx + dx - size * 0.6, cy + dy);
    ctx.closePath();
    ctx.fill();
  }
}

/** "GG" text with small star, scale-up then fade */
function drawGG(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, unit: number,
  t: number, frameCount: number,
): void {
  const scaleUp = t < 0.2 ? t / 0.2 : 1;
  const fadeOut = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
  const rise = t * unit * 6;

  ctx.globalAlpha = fadeOut;

  // "GG" text
  const fontSize = Math.max(10, unit * 5 * scaleUp);
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFD700';
  ctx.fillText('GG', cx, cy - rise);

  // Small star shape beside text
  const starX = cx + unit * 5 * scaleUp;
  const starY = cy - rise - unit * 2;
  const starSize = unit * 1.5 * scaleUp;
  const starPulse = 1 + Math.sin(frameCount * 0.15) * 0.2;

  ctx.fillStyle = '#FFFFFF';
  drawStar(ctx, starX, starY, starSize * starPulse, 4);
}

/** "BRB" text fading from full opacity to 0 over 3s */
function drawBRB(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, unit: number,
  t: number,
): void {
  ctx.globalAlpha = 1 - t;

  const fontSize = Math.max(10, unit * 4);
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#C8D6E5';
  ctx.fillText('BRB', cx, cy - t * unit * 4);
}

/** 2-3 concentric pulsing rings, blue-white tint */
function drawFocus(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, unit: number,
  t: number, frameCount: number,
): void {
  const fadeOut = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;

  for (let i = 0; i < 3; i++) {
    const phase = frameCount * 0.06 + i * 2;
    const pulse = 0.8 + Math.sin(phase) * 0.2;
    const radius = unit * (4 + i * 4) * pulse;
    const alpha = fadeOut * (0.5 - i * 0.12);

    ctx.globalAlpha = Math.max(0, alpha);
    ctx.strokeStyle = i === 0 ? '#FFFFFF' : '#64B5F6';
    ctx.lineWidth = Math.max(1, unit * (0.8 - i * 0.15));
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Draw a simple N-pointed star */
function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  size: number, points: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? size : size * 0.4;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}
