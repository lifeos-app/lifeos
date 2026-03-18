/**
 * Entity Renderer — The Realm
 *
 * Renders dynamic entities: Shadows, Goal Companions, and Journal Echoes.
 * All share positioning, sprite rendering, bobbing, alpha, and tap detection.
 */

import type { DynamicEntity } from '../bridge/DataBridge';
import type { Camera } from './Camera';

export class EntityRenderer {
  /**
   * Render all dynamic entities.
   */
  render(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    entities: DynamicEntity[],
    frameCount: number,
  ): void {
    for (const entity of entities) {
      const s = camera.worldToScreen(entity.worldX, entity.worldY);
      const z = camera.zoom;

      switch (entity.type) {
        case 'shadow':
          this.drawShadow(ctx, s.x, s.y, z, entity, frameCount);
          break;
        case 'goal_companion':
          this.drawGoalCompanion(ctx, s.x, s.y, z, entity, frameCount);
          break;
        case 'journal_echo':
          this.drawJournalEcho(ctx, s.x, s.y, z, entity, frameCount);
          break;
      }
    }
  }

  /**
   * Hit-test: find which entity (if any) is at the given screen coordinates.
   */
  getEntityAtScreen(
    sx: number,
    sy: number,
    camera: Camera,
    entities: DynamicEntity[],
  ): DynamicEntity | null {
    const hitRadius = 20;
    for (const entity of entities) {
      const s = camera.worldToScreen(entity.worldX, entity.worldY);
      const dist = Math.sqrt((sx - s.x) ** 2 + (sy - s.y) ** 2);
      if (dist < hitRadius * camera.zoom) {
        return entity;
      }
    }
    return null;
  }

  // ── Shadow (dark threatening entity) ───────────

  private drawShadow(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, z: number,
    entity: DynamicEntity,
    frameCount: number,
  ): void {
    const u = 3 * z;
    const wobble = Math.sin(frameCount * 0.04) * u * 2;
    const alpha = entity.alpha * (0.6 + Math.sin(frameCount * 0.03) * 0.2);

    // Dark blob body
    ctx.globalAlpha = alpha;
    const grad = ctx.createRadialGradient(cx + wobble, cy, u * 2, cx + wobble, cy, u * 8);
    grad.addColorStop(0, 'rgba(60,20,80,0.8)');
    grad.addColorStop(0.6, 'rgba(40,10,60,0.4)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx + wobble, cy, u * 8, 0, Math.PI * 2);
    ctx.fill();

    // Inner core
    ctx.fillStyle = 'rgba(30,0,50,0.6)';
    ctx.beginPath();
    ctx.arc(cx + wobble, cy, u * 4, 0, Math.PI * 2);
    ctx.fill();

    // Eyes (menacing red dots)
    ctx.fillStyle = `rgba(255,50,50,${alpha})`;
    ctx.beginPath();
    ctx.arc(cx - u * 1.5 + wobble, cy - u, u * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + u * 1.5 + wobble, cy - u, u * 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;

    // Label
    ctx.fillStyle = '#FF6B6B';
    ctx.font = `bold ${Math.max(8, u * 2.5)}px monospace`;
    ctx.textAlign = 'center';
    ctx.globalAlpha = alpha;
    ctx.fillText(entity.label, cx, cy + u * 10);
    if (entity.subLabel) {
      ctx.fillStyle = '#CC5555';
      ctx.font = `${Math.max(7, u * 2)}px monospace`;
      ctx.fillText(entity.subLabel, cx, cy + u * 12);
    }
    ctx.globalAlpha = 1;
  }

  // ── Goal Companion (friendly small NPC) ────────

  private drawGoalCompanion(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, z: number,
    entity: DynamicEntity,
    frameCount: number,
  ): void {
    const u = 3 * z;
    const bob = Math.sin(frameCount * 0.04 + cx * 0.01) * u;

    // Small body
    ctx.fillStyle = entity.color;
    ctx.beginPath();
    ctx.arc(cx, cy - u * 2 + bob, u * 3, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#FDDBB4';
    ctx.beginPath();
    ctx.arc(cx, cy - u * 5 + bob, u * 2, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(cx - u, cy - u * 5.5 + bob, u * 0.6, u * 0.6);
    ctx.fillRect(cx + u * 0.4, cy - u * 5.5 + bob, u * 0.6, u * 0.6);

    // Progress bar beneath
    if (entity.progress !== undefined) {
      const barW = u * 10;
      const barH = u * 1.2;
      const barX = cx - barW / 2;
      const barY = cy + u * 3;

      // Background
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(barX, barY, barW, barH);

      // Fill
      ctx.fillStyle = entity.color;
      ctx.fillRect(barX, barY, barW * Math.min(1, entity.progress), barH);

      // Border
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(barX, barY, barW, barH);
    }

    // Name label
    ctx.fillStyle = '#FFD700';
    ctx.font = `${Math.max(7, u * 2)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(entity.label, cx, cy + u * 6);
  }

  // ── Journal Echo (ghostly silhouette) ──────────

  private drawJournalEcho(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, z: number,
    entity: DynamicEntity,
    frameCount: number,
  ): void {
    const u = 3 * z;
    const bob = Math.sin(frameCount * 0.02 + cy * 0.01) * u * 1.5;
    const alpha = entity.alpha * (0.3 + Math.sin(frameCount * 0.025) * 0.15);

    ctx.globalAlpha = alpha;

    // Ghostly body silhouette
    const grad = ctx.createRadialGradient(cx, cy - u * 2 + bob, 0, cx, cy - u * 2 + bob, u * 6);
    grad.addColorStop(0, 'rgba(180,200,255,0.6)');
    grad.addColorStop(0.5, 'rgba(120,150,255,0.3)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy - u * 2 + bob, u * 6, 0, Math.PI * 2);
    ctx.fill();

    // Inner form (vaguely humanoid)
    ctx.fillStyle = 'rgba(200,220,255,0.4)';
    ctx.fillRect(cx - u * 1.5, cy - u * 4 + bob, u * 3, u * 6);
    ctx.beginPath();
    ctx.arc(cx, cy - u * 5 + bob, u * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;

    // Label
    ctx.fillStyle = 'rgba(180,200,255,0.7)';
    ctx.font = `${Math.max(7, u * 2)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(entity.label, cx, cy + u * 7 + bob);
  }
}
