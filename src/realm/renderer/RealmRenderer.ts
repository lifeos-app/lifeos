/**
 * Realm Renderer — Main rendering pipeline
 *
 * Orchestrates all rendering subsystems:
 * Sky → Tiles → Buildings → NPCs/Items → Player → Portals → Particles → Lighting → UI
 */

import { Camera } from './Camera';
import { TileRenderer } from './TileRenderer';
import { LightingSystem } from './LightingSystem';
import { ParticleEngine } from './ParticleEngine';
import { GardenRenderer } from './GardenRenderer';
import { EntityRenderer } from './EntityRenderer';
import { WeatherRenderer } from './WeatherRenderer';
import { TILE_SIZE } from '../data/tiles';
import type { ZoneDef, NPCAppearance } from '../data/zones';
import type { GardenPlant, DynamicEntity, EquippedVisuals } from '../bridge/DataBridge';
import { drawCharacter } from './drawCharacter';
import { CompanionRenderer } from './CompanionRenderer';
import { RemotePlayerRenderer } from '../multiplayer/RemotePlayerRenderer';
import { drawChatBubble } from '../ui/ChatBubble';
import type { RemotePlayer } from '../multiplayer/types';
import { useCharacterAppearanceStore } from '../../stores/useCharacterAppearanceStore';
import { getSeason, SEASON_PALETTES } from '../data/celestial';
import type { CompanionRenderData } from '../bridge/DataBridge';

/** Player state for rendering */
export interface PlayerRenderState {
  worldX: number;
  worldY: number;
  direction: 'up' | 'down' | 'left' | 'right';
  isMoving: boolean;
  skinTone: string;
  hairColor: string;
  bodyColor: string;
  classIcon: string;
  name: string;
  level: number;
}

/** Full world state for one render frame */
export interface RenderFrame {
  zone: ZoneDef;
  player: PlayerRenderState;
  houseLevel: number;
  portals: { tileX: number; tileY: number; label: string; icon: string; locked: boolean }[];
  npcs: { tileX: number; tileY: number; name: string; spriteType: string; appearance?: NPCAppearance }[];
  gardenPlants: GardenPlant[];
  gardenBounds: { x: number; y: number; w: number; h: number };
  dynamicEntities: DynamicEntity[];
  playerMood: number;
  playerBestStreak: number;
  playerEnergy: number;
  equippedVisuals: EquippedVisuals;
  remotePlayers: RemotePlayer[];
  localChatBubble: { text: string; time: number } | null;
  companion?: CompanionRenderData;
}

const SCALE = 3;

export class RealmRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  readonly camera = new Camera();
  readonly tileRenderer = new TileRenderer();
  readonly lighting = new LightingSystem();
  readonly particles = new ParticleEngine();
  readonly gardenRenderer = new GardenRenderer();
  readonly entityRenderer = new EntityRenderer();
  readonly weatherRenderer = new WeatherRenderer();
  readonly remotePlayerRenderer = new RemotePlayerRenderer();
  readonly companionRenderer = new CompanionRenderer();

  private frameCount = 0;
  private width = 0;
  private height = 0;
  private walkFrame = 0;
  private walkTimer = 0;

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.resize();
  }

  resize(): void {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx?.scale(dpr, dpr);
    if (this.ctx) this.ctx.imageSmoothingEnabled = false;

    this.camera.setViewport(this.width, this.height);
  }

  /**
   * Render one frame
   */
  render(frame: RenderFrame): void {
    if (!this.ctx) return;
    this.frameCount++;

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Update subsystems
    this.camera.update();
    this.lighting.update();
    this.particles.update();
    this.weatherRenderer.update(this.frameCount);

    // Walk animation
    if (frame.player.isMoving) {
      this.walkTimer++;
      if (this.walkTimer > 8) {
        this.walkFrame = (this.walkFrame + 1) % 4;
        this.walkTimer = 0;
      }
    } else {
      this.walkFrame = 0;
      this.walkTimer = 0;
    }

    // Set camera world bounds
    const worldW = frame.zone.width * TILE_SIZE * SCALE;
    const worldH = frame.zone.height * TILE_SIZE * SCALE;
    this.camera.setWorldBounds(worldW, worldH);

    // Follow player
    this.camera.follow(frame.player.worldX, frame.player.worldY);

    // ── Layer 1: Sky ──
    ctx.clearRect(0, 0, w, h);
    this.lighting.renderSky(ctx, w, h, frame.zone.palette.skyTop, frame.zone.palette.skyBottom);

    // ── Layer 1.5: Parallax ──
    this.renderParallax(ctx, w, h);

    // ── Layer 1.8: Grass base fill (prevent void beyond tile grid) ──
    {
      const worldOrigin = this.camera.worldToScreen(0, 0);
      const worldEnd = this.camera.worldToScreen(
        frame.zone.width * TILE_SIZE * SCALE,
        frame.zone.height * TILE_SIZE * SCALE,
      );
      // Extend grass fill slightly beyond world bounds so no gap shows
      const pad = 4;
      const gx = Math.max(0, worldOrigin.x - pad);
      const gy = Math.max(0, worldOrigin.y - pad);
      const gw = Math.min(w, worldEnd.x + pad) - gx;
      const gh = Math.min(h, worldEnd.y + pad) - gy;
      if (gw > 0 && gh > 0) {
        ctx.fillStyle = this.tileRenderer.getBiome()?.grassFill ?? '#4A7C3E';
        ctx.fillRect(gx, gy, gw, gh);
      }
    }

    // ── Layer 2: Ground tiles ──
    this.tileRenderer.setZone(frame.zone);
    this.tileRenderer.setScale(SCALE);
    this.tileRenderer.renderGround(ctx, this.camera, this.frameCount);

    // ── Layer 3: Buildings ──
    this.tileRenderer.renderBuildings(
      ctx, this.camera, frame.zone.buildings, this.frameCount, frame.houseLevel,
    );

    // ── Layer 3.5: Garden plants ──
    this.gardenRenderer.render(
      ctx, this.camera, frame.gardenPlants, frame.gardenBounds, this.frameCount,
    );

    // ── Layer 4: NPCs ──
    this.tileRenderer.renderNPCs(ctx, this.camera, frame.npcs, this.frameCount);

    // ── Layer 4.5: Dynamic entities ──
    this.entityRenderer.render(ctx, this.camera, frame.dynamicEntities, this.frameCount);

    // ── Layer 5: Portals ──
    this.tileRenderer.renderPortals(ctx, this.camera, frame.portals, this.frameCount);

    // ── Layer 5.5: Remote players ──
    this.remotePlayerRenderer.render(
      ctx, this.camera,
      frame.player.worldX, frame.player.worldY,
      frame.remotePlayers, this.frameCount,
    );

    // ── Layer 6: Player character ──
    this.renderPlayer(ctx, frame.player, frame.playerMood, frame.playerBestStreak, frame.playerEnergy, frame.equippedVisuals);

    // ── Layer 6.3: Companion animal ──
    if (frame.companion) {
      this.companionRenderer.update(frame.player.worldX, frame.player.worldY);
      this.companionRenderer.render(
        ctx, this.camera, frame.companion, this.frameCount,
      );
    }

    // ── Layer 6.5: Local player chat bubble ──
    if (frame.localChatBubble) {
      const age = Date.now() - frame.localChatBubble.time;
      if (age < 5000) {
        const ps = this.camera.worldToScreen(frame.player.worldX, frame.player.worldY);
        const pu = SCALE * this.camera.zoom;
        drawChatBubble(ctx, frame.localChatBubble.text, ps.x, ps.y, pu, age);
      }
    }

    // ── Layer 7: Particles ──
    this.particles.render(ctx, this.camera.x, this.camera.y, this.camera.zoom);

    // ── Layer 7.5: Weather overlay ──
    this.weatherRenderer.renderOverlay(ctx, w, h, this.frameCount);

    // ── Layer 8: Lighting overlay ──
    this.lighting.renderAmbientOverlay(ctx, w, h);
    this.lighting.renderPointLights(ctx, this.camera.x, this.camera.y, this.camera.zoom);

    // ── Ambient particles (season-aware) ──
    if (this.frameCount % 30 === 0) {
      const tod = this.lighting.getState().timeOfDay;
      const season = getSeason(new Date());
      const palette = SEASON_PALETTES[season];
      const camX = this.camera.x;
      const camY = this.camera.y;
      const vw = this.width / this.camera.zoom;
      const vh = this.height / this.camera.zoom;

      if (palette.particleType === 'petals') {
        const px = camX + Math.random() * vw;
        const py = camY + Math.random() * vh * 0.3;
        this.particles.emit(px, py, 1, {
          colors: ['#FFB7C5', '#FFC0CB', '#FFFFFF'],
          speed: 0.5, life: 60, size: 3, type: 'petal', gravity: 0.02,
        });
      } else if (palette.particleType === 'fireflies') {
        if (tod === 'night' || tod === 'evening') {
          this.particles.emitFirefly(camX, camY, vw, vh);
        } else {
          this.particles.emitPollen(camX, camY, vw, vh);
        }
      } else if (palette.particleType === 'leaves') {
        const px = camX + Math.random() * vw;
        const py = camY + Math.random() * vh * 0.3;
        this.particles.emit(px, py, 1, {
          colors: ['#FF8C00', '#CD853F', '#DAA520'],
          speed: 0.6, life: 50, size: 3, type: 'dot', gravity: 0.03,
        });
      } else if (palette.particleType === 'snow') {
        const px = camX + Math.random() * vw;
        const py = camY;
        this.particles.emit(px, py, 1, {
          colors: ['#FFFFFF', '#E8E8E8', '#F0F8FF'],
          speed: 0.3, life: 80, size: 2, type: 'snowflake', gravity: 0.01,
        });
      }
    }

    // ── Weather particles ──
    if (this.frameCount % 5 === 0) {
      this.weatherRenderer.emitWeatherParticles(this.particles, this.camera);
    }
  }

  // ── Player Rendering ──────────────────────────

  private renderPlayer(
    ctx: CanvasRenderingContext2D,
    player: PlayerRenderState,
    mood = 3,
    bestStreak = 0,
    energy = 3,
    equipped?: EquippedVisuals,
  ): void {
    const s = this.camera.worldToScreen(player.worldX, player.worldY);
    const u = SCALE * this.camera.zoom;

    const store = useCharacterAppearanceStore.getState();

    drawCharacter({
      ctx,
      cx: s.x,
      cy: s.y,
      unit: u,
      skinTone: player.skinTone,
      hairColor: player.hairColor,
      bodyColor: player.bodyColor,
      classIcon: player.classIcon,
      name: player.name,
      level: player.level,
      direction: player.direction,
      isMoving: player.isMoving,
      mood,
      bestStreak,
      energy,
      equipped,
      walkFrame: this.walkFrame,
      frameCount: this.frameCount,
      showName: true,
      showClassIcon: true,
      onEmitParticle: (cx, cy) => {
        this.particles.emit(cx, cy, 1, {
          colors: ['#FF4500', '#FF6347', '#FFD700'],
          speed: 1.5,
          life: 20,
          size: 3,
          type: 'glow',
        });
      },
      hairStyleIdx: store.hairStyleIdx,
      faceTypeIdx: store.faceTypeIdx,
      eyeColor: store.eyeColor,
      topIdx: store.topIdx,
      bottomIdx: store.bottomIdx,
      shoesIdx: store.shoesIdx,
      capeIdx: store.capeIdx,
      hatIdx: store.hatIdx,
      weaponIdx: store.weaponIdx,
      topColor: store.topColor,
      bottomColor: store.bottomColor,
      shoesColor: store.shoesColor,
    });
  }

  // ── Parallax Background ────────────────────────

  private renderParallax(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const camX = this.camera.x;

    // ── 3 mountain layers — rounded hills via bezierCurveTo ──
    const biome = this.tileRenderer.getBiome();
    const mtColors = biome?.mountainColors ?? [
      'rgba(25,20,55,0.45)',
      'rgba(35,45,75,0.35)',
      'rgba(45,70,80,0.28)',
    ];
    const layers = [
      { baseY: h * 0.35, amplitude: h * 0.18, rate: 0.05, color: mtColors[0] },
      { baseY: h * 0.38, amplitude: h * 0.13, rate: 0.1,  color: mtColors[1] },
      { baseY: h * 0.42, amplitude: h * 0.10, rate: 0.2,  color: mtColors[2] },
    ];

    for (const layer of layers) {
      const px = -camX * layer.rate;
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.moveTo(0, h);

      const segments = 8;
      const segW = (w + 200) / segments;
      for (let i = 0; i <= segments; i++) {
        const x = i * segW;
        const hillY = layer.baseY - layer.amplitude *
          (0.5 + 0.5 * Math.sin((x + px) * 0.003 + layer.rate * 10));
        if (i === 0) {
          ctx.lineTo(0, hillY);
        } else {
          const cpx = x - segW * 0.5;
          const prevHillY = layer.baseY - layer.amplitude *
            (0.5 + 0.5 * Math.sin(((i - 1) * segW + px) * 0.003 + layer.rate * 10));
          ctx.bezierCurveTo(cpx, prevHillY, cpx, hillY, x, hillY);
        }
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }

    // Tree silhouettes on nearest layer
    const treePx = -camX * 0.2;
    ctx.fillStyle = biome?.treeColor ?? 'rgba(20,40,25,0.3)';
    const treeSpacing = 120;
    const treeStart = Math.floor((-treePx) / treeSpacing) * treeSpacing;
    for (let tx = treeStart; tx < treeStart + w + treeSpacing; tx += treeSpacing) {
      const screenX = tx + treePx;
      if (screenX < -30 || screenX > w + 30) continue;
      const baseHillY = h * 0.42 - h * 0.10 *
        (0.5 + 0.5 * Math.sin((screenX - treePx + treePx) * 0.003 + 2));
      const treeH = 15 + (tx % 37) * 0.8;
      // Trunk
      ctx.fillRect(screenX - 2, baseHillY - treeH, 4, treeH);
      // Canopy
      ctx.beginPath();
      ctx.arc(screenX, baseHillY - treeH - 6, 10 + (tx % 19) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Fluffy clouds (5) ──
    const clouds = [
      { baseX: 0.1, y: 0.14, size: 1.0, speed: 0.15 },
      { baseX: 0.3, y: 0.10, size: 0.7, speed: 0.12 },
      { baseX: 0.55, y: 0.18, size: 1.2, speed: 0.18 },
      { baseX: 0.75, y: 0.08, size: 0.8, speed: 0.10 },
      { baseX: 0.92, y: 0.15, size: 0.9, speed: 0.14 },
    ];

    ctx.fillStyle = biome?.cloudColor ?? 'rgba(220,225,240,0.06)';
    for (const cloud of clouds) {
      const drift = (this.frameCount * cloud.speed) % (w + 300) - 150;
      const cloudX = drift - camX * 0.03;
      const cloudY = h * cloud.y;
      const s = cloud.size;
      // Overlapping arcs for fluffy shape
      ctx.beginPath();
      ctx.arc(cloudX, cloudY, 25 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cloudX - 20 * s, cloudY + 5 * s, 18 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cloudX + 22 * s, cloudY + 3 * s, 20 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cloudX + 8 * s, cloudY - 8 * s, 16 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Get world position from screen tap/click
   */
  screenToWorld(screenX: number, screenY: number): { worldX: number; worldY: number } {
    const world = this.camera.screenToWorld(screenX, screenY);
    return { worldX: world.x, worldY: world.y };
  }

  /**
   * Get tile coordinates from world position
   */
  worldToTile(worldX: number, worldY: number): { col: number; row: number } {
    return {
      col: Math.floor(worldX / (TILE_SIZE * SCALE)),
      row: Math.floor(worldY / (TILE_SIZE * SCALE)),
    };
  }

  /**
   * Get world position from tile coordinates
   */
  tileToWorld(col: number, row: number): { x: number; y: number } {
    return {
      x: col * TILE_SIZE * SCALE + (TILE_SIZE * SCALE) / 2,
      y: row * TILE_SIZE * SCALE + (TILE_SIZE * SCALE) / 2,
    };
  }

  getRemotePlayerAtScreen(
    screenX: number,
    screenY: number,
    remotePlayers: RemotePlayer[],
  ): RemotePlayer | null {
    return this.remotePlayerRenderer.getPlayerAtScreen(screenX, screenY, this.camera, remotePlayers);
  }

  detach(): void {
    this.canvas = null;
    this.ctx = null;
  }

  getScale(): number {
    return SCALE;
  }
}
