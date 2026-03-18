/**
 * StageCanvas — Unified stage component with particles, characters, and speech bubbles.
 *
 * Renders NPC and player characters as pixel-art sprites using drawCharacter(),
 * ambient particles via ParticleEngine, and speech bubbles via drawChatBubble().
 *
 * Used by both OnboardingQuest (System A) and SetupDialogue (System B).
 */

import { useRef, useEffect } from 'react';
import { ParticleEngine } from '../../realm/renderer/ParticleEngine';
import { drawCharacter } from '../../realm/renderer/drawCharacter';
import { drawChatBubble } from '../../realm/ui/ChatBubble';
import { NPC_BUBBLE_COLORS } from './npc-appearances';
import type { StageCharacter } from './types';

export interface ParticleThemeConfig {
  colors: string[];
  speed: number;
  life: number;
  size: number;
  type: 'dot' | 'glow';
  gravity: number;
  rate: number;
  emitFromBottom?: boolean; // e.g. first_seed: grow up from bottom
}

interface StageCanvasProps {
  theme: ParticleThemeConfig;
  characters: StageCharacter[];
  intensity?: number;
  className?: string;
  /** One-time burst (e.g. reveal scene) */
  burst?: { x: number; y: number; count: number; config: Omit<ParticleThemeConfig, 'rate' | 'emitFromBottom'> } | null;
}

export function StageCanvas({ theme, characters, intensity = 1, className, burst }: StageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<ParticleEngine>(new ParticleEngine());
  const rafRef = useRef(0);
  const frameRef = useRef(0);
  const burstFiredRef = useRef(false);

  // Reset burst flag when burst prop changes
  useEffect(() => {
    burstFiredRef.current = false;
  }, [burst]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const particles = particlesRef.current;
    particles.clear();
    frameRef.current = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    let running = true;

    const handleVisibility = () => {
      running = !document.hidden;
      if (running) tick();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const tick = () => {
      if (!running) return;

      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      frameRef.current++;

      // ── Emit ambient particles ──
      if (Math.random() < theme.rate * intensity) {
        const x = Math.random() * rect.width;
        const y = theme.emitFromBottom ? rect.height : Math.random() * rect.height;

        particles.emit(x, y, 1, {
          colors: theme.colors,
          speed: theme.speed,
          life: theme.life,
          size: theme.size,
          type: theme.type,
          gravity: theme.gravity,
        });
      }

      // ── One-time burst ──
      if (burst && !burstFiredRef.current) {
        burstFiredRef.current = true;
        particles.emit(
          burst.x * rect.width,
          burst.y * rect.height,
          burst.count,
          {
            colors: burst.config.colors,
            speed: burst.config.speed,
            life: burst.config.life,
            size: burst.config.size,
            type: burst.config.type,
            gravity: burst.config.gravity,
          },
        );
      }

      particles.update();
      particles.render(ctx, 0, 0, 1);

      // ── Render stage characters ──
      for (const char of characters) {
        if (!char.visible || char.alpha <= 0) continue;

        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha = char.alpha;

        const charCx = char.cx * rect.width;
        const charCy = char.cy * rect.height;
        // Scale characters for mobile — keep them small enough to see bubbles above
        const minDim = Math.min(rect.width, rect.height);
        const unit = minDim < 500 ? minDim * 0.0115 : minDim * 0.021;

        drawCharacter({
          ctx,
          cx: charCx,
          cy: charCy,
          unit,
          skinTone: char.appearance.skinTone,
          hairColor: char.appearance.hairColor,
          bodyColor: char.appearance.bodyColor,
          classIcon: char.appearance.classIcon,
          name: char.appearance.name,
          level: char.appearance.level,
          direction: char.direction,
          isMoving: char.isMoving,
          walkFrame: char.walkFrame,
          mood: char.mood,
          frameCount: frameRef.current,
          showName: true,
          showClassIcon: true,
        });

        // ── Speech bubble ──
        if (char.bubble && char.bubble.text) {
          const age = performance.now() - char.bubble.startTime;
          const isPersistent = char.bubble.duration === Infinity;

          if (isPersistent || age < char.bubble.duration) {
            const bubbleColors = NPC_BUBBLE_COLORS[char.id] || NPC_BUBBLE_COLORS.player;
            drawChatBubble(ctx, char.bubble.text, charCx, charCy, unit, isPersistent ? 0 : age, {
              persistent: isPersistent,
              bgColor: bubbleColors.bg,
              borderColor: bubbleColors.border,
            });
          }
        }

        ctx.globalAlpha = prevAlpha;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [theme, characters, intensity, burst]);

  return (
    <canvas
      ref={canvasRef}
      className={className || 'stage-canvas'}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}
