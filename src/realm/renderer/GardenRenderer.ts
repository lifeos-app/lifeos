/**
 * Garden Renderer — The Realm
 *
 * Renders habit-derived garden plants as species-aware botanical silhouettes
 * with 5 growth stages, dormancy visuals, and particle effects.
 */

import type { GardenPlant } from '../bridge/DataBridge';
import type { Camera } from './Camera';

export interface Rect {
  x: number; y: number; w: number; h: number;
}

// ── Sprite Sheet Support ─────────────────────────

const SPRITE_FRAME_SIZE = 128;
const SPRITE_FRAME_COUNT = 7; // stages 0-5 + dormant frame 6

const spriteCache: Map<string, HTMLImageElement> = new Map();
const spriteFailed: Set<string> = new Set();

function loadSprite(speciesKey: string): HTMLImageElement | null {
  if (spriteFailed.has(speciesKey)) return null;

  const cached = spriteCache.get(speciesKey);
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;

  const img = new Image();
  img.src = `/sprites/plants/${speciesKey}.png`;
  img.onload = () => {}; // will be available next frame
  img.onerror = () => {
    spriteFailed.add(speciesKey);
    spriteCache.delete(speciesKey);
  };
  spriteCache.set(speciesKey, img);
  return null;
}

// ── Species Color Palettes ─────────────────────

interface SpeciesPalette {
  trunk: string;
  leaf: string;
  accent: string;
  special: string; // water for lotus, gold for money tree, etc.
}

const PALETTES: Record<string, SpeciesPalette> = {
  wellness:     { trunk: '#2E7D32', leaf: '#E91E8B', accent: '#FF69B4', special: '#4FC3F7' },
  fitness:      { trunk: '#5D4037', leaf: '#2E7D32', accent: '#1B5E20', special: '#795548' },
  learning:     { trunk: '#6D4C41', leaf: '#8DB580', accent: '#A5D6A7', special: '#C5E1A5' },
  finance:      { trunk: '#6D4C41', leaf: '#7CB342', accent: '#FFD700', special: '#FFC107' },
  spiritual:    { trunk: '#4E342E', leaf: '#1B5E20', accent: '#2E7D32', special: '#B0BEC5' },
  productivity: { trunk: '#A89F68', leaf: '#7CB342', accent: '#9CCC65', special: '#C5E1A5' },
  creative:     { trunk: '#8D6E63', leaf: '#F48FB1', accent: '#FF80AB', special: '#FCE4EC' },
  other:        { trunk: '#4E342E', leaf: '#4CAF50', accent: '#81C784', special: '#00E5FF' },
};

function desaturate(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const grey = Math.round(r * 0.3 + g * 0.59 + b * 0.11);
  const h = grey.toString(16).padStart(2, '0');
  return `#${h}${h}${h}`;
}

export class GardenRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    plants: GardenPlant[],
    gardenBounds: Rect,
    frameCount: number,
  ): void {
    if (plants.length === 0) return;
    if (!camera.isVisible(gardenBounds.x, gardenBounds.y, gardenBounds.w, gardenBounds.h)) return;

    const maxVisible = 12;
    const visiblePlants = plants.slice(0, maxVisible);
    const cols = Math.min(visiblePlants.length, 6);
    const rows = visiblePlants.length > 6 ? 2 : 1;
    const cellW = gardenBounds.w / cols;
    const cellH = gardenBounds.h / rows;

    // Draw garden bed behind plants
    this.drawGardenBed(ctx, camera, gardenBounds, frameCount);

    for (let i = 0; i < visiblePlants.length; i++) {
      const plant = visiblePlants[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const worldCX = gardenBounds.x + col * cellW + cellW / 2;
      const worldCY = gardenBounds.y + row * cellH + cellH / 2 + cellH * 0.1;
      const s = camera.worldToScreen(worldCX, worldCY);
      const z = camera.zoom;
      this.renderPlant(ctx, s.x, s.y, z, plant, frameCount, i);
    }

    // Garden ambience particle
    this.drawAmbienceParticle(ctx, camera, gardenBounds, frameCount);
  }

  getPlantAtScreen(
    sx: number, sy: number,
    camera: Camera, plants: GardenPlant[], gardenBounds: Rect,
  ): GardenPlant | null {
    if (plants.length === 0) return null;
    const maxVisible = 12;
    const visiblePlants = plants.slice(0, maxVisible);
    const cols = Math.min(visiblePlants.length, 6);
    const rows = visiblePlants.length > 6 ? 2 : 1;
    const cellW = gardenBounds.w / cols;
    const cellH = gardenBounds.h / rows;

    for (let i = 0; i < visiblePlants.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const worldCX = gardenBounds.x + col * cellW + cellW / 2;
      const worldCY = gardenBounds.y + row * cellH + cellH / 2 + cellH * 0.1;
      const s = camera.worldToScreen(worldCX, worldCY);
      const hitRadius = 22 * camera.zoom;
      if (Math.abs(sx - s.x) < hitRadius && Math.abs(sy - s.y) < hitRadius) {
        return visiblePlants[i];
      }
    }
    return null;
  }

  // ── Garden Bed ───────────────────────────────

  private drawGardenBed(
    ctx: CanvasRenderingContext2D, camera: Camera, bounds: Rect, frameCount: number,
  ): void {
    const tl = camera.worldToScreen(bounds.x, bounds.y);
    const br = camera.worldToScreen(bounds.x + bounds.w, bounds.y + bounds.h);
    const z = camera.zoom;
    const w = br.x - tl.x;
    const h = br.y - tl.y;
    const r = 6 * z;

    // Soil fill
    ctx.fillStyle = '#3A2A1A';
    ctx.beginPath();
    ctx.roundRect(tl.x - 4 * z, tl.y - 4 * z, w + 8 * z, h + 8 * z, r);
    ctx.fill();

    // Stone border
    ctx.strokeStyle = '#6B5B4B';
    ctx.lineWidth = Math.max(1, 1.5 * z);
    ctx.stroke();

    // Soil texture dots
    for (let i = 0; i < 20; i++) {
      const px = tl.x + (Math.sin(i * 7.3) * 0.5 + 0.5) * w;
      const py = tl.y + (Math.sin(i * 4.1 + 2.7) * 0.5 + 0.5) * h;
      const shade = 40 + Math.sin(i * 3.7) * 10;
      ctx.fillStyle = `rgb(${shade + 20},${shade + 10},${shade})`;
      ctx.beginPath();
      ctx.arc(px, py, z * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Plant Dispatcher ─────────────────────────

  private renderPlant(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, z: number,
    plant: GardenPlant, frameCount: number, index: number,
  ): void {
    const dormancyLevel = plant.dormancyLevel ?? 0;
    const u = 3 * z;

    // Multi-level dormancy visuals
    const dormancySaturation = [1, 0.5, 0.25, 0.1][dormancyLevel] ?? 1;
    const dormancyAlpha = [1, 0.85, 0.7, 0.55][dormancyLevel] ?? 1;
    const dormancyDroop = [0, 0, 0.12, 0.17][dormancyLevel] ?? 0;
    const isDormant = dormancyLevel > 0;

    // Apply dormancy filter
    if (isDormant) {
      ctx.save();
      ctx.filter = `saturate(${dormancySaturation})`;
      ctx.globalAlpha = dormancyAlpha;
    }

    // Growth progress scale interpolation (0.85 → 1.0 within stage)
    const progress = plant.growthProgress ?? 0;
    const progressScale = 0.85 + progress * 0.15;

    // Try sprite sheet first
    const sprite = loadSprite(plant.speciesKey);
    if (sprite) {
      const frameIdx = isDormant ? 6 : Math.min(plant.stage, 5);
      const srcX = frameIdx * SPRITE_FRAME_SIZE;
      const drawSize = SPRITE_FRAME_SIZE * z * 0.4 * progressScale;

      if (dormancyDroop > 0) {
        ctx.save();
        ctx.translate(cx, cy + u * 4);
        ctx.rotate(dormancyDroop);
        ctx.translate(-cx, -(cy + u * 4));
      }

      ctx.drawImage(
        sprite,
        srcX, 0, SPRITE_FRAME_SIZE, SPRITE_FRAME_SIZE,
        cx - drawSize / 2, cy - drawSize + u * 4, drawSize, drawSize,
      );

      if (dormancyDroop > 0) ctx.restore();
    } else {
      // Canvas fallback
      this.drawCanvasPlant(ctx, cx, cy, u, z, plant, frameCount, index, progressScale, isDormant, dormancyDroop);
    }

    if (isDormant) {
      ctx.restore();
    }

    // Logged-today water droplet + sparkles
    if (plant.isLoggedToday && !isDormant) {
      this.drawWaterDroplet(ctx, cx, cy, u, frameCount, index);
      this.drawLoggedSparkles(ctx, cx, cy, u, frameCount, index);
    }

    // Legendary/Thriving/Ancient particles
    if (plant.stage >= 4) {
      this.drawLegendaryParticles(ctx, cx, cy, u, frameCount, index, plant.category);
    }

    // Ancient golden aura (stage 5)
    if (plant.stage === 5) {
      this.drawAncientAura(ctx, cx, cy, u, frameCount, index);
    }

    // Name label
    ctx.fillStyle = isDormant ? '#666' : '#fff';
    ctx.font = `${Math.max(8, u * 2.5)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(plant.name, cx, cy + u * 8);

    // Streak badge
    if (plant.streakDays > 0) {
      ctx.fillStyle = '#FFD700';
      ctx.font = `bold ${Math.max(7, u * 2)}px monospace`;
      ctx.fillText(`${plant.streakDays}d`, cx, cy + u * 10);
    }
  }

  private drawCanvasPlant(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, u: number, z: number,
    plant: GardenPlant, frameCount: number, index: number,
    progressScale: number, isDormant: boolean, dormancyDroop: number,
  ): void {
    const pal = PALETTES[plant.category] || PALETTES.other;
    const sway = Math.sin(frameCount * 0.025 + index * 1.7) * u * 0.5;
    const scale = progressScale + (plant.growthProgress ?? 0) * 0.15;

    const trunk = pal.trunk;
    const leaf = pal.leaf;
    const accent = pal.accent;
    const special = pal.special;

    // Logged-today base glow
    if (plant.isLoggedToday && !isDormant) {
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, u * 10);
      grad.addColorStop(0, `${accent}40`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, u * 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // Soil mound (always)
    ctx.fillStyle = '#5C4033';
    ctx.beginPath();
    ctx.ellipse(cx, cy + u * 4, u * 5, u * 2, 0, 0, Math.PI * 2);
    ctx.fill();

    if (plant.stage === 0) {
      this.drawSeed(ctx, cx, cy, u);
    } else {
      // Apply dormancy droop
      if (dormancyDroop > 0) {
        ctx.save();
        ctx.translate(cx, cy + u * 4);
        ctx.rotate(dormancyDroop);
        ctx.translate(-cx, -(cy + u * 4));
      }

      // Stage 5 uses stage 4 base drawing + enhanced effects
      const drawStage = Math.min(plant.stage, 4);
      const args = { ctx, cx, cy, u, stage: drawStage, scale, sway, trunk, leaf, accent, special, frameCount, index } as const;
      switch (plant.category) {
        case 'wellness':     this.drawLotus(args); break;
        case 'fitness':      this.drawOak(args); break;
        case 'learning':     this.drawOlive(args); break;
        case 'finance':      this.drawMoneyTree(args); break;
        case 'spiritual':    this.drawCedar(args); break;
        case 'productivity': this.drawBamboo(args); break;
        case 'creative':     this.drawCherryBlossom(args); break;
        default:             this.drawFern(args); break;
      }

      // Stage 5 golden shimmer overlay
      if (plant.stage === 5) {
        const shimmer = 0.1 + Math.sin(frameCount * 0.03 + index * 2) * 0.08;
        ctx.fillStyle = `rgba(255,215,0,${shimmer})`;
        ctx.beginPath();
        ctx.arc(cx, cy - u * 4, u * 8 * scale, 0, Math.PI * 2);
        ctx.fill();
      }

      if (dormancyDroop > 0) ctx.restore();
    }
  }

  /** Stage 5 Ancient: dramatic golden aura with radiating rays */
  private drawAncientAura(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, u: number,
    frameCount: number, index: number,
  ): void {
    // Outer pulse ring
    const pulseR = u * 10 + Math.sin(frameCount * 0.02 + index) * u * 2;
    const pulseAlpha = 0.15 + Math.sin(frameCount * 0.04 + index * 1.5) * 0.08;
    ctx.strokeStyle = `rgba(255,215,0,${pulseAlpha})`;
    ctx.lineWidth = u * 0.6;
    ctx.beginPath();
    ctx.arc(cx, cy - u * 3, pulseR, 0, Math.PI * 2);
    ctx.stroke();

    // Inner golden glow
    const grad = ctx.createRadialGradient(cx, cy - u * 3, 0, cx, cy - u * 3, u * 8);
    grad.addColorStop(0, `rgba(255,215,0,${0.12 + Math.sin(frameCount * 0.05) * 0.06})`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy - u * 3, u * 8, 0, Math.PI * 2);
    ctx.fill();

    // Radiating light rays
    for (let r = 0; r < 6; r++) {
      const angle = (r / 6) * Math.PI * 2 + frameCount * 0.008;
      const rayLen = u * (7 + Math.sin(frameCount * 0.03 + r * 1.5) * 2);
      const rayAlpha = 0.08 + Math.sin(frameCount * 0.05 + r) * 0.04;
      ctx.strokeStyle = `rgba(255,223,100,${rayAlpha})`;
      ctx.lineWidth = u * 0.3;
      ctx.beginPath();
      ctx.moveTo(cx, cy - u * 3);
      ctx.lineTo(cx + Math.cos(angle) * rayLen, cy - u * 3 + Math.sin(angle) * rayLen);
      ctx.stroke();
    }
  }

  // ── Shared: Seed ─────────────────────────────

  private drawSeed(ctx: CanvasRenderingContext2D, cx: number, cy: number, u: number): void {
    ctx.fillStyle = '#4A3520';
    ctx.beginPath(); ctx.arc(cx - u, cy + u * 2, u * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + u * 0.6, cy + u * 2.5, u * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + u * 0.1, cy + u * 1.8, u * 0.35, 0, Math.PI * 2); ctx.fill();
  }

  // ── Species Drawing Args ─────────────────────

  private drawLotus(a: DrawArgs): void {
    const { ctx, cx, cy, u, stage, scale, sway, leaf, accent, special, frameCount, index } = a;
    const s = scale;

    // Water circle
    ctx.fillStyle = special;
    ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.5);
    ctx.beginPath();
    ctx.ellipse(cx, cy + u * 2, u * 4 * s, u * 1.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = ctx.globalAlpha < 1 ? 0.7 : 1; // restore dormancy alpha or full

    if (stage === 1) {
      // Tiny lily pad
      ctx.fillStyle = '#2E7D32';
      ctx.beginPath();
      ctx.ellipse(cx + sway * 0.3, cy + u * 1.5, u * 2 * s, u * 1 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (stage === 2) {
      // Full pad + closed bud
      ctx.fillStyle = '#2E7D32';
      ctx.beginPath();
      ctx.ellipse(cx + sway * 0.3, cy + u * 1.5, u * 3 * s, u * 1.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Bud
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.ellipse(cx + sway * 0.5, cy - u * 1 * s, u * 1 * s, u * 2 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (stage >= 3) {
      // Full pad
      ctx.fillStyle = '#2E7D32';
      ctx.beginPath();
      ctx.ellipse(cx + sway * 0.3, cy + u * 1.5, u * 4 * s, u * 2 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Layered petals
      const petalColor = stage === 4 ? '#FFD700' : accent;
      const layers = 3;
      for (let l = layers; l >= 1; l--) {
        const r = u * (1.5 + l * 0.8) * s;
        const yOff = cy - u * (2 + l * 0.8) * s + sway * 0.5;
        ctx.fillStyle = petalColor;
        ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.6 + l * 0.12);
        ctx.beginPath();
        for (let p = 0; p < 6; p++) {
          const angle = (p / 6) * Math.PI * 2 + frameCount * 0.003;
          const px = cx + Math.cos(angle) * r * 0.7;
          const py = yOff + Math.sin(angle) * r * 0.4;
          ctx.moveTo(px, py);
          ctx.arc(px, py, u * 0.8 * s, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.globalAlpha = ctx.globalAlpha < 1 ? 0.7 : 1;
      }
      // Center
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(cx + sway * 0.5, cy - u * 3 * s, u * 1 * s, 0, Math.PI * 2);
      ctx.fill();

      // Stage 4 water glow
      if (stage === 4) {
        const glowAlpha = 0.15 + Math.sin(frameCount * 0.04 + index) * 0.1;
        ctx.fillStyle = `rgba(255,215,0,${glowAlpha})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy + u * 2, u * 5 * s, u * 2.5 * s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawOak(a: DrawArgs): void {
    const { ctx, cx, cy, u, stage, scale, sway, trunk, leaf, frameCount, index } = a;
    const s = scale;

    if (stage === 1) {
      // Stubby stem
      ctx.fillStyle = trunk;
      ctx.fillRect(cx - u * 0.4, cy - u * 2 * s, u * 0.8, u * 5 * s);
      // Two rounded leaves
      ctx.fillStyle = leaf;
      ctx.beginPath();
      ctx.ellipse(cx - u * 1.5 + sway * 0.3, cy - u * 2 * s, u * 1.5 * s, u * 1 * s, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + u * 1.5 + sway * 0.3, cy - u * 2.5 * s, u * 1.5 * s, u * 1 * s, 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (stage === 2) {
      // Tapered trunk
      ctx.fillStyle = trunk;
      ctx.beginPath();
      ctx.moveTo(cx - u * 1, cy + u * 4);
      ctx.lineTo(cx - u * 0.4, cy - u * 4 * s);
      ctx.lineTo(cx + u * 0.4, cy - u * 4 * s);
      ctx.lineTo(cx + u * 1, cy + u * 4);
      ctx.fill();
      // Small bumpy crown
      ctx.fillStyle = leaf;
      const crownY = cy - u * 5 * s + sway * 0.5;
      ctx.beginPath();
      ctx.arc(cx, crownY, u * 3 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx - u * 2 * s, crownY + u, u * 2 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + u * 2 * s, crownY + u, u * 2 * s, 0, Math.PI * 2);
      ctx.fill();
    } else if (stage >= 3) {
      // Thick tapered trunk
      ctx.fillStyle = trunk;
      ctx.beginPath();
      ctx.moveTo(cx - u * 1.5, cy + u * 4);
      ctx.lineTo(cx - u * 0.5, cy - u * 6 * s);
      ctx.lineTo(cx + u * 0.5, cy - u * 6 * s);
      ctx.lineTo(cx + u * 1.5, cy + u * 4);
      ctx.fill();
      // Wide spreading crown with bezier bumps
      ctx.fillStyle = leaf;
      const topY = cy - u * 8 * s + sway * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx - u * 6 * s, topY + u * 3);
      ctx.bezierCurveTo(cx - u * 6 * s, topY - u, cx - u * 2, topY - u * 2 * s, cx, topY - u * 2 * s);
      ctx.bezierCurveTo(cx + u * 2, topY - u * 2 * s, cx + u * 6 * s, topY - u, cx + u * 6 * s, topY + u * 3);
      ctx.bezierCurveTo(cx + u * 4, topY + u * 4, cx - u * 4, topY + u * 4, cx - u * 6 * s, topY + u * 3);
      ctx.fill();
      // Darker inner texture
      ctx.fillStyle = '#1B5E20';
      ctx.beginPath();
      ctx.arc(cx - u * 2, topY + u, u * 2 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + u * 1.5, topY + u * 2, u * 1.5 * s, 0, Math.PI * 2);
      ctx.fill();

      // Stage 4: golden acorns + crown sparkles
      if (stage === 4) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = u * 0.5;
        ctx.beginPath();
        ctx.moveTo(cx - u * 6 * s, topY + u * 3);
        ctx.bezierCurveTo(cx - u * 6 * s, topY - u, cx - u * 2, topY - u * 2 * s, cx, topY - u * 2 * s);
        ctx.bezierCurveTo(cx + u * 2, topY - u * 2 * s, cx + u * 6 * s, topY - u, cx + u * 6 * s, topY + u * 3);
        ctx.stroke();
        // Acorns
        ctx.fillStyle = '#8B6914';
        for (let ac = 0; ac < 3; ac++) {
          const ax = cx + (ac - 1) * u * 3 + Math.sin(frameCount * 0.02 + ac) * u * 0.5;
          const ay = topY + u * 4 + Math.sin(frameCount * 0.03 + ac * 2) * u;
          ctx.beginPath(); ctx.arc(ax, ay, u * 0.7, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  private drawOlive(a: DrawArgs): void {
    const { ctx, cx, cy, u, stage, scale, sway, trunk, leaf, accent, frameCount, index } = a;
    const s = scale;

    if (stage === 1) {
      // Thin twisted stem
      ctx.strokeStyle = trunk;
      ctx.lineWidth = u * 0.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy + u * 3);
      ctx.bezierCurveTo(cx - u, cy + u, cx + u, cy - u * s, cx + sway * 0.3, cy - u * 2 * s);
      ctx.stroke();
      // Tiny leaf
      ctx.fillStyle = leaf;
      ctx.beginPath();
      ctx.ellipse(cx + sway * 0.3, cy - u * 2.5 * s, u * 1.5 * s, u * 0.6 * s, 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (stage === 2) {
      // Twisted trunk
      ctx.strokeStyle = trunk;
      ctx.lineWidth = u * 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy + u * 3);
      ctx.bezierCurveTo(cx - u * 2, cy, cx + u * 2, cy - u * 3, cx + sway * 0.3, cy - u * 4 * s);
      ctx.stroke();
      // Silvery-green leaf clusters
      ctx.fillStyle = leaf;
      const topY = cy - u * 4 * s + sway * 0.5;
      ctx.beginPath(); ctx.ellipse(cx - u * 2, topY, u * 2 * s, u * 1 * s, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + u * 2, topY - u, u * 2 * s, u * 1 * s, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, topY - u * 1.5, u * 1.5 * s, u * 0.8 * s, 0, 0, Math.PI * 2); ctx.fill();
    } else if (stage >= 3) {
      // Full twisted trunk
      ctx.strokeStyle = trunk;
      ctx.lineWidth = u * 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - u * 0.5, cy + u * 4);
      ctx.bezierCurveTo(cx - u * 3, cy + u, cx + u * 3, cy - u * 2, cx + sway * 0.2, cy - u * 5 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + u * 0.5, cy + u * 4);
      ctx.bezierCurveTo(cx + u * 2, cy + u * 2, cx - u, cy - u * 3, cx - u + sway * 0.2, cy - u * 6 * s);
      ctx.stroke();
      // Mediterranean canopy
      ctx.fillStyle = leaf;
      const topY = cy - u * 6 * s + sway * 0.5;
      ctx.beginPath();
      ctx.ellipse(cx, topY, u * 5 * s, u * 3 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.ellipse(cx - u * 2, topY + u, u * 2 * s, u * 1.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // Stage 4: silver-gold fruit
      if (stage === 4) {
        ctx.fillStyle = '#C0C060';
        for (let f = 0; f < 5; f++) {
          const fx = cx + Math.sin(f * 1.4 + index) * u * 3 * s;
          const fy = topY + Math.cos(f * 1.8 + index) * u * 2 * s;
          ctx.beginPath(); ctx.arc(fx, fy, u * 0.6, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  private drawMoneyTree(a: DrawArgs): void {
    const { ctx, cx, cy, u, stage, scale, sway, trunk, leaf, accent, frameCount, index } = a;
    const s = scale;

    if (stage === 1) {
      ctx.fillStyle = trunk;
      ctx.fillRect(cx - u * 0.3, cy - u * 2 * s, u * 0.6, u * 5 * s);
      ctx.fillStyle = leaf;
      ctx.beginPath();
      ctx.ellipse(cx + sway * 0.3, cy - u * 2.5 * s, u * 1.5 * s, u * 1 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (stage === 2) {
      // Braided trunk (3 interweaving lines)
      ctx.strokeStyle = trunk;
      ctx.lineWidth = u * 0.6;
      for (let b = 0; b < 3; b++) {
        ctx.beginPath();
        const ox = (b - 1) * u * 0.5;
        ctx.moveTo(cx + ox, cy + u * 3);
        ctx.bezierCurveTo(
          cx + ox + Math.sin(b * 2.1) * u * 1.5, cy + u,
          cx + ox - Math.sin(b * 2.1) * u * 1.5, cy - u * 2,
          cx + sway * 0.3, cy - u * 4 * s,
        );
        ctx.stroke();
      }
      // Small palmate leaves
      ctx.fillStyle = leaf;
      const topY = cy - u * 4 * s + sway * 0.5;
      for (let l = 0; l < 4; l++) {
        const angle = (l / 4) * Math.PI - Math.PI * 0.25;
        ctx.beginPath();
        ctx.ellipse(
          topY > 0 ? cx + Math.cos(angle) * u * 2 * s : cx + Math.cos(angle) * u * 2 * s,
          topY + Math.sin(angle) * u * 1.5 * s - u,
          u * 2 * s, u * 0.8 * s, angle, 0, Math.PI * 2,
        );
        ctx.fill();
      }
    } else if (stage >= 3) {
      // Full braided trunk
      ctx.strokeStyle = trunk;
      ctx.lineWidth = u * 0.8;
      for (let b = 0; b < 3; b++) {
        ctx.beginPath();
        const ox = (b - 1) * u * 0.7;
        ctx.moveTo(cx + ox, cy + u * 4);
        ctx.bezierCurveTo(
          cx + ox + Math.sin(b * 2.1) * u * 2, cy + u,
          cx + ox - Math.sin(b * 2.1) * u * 2, cy - u * 3,
          cx + sway * 0.2, cy - u * 6 * s,
        );
        ctx.stroke();
      }
      // Large radiating palmate leaves
      const topY = cy - u * 7 * s + sway * 0.5;
      for (let l = 0; l < 5; l++) {
        const angle = (l / 5) * Math.PI - Math.PI * 0.3 + sway * 0.02;
        // Gold-green gradient effect
        ctx.fillStyle = l % 2 === 0 ? leaf : accent;
        ctx.beginPath();
        ctx.ellipse(
          cx + Math.cos(angle) * u * 3 * s,
          topY + Math.sin(angle) * u * 2 * s,
          u * 3 * s, u * 1 * s, angle, 0, Math.PI * 2,
        );
        ctx.fill();
      }

      // Stage 4: floating golden coins
      if (stage === 4) {
        ctx.fillStyle = '#FFD700';
        for (let c = 0; c < 4; c++) {
          const t = frameCount * 0.03 + c * 1.57;
          const coinX = cx + Math.sin(t) * u * 5 * s;
          const coinY = topY - u * 2 + Math.cos(t * 0.7) * u * 3;
          const coinAlpha = 0.5 + Math.sin(t * 2) * 0.3;
          ctx.globalAlpha = Math.min(ctx.globalAlpha, coinAlpha);
          ctx.beginPath(); ctx.arc(coinX, coinY, u * 0.8, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = ctx.globalAlpha < 1 ? 0.7 : 1;
        }
      }
    }
  }

  private drawCedar(a: DrawArgs): void {
    const { ctx, cx, cy, u, stage, scale, sway, trunk, leaf, special, frameCount, index } = a;
    const s = scale;

    if (stage === 1) {
      // Single upright shoot
      ctx.fillStyle = trunk;
      ctx.fillRect(cx - u * 0.3, cy - u * 2 * s, u * 0.6, u * 5 * s);
      ctx.fillStyle = leaf;
      // Tiny triangle top
      ctx.beginPath();
      ctx.moveTo(cx + sway * 0.3, cy - u * 3 * s);
      ctx.lineTo(cx - u * 1.5, cy - u * 0.5);
      ctx.lineTo(cx + u * 1.5, cy - u * 0.5);
      ctx.fill();
    } else if (stage === 2) {
      // Small pyramid
      ctx.fillStyle = trunk;
      ctx.fillRect(cx - u * 0.5, cy - u * 3 * s, u, u * 6 * s);
      ctx.fillStyle = leaf;
      ctx.beginPath();
      ctx.moveTo(cx + sway * 0.3, cy - u * 5 * s);
      ctx.lineTo(cx - u * 3 * s, cy - u);
      ctx.lineTo(cx + u * 3 * s, cy - u);
      ctx.fill();
    } else if (stage >= 3) {
      // Thick trunk
      ctx.fillStyle = trunk;
      ctx.beginPath();
      ctx.moveTo(cx - u * 1, cy + u * 4);
      ctx.lineTo(cx - u * 0.4, cy - u * 6 * s);
      ctx.lineTo(cx + u * 0.4, cy - u * 6 * s);
      ctx.lineTo(cx + u * 1, cy + u * 4);
      ctx.fill();
      // Flat-topped horizontal branch layers
      ctx.fillStyle = leaf;
      const layers = 3;
      for (let l = 0; l < layers; l++) {
        const ly = cy - u * (3 + l * 2.5) * s + sway * 0.3 * (l + 1);
        const lw = u * (5 - l * 0.8) * s;
        ctx.beginPath();
        ctx.moveTo(cx - lw, ly + u * 0.5);
        ctx.bezierCurveTo(cx - lw * 0.5, ly - u * 0.5, cx + lw * 0.5, ly - u * 0.5, cx + lw, ly + u * 0.5);
        ctx.bezierCurveTo(cx + lw * 0.5, ly + u * 1.2, cx - lw * 0.5, ly + u * 1.2, cx - lw, ly + u * 0.5);
        ctx.fill();
      }

      // Stage 4: ethereal mist at base
      if (stage === 4) {
        for (let m = 0; m < 4; m++) {
          const mx = cx + Math.sin(frameCount * 0.015 + m * 1.8) * u * 4;
          const my = cy + u * 3 + Math.sin(frameCount * 0.02 + m) * u;
          const mAlpha = 0.1 + Math.sin(frameCount * 0.03 + m * 2) * 0.05;
          ctx.fillStyle = `rgba(176,190,197,${mAlpha})`;
          ctx.beginPath();
          ctx.ellipse(mx, my, u * 3, u * 1, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  private drawBamboo(a: DrawArgs): void {
    const { ctx, cx, cy, u, stage, scale, sway, trunk, leaf, accent, frameCount, index } = a;
    const s = scale;

    const caneColor = trunk;
    const nodeColor = '#8B7D3C';

    if (stage === 1) {
      // Single thin cane
      ctx.strokeStyle = caneColor;
      ctx.lineWidth = u * 0.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy + u * 3);
      ctx.lineTo(cx + sway * 0.3, cy - u * 3 * s);
      ctx.stroke();
      // Node mark
      ctx.strokeStyle = nodeColor;
      ctx.lineWidth = u * 0.3;
      ctx.beginPath();
      ctx.moveTo(cx - u * 0.5 + sway * 0.15, cy);
      ctx.lineTo(cx + u * 0.5 + sway * 0.15, cy);
      ctx.stroke();
    } else if (stage === 2) {
      // 3 canes with nodes
      for (let c = 0; c < 3; c++) {
        const ox = (c - 1) * u * 1.5;
        const cSway = sway * (0.8 + c * 0.1);
        ctx.strokeStyle = caneColor;
        ctx.lineWidth = u * 0.5;
        ctx.beginPath();
        ctx.moveTo(cx + ox, cy + u * 3);
        ctx.lineTo(cx + ox + cSway * 0.3, cy - u * 4 * s);
        ctx.stroke();
        // Nodes
        ctx.strokeStyle = nodeColor;
        ctx.lineWidth = u * 0.3;
        for (let n = 0; n < 2; n++) {
          const ny = cy + u * (1 - n * 2.5) * s;
          ctx.beginPath();
          ctx.moveTo(cx + ox - u * 0.4, ny);
          ctx.lineTo(cx + ox + u * 0.4, ny);
          ctx.stroke();
        }
      }
      // Small leaf
      ctx.fillStyle = leaf;
      ctx.beginPath();
      ctx.ellipse(cx + u * 2 + sway * 0.5, cy - u * 3 * s, u * 1.5 * s, u * 0.5 * s, 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (stage >= 3) {
      // 5+ canes, dense
      const caneCount = stage === 4 ? 7 : 5;
      for (let c = 0; c < caneCount; c++) {
        const ox = (c - Math.floor(caneCount / 2)) * u * 1.2;
        const height = u * (6 + Math.sin(c * 1.3) * 2) * s;
        const cSway = sway * (0.7 + c * 0.08);
        ctx.strokeStyle = caneColor;
        ctx.lineWidth = u * 0.5;
        ctx.beginPath();
        ctx.moveTo(cx + ox, cy + u * 3);
        ctx.lineTo(cx + ox + cSway * 0.4, cy - height);
        ctx.stroke();
        // Nodes
        ctx.strokeStyle = nodeColor;
        ctx.lineWidth = u * 0.25;
        const nodeCount = Math.floor(height / (u * 2));
        for (let n = 1; n < nodeCount; n++) {
          const ny = cy + u * 3 - n * u * 2;
          ctx.beginPath();
          ctx.moveTo(cx + ox - u * 0.4, ny);
          ctx.lineTo(cx + ox + u * 0.4, ny);
          ctx.stroke();
        }
        // Alternating leaf clusters
        if (c % 2 === 0) {
          ctx.fillStyle = leaf;
          const ly = cy - height * 0.6 + cSway * 0.5;
          ctx.beginPath();
          ctx.ellipse(cx + ox + u * 2, ly, u * 2 * s, u * 0.6 * s, 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Stage 4: jade glow on nodes
      if (stage === 4) {
        for (let c = 0; c < caneCount; c++) {
          const ox = (c - Math.floor(caneCount / 2)) * u * 1.2;
          const glowAlpha = 0.2 + Math.sin(frameCount * 0.04 + c) * 0.1;
          ctx.fillStyle = `rgba(0,230,118,${glowAlpha})`;
          ctx.beginPath();
          ctx.arc(cx + ox, cy, u * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  private drawCherryBlossom(a: DrawArgs): void {
    const { ctx, cx, cy, u, stage, scale, sway, trunk, leaf, accent, frameCount, index } = a;
    const s = scale;

    if (stage === 1) {
      // Thin pale stem + 2 buds
      ctx.strokeStyle = trunk;
      ctx.lineWidth = u * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy + u * 3);
      ctx.lineTo(cx + sway * 0.2, cy - u * 2 * s);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(cx + sway * 0.2 - u, cy - u * 1.5 * s, u * 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + sway * 0.2 + u, cy - u * 2 * s, u * 0.5, 0, Math.PI * 2); ctx.fill();
    } else if (stage === 2) {
      // Branching structure + pink spots
      ctx.strokeStyle = trunk;
      ctx.lineWidth = u * 0.7;
      ctx.beginPath();
      ctx.moveTo(cx, cy + u * 3);
      ctx.lineTo(cx, cy - u * 3 * s);
      ctx.stroke();
      // Branches
      ctx.lineWidth = u * 0.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy - u * s);
      ctx.bezierCurveTo(cx - u * 2, cy - u * 2, cx - u * 4, cy - u * 3 * s, cx - u * 4 + sway * 0.5, cy - u * 4 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - u * 2 * s);
      ctx.bezierCurveTo(cx + u * 2, cy - u * 3, cx + u * 3, cy - u * 4 * s, cx + u * 3 + sway * 0.5, cy - u * 5 * s);
      ctx.stroke();
      // Pink flower spots
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(cx - u * 4 + sway * 0.5, cy - u * 4 * s, u * 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + u * 3 + sway * 0.5, cy - u * 5 * s, u * 1.2, 0, Math.PI * 2); ctx.fill();
    } else if (stage >= 3) {
      // Delicate trunk
      ctx.strokeStyle = trunk;
      ctx.lineWidth = u * 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy + u * 4);
      ctx.bezierCurveTo(cx - u, cy + u, cx + u * 0.5, cy - u * 3, cx + sway * 0.2, cy - u * 5 * s);
      ctx.stroke();
      // Multiple delicate branches
      ctx.lineWidth = u * 0.4;
      const branches = [
        { sx: -0.5, sy: -2, ex: -5, ey: -6 },
        { sx: 0, sy: -3, ex: 4, ey: -7 },
        { sx: -0.3, sy: -4, ex: -3, ey: -8 },
        { sx: 0.2, sy: -4.5, ex: 2, ey: -9 },
      ];
      for (const b of branches) {
        ctx.beginPath();
        ctx.moveTo(cx + b.sx * u, cy + b.sy * u * s);
        ctx.bezierCurveTo(
          cx + (b.sx + b.ex) * 0.5 * u, cy + (b.sy + b.ey) * 0.5 * u * s,
          cx + b.ex * 0.8 * u, cy + b.ey * 0.8 * u * s,
          cx + b.ex * u + sway * 0.5, cy + b.ey * u * s,
        );
        ctx.stroke();
      }
      // Dense pink flower clusters
      ctx.fillStyle = accent;
      const flowers = [
        { x: -5, y: -6 }, { x: 4, y: -7 }, { x: -3, y: -8 },
        { x: 2, y: -9 }, { x: -1, y: -7 }, { x: 1, y: -5 },
      ];
      for (const f of flowers) {
        const clusterR = u * (1.2 + Math.sin(index + f.x) * 0.3) * s;
        ctx.beginPath();
        ctx.arc(cx + f.x * u + sway * 0.4, cy + f.y * u * s, clusterR, 0, Math.PI * 2);
        ctx.fill();
      }
      // White highlights
      ctx.fillStyle = leaf;
      ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.4);
      for (let h = 0; h < 4; h++) {
        const hf = flowers[h];
        ctx.beginPath();
        ctx.arc(cx + hf.x * u + sway * 0.3 + u * 0.5, cy + hf.y * u * s - u * 0.3, u * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = ctx.globalAlpha < 1 ? 0.7 : 1;
    }
  }

  private drawFern(a: DrawArgs): void {
    const { ctx, cx, cy, u, stage, scale, sway, trunk, leaf, accent, special, frameCount, index } = a;
    const s = scale;

    if (stage === 1) {
      // Curled fiddlehead (spiral)
      ctx.strokeStyle = leaf;
      ctx.lineWidth = u * 0.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy + u * 2);
      // Spiral upward
      const steps = 12;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const r = u * (2 - t * 1.5) * s;
        const angle = t * Math.PI * 1.5 + Math.PI * 0.5;
        ctx.lineTo(cx + Math.cos(angle) * r * 0.5 + sway * t * 0.3, cy + u * 2 - t * u * 3 * s + Math.sin(angle) * r * 0.3);
      }
      ctx.stroke();
    } else if (stage === 2) {
      // 2-3 unfurling fronds
      ctx.strokeStyle = leaf;
      ctx.lineWidth = u * 0.5;
      for (let f = 0; f < 3; f++) {
        const angle = (f - 1) * 0.4;
        ctx.beginPath();
        ctx.moveTo(cx, cy + u * 2);
        const fSway = sway * (0.8 + f * 0.1);
        ctx.bezierCurveTo(
          cx + Math.sin(angle) * u * 2, cy,
          cx + Math.sin(angle) * u * 3, cy - u * 2 * s,
          cx + Math.sin(angle) * u * 3.5 + fSway * 0.4, cy - u * 4 * s,
        );
        ctx.stroke();
        // Leaf marks along frond
        ctx.fillStyle = accent;
        for (let l = 0; l < 3; l++) {
          const t = 0.3 + l * 0.25;
          const lx = cx + Math.sin(angle) * u * 3.5 * t + fSway * 0.4 * t;
          const ly = cy + u * 2 - t * u * 6 * s;
          ctx.beginPath();
          ctx.ellipse(lx + u * 0.8, ly, u * 1 * s, u * 0.3 * s, angle + 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (stage >= 3) {
      // Full spread of 5+ fronds
      const frondCount = stage === 4 ? 7 : 5;
      ctx.strokeStyle = leaf;
      ctx.lineWidth = u * 0.5;
      for (let f = 0; f < frondCount; f++) {
        const angle = (f - Math.floor(frondCount / 2)) * 0.35;
        const fSway = sway * (0.7 + f * 0.05);
        const height = u * (5 + Math.sin(f * 1.7) * 1.5) * s;
        ctx.beginPath();
        ctx.moveTo(cx, cy + u * 2);
        ctx.bezierCurveTo(
          cx + Math.sin(angle) * u * 2, cy,
          cx + Math.sin(angle) * u * 4, cy - height * 0.6,
          cx + Math.sin(angle) * u * 4.5 + fSway * 0.5, cy + u * 2 - height,
        );
        ctx.stroke();
        // Leaflets along frond
        ctx.fillStyle = accent;
        for (let l = 0; l < 5; l++) {
          const t = 0.2 + l * 0.17;
          const lx = cx + Math.sin(angle) * u * 4.5 * t + fSway * 0.5 * t;
          const ly = cy + u * 2 - height * t;
          ctx.beginPath();
          ctx.ellipse(lx + u * 0.7, ly, u * 1.2 * s, u * 0.35 * s, angle + 0.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(lx - u * 0.7, ly + u * 0.3, u * 1 * s, u * 0.3 * s, angle - 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Stage 4: bioluminescent frond tips
      if (stage === 4) {
        for (let f = 0; f < frondCount; f++) {
          const angle = (f - Math.floor(frondCount / 2)) * 0.35;
          const height = u * (5 + Math.sin(f * 1.7) * 1.5) * s;
          const tx = cx + Math.sin(angle) * u * 4.5 + sway * 0.5;
          const ty = cy + u * 2 - height;
          const glowAlpha = 0.3 + Math.sin(frameCount * 0.05 + f) * 0.2;
          ctx.fillStyle = `rgba(0,229,255,${glowAlpha})`;
          ctx.beginPath();
          ctx.arc(tx, ty, u * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // ── Effects ──────────────────────────────────

  private drawWaterDroplet(
    ctx: CanvasRenderingContext2D, cx: number, cy: number, u: number,
    frameCount: number, index: number,
  ): void {
    const t = frameCount * 0.06 + index * 2.3;
    const alpha = 0.4 + Math.sin(t) * 0.3;
    const dx = cx + u * 2 + Math.sin(t * 0.7) * u;
    const dy = cy + u * 3;
    ctx.fillStyle = `rgba(79,195,247,${alpha})`;
    ctx.beginPath();
    ctx.arc(dx, dy, u * 0.8, 0, Math.PI * 2);
    ctx.fill();
    // Tiny highlight
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.6})`;
    ctx.beginPath();
    ctx.arc(dx - u * 0.2, dy - u * 0.2, u * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawLoggedSparkles(
    ctx: CanvasRenderingContext2D, cx: number, cy: number, u: number,
    frameCount: number, index: number,
  ): void {
    for (let s = 0; s < 2; s++) {
      const t = frameCount * 0.05 + index * 3.1 + s * 4.7;
      const cycle = t % 120;
      if (cycle > 60) continue; // Only show half the time
      const progress = cycle / 60;
      const sx = cx + Math.sin(t * 0.3 + s) * u * 3;
      const sy = cy - u * 2 - progress * u * 8;
      const alpha = (1 - progress) * 0.7;
      ctx.fillStyle = `rgba(255,215,0,${alpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, u * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawLegendaryParticles(
    ctx: CanvasRenderingContext2D, cx: number, cy: number, u: number,
    frameCount: number, index: number, category: string,
  ): void {
    if (category === 'creative') {
      // Cherry blossom: pink petals falling
      for (let p = 0; p < 4; p++) {
        const t = frameCount * 0.03 + p * 2.5 + index;
        const cycle = (t % 100) / 100;
        const px = cx + Math.sin(t * 0.5) * u * 6;
        const py = cy - u * 10 + cycle * u * 16;
        const alpha = 0.5 - cycle * 0.4;
        if (alpha <= 0) continue;
        ctx.fillStyle = `rgba(244,143,177,${alpha})`;
        ctx.beginPath();
        // Petal shape (small ellipse)
        ctx.ellipse(px, py, u * 0.6, u * 0.3, t * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Golden sparkles rising (existing pattern, enhanced)
      const sparkleAlpha = 0.4 + Math.sin(frameCount * 0.08 + index) * 0.3;
      ctx.fillStyle = `rgba(255,215,0,${sparkleAlpha})`;
      for (let s = 0; s < 5; s++) {
        const angle = (frameCount * 0.02 + s * 1.26) % (Math.PI * 2);
        const dist = u * 6;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(angle) * dist, cy - u * 6 + Math.sin(angle) * dist, u * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Gold shimmer outline for all legendary
    ctx.strokeStyle = `rgba(255,215,0,${0.3 + Math.sin(frameCount * 0.06) * 0.15})`;
    ctx.lineWidth = u * 0.4;
    ctx.beginPath();
    ctx.arc(cx, cy - u * 4, u * 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawAmbienceParticle(
    ctx: CanvasRenderingContext2D, camera: Camera, bounds: Rect, frameCount: number,
  ): void {
    const cycleLen = 300;
    const t = (frameCount % cycleLen) / cycleLen;
    if (t > 0.6) return; // Only visible part of cycle

    const tl = camera.worldToScreen(bounds.x, bounds.y);
    const br = camera.worldToScreen(bounds.x + bounds.w, bounds.y + bounds.h);
    const w = br.x - tl.x;
    const h = br.y - tl.y;
    const z = camera.zoom;

    const px = tl.x + t * w * 1.5;
    const py = tl.y + h * 0.3 + Math.sin(frameCount * 0.03) * h * 0.2;
    const alpha = Math.sin(t / 0.6 * Math.PI) * 0.3;

    ctx.fillStyle = `rgba(129,199,132,${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, z * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

type DrawArgs = {
  ctx: CanvasRenderingContext2D;
  cx: number;
  cy: number;
  u: number;
  stage: number;
  scale: number;
  sway: number;
  trunk: string;
  leaf: string;
  accent: string;
  special: string;
  frameCount: number;
  index: number;
};
