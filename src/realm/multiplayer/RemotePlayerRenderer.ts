/**
 * RemotePlayerRenderer — Renders other players in the zone
 *
 * Uses LOD (level of detail) based on distance from local player.
 * Handles walk animation, AFK visuals, chat bubbles, and emotes.
 */

import type { Camera } from '../renderer/Camera';
import type { RemotePlayer } from './types';
import { drawCharacter } from '../renderer/drawCharacter';
import { drawChatBubble } from '../ui/ChatBubble';
import { drawEmoteEffect } from '../renderer/EmoteRenderer';

const MAX_VISIBLE_PLAYERS = 20;
const LOD_HIGH_DIST = 400;
const LOD_MEDIUM_DIST = 800;
const SCALE = 3;

export class RemotePlayerRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    localX: number,
    localY: number,
    remotePlayers: RemotePlayer[],
    frameCount: number,
  ): void {
    if (remotePlayers.length === 0) return;

    // Calculate distances and sort by Y for depth
    const withDist = remotePlayers.map(p => ({
      player: p,
      dist: Math.sqrt((p.renderX - localX) ** 2 + (p.renderY - localY) ** 2),
    }));

    // Cap to nearest players
    withDist.sort((a, b) => a.dist - b.dist);
    const visible = withDist.slice(0, MAX_VISIBLE_PLAYERS);

    // Sort by Y for depth ordering
    visible.sort((a, b) => a.player.renderY - b.player.renderY);

    const unit = SCALE * camera.zoom;

    for (const { player, dist } of visible) {
      // Visibility cull
      const charWidth = unit * 12;
      const charHeight = unit * 24;
      if (!camera.isVisible(
        player.renderX - charWidth / 2,
        player.renderY - charHeight / 2,
        charWidth,
        charHeight,
      )) {
        continue;
      }

      const screen = camera.worldToScreen(player.renderX, player.renderY);

      ctx.save();

      // AFK visuals
      if (player.status === 'afk') {
        ctx.globalAlpha = 0.4;
        ctx.filter = 'grayscale(100%)';
      } else if (player.status === 'idle') {
        ctx.globalAlpha = 0.7;
      }

      if (dist < LOD_HIGH_DIST) {
        // HIGH LOD: full character with name + icon
        drawCharacter({
          ctx,
          cx: screen.x,
          cy: screen.y,
          unit,
          skinTone: player.skinTone,
          hairColor: player.hairColor,
          bodyColor: player.bodyColor,
          classIcon: player.classIcon,
          name: player.name,
          level: player.level,
          direction: player.direction,
          isMoving: player.isMoving,
          mood: 3,
          bestStreak: 0,
          walkFrame: player.walkFrame,
          frameCount,
          showName: true,
          showClassIcon: true,
        });
      } else if (dist < LOD_MEDIUM_DIST) {
        // MEDIUM LOD: character with name, no icon
        drawCharacter({
          ctx,
          cx: screen.x,
          cy: screen.y,
          unit,
          skinTone: player.skinTone,
          hairColor: player.hairColor,
          bodyColor: player.bodyColor,
          classIcon: player.classIcon,
          name: player.name,
          level: player.level,
          direction: player.direction,
          isMoving: player.isMoving,
          mood: 3,
          bestStreak: 0,
          walkFrame: player.walkFrame,
          frameCount,
          showName: true,
          showClassIcon: false,
        });
      } else {
        // LOW LOD: colored dot + name label
        ctx.fillStyle = player.bodyColor;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 3 * camera.zoom, 0, Math.PI * 2);
        ctx.fill();

        // Name label
        const fontSize = Math.max(8, Math.round(unit * 3));
        ctx.font = `${fontSize}px monospace`;
        ctx.fillStyle = '#C8D6E5';
        ctx.textAlign = 'center';
        ctx.fillText(player.name, screen.x, screen.y - 8 * camera.zoom);
      }

      ctx.restore();

      // AFK indicator — canvas-drawn "Zzz" text (no emoji)
      if (player.status === 'afk' && Math.floor(frameCount / 60) % 2 === 0) {
        ctx.save();
        const fontSize = Math.max(10, Math.round(unit * 4));
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#C8D6E5';
        ctx.fillText('Zzz', screen.x + unit * 4, screen.y - unit * 14);
        ctx.restore();
      }

      // Emote effect
      if (player.emote && player.emoteStartTime) {
        const elapsed = Date.now() - player.emoteStartTime;
        if (elapsed < 3000) {
          drawEmoteEffect(ctx, player.emote, screen.x, screen.y - unit * 12, unit, elapsed, frameCount);
        }
      }

      // Chat bubble
      if (player.chatBubble) {
        const age = Date.now() - player.chatBubbleTime;
        if (age < 5000) {
          drawChatBubble(ctx, player.chatBubble, screen.x, screen.y, unit, age);
        }
      }
    }
  }

  getPlayerAtScreen(
    screenX: number,
    screenY: number,
    camera: Camera,
    remotePlayers: RemotePlayer[],
  ): RemotePlayer | null {
    const unit = SCALE * camera.zoom;
    const hitW = unit * 10;
    const hitH = unit * 20;

    // Check in reverse render order (top-most = highest Y first)
    const sorted = [...remotePlayers].sort((a, b) => b.renderY - a.renderY);

    for (const player of sorted) {
      const screen = camera.worldToScreen(player.renderX, player.renderY);
      const left = screen.x - hitW / 2;
      const top = screen.y - hitH / 2;

      if (
        screenX >= left &&
        screenX <= left + hitW &&
        screenY >= top &&
        screenY <= top + hitH
      ) {
        return player;
      }
    }

    return null;
  }
}
