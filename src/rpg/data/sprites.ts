// Sprite definitions — placeholder until art assets are generated
// Sprites will be loaded from /public/rpg/sprites/

export interface SpriteDefinition {
  id: string;
  src: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  animations: Record<string, { start: number; end: number; speed: number }>;
}

// Placeholder sprite configs — actual sprites TBD
export const SPRITE_DEFS: Record<string, SpriteDefinition> = {
  warrior_idle: {
    id: 'warrior_idle',
    src: '/rpg/sprites/warrior.png',
    frameWidth: 64,
    frameHeight: 64,
    frames: 4,
    animations: {
      idle: { start: 0, end: 3, speed: 200 },
    },
  },
  mage_idle: {
    id: 'mage_idle',
    src: '/rpg/sprites/mage.png',
    frameWidth: 64,
    frameHeight: 64,
    frames: 4,
    animations: {
      idle: { start: 0, end: 3, speed: 200 },
    },
  },
  // ... other classes follow same pattern
};

// Color palette for character customization
export const SKIN_TONES = ['#FDDBB4', '#E8B98D', '#D19A6B', '#B5784D', '#8D5524', '#4A2D13'];
export const HAIR_COLORS = ['#2C1608', '#6B3A2A', '#B55239', '#D4A857', '#E8E8E8', '#C41E3A', '#1E90FF', '#9B59B6'];

// ── MapleStory-style part draw functions ──────────────────────

export type PartDrawFn = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  u: number,
  color: string,
  frame: number,
) => void;

export type FaceDrawFn = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  u: number,
  eyeColor: string,
  mood: number,
  frame: number,
) => void;

const OL = '#1a1a2e'; // outline color

function outline(ctx: CanvasRenderingContext2D, u: number) {
  ctx.strokeStyle = OL;
  ctx.lineWidth = Math.max(0.5, u * 0.25);
}

// ── Eye Colors ──────────────────────────────────
export const EYE_COLORS = ['#2C1608', '#1E90FF', '#2ECC71', '#9B59B6', '#E67E22', '#E74C3C'];

// ── Outfit / Bottom / Shoe Colors ───────────────
export const OUTFIT_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c'];
export const BOTTOM_COLORS = ['#2C3E50', '#1a1a2e', '#4A3728', '#2C5F2D', '#3B1F5C'];
export const SHOE_COLORS = ['#6B3A2A', '#1a1a2e', '#C0392B', '#F1C40F', '#ECF0F1'];

// ── Hair Styles (8) ─────────────────────────────
export const HAIR_STYLES: PartDrawFn[] = [
  // 0: Short basic
  (ctx, cx, cy, u, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy - u * 1.5, u * 5.2, Math.PI, Math.PI * 2);
    ctx.fill();
    outline(ctx, u); ctx.stroke();
    // Side tufts
    ctx.fillStyle = color;
    ctx.fillRect(cx - u * 5, cy - u * 3, u * 1.8, u * 3);
    ctx.fillRect(cx + u * 3.2, cy - u * 3, u * 1.8, u * 3);
  },
  // 1: Spiky
  (ctx, cx, cy, u, color) => {
    ctx.fillStyle = color;
    outline(ctx, u);
    const spikes = 5;
    for (let i = 0; i < spikes; i++) {
      const angle = Math.PI + (Math.PI / (spikes + 1)) * (i + 1);
      const bx = cx + Math.cos(angle) * u * 5;
      const by = cy - u * 1.5 + Math.sin(angle) * u * 5;
      const tx = cx + Math.cos(angle) * u * 8;
      const ty = cy - u * 1.5 + Math.sin(angle) * u * 8;
      ctx.beginPath();
      ctx.moveTo(bx - u, by);
      ctx.lineTo(tx, ty);
      ctx.lineTo(bx + u, by);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    // Base cap
    ctx.beginPath();
    ctx.arc(cx, cy - u * 1.5, u * 5.2, Math.PI, Math.PI * 2);
    ctx.fill();
  },
  // 2: Long straight
  (ctx, cx, cy, u, color, frame) => {
    const sway = Math.sin(frame * 0.03) * u * 0.4;
    ctx.fillStyle = color;
    outline(ctx, u);
    // Top cap
    ctx.beginPath();
    ctx.arc(cx, cy - u * 1.5, u * 5.2, Math.PI, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Long sides
    ctx.beginPath();
    ctx.moveTo(cx - u * 5, cy - u * 3);
    ctx.bezierCurveTo(cx - u * 5.5, cy + u * 4, cx - u * 4 + sway, cy + u * 8, cx - u * 3 + sway, cy + u * 10);
    ctx.lineTo(cx - u * 3.5 + sway, cy + u * 10);
    ctx.bezierCurveTo(cx - u * 3, cy + u * 6, cx - u * 3.5, cy, cx - u * 3.5, cy - u * 3);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + u * 5, cy - u * 3);
    ctx.bezierCurveTo(cx + u * 5.5, cy + u * 4, cx + u * 4 - sway, cy + u * 8, cx + u * 3 - sway, cy + u * 10);
    ctx.lineTo(cx + u * 3.5 - sway, cy + u * 10);
    ctx.bezierCurveTo(cx + u * 3, cy + u * 6, cx + u * 3.5, cy, cx + u * 3.5, cy - u * 3);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  },
  // 3: Mushroom bowl
  (ctx, cx, cy, u, color) => {
    ctx.fillStyle = color;
    outline(ctx, u);
    ctx.beginPath();
    ctx.arc(cx, cy - u * 1, u * 5.8, Math.PI * 0.85, Math.PI * 2.15);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  },
  // 4: Twin tails
  (ctx, cx, cy, u, color, frame) => {
    const sway = Math.sin(frame * 0.04) * u * 0.5;
    ctx.fillStyle = color;
    outline(ctx, u);
    // Top cap
    ctx.beginPath();
    ctx.arc(cx, cy - u * 1.5, u * 5.2, Math.PI, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Left tail
    ctx.beginPath();
    ctx.moveTo(cx - u * 4.5, cy - u * 1);
    ctx.bezierCurveTo(cx - u * 6, cy + u * 2 + sway, cx - u * 7, cy + u * 6, cx - u * 5.5 + sway, cy + u * 10);
    ctx.lineTo(cx - u * 4.5 + sway, cy + u * 10);
    ctx.bezierCurveTo(cx - u * 5.5, cy + u * 5, cx - u * 4, cy + u * 2, cx - u * 3.5, cy - u * 1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Right tail
    ctx.beginPath();
    ctx.moveTo(cx + u * 4.5, cy - u * 1);
    ctx.bezierCurveTo(cx + u * 6, cy + u * 2 - sway, cx + u * 7, cy + u * 6, cx + u * 5.5 - sway, cy + u * 10);
    ctx.lineTo(cx + u * 4.5 - sway, cy + u * 10);
    ctx.bezierCurveTo(cx + u * 5.5, cy + u * 5, cx + u * 4, cy + u * 2, cx + u * 3.5, cy - u * 1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  },
  // 5: Swept bangs
  (ctx, cx, cy, u, color) => {
    ctx.fillStyle = color;
    outline(ctx, u);
    ctx.beginPath();
    ctx.arc(cx, cy - u * 1.5, u * 5.2, Math.PI, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Swept fringe over one eye
    ctx.beginPath();
    ctx.moveTo(cx + u * 4, cy - u * 4);
    ctx.bezierCurveTo(cx + u * 2, cy - u * 2, cx - u * 2, cy - u * 1, cx - u * 5.5, cy);
    ctx.lineTo(cx - u * 5, cy - u * 1);
    ctx.bezierCurveTo(cx - u * 1, cy - u * 2.5, cx + u * 2, cy - u * 3.5, cx + u * 4.5, cy - u * 5);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  },
  // 6: Messy long
  (ctx, cx, cy, u, color, frame) => {
    const sway = Math.sin(frame * 0.025) * u * 0.3;
    ctx.fillStyle = color;
    outline(ctx, u);
    // Base
    ctx.beginPath();
    ctx.arc(cx, cy - u * 1.5, u * 5.5, Math.PI * 0.8, Math.PI * 2.2);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Messy strands
    for (let i = -2; i <= 2; i++) {
      const sx = cx + i * u * 2;
      ctx.beginPath();
      ctx.moveTo(sx, cy - u * 2);
      ctx.bezierCurveTo(sx + u + sway, cy + u * 2, sx - u + sway, cy + u * 5, sx + sway * 0.5, cy + u * 8);
      ctx.lineTo(sx + u * 0.8 + sway * 0.5, cy + u * 7.5);
      ctx.bezierCurveTo(sx + u * 0.5 + sway, cy + u * 4, sx + u * 1.5 + sway, cy + u * 1, sx + u * 0.5, cy - u * 2);
      ctx.closePath();
      ctx.fill();
    }
  },
  // 7: Flowing
  (ctx, cx, cy, u, color, frame) => {
    const sway = Math.sin(frame * 0.02) * u * 0.6;
    ctx.fillStyle = color;
    outline(ctx, u);
    // Top cap
    ctx.beginPath();
    ctx.arc(cx, cy - u * 1.5, u * 5.2, Math.PI, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Flowing body behind
    ctx.beginPath();
    ctx.moveTo(cx - u * 5, cy - u * 2);
    ctx.bezierCurveTo(cx - u * 6 + sway, cy + u * 3, cx - u * 5 + sway, cy + u * 8, cx - u * 2 + sway, cy + u * 12);
    ctx.lineTo(cx + u * 2 - sway, cy + u * 12);
    ctx.bezierCurveTo(cx + u * 5 - sway, cy + u * 8, cx + u * 6 - sway, cy + u * 3, cx + u * 5, cy - u * 2);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  },
];

// ── Face Types (6) ──────────────────────────────
export const FACE_TYPES: FaceDrawFn[] = [
  // 0: Big round eyes (MapleStory default)
  (ctx, cx, cy, u, eyeColor, mood) => {
    const eyeR = u * 1.4;
    for (const side of [-1, 1]) {
      const ex = cx + side * u * 1.8;
      const ey = cy;
      // White sclera
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill();
      outline(ctx, u); ctx.stroke();
      // Colored iris
      ctx.fillStyle = eyeColor;
      ctx.beginPath(); ctx.arc(ex, ey + u * 0.15, eyeR * 0.6, 0, Math.PI * 2); ctx.fill();
      // Pupil
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(ex, ey + u * 0.2, eyeR * 0.3, 0, Math.PI * 2); ctx.fill();
      // Shine dots
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex - u * 0.3, ey - u * 0.3, eyeR * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex + u * 0.15, ey - u * 0.15, eyeR * 0.1, 0, Math.PI * 2); ctx.fill();
    }
    // Mouth
    drawMouth(ctx, cx, cy + u * 2.2, u, mood);
  },
  // 1: Almond eyes
  (ctx, cx, cy, u, eyeColor, mood) => {
    for (const side of [-1, 1]) {
      const ex = cx + side * u * 1.8;
      const ey = cy;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(ex, ey, u * 1.5, u * 1, 0, 0, Math.PI * 2);
      ctx.fill(); outline(ctx, u); ctx.stroke();
      ctx.fillStyle = eyeColor;
      ctx.beginPath(); ctx.arc(ex, ey + u * 0.1, u * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(ex, ey + u * 0.15, u * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex - u * 0.25, ey - u * 0.2, u * 0.15, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex + u * 0.1, ey - u * 0.1, u * 0.08, 0, Math.PI * 2); ctx.fill();
    }
    drawMouth(ctx, cx, cy + u * 2.2, u, mood);
  },
  // 2: Cat eyes
  (ctx, cx, cy, u, eyeColor, mood) => {
    for (const side of [-1, 1]) {
      const ex = cx + side * u * 1.8;
      const ey = cy;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(ex, ey, u * 1.3, u * 1.1, side * 0.15, 0, Math.PI * 2);
      ctx.fill(); outline(ctx, u); ctx.stroke();
      ctx.fillStyle = eyeColor;
      ctx.beginPath(); ctx.ellipse(ex, ey + u * 0.1, u * 0.4, u * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(ex, ey + u * 0.15, u * 0.2, u * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex - u * 0.2, ey - u * 0.3, u * 0.15, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex + u * 0.1, ey - u * 0.1, u * 0.08, 0, Math.PI * 2); ctx.fill();
    }
    // Cat mouth: w shape
    ctx.strokeStyle = OL;
    ctx.lineWidth = Math.max(0.5, u * 0.3);
    ctx.beginPath();
    ctx.moveTo(cx - u * 0.6, cy + u * 2);
    ctx.lineTo(cx, cy + u * 2.3);
    ctx.lineTo(cx + u * 0.6, cy + u * 2);
    ctx.stroke();
  },
  // 3: Cheerful (^_^)
  (ctx, cx, cy, u, _eyeColor, mood) => {
    ctx.strokeStyle = OL;
    ctx.lineWidth = Math.max(0.8, u * 0.4);
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      const ex = cx + side * u * 1.8;
      ctx.beginPath();
      ctx.arc(ex, cy + u * 0.3, u * 1, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    // Blush
    ctx.fillStyle = 'rgba(255,150,150,0.3)';
    ctx.beginPath(); ctx.ellipse(cx - u * 2.8, cy + u * 1, u * 0.8, u * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + u * 2.8, cy + u * 1, u * 0.8, u * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    drawMouth(ctx, cx, cy + u * 2.2, u, Math.max(mood, 4));
  },
  // 4: Determined
  (ctx, cx, cy, u, eyeColor, mood) => {
    for (const side of [-1, 1]) {
      const ex = cx + side * u * 1.8;
      const ey = cy;
      // Stern brow
      ctx.strokeStyle = OL;
      ctx.lineWidth = Math.max(0.8, u * 0.4);
      ctx.beginPath();
      ctx.moveTo(ex - side * u * 0.8, ey - u * 1.3);
      ctx.lineTo(ex + side * u * 1.2, ey - u * 1);
      ctx.stroke();
      // Eye
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex, ey, u * 1.2, 0, Math.PI * 2); ctx.fill();
      outline(ctx, u); ctx.stroke();
      ctx.fillStyle = eyeColor;
      ctx.beginPath(); ctx.arc(ex, ey + u * 0.1, u * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(ex, ey + u * 0.15, u * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex - u * 0.2, ey - u * 0.2, u * 0.15, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex + u * 0.1, ey - u * 0.05, u * 0.08, 0, Math.PI * 2); ctx.fill();
    }
    drawMouth(ctx, cx, cy + u * 2.2, u, mood);
  },
  // 5: Big sparkle
  (ctx, cx, cy, u, eyeColor, mood, frame) => {
    const sparkle = 0.9 + Math.sin(frame * 0.1) * 0.1;
    for (const side of [-1, 1]) {
      const ex = cx + side * u * 1.8;
      const ey = cy;
      const r = u * 1.5 * sparkle;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
      outline(ctx, u); ctx.stroke();
      ctx.fillStyle = eyeColor;
      ctx.beginPath(); ctx.arc(ex, ey + u * 0.15, r * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(ex, ey + u * 0.2, r * 0.3, 0, Math.PI * 2); ctx.fill();
      // Multi shine
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex - u * 0.4, ey - u * 0.4, r * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex + u * 0.2, ey - u * 0.15, r * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex - u * 0.1, ey + u * 0.4, r * 0.08, 0, Math.PI * 2); ctx.fill();
    }
    drawMouth(ctx, cx, cy + u * 2.2, u, mood);
  },
];

function drawMouth(ctx: CanvasRenderingContext2D, cx: number, cy: number, u: number, mood: number) {
  ctx.strokeStyle = OL;
  ctx.lineWidth = Math.max(0.5, u * 0.3);
  ctx.lineCap = 'round';
  if (mood >= 4) {
    ctx.beginPath();
    ctx.arc(cx, cy - u * 0.3, u * 0.8, 0.1, Math.PI - 0.1);
    ctx.stroke();
  } else if (mood <= 2) {
    ctx.beginPath();
    ctx.arc(cx, cy + u * 0.3, u * 0.6, Math.PI + 0.2, -0.2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - u * 0.4, cy);
    ctx.lineTo(cx + u * 0.4, cy);
    ctx.stroke();
  }
}

// ── Top Styles (4) ──────────────────────────────
export const TOP_STYLES: PartDrawFn[] = [
  // 0: Basic tee
  (ctx, cx, cy, u, color) => {
    ctx.fillStyle = color;
    outline(ctx, u);
    // Torso
    ctx.beginPath();
    ctx.moveTo(cx - u * 2.5, cy - u * 0.5);
    ctx.lineTo(cx + u * 2.5, cy - u * 0.5);
    ctx.lineTo(cx + u * 2.5, cy + u * 5);
    ctx.lineTo(cx - u * 2.5, cy + u * 5);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Collar
    ctx.beginPath();
    ctx.arc(cx, cy - u * 0.3, u * 0.8, 0.2, Math.PI - 0.2);
    ctx.stroke();
  },
  // 1: Armor
  (ctx, cx, cy, u, color) => {
    ctx.fillStyle = color;
    outline(ctx, u);
    ctx.beginPath();
    ctx.moveTo(cx - u * 2.8, cy - u * 0.5);
    ctx.lineTo(cx + u * 2.8, cy - u * 0.5);
    ctx.lineTo(cx + u * 2.5, cy + u * 5);
    ctx.lineTo(cx - u * 2.5, cy + u * 5);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Shoulder plates
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx - u * 3.5, cy, u * 1.5, u * 1, 0.3, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + u * 3.5, cy, u * 1.5, u * 1, -0.3, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Belt
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(cx - u * 2.5, cy + u * 4, u * 5, u * 0.8);
    // Buckle
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(cx - u * 0.4, cy + u * 4, u * 0.8, u * 0.8);
  },
  // 2: Robe
  (ctx, cx, cy, u, color) => {
    ctx.fillStyle = color;
    outline(ctx, u);
    ctx.beginPath();
    ctx.moveTo(cx - u * 2.5, cy - u * 0.5);
    ctx.lineTo(cx + u * 2.5, cy - u * 0.5);
    ctx.lineTo(cx + u * 3, cy + u * 6);
    ctx.lineTo(cx - u * 3, cy + u * 6);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Center trim
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = Math.max(0.5, u * 0.3);
    ctx.beginPath();
    ctx.moveTo(cx, cy - u * 0.5);
    ctx.lineTo(cx, cy + u * 6);
    ctx.stroke();
    // V neckline
    ctx.strokeStyle = OL;
    ctx.lineWidth = Math.max(0.5, u * 0.25);
    ctx.beginPath();
    ctx.moveTo(cx - u * 1, cy - u * 0.5);
    ctx.lineTo(cx, cy + u * 1);
    ctx.lineTo(cx + u * 1, cy - u * 0.5);
    ctx.stroke();
  },
  // 3: Hoodie
  (ctx, cx, cy, u, color) => {
    ctx.fillStyle = color;
    outline(ctx, u);
    ctx.beginPath();
    ctx.moveTo(cx - u * 2.5, cy - u * 0.5);
    ctx.lineTo(cx + u * 2.5, cy - u * 0.5);
    ctx.lineTo(cx + u * 2.5, cy + u * 5.5);
    ctx.lineTo(cx - u * 2.5, cy + u * 5.5);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Hood outline around neck
    ctx.beginPath();
    ctx.arc(cx, cy - u * 0.5, u * 1.8, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
    // Front pocket
    ctx.strokeStyle = OL;
    ctx.lineWidth = Math.max(0.5, u * 0.2);
    ctx.beginPath();
    ctx.moveTo(cx - u * 1.5, cy + u * 3);
    ctx.lineTo(cx - u * 1.5, cy + u * 4.5);
    ctx.lineTo(cx + u * 1.5, cy + u * 4.5);
    ctx.lineTo(cx + u * 1.5, cy + u * 3);
    ctx.stroke();
  },
];

// ── Bottom Styles (3) ───────────────────────────
export const BOTTOM_STYLES: PartDrawFn[] = [
  // 0: Pants
  (ctx, cx, cy, u, color) => {
    ctx.fillStyle = color;
    outline(ctx, u);
    // Left leg
    ctx.beginPath();
    ctx.rect(cx - u * 2.2, cy, u * 2, u * 3);
    ctx.fill(); ctx.stroke();
    // Right leg
    ctx.beginPath();
    ctx.rect(cx + u * 0.2, cy, u * 2, u * 3);
    ctx.fill(); ctx.stroke();
  },
  // 1: Shorts
  (ctx, cx, cy, u, color) => {
    ctx.fillStyle = color;
    outline(ctx, u);
    ctx.beginPath();
    ctx.rect(cx - u * 2.2, cy, u * 2, u * 1.8);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.rect(cx + u * 0.2, cy, u * 2, u * 1.8);
    ctx.fill(); ctx.stroke();
  },
  // 2: Skirt
  (ctx, cx, cy, u, color) => {
    ctx.fillStyle = color;
    outline(ctx, u);
    ctx.beginPath();
    ctx.moveTo(cx - u * 2.2, cy);
    ctx.lineTo(cx + u * 2.2, cy);
    ctx.lineTo(cx + u * 3, cy + u * 2.5);
    ctx.lineTo(cx - u * 3, cy + u * 2.5);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  },
];

// ── Shoe Styles (3) ─────────────────────────────
export const SHOE_STYLES: PartDrawFn[] = [
  // 0: Sneakers
  (ctx, cx, cy, u, color) => {
    ctx.fillStyle = color;
    outline(ctx, u);
    for (const side of [-1, 1]) {
      const sx = cx + side * u * 1.1;
      ctx.beginPath();
      ctx.ellipse(sx, cy, u * 1.3, u * 0.7, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // White toe cap
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sx + side * u * 0.5, cy, u * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
    }
  },
  // 1: Boots
  (ctx, cx, cy, u, color) => {
    ctx.fillStyle = color;
    outline(ctx, u);
    for (const side of [-1, 1]) {
      const sx = cx + side * u * 1.1;
      ctx.beginPath();
      ctx.rect(sx - u * 1, cy - u * 1, u * 2, u * 1.8);
      ctx.fill(); ctx.stroke();
      // Boot top cuff
      ctx.fillStyle = '#8B7355';
      ctx.fillRect(sx - u * 1.1, cy - u * 1, u * 2.2, u * 0.4);
      ctx.fillStyle = color;
    }
  },
  // 2: Sandals
  (ctx, cx, cy, u, color) => {
    ctx.fillStyle = color;
    outline(ctx, u);
    for (const side of [-1, 1]) {
      const sx = cx + side * u * 1.1;
      // Sole
      ctx.beginPath();
      ctx.ellipse(sx, cy + u * 0.2, u * 1.2, u * 0.5, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // Strap
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(0.5, u * 0.3);
      ctx.beginPath();
      ctx.moveTo(sx - u * 0.8, cy + u * 0.2);
      ctx.lineTo(sx, cy - u * 0.3);
      ctx.lineTo(sx + u * 0.8, cy + u * 0.2);
      ctx.stroke();
    }
  },
];

// ── Cape Styles (2) ─────────────────────────────
export const CAPE_STYLES: PartDrawFn[] = [
  // 0: Short cape
  (ctx, cx, cy, u, color, frame) => {
    const sway = Math.sin(frame * 0.03) * u * 0.5;
    ctx.fillStyle = color;
    outline(ctx, u);
    ctx.beginPath();
    ctx.moveTo(cx - u * 2.5, cy - u * 0.5);
    ctx.bezierCurveTo(cx - u * 3 + sway, cy + u * 3, cx - u * 2 + sway, cy + u * 5, cx + sway * 0.5, cy + u * 6);
    ctx.lineTo(cx + sway * 0.5, cy + u * 6);
    ctx.bezierCurveTo(cx + u * 2 - sway, cy + u * 5, cx + u * 3 - sway, cy + u * 3, cx + u * 2.5, cy - u * 0.5);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  },
  // 1: Flowing cloak
  (ctx, cx, cy, u, color, frame) => {
    const sway = Math.sin(frame * 0.025) * u * 0.8;
    ctx.fillStyle = color;
    outline(ctx, u);
    ctx.beginPath();
    ctx.moveTo(cx - u * 2.8, cy - u * 1);
    ctx.bezierCurveTo(cx - u * 4 + sway, cy + u * 4, cx - u * 3 + sway, cy + u * 8, cx - u * 1 + sway, cy + u * 10);
    ctx.lineTo(cx + u * 1 - sway, cy + u * 10);
    ctx.bezierCurveTo(cx + u * 3 - sway, cy + u * 8, cx + u * 4 - sway, cy + u * 4, cx + u * 2.8, cy - u * 1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Bottom trim
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = Math.max(0.5, u * 0.3);
    ctx.beginPath();
    ctx.moveTo(cx - u * 1 + sway, cy + u * 10);
    ctx.bezierCurveTo(cx - u * 0.5 + sway * 0.5, cy + u * 10.3, cx + u * 0.5 - sway * 0.5, cy + u * 10.3, cx + u * 1 - sway, cy + u * 10);
    ctx.stroke();
  },
];

// ── Hat Styles (2) ──────────────────────────────
export const HAT_STYLES: PartDrawFn[] = [
  // 0: Headband
  (ctx, cx, cy, u, color) => {
    ctx.fillStyle = color;
    outline(ctx, u);
    ctx.beginPath();
    ctx.rect(cx - u * 5, cy - u * 1.5, u * 10, u * 1);
    ctx.fill(); ctx.stroke();
    // Knot on side
    ctx.beginPath();
    ctx.arc(cx + u * 5, cy - u * 1, u * 0.8, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  },
  // 1: Wizard hat
  (ctx, cx, cy, u, color) => {
    ctx.fillStyle = color;
    outline(ctx, u);
    // Brim
    ctx.beginPath();
    ctx.ellipse(cx, cy, u * 6, u * 1.5, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Cone
    ctx.beginPath();
    ctx.moveTo(cx - u * 4, cy);
    ctx.lineTo(cx, cy - u * 8);
    ctx.lineTo(cx + u * 4, cy);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Star on hat
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(cx, cy - u * 4, u * 0.6, 0, Math.PI * 2);
    ctx.fill();
  },
];

// ── Weapon Styles (3) ───────────────────────────
export const WEAPON_STYLES: PartDrawFn[] = [
  // 0: Sword
  (ctx, cx, cy, u, color) => {
    outline(ctx, u);
    // Blade
    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath();
    ctx.moveTo(cx, cy - u * 6);
    ctx.lineTo(cx + u * 0.6, cy - u * 1);
    ctx.lineTo(cx - u * 0.6, cy - u * 1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Guard
    ctx.fillStyle = color;
    ctx.fillRect(cx - u * 1.2, cy - u * 1.2, u * 2.4, u * 0.6);
    // Grip
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(cx - u * 0.3, cy - u * 0.6, u * 0.6, u * 2);
    // Pommel
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(cx, cy + u * 1.5, u * 0.4, 0, Math.PI * 2); ctx.fill();
  },
  // 1: Staff
  (ctx, cx, cy, u, color) => {
    outline(ctx, u);
    // Shaft
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(cx - u * 0.25, cy - u * 6, u * 0.5, u * 8);
    ctx.strokeRect(cx - u * 0.25, cy - u * 6, u * 0.5, u * 8);
    // Orb
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(cx, cy - u * 6.5, u * 1.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Orb glow
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.arc(cx - u * 0.3, cy - u * 7, u * 0.4, 0, Math.PI * 2); ctx.fill();
  },
  // 2: Bow
  (ctx, cx, cy, u, color) => {
    outline(ctx, u);
    // Bow body
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = Math.max(0.8, u * 0.4);
    ctx.beginPath();
    ctx.moveTo(cx, cy - u * 5);
    ctx.bezierCurveTo(cx - u * 2.5, cy - u * 3, cx - u * 2.5, cy + u * 1, cx, cy + u * 3);
    ctx.stroke();
    // String
    ctx.strokeStyle = '#E8E8E8';
    ctx.lineWidth = Math.max(0.3, u * 0.15);
    ctx.beginPath();
    ctx.moveTo(cx, cy - u * 5);
    ctx.lineTo(cx, cy + u * 3);
    ctx.stroke();
    // Color accents at tips
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(cx, cy - u * 5, u * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy + u * 3, u * 0.3, 0, Math.PI * 2); ctx.fill();
  },
];
