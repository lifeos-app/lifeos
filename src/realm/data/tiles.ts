/**
 * Tile System — The Realm
 *
 * 16×16px base tiles rendered at scale. Each tile has:
 * - A type (determines appearance)
 * - Walkability flag
 * - Optional decoration layer
 */

export type TileType =
  | 'grass' | 'grass_dark' | 'grass_flowers'
  | 'path_stone' | 'path_dirt'
  | 'water' | 'water_edge_n' | 'water_edge_s' | 'water_edge_e' | 'water_edge_w'
  | 'bridge'
  | 'wall_stone' | 'fence'
  | 'void';

export interface TileDef {
  type: TileType;
  walkable: boolean;
  /** Base colors (drawn procedurally) */
  colors: string[];
  /** If true, tile has a subtle animation (water shimmer, flower sway) */
  animated?: boolean;
  /** Z-offset for parallax layering (0 = ground, 1 = raised) */
  zLayer?: number;
}

export const TILE_DEFS: Record<TileType, TileDef> = {
  grass:         { type: 'grass',         walkable: true,  colors: ['#4A7C59', '#5A9C69', '#3D6B4A'] },
  grass_dark:    { type: 'grass_dark',    walkable: true,  colors: ['#3D6B4A', '#4A7C59', '#2E5A3B'] },
  grass_flowers: { type: 'grass_flowers', walkable: true,  colors: ['#4A7C59', '#FF69B4', '#FFD700'], animated: true },
  path_stone:    { type: 'path_stone',    walkable: true,  colors: ['#8B8B7A', '#9B9B8A', '#7B7B6A'] },
  path_dirt:     { type: 'path_dirt',     walkable: true,  colors: ['#8B7355', '#9B836C', '#7B633F'] },
  water:         { type: 'water',         walkable: false, colors: ['#2E7D8E', '#3A9BAA', '#1E6D7E'], animated: true },
  water_edge_n:  { type: 'water_edge_n',  walkable: false, colors: ['#3A9BAA', '#4A7C59'] },
  water_edge_s:  { type: 'water_edge_s',  walkable: false, colors: ['#3A9BAA', '#4A7C59'] },
  water_edge_e:  { type: 'water_edge_e',  walkable: false, colors: ['#3A9BAA', '#4A7C59'] },
  water_edge_w:  { type: 'water_edge_w',  walkable: false, colors: ['#3A9BAA', '#4A7C59'] },
  bridge:        { type: 'bridge',        walkable: true,  colors: ['#8B6B3F', '#A0896C', '#6B5B3F'] },
  wall_stone:    { type: 'wall_stone',    walkable: false, colors: ['#6B6B6B', '#7B7B7B', '#5B5B5B'], zLayer: 1 },
  fence:         { type: 'fence',         walkable: false, colors: ['#8B7355', '#6B5B3F'] },
  void:          { type: 'void',          walkable: false, colors: ['#1B2838'] },
};

/** Tile size in world pixels */
export const TILE_SIZE = 16;

/** Render scale (16px tile → 48px on screen at 3x) */
export const RENDER_SCALE = 3;

/** Rendered tile size in screen pixels */
export const RENDERED_TILE = TILE_SIZE * RENDER_SCALE;

/**
 * Draw a single tile procedurally on canvas
 */
export function drawTile(
  ctx: CanvasRenderingContext2D,
  type: TileType,
  screenX: number,
  screenY: number,
  scale: number,
  frameCount: number,
  colorOverride?: string[],
): void {
  const def = TILE_DEFS[type];
  if (!def) return;

  const s = TILE_SIZE * scale;
  const [c1, c2, c3] = colorOverride ?? def.colors;

  switch (type) {
    case 'grass':
    case 'grass_dark': {
      ctx.fillStyle = c1;
      ctx.fillRect(screenX, screenY, s, s);
      // Grass texture dots
      ctx.fillStyle = c2;
      for (let i = 0; i < 4; i++) {
        const dx = ((i * 7 + screenX) % s);
        const dy = ((i * 11 + screenY) % s);
        ctx.fillRect(screenX + dx % s, screenY + dy % s, scale, scale * 2);
      }
      break;
    }
    case 'grass_flowers': {
      ctx.fillStyle = c1;
      ctx.fillRect(screenX, screenY, s, s);
      // Flowers
      const flowerOffset = def.animated ? Math.sin(frameCount * 0.03 + screenX * 0.1) * scale : 0;
      ctx.fillStyle = c2;
      ctx.fillRect(screenX + 3 * scale, screenY + 4 * scale + flowerOffset, scale * 2, scale * 2);
      ctx.fillStyle = c3;
      ctx.fillRect(screenX + 10 * scale, screenY + 8 * scale - flowerOffset, scale * 2, scale * 2);
      break;
    }
    case 'path_stone': {
      ctx.fillStyle = c1;
      ctx.fillRect(screenX, screenY, s, s);
      // Stone pattern
      ctx.fillStyle = c2;
      ctx.fillRect(screenX + 2 * scale, screenY + 2 * scale, 5 * scale, 5 * scale);
      ctx.fillRect(screenX + 9 * scale, screenY + 8 * scale, 5 * scale, 6 * scale);
      ctx.fillStyle = c3;
      ctx.fillRect(screenX + 8 * scale, screenY + 1 * scale, 6 * scale, 5 * scale);
      ctx.fillRect(screenX + 1 * scale, screenY + 9 * scale, 6 * scale, 5 * scale);
      break;
    }
    case 'path_dirt': {
      ctx.fillStyle = c1;
      ctx.fillRect(screenX, screenY, s, s);
      ctx.fillStyle = c2;
      ctx.fillRect(screenX + 4 * scale, screenY + 3 * scale, 2 * scale, scale);
      ctx.fillRect(screenX + 10 * scale, screenY + 11 * scale, 3 * scale, scale);
      break;
    }
    case 'water': {
      const shimmer = def.animated ? Math.sin(frameCount * 0.04 + screenX * 0.05) * 15 : 0;
      const r = parseInt(c1.slice(1, 3), 16) + shimmer;
      const g = parseInt(c1.slice(3, 5), 16) + shimmer;
      const b = parseInt(c1.slice(5, 7), 16);
      ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, r))},${Math.max(0, Math.min(255, g))},${Math.max(0, Math.min(255, b))})`;
      ctx.fillRect(screenX, screenY, s, s);
      // Wave lines
      ctx.fillStyle = c2;
      const waveY = Math.sin(frameCount * 0.05 + screenX * 0.1) * scale;
      ctx.fillRect(screenX + 2 * scale, screenY + 6 * scale + waveY, 4 * scale, scale);
      ctx.fillRect(screenX + 9 * scale, screenY + 10 * scale - waveY, 5 * scale, scale);
      break;
    }
    case 'bridge': {
      ctx.fillStyle = c1;
      ctx.fillRect(screenX, screenY, s, s);
      // Planks
      ctx.fillStyle = c2;
      ctx.fillRect(screenX, screenY + 2 * scale, s, scale);
      ctx.fillRect(screenX, screenY + 7 * scale, s, scale);
      ctx.fillRect(screenX, screenY + 12 * scale, s, scale);
      // Rails
      ctx.fillStyle = c3;
      ctx.fillRect(screenX, screenY, scale, s);
      ctx.fillRect(screenX + s - scale, screenY, scale, s);
      break;
    }
    case 'wall_stone': {
      ctx.fillStyle = c1;
      ctx.fillRect(screenX, screenY, s, s);
      ctx.fillStyle = c2;
      ctx.fillRect(screenX + 1 * scale, screenY + 1 * scale, 6 * scale, 6 * scale);
      ctx.fillRect(screenX + 9 * scale, screenY + 9 * scale, 6 * scale, 6 * scale);
      ctx.strokeStyle = c3;
      ctx.lineWidth = scale;
      ctx.strokeRect(screenX, screenY, s, s);
      break;
    }
    case 'fence': {
      // Transparent base — fence sits on grass
      ctx.fillStyle = c1;
      // Vertical posts
      ctx.fillRect(screenX + 2 * scale, screenY, scale * 2, s);
      ctx.fillRect(screenX + 12 * scale, screenY, scale * 2, s);
      // Horizontal rail
      ctx.fillStyle = c2;
      ctx.fillRect(screenX, screenY + 4 * scale, s, scale * 2);
      ctx.fillRect(screenX, screenY + 10 * scale, s, scale * 2);
      break;
    }
    default: {
      ctx.fillStyle = c1;
      ctx.fillRect(screenX, screenY, s, s);
    }
  }
}
