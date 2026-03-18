/**
 * Minimap — The Realm
 *
 * Small canvas overlay showing zone layout with player/NPC/portal dots.
 */

import { useRef, useEffect } from 'react';
import type { ZoneDef } from '../data/zones';

const MAP_W = 120;
const MAP_H = 100;
const TILE_PX = 4;

const TILE_COLORS: Record<string, string> = {
  grass: '#2D5A1E',
  grass_dark: '#1A3A10',
  grass_flowers: '#3D6A2E',
  path_stone: '#888',
  path_dirt: '#7A6540',
  water: '#2E6090',
  bridge: '#8B7355',
  wall_stone: '#666',
  fence: '#6B5B3F',
  void: '#111',
};

interface MinimapProps {
  zone: ZoneDef;
  playerX: number;
  playerY: number;
  npcs: { tileX: number; tileY: number }[];
  portals: { tileX: number; tileY: number; locked: boolean }[];
  visible: boolean;
  onToggle: () => void;
}

export function Minimap({ zone, playerX, playerY, npcs, portals, visible, onToggle }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!visible || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale to fit
    const scaleX = MAP_W / zone.width;
    const scaleY = MAP_H / zone.height;
    const s = Math.min(scaleX, scaleY, TILE_PX);

    ctx.clearRect(0, 0, MAP_W, MAP_H);

    // Background
    ctx.fillStyle = 'rgba(13,13,43,0.8)';
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // Tiles
    for (let row = 0; row < zone.height; row++) {
      for (let col = 0; col < zone.width; col++) {
        const tile = zone.tiles[row]?.[col];
        if (!tile) continue;
        ctx.fillStyle = TILE_COLORS[tile] || '#2D5A1E';
        ctx.fillRect(col * s, row * s, s, s);
      }
    }

    // Buildings (brown)
    for (const b of zone.buildings) {
      ctx.fillStyle = '#6B4226';
      ctx.fillRect(b.tileX * s, b.tileY * s, b.widthTiles * s, b.heightTiles * s);
    }

    // Portals (blue/grey dots)
    for (const p of portals) {
      ctx.fillStyle = p.locked ? '#666' : '#4ECDC4';
      ctx.beginPath();
      ctx.arc(p.tileX * s + s / 2, p.tileY * s + s / 2, s * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // NPCs (yellow dots)
    for (const n of npcs) {
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(n.tileX * s + s / 2, n.tileY * s + s / 2, s * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player (white blinking dot)
    const tileScale = 48; // TILE_SIZE * SCALE
    const px = (playerX / tileScale) * s;
    const py = (playerY / tileScale) * s;
    const blink = Math.sin(Date.now() * 0.005) > 0;
    ctx.fillStyle = blink ? '#fff' : '#ddd';
    ctx.beginPath();
    ctx.arc(px, py, s * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255,215,0,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, MAP_W, MAP_H);
  }, [visible, zone, playerX, playerY, npcs, portals]);

  if (!visible) return null;

  return (
    <div className="realm-minimap">
      <canvas
        ref={canvasRef}
        width={MAP_W}
        height={MAP_H}
        style={{ display: 'block', borderRadius: 4 }}
      />
    </div>
  );
}
