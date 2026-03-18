/**
 * PlayerProfileCard — Remote player profile popup
 *
 * Shows character preview, name, level, class, and action buttons.
 */

import { useRef, useEffect, useCallback } from 'react';
import type { RemotePlayer } from '../multiplayer/types';
import { drawCharacter } from '../renderer/drawCharacter';

interface PlayerProfileCardProps {
  player: RemotePlayer;
  onClose: () => void;
  onWhisper?: (userId: string, name: string) => void;
  onAddFriend?: (userId: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  active: '\u{1F7E2} Online',
  idle: '\u{1F7E1} Idle',
  afk: '\u{26AA} AFK',
};

export function PlayerProfileCard({
  player,
  onClose,
  onWhisper,
  onAddFriend,
}: PlayerProfileCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = 80 * dpr;
    canvas.height = 100 * dpr;
    canvas.style.width = '80px';
    canvas.style.height = '100px';
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    ctx.clearRect(0, 0, 80, 100);
    drawCharacter({
      ctx,
      cx: 40,
      cy: 60,
      unit: 2,
      skinTone: player.skinTone,
      hairColor: player.hairColor,
      bodyColor: player.bodyColor,
      classIcon: player.classIcon,
      name: '',
      level: player.level,
      direction: 'down',
      isMoving: false,
      mood: 3,
      bestStreak: 0,
      showName: false,
      showClassIcon: false,
    });
  }, [player]);

  const handleBackdrop = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleAddFriend = useCallback(() => {
    onAddFriend?.(player.userId);
  }, [onAddFriend, player.userId]);

  const handleWhisper = useCallback(() => {
    onWhisper?.(player.userId, player.name);
  }, [onWhisper, player.userId, player.name]);

  return (
    <div className="realm-profile-backdrop" onClick={handleBackdrop}>
      <div className="realm-profile-card">
        <button className="realm-profile-close" onClick={onClose}>&times;</button>

        <canvas ref={canvasRef} className="realm-profile-canvas" />

        <div className="realm-profile-info">
          <div className="realm-profile-name">
            {player.classIcon} {player.name}
          </div>
          <div className="realm-profile-level">Level {player.level}</div>
          <div className="realm-profile-status">
            {STATUS_LABELS[player.status] || player.status}
          </div>
        </div>

        <div className="realm-profile-actions">
          <button className="realm-profile-btn" onClick={handleWhisper}>
            Whisper
          </button>
          <button className="realm-profile-btn" onClick={handleAddFriend}>
            Add Friend
          </button>
        </div>
      </div>
    </div>
  );
}
