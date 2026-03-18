/**
 * Companion Renderer — The Realm
 *
 * Canvas-drawn companion animal that follows the player.
 * 4 body types, state variations, bond aura, and name plate.
 */

import type { Camera } from './Camera';
import type { CompanionRenderData } from '../bridge/DataBridge';

const LERP_FACTOR = 0.08;
const FOLLOW_OFFSET_X = -48;
const FOLLOW_OFFSET_Y = 16;
const SCALE = 3;

export class CompanionRenderer {
  private x = 0;
  private y = 0;
  private initialized = false;

  update(playerX: number, playerY: number): void {
    const targetX = playerX + FOLLOW_OFFSET_X;
    const targetY = playerY + FOLLOW_OFFSET_Y;

    if (!this.initialized) {
      this.x = targetX;
      this.y = targetY;
      this.initialized = true;
      return;
    }

    this.x += (targetX - this.x) * LERP_FACTOR;
    this.y += (targetY - this.y) * LERP_FACTOR;
  }

  render(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    companion: CompanionRenderData,
    frameCount: number,
  ): void {
    const s = camera.worldToScreen(this.x, this.y);
    const u = SCALE * camera.zoom;
    const cx = s.x;
    const cy = s.y;

    const palette = {
      body: companion.bodyColor,
      accent: companion.accentColor,
      eye: companion.eyeColor,
    };

    // State-based sizing and alpha
    let scale = 1;
    let alpha = 1;

    if (companion.state === 'sleeping') {
      scale = 0.6;
      alpha = 0.7;
    } else if (companion.state === 'resting') {
      scale = 0.8;
      alpha = 0.85;
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    // Bond aura at level 5+
    if (companion.bondLevel >= 5) {
      const auraR = 18 * u * 0.2 * scale;
      const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
      const auraAlpha = 0.08 + (companion.bondLevel - 5) * 0.02;
      aura.addColorStop(0, `rgba(255,215,0,${auraAlpha})`);
      aura.addColorStop(1, 'transparent');
      ctx.fillStyle = aura;
      ctx.fillRect(cx - auraR, cy - auraR, auraR * 2, auraR * 2);
    }

    // Idle bob animation (active state)
    let bobY = 0;
    if (companion.state === 'active') {
      bobY = Math.sin(frameCount * 0.06) * 1.5;
    }

    // Joyful bounce + sparkle
    if (companion.state === 'joyful') {
      bobY = Math.abs(Math.sin(frameCount * 0.12)) * -4;
      if (frameCount % 15 === 0) {
        // Sparkle effect drawn inline
        const sparkleX = cx + (Math.random() - 0.5) * 16;
        const sparkleY = cy + bobY - 8 + (Math.random() - 0.5) * 8;
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(sparkleX - 1, sparkleY - 1, 2, 2);
      }
    }

    const drawY = cy + bobY;
    const drawScale = u * 0.2 * scale;

    // Draw body type
    switch (companion.bodyType) {
      case 'canine':
        this.drawCanine(ctx, cx, drawY, drawScale, palette);
        break;
      case 'feline':
        this.drawFeline(ctx, cx, drawY, drawScale, palette);
        break;
      case 'bird':
        this.drawBird(ctx, cx, drawY, drawScale, palette);
        break;
      case 'large':
        this.drawLarge(ctx, cx, drawY, drawScale, palette);
        break;
    }

    // Sleeping Zzz
    if (companion.state === 'sleeping') {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `${Math.max(6, drawScale * 3)}px monospace`;
      ctx.textAlign = 'center';
      const zPhase = Math.sin(frameCount * 0.04);
      ctx.fillText('z', cx + 8, drawY - 12 + zPhase * 2);
      ctx.font = `${Math.max(5, drawScale * 2.5)}px monospace`;
      ctx.fillText('z', cx + 12, drawY - 16 + zPhase * 3);
    }

    // Name plate
    if (companion.name) {
      ctx.font = `${Math.max(7, drawScale * 3)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillText(companion.name, cx, drawY + 14);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(companion.name, cx, drawY + 13);
    }

    ctx.restore();
  }

  private drawCanine(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, u: number,
    palette: { body: string; accent: string; eye: string },
  ): void {
    // Body (oval)
    ctx.fillStyle = palette.body;
    ctx.beginPath();
    ctx.ellipse(cx, cy, u * 5, u * 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(cx + u * 4, cy - u * 1.5, u * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Ears (pointed)
    ctx.beginPath();
    ctx.moveTo(cx + u * 3, cy - u * 3.5);
    ctx.lineTo(cx + u * 2, cy - u * 5.5);
    ctx.lineTo(cx + u * 4, cy - u * 3.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + u * 5, cy - u * 3.5);
    ctx.lineTo(cx + u * 5.5, cy - u * 5.5);
    ctx.lineTo(cx + u * 6, cy - u * 3.5);
    ctx.fill();

    // Snout accent
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.ellipse(cx + u * 6, cy - u * 1, u * 1.2, u * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = palette.eye;
    ctx.fillRect(cx + u * 3, cy - u * 2.5, u * 1, u * 1);
    ctx.fillRect(cx + u * 5, cy - u * 2.5, u * 1, u * 1);

    // Tail
    ctx.strokeStyle = palette.body;
    ctx.lineWidth = u * 1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - u * 5, cy - u * 1);
    ctx.quadraticCurveTo(cx - u * 7, cy - u * 4, cx - u * 6, cy - u * 5);
    ctx.stroke();

    // Legs
    ctx.fillStyle = palette.body;
    ctx.fillRect(cx + u * 2, cy + u * 2, u * 1.2, u * 3);
    ctx.fillRect(cx - u * 2, cy + u * 2, u * 1.2, u * 3);
  }

  private drawFeline(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, u: number,
    palette: { body: string; accent: string; eye: string },
  ): void {
    // Sleek body
    ctx.fillStyle = palette.body;
    ctx.beginPath();
    ctx.ellipse(cx, cy, u * 4.5, u * 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head (slightly smaller, rounded)
    ctx.beginPath();
    ctx.arc(cx + u * 3.5, cy - u * 2, u * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Ears (rounded triangles)
    ctx.beginPath();
    ctx.moveTo(cx + u * 2, cy - u * 3.5);
    ctx.lineTo(cx + u * 2.5, cy - u * 5.5);
    ctx.lineTo(cx + u * 3.5, cy - u * 3.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + u * 4.5, cy - u * 3.5);
    ctx.lineTo(cx + u * 5, cy - u * 5.5);
    ctx.lineTo(cx + u * 5.5, cy - u * 3.5);
    ctx.fill();

    // Inner ears
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.moveTo(cx + u * 2.3, cy - u * 3.8);
    ctx.lineTo(cx + u * 2.7, cy - u * 5);
    ctx.lineTo(cx + u * 3.2, cy - u * 3.8);
    ctx.fill();

    // Eyes (slit-style)
    ctx.fillStyle = palette.eye;
    ctx.beginPath();
    ctx.ellipse(cx + u * 2.8, cy - u * 2.5, u * 0.5, u * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + u * 4.5, cy - u * 2.5, u * 0.5, u * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Curved tail
    ctx.strokeStyle = palette.body;
    ctx.lineWidth = u * 0.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - u * 4.5, cy);
    ctx.bezierCurveTo(cx - u * 6, cy - u * 2, cx - u * 7, cy - u * 5, cx - u * 5, cy - u * 6);
    ctx.stroke();

    // Legs (slim)
    ctx.fillStyle = palette.body;
    ctx.fillRect(cx + u * 1.5, cy + u * 1.5, u * 1, u * 3);
    ctx.fillRect(cx - u * 1.5, cy + u * 1.5, u * 1, u * 3);
  }

  private drawBird(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, u: number,
    palette: { body: string; accent: string; eye: string },
  ): void {
    // Body (small round)
    ctx.fillStyle = palette.body;
    ctx.beginPath();
    ctx.ellipse(cx, cy, u * 3, u * 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(cx + u * 2, cy - u * 2, u * 2, 0, Math.PI * 2);
    ctx.fill();

    // Breast accent
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.ellipse(cx + u * 1, cy + u * 0.5, u * 2, u * 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing
    ctx.fillStyle = palette.body;
    ctx.beginPath();
    ctx.ellipse(cx - u * 1, cy - u * 0.5, u * 3, u * 1.5, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = palette.eye;
    ctx.beginPath();
    ctx.arc(cx + u * 2.8, cy - u * 2.3, u * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Beak (triangle)
    ctx.fillStyle = '#FF8C00';
    ctx.beginPath();
    ctx.moveTo(cx + u * 3.8, cy - u * 2);
    ctx.lineTo(cx + u * 5.5, cy - u * 1.5);
    ctx.lineTo(cx + u * 3.8, cy - u * 1);
    ctx.closePath();
    ctx.fill();

    // Tail feathers
    ctx.fillStyle = palette.body;
    ctx.beginPath();
    ctx.moveTo(cx - u * 3, cy);
    ctx.lineTo(cx - u * 5.5, cy - u * 1);
    ctx.lineTo(cx - u * 5, cy + u * 0.5);
    ctx.closePath();
    ctx.fill();

    // Legs (thin)
    ctx.strokeStyle = '#FF8C00';
    ctx.lineWidth = u * 0.4;
    ctx.beginPath();
    ctx.moveTo(cx + u * 0.5, cy + u * 2.5);
    ctx.lineTo(cx + u * 0.5, cy + u * 4);
    ctx.moveTo(cx - u * 0.5, cy + u * 2.5);
    ctx.lineTo(cx - u * 0.5, cy + u * 4);
    ctx.stroke();
  }

  private drawLarge(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, u: number,
    palette: { body: string; accent: string; eye: string },
  ): void {
    // Large body
    ctx.fillStyle = palette.body;
    ctx.beginPath();
    ctx.ellipse(cx, cy, u * 6, u * 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(cx + u * 5, cy - u * 2, u * 3, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.beginPath();
    ctx.ellipse(cx + u * 3.5, cy - u * 4.5, u * 1.5, u * 1, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + u * 6.5, cy - u * 4.5, u * 1.5, u * 1, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = palette.eye;
    ctx.fillRect(cx + u * 4, cy - u * 3, u * 1, u * 1);
    ctx.fillRect(cx + u * 6, cy - u * 3, u * 1, u * 1);

    // Accent (belly)
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.ellipse(cx, cy + u * 1, u * 4, u * 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stout legs
    ctx.fillStyle = palette.body;
    ctx.fillRect(cx + u * 3, cy + u * 3, u * 1.8, u * 3);
    ctx.fillRect(cx - u * 3, cy + u * 3, u * 1.8, u * 3);
    ctx.fillRect(cx + u * 1, cy + u * 3, u * 1.8, u * 2.5);
    ctx.fillRect(cx - u * 1, cy + u * 3, u * 1.8, u * 2.5);
  }

  /**
   * Hit detection for companion tap
   */
  getCompanionAtScreen(
    sx: number, sy: number,
    camera: Camera,
  ): boolean {
    const screen = camera.worldToScreen(this.x, this.y);
    const dist = Math.sqrt((sx - screen.x) ** 2 + (sy - screen.y) ** 2);
    return dist < 24;
  }
}
