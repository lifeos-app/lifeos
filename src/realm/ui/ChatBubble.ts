/**
 * ChatBubble — Canvas-drawn speech bubble
 *
 * Renders a floating text bubble above a character on the game canvas.
 */

const MAX_VISIBLE_CHARS = 160;
const BUBBLE_MAX_WIDTH = 300;
const BUBBLE_BG = 'rgba(13, 13, 43, 0.85)';
const BUBBLE_BORDER = 'rgba(255, 215, 0, 0.4)';
const TEXT_COLOR = '#C8D6E5';
const BUBBLE_DURATION = 5000;
const FADE_START = 4000;

export interface ChatBubbleOptions {
  persistent?: boolean;     // if true, no auto-fade
  maxWidth?: number;        // override BUBBLE_MAX_WIDTH
  bgColor?: string;        // override BUBBLE_BG
  borderColor?: string;    // override BUBBLE_BORDER (NPC-themed)
}

export function drawChatBubble(
  ctx: CanvasRenderingContext2D,
  text: string,
  screenX: number,
  screenY: number,
  unit: number,
  ageMs: number,
  options?: ChatBubbleOptions,
): void {
  const isPersistent = options?.persistent ?? false;

  if (!isPersistent && ageMs >= BUBBLE_DURATION) return;

  // Truncate
  const display = text.length > MAX_VISIBLE_CHARS
    ? text.slice(0, MAX_VISIBLE_CHARS) + '...'
    : text;

  // Fade out in last second (skip if persistent)
  const alpha = isPersistent
    ? 1
    : ageMs > FADE_START
      ? 1 - (ageMs - FADE_START) / (BUBBLE_DURATION - FADE_START)
      : 1;

  ctx.save();
  ctx.globalAlpha = alpha;

  const effectiveMaxWidth = options?.maxWidth ?? BUBBLE_MAX_WIDTH;

  // Measure text for word wrap
  const fontSize = Math.max(9, Math.round(unit * 3.2));
  ctx.font = `${fontSize}px monospace`;

  // Word wrap
  const lines = wrapText(ctx, display, effectiveMaxWidth - 12);
  const lineHeight = fontSize + 2;
  const textHeight = lines.length * lineHeight;

  // Bubble dimensions
  let maxLineWidth = 0;
  for (const line of lines) {
    const w = ctx.measureText(line).width;
    if (w > maxLineWidth) maxLineWidth = w;
  }
  const bubbleW = Math.min(effectiveMaxWidth, maxLineWidth + 16);
  const bubbleH = textHeight + 10;
  const pointerH = 5;

  // Position: centered above character, offset above name area
  const bx = screenX - bubbleW / 2;
  const by = screenY - unit * 16 - bubbleH - pointerH;

  // Rounded rect background
  const r = 4;
  ctx.fillStyle = options?.bgColor ?? BUBBLE_BG;
  ctx.strokeStyle = options?.borderColor ?? BUBBLE_BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + bubbleW - r, by);
  ctx.arcTo(bx + bubbleW, by, bx + bubbleW, by + r, r);
  ctx.lineTo(bx + bubbleW, by + bubbleH - r);
  ctx.arcTo(bx + bubbleW, by + bubbleH, bx + bubbleW - r, by + bubbleH, r);
  ctx.lineTo(bx + r, by + bubbleH);
  ctx.arcTo(bx, by + bubbleH, bx, by + bubbleH - r, r);
  ctx.lineTo(bx, by + r);
  ctx.arcTo(bx, by, bx + r, by, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Pointer triangle
  ctx.beginPath();
  ctx.moveTo(screenX - 4, by + bubbleH);
  ctx.lineTo(screenX, by + bubbleH + pointerH);
  ctx.lineTo(screenX + 4, by + bubbleH);
  ctx.closePath();
  ctx.fillStyle = options?.bgColor ?? BUBBLE_BG;
  ctx.fill();

  // Text
  ctx.fillStyle = TEXT_COLOR;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], bx + 8, by + 5 + i * lineHeight);
  }

  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}
