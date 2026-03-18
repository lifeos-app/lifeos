/**
 * Tile Renderer — The Realm
 *
 * Renders the tilemap for the current zone.
 * Only renders tiles visible in the camera viewport (culling).
 */

import { drawTile, TILE_SIZE, type TileType } from '../data/tiles';
import type { Camera } from './Camera';
import type { ZoneDef, BuildingPlacement, NPCAppearance } from '../data/zones';
import { drawCharacter } from './drawCharacter';
import { SKIN_TONES, HAIR_COLORS } from '../../rpg/data/sprites';
import type { BiomePalette } from '../data/biomes';

export class TileRenderer {
  private zone: ZoneDef | null = null;
  private scale = 3;
  private biome: BiomePalette | null = null;

  setBiome(biome: BiomePalette | null): void {
    this.biome = biome;
  }

  getBiome(): BiomePalette | null {
    return this.biome;
  }

  setZone(zone: ZoneDef): void {
    this.zone = zone;
  }

  setScale(s: number): void {
    this.scale = s;
  }

  /**
   * Render ground tiles (visible region only)
   */
  renderGround(ctx: CanvasRenderingContext2D, camera: Camera, frameCount: number): void {
    if (!this.zone) return;

    const tileScreenSize = TILE_SIZE * this.scale * camera.zoom;

    // Calculate visible tile range
    const startCol = Math.max(0, Math.floor(camera.x / (TILE_SIZE * this.scale)));
    const startRow = Math.max(0, Math.floor(camera.y / (TILE_SIZE * this.scale)));
    const endCol = Math.min(
      this.zone.width,
      Math.ceil((camera.x + camera.viewportWidth / camera.zoom) / (TILE_SIZE * this.scale)) + 1,
    );
    const endRow = Math.min(
      this.zone.height,
      Math.ceil((camera.y + camera.viewportHeight / camera.zoom) / (TILE_SIZE * this.scale)) + 1,
    );

    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const tile = this.zone.tiles[row]?.[col];
        if (!tile) continue;

        const worldX = col * TILE_SIZE * this.scale;
        const worldY = row * TILE_SIZE * this.scale;
        const screen = camera.worldToScreen(worldX, worldY);

        const override = this.biome?.tileOverrides[tile];
        drawTile(ctx, tile, screen.x, screen.y, this.scale * camera.zoom, frameCount, override);
      }
    }
  }

  /**
   * Render buildings
   */
  renderBuildings(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    buildings: BuildingPlacement[],
    frameCount: number,
    houseLevel: number,
  ): void {
    const ts = TILE_SIZE * this.scale;

    for (const b of buildings) {
      const worldX = b.tileX * ts;
      const worldY = b.tileY * ts;
      const w = b.widthTiles * ts;
      const h = b.heightTiles * ts;

      if (!camera.isVisible(worldX, worldY, w, h)) continue;

      const s = camera.worldToScreen(worldX, worldY);
      const sw = w * camera.zoom;
      const sh = h * camera.zoom;

      switch (b.type) {
        case 'house':
          this.drawHouse(ctx, s.x, s.y, sw, sh, houseLevel, frameCount);
          break;
        case 'town_hall':
          this.drawTownHall(ctx, s.x, s.y, sw, sh, frameCount);
          break;
        case 'bulletin_board':
          this.drawBulletinBoard(ctx, s.x, s.y, sw, sh);
          break;
        case 'well':
          this.drawWell(ctx, s.x, s.y, sw, sh, frameCount);
          break;
        case 'garden':
          this.drawGardenArea(ctx, s.x, s.y, sw, sh, frameCount);
          break;
        case 'forge':
          this.drawForge(ctx, s.x, s.y, sw, sh, frameCount);
          break;
        case 'library':
          this.drawLibrary(ctx, s.x, s.y, sw, sh, frameCount);
          break;
        case 'temple':
          this.drawTemple(ctx, s.x, s.y, sw, sh, frameCount);
          break;
        case 'bank':
          this.drawBank(ctx, s.x, s.y, sw, sh);
          break;
        case 'tavern':
          this.drawTavern(ctx, s.x, s.y, sw, sh, frameCount);
          break;
        default:
          // Generic building
          ctx.fillStyle = '#6B5B3F';
          ctx.fillRect(s.x, s.y, sw, sh);
          break;
      }
    }
  }

  // ── Building Renderers ─────────────────────────

  private drawHouse(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    level: number,
    frameCount: number,
  ): void {
    const u = w / 16; // unit size

    if (level <= 1) {
      // Hut — simple wooden structure
      ctx.fillStyle = '#6B5B3F';
      ctx.fillRect(x + u * 2, y + h * 0.4, w - u * 4, h * 0.6);
      // Roof
      ctx.fillStyle = '#8B4513';
      ctx.beginPath();
      ctx.moveTo(x + u, y + h * 0.4);
      ctx.lineTo(x + w / 2, y + u * 2);
      ctx.lineTo(x + w - u, y + h * 0.4);
      ctx.closePath();
      ctx.fill();
      // Door
      ctx.fillStyle = '#4A3520';
      ctx.fillRect(x + w / 2 - u * 1.5, y + h * 0.65, u * 3, h * 0.35);
    } else if (level <= 2) {
      // Cottage — stone walls, chimney
      ctx.fillStyle = '#8B8B7A';
      ctx.fillRect(x + u * 2, y + h * 0.35, w - u * 4, h * 0.65);
      // Roof
      ctx.fillStyle = '#A0522D';
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.35);
      ctx.lineTo(x + w / 2, y + u);
      ctx.lineTo(x + w, y + h * 0.35);
      ctx.closePath();
      ctx.fill();
      // Chimney
      ctx.fillStyle = '#696969';
      ctx.fillRect(x + w * 0.75, y, u * 3, h * 0.25);
      // Smoke
      ctx.fillStyle = 'rgba(200,200,200,0.4)';
      const smokeY = Math.sin(frameCount * 0.03) * u * 2;
      ctx.beginPath();
      ctx.arc(x + w * 0.78, y - u * 2 + smokeY, u * 2, 0, Math.PI * 2);
      ctx.fill();
      // Door
      ctx.fillStyle = '#4A3520';
      ctx.fillRect(x + w / 2 - u * 2, y + h * 0.6, u * 4, h * 0.4);
      // Windows
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(x + u * 4, y + h * 0.45, u * 3, u * 3);
      ctx.fillRect(x + w - u * 7, y + h * 0.45, u * 3, u * 3);
    } else {
      // House — two stories, grander
      ctx.fillStyle = '#A08B70';
      ctx.fillRect(x + u, y + h * 0.3, w - u * 2, h * 0.7);
      // Roof
      ctx.fillStyle = '#8B0000';
      ctx.beginPath();
      ctx.moveTo(x - u, y + h * 0.3);
      ctx.lineTo(x + w / 2, y);
      ctx.lineTo(x + w + u, y + h * 0.3);
      ctx.closePath();
      ctx.fill();
      // Door (grand)
      ctx.fillStyle = '#4A3520';
      ctx.fillRect(x + w / 2 - u * 2, y + h * 0.65, u * 4, h * 0.35);
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(x + w / 2 + u, y + h * 0.75, u, u); // doorknob
      // Windows (4)
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(x + u * 3, y + h * 0.4, u * 3, u * 3);
      ctx.fillRect(x + w - u * 6, y + h * 0.4, u * 3, u * 3);
      ctx.fillRect(x + u * 3, y + h * 0.6, u * 3, u * 3);
      ctx.fillRect(x + w - u * 6, y + h * 0.6, u * 3, u * 3);
    }

    // Label
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(9, u * 3)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('🏠', x + w / 2, y - u);
  }

  private drawTownHall(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    frameCount: number,
  ): void {
    const u = w / 20;

    // Main building
    ctx.fillStyle = '#8B8B7A';
    ctx.fillRect(x + u * 2, y + h * 0.35, w - u * 4, h * 0.65);

    // Columns
    ctx.fillStyle = '#BEBEBE';
    for (let i = 0; i < 4; i++) {
      const cx = x + u * 4 + i * (w - u * 8) / 3;
      ctx.fillRect(cx, y + h * 0.35, u * 1.5, h * 0.65);
    }

    // Roof (triangular pediment)
    ctx.fillStyle = '#696969';
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.35);
    ctx.lineTo(x + w / 2, y + u * 2);
    ctx.lineTo(x + w, y + h * 0.35);
    ctx.closePath();
    ctx.fill();

    // Flag
    ctx.fillStyle = '#FF4500';
    const flagWave = Math.sin(frameCount * 0.05) * u;
    ctx.fillRect(x + w / 2 - u, y, u, u * 4);
    ctx.fillRect(x + w / 2, y + u, u * 4 + flagWave, u * 2);

    // Door
    ctx.fillStyle = '#4A3520';
    ctx.fillRect(x + w / 2 - u * 2.5, y + h * 0.55, u * 5, h * 0.45);

    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(9, u * 2.5)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('🏛️ Town Hall', x + w / 2, y - u);
  }

  private drawBulletinBoard(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
  ): void {
    const ts = w; // It's 1 tile
    const u = ts / 16;

    // Posts
    ctx.fillStyle = '#6B5B3F';
    ctx.fillRect(x + u * 2, y + u * 4, u * 2, u * 12);
    ctx.fillRect(x + u * 12, y + u * 4, u * 2, u * 12);

    // Board
    ctx.fillStyle = '#A08B70';
    ctx.fillRect(x + u, y + u * 2, u * 14, u * 8);

    // Papers (quest indicators)
    ctx.fillStyle = '#FFF8DC';
    ctx.fillRect(x + u * 3, y + u * 3, u * 4, u * 3);
    ctx.fillRect(x + u * 8, y + u * 4, u * 4, u * 4);
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(x + u * 4, y + u * 7, u * 3, u * 2);
  }

  private drawWell(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    frameCount: number,
  ): void {
    const ts = w;
    const u = ts / 16;

    // Base circle (oval)
    ctx.fillStyle = '#696969';
    ctx.beginPath();
    ctx.ellipse(x + ts / 2, y + ts * 0.6, u * 6, u * 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner water
    ctx.fillStyle = '#2E7D8E';
    ctx.beginPath();
    ctx.ellipse(x + ts / 2, y + ts * 0.6, u * 4, u * 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Water shimmer
    const shimmer = Math.sin(frameCount * 0.04) * u;
    ctx.fillStyle = 'rgba(100,200,255,0.3)';
    ctx.fillRect(x + ts * 0.35, y + ts * 0.55 + shimmer, u * 4, u);

    // Roof posts
    ctx.fillStyle = '#6B5B3F';
    ctx.fillRect(x + u * 4, y + u * 2, u * 1.5, u * 8);
    ctx.fillRect(x + u * 10.5, y + u * 2, u * 1.5, u * 8);

    // Roof
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.moveTo(x + u * 2, y + u * 3);
    ctx.lineTo(x + ts / 2, y);
    ctx.lineTo(x + u * 14, y + u * 3);
    ctx.closePath();
    ctx.fill();
  }

  private drawGardenArea(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    frameCount: number,
  ): void {
    // Garden fence
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    ctx.setLineDash([]);

    // Plot circles (where plants will grow)
    const cols = 4;
    const rows = 2;
    const plotW = (w - 20) / cols;
    const plotH = (h - 20) / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = x + 10 + c * plotW + plotW / 2;
        const py = y + 10 + r * plotH + plotH / 2;
        const plotRadius = Math.min(plotW, plotH) / 3;

        // Soil circle
        ctx.fillStyle = '#5C4033';
        ctx.beginPath();
        ctx.arc(px, py, plotRadius, 0, Math.PI * 2);
        ctx.fill();

        // Tiny placeholder sprout
        const sway = Math.sin(frameCount * 0.03 + c * 2 + r) * 2;
        ctx.fillStyle = '#3D8B3D';
        ctx.fillRect(px - 1, py - plotRadius * 0.5 + sway, 2, plotRadius * 0.5);
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(px, py - plotRadius * 0.5 + sway, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Label
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🌱 Garden', x + w / 2, y - 4);
  }

  private drawForge(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    frameCount: number,
  ): void {
    const u = w / 16;

    // Stone walls
    ctx.fillStyle = '#555';
    ctx.fillRect(x + u * 2, y + h * 0.3, w - u * 4, h * 0.7);

    // Roof
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.3);
    ctx.lineTo(x + w / 2, y + u);
    ctx.lineTo(x + w, y + h * 0.3);
    ctx.closePath();
    ctx.fill();

    // Chimney with smoke
    ctx.fillStyle = '#333';
    ctx.fillRect(x + w * 0.7, y - u, u * 4, h * 0.25);
    ctx.fillStyle = 'rgba(180,180,180,0.3)';
    const smokeY = Math.sin(frameCount * 0.03) * u * 2;
    ctx.beginPath();
    ctx.arc(x + w * 0.73, y - u * 3 + smokeY, u * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Anvil
    ctx.fillStyle = '#333';
    ctx.fillRect(x + w * 0.35, y + h * 0.6, u * 5, u * 3);
    ctx.fillRect(x + w * 0.3, y + h * 0.55, u * 7, u * 2);

    // Forge glow (animated)
    const glowAlpha = 0.3 + Math.sin(frameCount * 0.05) * 0.15;
    ctx.fillStyle = `rgba(255,120,0,${glowAlpha})`;
    ctx.beginPath();
    ctx.arc(x + w * 0.5, y + h * 0.7, u * 4, 0, Math.PI * 2);
    ctx.fill();

    // Door
    ctx.fillStyle = '#3A2A1A';
    ctx.fillRect(x + w / 2 - u * 2, y + h * 0.6, u * 4, h * 0.4);

    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(9, u * 2.5)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('⚒️ Forge', x + w / 2, y - u);
  }

  private drawLibrary(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    frameCount: number,
  ): void {
    const u = w / 16;

    // Stone building
    ctx.fillStyle = '#6B5B8B';
    ctx.fillRect(x + u * 2, y + h * 0.3, w - u * 4, h * 0.7);

    // Flat roof with railing
    ctx.fillStyle = '#554570';
    ctx.fillRect(x, y + h * 0.25, w, u * 2);

    // Windows (bookshelf-filled)
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(x + u * 4, y + h * 0.4, u * 3, u * 4);
    ctx.fillRect(x + w - u * 7, y + h * 0.4, u * 3, u * 4);

    // Book spines in windows
    const colors = ['#C41E3A', '#2196F3', '#4CAF50', '#FF9800'];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(x + u * 4.2 + i * u, y + h * 0.42, u * 0.7, u * 3.5);
      ctx.fillRect(x + w - u * 6.8 + i * u, y + h * 0.42, u * 0.7, u * 3.5);
    }

    // Door
    ctx.fillStyle = '#4A3520';
    ctx.fillRect(x + w / 2 - u * 2, y + h * 0.6, u * 4, h * 0.4);

    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(9, u * 2.5)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('📚 Library', x + w / 2, y - u);
  }

  private drawTemple(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    frameCount: number,
  ): void {
    const u = w / 16;

    // White stone walls
    ctx.fillStyle = '#E8E0D8';
    ctx.fillRect(x + u * 2, y + h * 0.35, w - u * 4, h * 0.65);

    // Columns
    ctx.fillStyle = '#F0E8E0';
    ctx.fillRect(x + u * 3, y + h * 0.35, u * 1.5, h * 0.65);
    ctx.fillRect(x + w - u * 4.5, y + h * 0.35, u * 1.5, h * 0.65);

    // Triangular roof
    ctx.fillStyle = '#D4C8B8';
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.35);
    ctx.lineTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h * 0.35);
    ctx.closePath();
    ctx.fill();

    // Halo glow at top
    const haloAlpha = 0.3 + Math.sin(frameCount * 0.03) * 0.15;
    ctx.fillStyle = `rgba(200,180,255,${haloAlpha})`;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + u, u * 3, 0, Math.PI * 2);
    ctx.fill();

    // Door
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(x + w / 2 - u * 2, y + h * 0.6, u * 4, h * 0.4);

    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(9, u * 2.5)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('🕊️ Temple', x + w / 2, y - u);
  }

  private drawBank(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
  ): void {
    const u = w / 12;

    // Solid stone walls
    ctx.fillStyle = '#8B8B7A';
    ctx.fillRect(x + u, y + h * 0.3, w - u * 2, h * 0.7);

    // Flat roof
    ctx.fillStyle = '#696969';
    ctx.fillRect(x, y + h * 0.25, w, u * 2);

    // Vault door
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.65, u * 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.65, u * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Coin symbol
    ctx.fillStyle = '#8B6914';
    ctx.font = `bold ${Math.max(8, u * 2)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('$', x + w / 2, y + h * 0.69);

    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(9, u * 2.5)}px monospace`;
    ctx.fillText('💰 Bank', x + w / 2, y - u);
  }

  private drawTavern(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    frameCount: number,
  ): void {
    const u = w / 16;

    // Warm wooden walls
    ctx.fillStyle = '#7A5C3F';
    ctx.fillRect(x + u * 2, y + h * 0.35, w - u * 4, h * 0.65);

    // Sloped roof
    ctx.fillStyle = '#A0522D';
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.35);
    ctx.lineTo(x + w / 2, y + u * 2);
    ctx.lineTo(x + w, y + h * 0.35);
    ctx.closePath();
    ctx.fill();

    // Warm window light
    const flicker = 0.8 + Math.sin(frameCount * 0.06) * 0.15;
    ctx.fillStyle = `rgba(255,200,100,${flicker})`;
    ctx.fillRect(x + u * 4, y + h * 0.45, u * 3, u * 3);
    ctx.fillRect(x + w - u * 7, y + h * 0.45, u * 3, u * 3);

    // Door
    ctx.fillStyle = '#4A3520';
    ctx.fillRect(x + w / 2 - u * 2, y + h * 0.55, u * 4, h * 0.45);

    // Sign
    ctx.fillStyle = '#A08B70';
    ctx.fillRect(x + w * 0.7, y + h * 0.3, u * 5, u * 3);
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(7, u * 1.5)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('INN', x + w * 0.7 + u * 2.5, y + h * 0.35 + u * 1.5);

    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(9, u * 2.5)}px monospace`;
    ctx.fillText('🍺 Tavern', x + w / 2, y - u);
  }

  // ── Portal rendering ─────────────────────────

  renderPortals(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    portals: { tileX: number; tileY: number; label: string; icon: string; locked: boolean }[],
    frameCount: number,
  ): void {
    const ts = TILE_SIZE * this.scale;

    for (const p of portals) {
      const worldX = p.tileX * ts;
      const worldY = p.tileY * ts;
      const s = camera.worldToScreen(worldX, worldY);
      const sz = ts * camera.zoom;

      // Portal glow
      const pulse = Math.sin(frameCount * 0.04) * 0.2 + 0.6;
      ctx.globalAlpha = p.locked ? 0.3 : pulse;

      const grad = ctx.createRadialGradient(
        s.x + sz / 2, s.y + sz / 2, 0,
        s.x + sz / 2, s.y + sz / 2, sz,
      );

      if (p.locked) {
        grad.addColorStop(0, 'rgba(100,100,100,0.5)');
        grad.addColorStop(1, 'transparent');
      } else {
        grad.addColorStop(0, 'rgba(100,200,255,0.6)');
        grad.addColorStop(1, 'transparent');
      }

      ctx.fillStyle = grad;
      ctx.fillRect(s.x - sz / 2, s.y - sz / 2, sz * 2, sz * 2);
      ctx.globalAlpha = 1;

      // Icon
      ctx.font = `${Math.max(12, sz * 0.5)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(p.icon, s.x + sz / 2, s.y + sz / 2);

      // Label
      ctx.fillStyle = p.locked ? '#888' : '#fff';
      ctx.font = `${Math.max(8, sz * 0.22)}px monospace`;
      ctx.fillText(p.label, s.x + sz / 2, s.y + sz + Math.max(8, sz * 0.25));

      if (p.locked) {
        ctx.fillStyle = '#FF6B6B';
        ctx.font = `${Math.max(8, sz * 0.18)}px monospace`;
        ctx.fillText('🔒 Locked', s.x + sz / 2, s.y + sz + Math.max(16, sz * 0.45));
      }
    }
  }

  // ── NPC rendering ─────────────────────────────

  renderNPCs(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    npcs: { tileX: number; tileY: number; name: string; spriteType: string; appearance?: NPCAppearance }[],
    frameCount: number,
  ): void {
    const ts = TILE_SIZE * this.scale;

    for (const npc of npcs) {
      const worldX = npc.tileX * ts + ts / 2;
      const worldY = npc.tileY * ts;

      // BUG-087: Viewport culling — skip off-screen NPCs
      if (worldX < camera.x - ts || worldX > camera.x + camera.viewportWidth / camera.zoom + ts ||
          worldY < camera.y - ts || worldY > camera.y + camera.viewportHeight / camera.zoom + ts) {
        continue;
      }

      const s = camera.worldToScreen(worldX, worldY);
      const sz = ts * camera.zoom;
      const u = this.scale * camera.zoom * 0.7; // NPCs slightly smaller than player

      // Merge appearance over defaults
      const defaults = NPC_DEFAULTS[npc.spriteType] || NPC_DEFAULTS.guide;
      const a = { ...defaults, ...npc.appearance };

      // Idle bob
      const bob = Math.sin(frameCount * 0.03 + npc.tileX) * 2;

      drawCharacter({
        ctx,
        cx: s.x,
        cy: s.y + sz * 0.35 + bob,
        unit: u,
        skinTone: SKIN_TONES[a.skinTone] || SKIN_TONES[0],
        hairColor: HAIR_COLORS[a.hairColor] || HAIR_COLORS[0],
        bodyColor: a.bodyColor,
        classIcon: '',
        name: npc.name,
        level: 0,
        direction: 'down',
        isMoving: false,
        showName: true,
        showClassIcon: false,
        frameCount,
        hairStyleIdx: a.hairStyleIdx,
        faceTypeIdx: a.faceTypeIdx,
        topIdx: a.topIdx,
        hatIdx: a.hatIdx,
        capeIdx: a.capeIdx,
        weaponIdx: a.weaponIdx,
      });

      // Interaction hint below character
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `${Math.max(7, sz * 0.15)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('tap to talk', s.x, s.y + sz + sz * 0.1);
    }
  }
}

const NPC_DEFAULTS: Record<string, { skinTone: number; hairColor: number; bodyColor: string; hairStyleIdx: number; faceTypeIdx: number; topIdx: number; hatIdx: number; capeIdx: number; weaponIdx: number }> = {
  guide:      { skinTone: 3, hairColor: 2, bodyColor: '#4A90D9', hairStyleIdx: 5, faceTypeIdx: 0, topIdx: 2, hatIdx: -1, capeIdx: 0, weaponIdx: -1 },
  blacksmith: { skinTone: 4, hairColor: 0, bodyColor: '#8B4513', hairStyleIdx: 1, faceTypeIdx: 4, topIdx: 1, hatIdx: -1, capeIdx: -1, weaponIdx: -1 },
  librarian:  { skinTone: 2, hairColor: 3, bodyColor: '#6B5B8B', hairStyleIdx: 2, faceTypeIdx: 1, topIdx: 2, hatIdx: 1, capeIdx: -1, weaponIdx: 1 },
  healer:     { skinTone: 1, hairColor: 2, bodyColor: '#2ECC71', hairStyleIdx: 6, faceTypeIdx: 5, topIdx: 2, hatIdx: -1, capeIdx: 1, weaponIdx: -1 },
  merchant:   { skinTone: 5, hairColor: 3, bodyColor: '#F39C12', hairStyleIdx: 3, faceTypeIdx: 3, topIdx: 0, hatIdx: 0, capeIdx: -1, weaponIdx: -1 },
  sage:       { skinTone: 0, hairColor: 4, bodyColor: '#9B59B6', hairStyleIdx: 7, faceTypeIdx: 1, topIdx: 2, hatIdx: 1, capeIdx: 1, weaponIdx: 1 },
};
