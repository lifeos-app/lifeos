/**
 * MiniCharacter — Reusable canvas-based character component
 *
 * Renders the pixel-art RPG character at any size, with optional
 * idle breathing animation. Used in header, equipment tab, level-up modal, etc.
 */

import { useRef, useEffect, useCallback } from 'react';
import { drawCharacter } from '../renderer/drawCharacter';
import { useCharacterAppearanceStore } from '../../stores/useCharacterAppearanceStore';
import { useInventoryStore } from '../../stores/useInventoryStore';
import { useHealthStore } from '../../stores/useHealthStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useUserStore } from '../../stores/useUserStore';
import type { EquippedVisuals } from '../bridge/DataBridge';

interface MiniCharacterProps {
  size?: number;        // default 64
  animate?: boolean;    // default true (idle breathing bob)
  showLevel?: boolean;
  showName?: boolean;
  onClick?: () => void;
  className?: string;
  fps?: number;         // default 15
}

function deriveEquippedVisuals(): EquippedVisuals {
  const equipped = useInventoryStore.getState().getEquipped();
  const headItem = equipped.find(i => i.slot === 'head');
  const torsoItem = equipped.find(i => i.slot === 'torso');
  const handsItem = equipped.find(i => i.slot === 'hands');
  return {
    hasHead: !!headItem,
    headColor: headItem?.color || '#888',
    bodyColor: torsoItem?.color || undefined,
    hasWeapon: equipped.some(i => i.slot === 'accessories' && i.category === 'equipment'),
    weaponColor: '#C0C0C0',
    hasShield: !!handsItem,
    shieldColor: handsItem?.color || '#8B4513',
  };
}

export function MiniCharacter({
  size = 64,
  animate = true,
  showLevel = false,
  showName = false,
  onClick,
  className,
  fps = 15,
}: MiniCharacterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const frameRef = useRef(0);
  const lastDrawRef = useRef(0);

  const loaded = useCharacterAppearanceStore(s => s.loaded);
  const userId = useUserStore(s => s.session?.user?.id);

  // Load appearance if not loaded
  useEffect(() => {
    if (!loaded && userId) {
      useCharacterAppearanceStore.getState().loadFromSupabase(userId);
    }
  }, [loaded, userId]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const now = performance.now();
    const interval = 1000 / fps;
    if (now - lastDrawRef.current < interval) return;
    lastDrawRef.current = now;

    const dpr = window.devicePixelRatio || 1;
    const w = size * dpr;
    const h = size * dpr;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    const {
      skinTone, hairColor, bodyColor, classIcon, name, level, loaded,
      hairStyleIdx, faceTypeIdx, eyeColor, topIdx, bottomIdx, shoesIdx,
      capeIdx, hatIdx, weaponIdx, topColor, bottomColor, shoesColor,
    } = useCharacterAppearanceStore.getState();

    if (!loaded) {
      // Gray silhouette placeholder
      ctx.fillStyle = 'rgba(100,100,100,0.3)';
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.35, w * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(w * 0.35, h * 0.45, w * 0.3, h * 0.35);
      return;
    }

    frameRef.current++;
    const fc = frameRef.current;

    // Unit is proportional to canvas size; character occupies ~60% height
    const unit = (h * 0.03);
    const cx = w / 2;
    // Center vertically but shift down to leave room for icon/name above
    const autoShowName = showName && size >= 48;
    const autoShowIcon = size >= 48;
    const cy = autoShowName || autoShowIcon ? h * 0.55 : h * 0.45;

    // Idle breathing bob
    const idleBob = animate ? Math.sin(fc * 0.08) * unit * 0.5 : 0;

    const health = useHealthStore.getState().todayMetrics;
    const mood = health?.mood_score ?? 3;
    const energy = health?.energy_level ?? 3;
    const habits = useHabitsStore.getState().habits;
    const bestStreak = habits.reduce((max, h) => Math.max(max, h.streak_current || 0), 0);
    const equippedVisuals = deriveEquippedVisuals();

    drawCharacter({
      ctx,
      cx,
      cy: cy + idleBob,
      unit,
      skinTone,
      hairColor,
      bodyColor,
      classIcon,
      name,
      level,
      direction: 'down',
      isMoving: false,
      mood,
      bestStreak,
      energy,
      equipped: equippedVisuals,
      walkFrame: 0,
      frameCount: fc,
      showName: autoShowName && (showLevel || showName),
      showClassIcon: autoShowIcon,
      hairStyleIdx,
      faceTypeIdx,
      eyeColor,
      topIdx,
      bottomIdx,
      shoesIdx,
      capeIdx,
      hatIdx,
      weaponIdx,
      topColor,
      bottomColor,
      shoesColor,
    });
  }, [size, animate, showLevel, showName, fps]);

  useEffect(() => {
    let running = true;

    const loop = () => {
      if (!running) return;
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
      } else {
        running = true;
        loop();
      }
    };

    loop();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      onClick={onClick}
      className={className}
      style={{
        width: size,
        height: size,
        cursor: onClick ? 'pointer' : undefined,
        imageRendering: 'pixelated',
      }}
    />
  );
}
