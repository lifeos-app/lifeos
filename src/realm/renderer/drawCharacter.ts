/**
 * drawCharacter — MapleStory-style chibi character renderer
 *
 * Big head, expressive eyes, flowing hair, visible equipment.
 * All procedural Canvas2D — no sprite sheets.
 */

import type { EquippedVisuals } from '../bridge/DataBridge';
import {
  HAIR_STYLES, FACE_TYPES, TOP_STYLES, BOTTOM_STYLES, SHOE_STYLES,
  CAPE_STYLES, HAT_STYLES, WEAPON_STYLES,
} from '../../rpg/data/sprites';

export type { EquippedVisuals };

export interface DrawCharacterParams {
  ctx: CanvasRenderingContext2D;
  cx: number;              // center X (screen px)
  cy: number;              // center Y (screen px)
  unit: number;            // base drawing unit (replaces SCALE * zoom)
  skinTone: string;
  hairColor: string;
  bodyColor: string;
  classIcon: string;
  name: string;
  level: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  isMoving?: boolean;
  mood?: number;           // 1-5
  bestStreak?: number;
  energy?: number;         // 1-5
  equipped?: EquippedVisuals;
  walkFrame?: number;      // 0-3
  frameCount?: number;     // for aura pulse
  showName?: boolean;
  showClassIcon?: boolean;
  onEmitParticle?: (cx: number, cy: number) => void;
  // New customization indices
  hairStyleIdx?: number;
  faceTypeIdx?: number;
  eyeColor?: string;
  topIdx?: number;
  bottomIdx?: number;
  shoesIdx?: number;
  capeIdx?: number;        // -1 = none
  hatIdx?: number;         // -1 = none
  weaponIdx?: number;      // -1 = none
  topColor?: string;
  bottomColor?: string;
  shoesColor?: string;
}

const OL = '#1a1a2e';

export function drawCharacter(p: DrawCharacterParams): void {
  const {
    ctx, cx, cy, unit: u,
    skinTone, hairColor, bodyColor, classIcon, name, level,
    direction = 'down',
    isMoving = false,
    mood = 3,
    bestStreak = 0,
    energy = 3,
    equipped,
    walkFrame = 0,
    frameCount = 0,
    showName = true,
    showClassIcon = true,
    onEmitParticle,
    hairStyleIdx = 0,
    faceTypeIdx = 0,
    eyeColor = '#2C1608',
    topIdx = 0,
    bottomIdx = 0,
    shoesIdx = 0,
    capeIdx = -1,
    hatIdx = -1,
    weaponIdx = -1,
    topColor,
    bottomColor = '#2C3E50',
    shoesColor = '#6B3A2A',
  } = p;

  const compact = u < 1.5;
  const ol = () => {
    if (compact) return;
    ctx.strokeStyle = OL;
    ctx.lineWidth = Math.max(0.5, u * 0.25);
  };

  // Idle bounce (always, subtle)
  const idleBob = Math.sin((frameCount) * 0.04) * u * 0.3;

  // Walk bob
  const walkBob = isMoving ? Math.sin(walkFrame * Math.PI / 2) * u * 0.5 : 0;
  const bob = idleBob + walkBob;

  // Energy crouch
  const crouchOffset = energy <= 2 ? u * 0.5 : 0;

  // Chibi proportions:
  // Head center: cy - 8u, radius 5u
  // Body: cy - 2u to cy + 4u (6u tall)
  // Legs: cy + 4u to cy + 7u (3u)
  // Shoes: cy + 7u to cy + 8.5u (1.5u)

  const headCY = cy - u * 8 - bob + crouchOffset;
  const bodyCY = cy - u * 2 - bob + crouchOffset;
  const legsCY = cy + u * 4 - bob + crouchOffset;
  const shoesCY = cy + u * 7 - bob + crouchOffset;

  // Direction offset for face features
  const dirX = direction === 'left' ? -u * 0.5 : direction === 'right' ? u * 0.5 : 0;

  // ── 1. Streak aura (behind everything) ──
  if (bestStreak >= 7) {
    const auraAlpha = bestStreak >= 100
      ? 0.4 + Math.sin(frameCount * 0.06) * 0.15
      : bestStreak >= 30 ? 0.3 : 0.15;
    const grad = ctx.createRadialGradient(cx, cy, u * 2, cx, cy, u * 14);
    grad.addColorStop(0, `rgba(255,255,255,${auraAlpha})`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, u * 14, 0, Math.PI * 2);
    ctx.fill();

    if (bestStreak >= 100 && frameCount % 6 === 0 && onEmitParticle) {
      onEmitParticle(cx, cy + u * 8);
    }
  }

  // ── 2. Shadow ellipse ──
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + u * 9, u * 4, u * 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── 3. Cape (behind body) ──
  if (capeIdx >= 0 && capeIdx < CAPE_STYLES.length) {
    ctx.save();
    CAPE_STYLES[capeIdx](ctx, cx, bodyCY, u, bodyColor, frameCount);
    ctx.restore();
  }

  // ── 4. Shoes ──
  ctx.save();
  const shoesFn = SHOE_STYLES[shoesIdx] ?? SHOE_STYLES[0];
  shoesFn(ctx, cx, shoesCY, u, shoesColor, frameCount);
  ctx.restore();

  // ── 5. Legs ──
  ctx.fillStyle = skinTone;
  if (isMoving) {
    const legSpread = Math.sin(walkFrame * Math.PI / 2) * u * 1.2;
    ctx.fillRect(cx - u * 1.5 - legSpread, legsCY, u * 1.5, u * 3);
    ctx.fillRect(cx + legSpread, legsCY, u * 1.5, u * 3);
  } else {
    ctx.fillRect(cx - u * 1.5, legsCY, u * 1.5, u * 3);
    ctx.fillRect(cx + u * 0, legsCY, u * 1.5, u * 3);
  }

  // ── 6. Bottom (pants/shorts/skirt) ──
  ctx.save();
  const bottomFn = BOTTOM_STYLES[bottomIdx] ?? BOTTOM_STYLES[0];
  bottomFn(ctx, cx, legsCY, u, bottomColor, frameCount);
  ctx.restore();

  // ── 7. Body/torso + top ──
  const finalBodyColor = equipped?.bodyColor || topColor || bodyColor;
  ctx.save();
  const topFn = TOP_STYLES[topIdx] ?? TOP_STYLES[0];
  topFn(ctx, cx, bodyCY, u, finalBodyColor, frameCount);
  ctx.restore();

  // ── 8. Arms ──
  ctx.fillStyle = skinTone;
  // Left arm
  ctx.beginPath();
  ctx.ellipse(cx - u * 3.5, bodyCY + u * 2, u * 1, u * 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!compact) { ol(); ctx.stroke(); }
  // Right arm
  ctx.beginPath();
  ctx.ellipse(cx + u * 3.5, bodyCY + u * 2, u * 1, u * 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!compact) { ol(); ctx.stroke(); }

  // ── 9. Weapon ──
  const hasWeapon = equipped?.hasWeapon || weaponIdx >= 0;
  if (hasWeapon) {
    ctx.save();
    const wIdx = weaponIdx >= 0 ? weaponIdx : 0;
    if (wIdx < WEAPON_STYLES.length) {
      const weaponColor = equipped?.weaponColor || '#C0C0C0';
      WEAPON_STYLES[wIdx](ctx, cx + u * 5, bodyCY + u * 1, u, weaponColor, frameCount);
    }
    ctx.restore();
  }

  // ── 10. Shield ──
  if (equipped?.hasShield) {
    ctx.fillStyle = equipped.shieldColor || '#8B4513';
    const sx = cx - u * 5;
    const sy = bodyCY + u * 1;
    ctx.beginPath();
    ctx.moveTo(sx - u * 1.2, sy - u * 1.5);
    ctx.lineTo(sx + u * 1.2, sy - u * 1.5);
    ctx.lineTo(sx + u * 1.2, sy + u * 0.5);
    ctx.lineTo(sx, sy + u * 2);
    ctx.lineTo(sx - u * 1.2, sy + u * 0.5);
    ctx.closePath();
    ctx.fill();
    if (!compact) {
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }

  // ── 11. Head (larger circle) + dark outline ──
  ctx.fillStyle = skinTone;
  ctx.beginPath();
  ctx.arc(cx + dirX * 0.5, headCY, u * 5, 0, Math.PI * 2);
  ctx.fill();
  if (!compact) {
    ctx.strokeStyle = OL;
    ctx.lineWidth = Math.max(0.5, u * 0.25);
    ctx.stroke();
  }

  // ── 12. Hair ──
  const hasEquippedHead = equipped?.hasHead;
  const showHat = hatIdx >= 0 && hatIdx < HAT_STYLES.length;

  if (!hasEquippedHead) {
    ctx.save();
    const hIdx = Math.min(hairStyleIdx, HAIR_STYLES.length - 1);
    if (compact) {
      // Simplified: filled arc only
      ctx.fillStyle = hairColor;
      ctx.beginPath();
      ctx.arc(cx + dirX * 0.5, headCY - u * 1.5, u * 5.2, Math.PI, Math.PI * 2);
      ctx.fill();
    } else {
      HAIR_STYLES[hIdx](ctx, cx + dirX * 0.5, headCY, u, hairColor, frameCount);
    }
    ctx.restore();
  }

  // ── 13. Hat / Headgear ──
  if (hasEquippedHead) {
    ctx.fillStyle = equipped.headColor || '#888';
    ctx.beginPath();
    ctx.arc(cx, headCY - u * 1.5, u * 5.5, Math.PI * 1.1, Math.PI * 1.9);
    ctx.fill();
    ctx.fillRect(cx - u * 5.5, headCY - u * 1.5, u * 11, u);
  } else if (showHat) {
    ctx.save();
    HAT_STYLES[hatIdx](ctx, cx + dirX * 0.5, headCY - u * 4, u, bodyColor, frameCount);
    ctx.restore();
  }

  // ── 14. Face ──
  if (direction !== 'up') {
    ctx.save();
    const fIdx = Math.min(faceTypeIdx, FACE_TYPES.length - 1);
    if (compact) {
      // Simplified face: two dots + line
      ctx.fillStyle = '#000';
      ctx.fillRect(cx - u * 1.5 + dirX, headCY - u * 0.5, u * 0.8, u * 0.8);
      ctx.fillRect(cx + u * 0.7 + dirX, headCY - u * 0.5, u * 0.8, u * 0.8);
    } else {
      FACE_TYPES[fIdx](ctx, cx + dirX, headCY, u, eyeColor, mood, frameCount);
    }
    ctx.restore();
  }

  // ── 15. Class icon + name label ──
  if (showClassIcon) {
    ctx.font = `${Math.max(12, u * 4)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(classIcon, cx, headCY - u * 7);
  }

  if (showName) {
    ctx.font = `bold ${Math.max(9, u * 2.5)}px monospace`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    const label = `${name} Lv.${level}`;
    ctx.strokeText(label, cx, headCY - u * 8.5);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, cx, headCY - u * 8.5);
  }
}
