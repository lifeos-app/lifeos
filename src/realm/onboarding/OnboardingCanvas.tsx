/**
 * OnboardingCanvas — Lightweight visual scene renderer
 *
 * Renders scene-specific particles on a transparent canvas overlay.
 * Uses a standalone ParticleEngine instance (not tied to RealmEngine).
 * When showCharacter is true, renders the character preview using drawCharacter().
 */

import { useRef, useEffect } from 'react';
import { ParticleEngine } from '../renderer/ParticleEngine';
import { drawCharacter } from '../renderer/drawCharacter';
import type { OnboardingScene } from './OnboardingLLM';

interface CharacterPreview {
  skinTone: string;
  hairColor: string;
  bodyColor: string;
  classIcon: string;
  name: string;
  level: number;
}

interface OnboardingCanvasProps {
  scene: OnboardingScene;
  characterPreview?: CharacterPreview;
  showCharacter: boolean;
  characterClass?: string;
}

// Class-based identity colors
const CLASS_PARTICLE_COLORS: Record<string, string[]> = {
  warrior: ['#e74c3c', '#ff6b6b', '#ff9999'],
  mage: ['#3498db', '#74b9ff', '#a29bfe'],
  ranger: ['#2ecc71', '#55efc4', '#00b894'],
  healer: ['#f1c40f', '#ffeaa7', '#fdcb6e'],
  engineer: ['#e67e22', '#fab1a0', '#ff7675'],
};

// Scene particle configurations
const SCENE_PARTICLES: Record<string, {
  colors: string[];
  speed: number;
  life: number;
  size: number;
  type: 'dot' | 'glow';
  gravity: number;
  rate: number; // particles per frame
}> = {
  awakening: { colors: ['#444', '#666', '#888'], speed: 0.3, life: 180, size: 2, type: 'dot', gravity: -0.005, rate: 0.2 },
  path_selection: { colors: ['#FFD700', '#fff', '#FFC107'], speed: 0.3, life: 150, size: 2, type: 'glow', gravity: 0, rate: 0.2 },
  identity: { colors: ['#FFD700', '#FFC107', '#FFB300'], speed: 0.3, life: 200, size: 2, type: 'glow', gravity: 0, rate: 0.2 },
  first_seed: { colors: ['#27ae60', '#2ecc71', '#82e0aa'], speed: 0.6, life: 100, size: 2, type: 'dot', gravity: -0.015, rate: 0.4 },
  the_dream: { colors: ['#e74c3c', '#f39c12', '#FFD700'], speed: 1.5, life: 50, size: 2, type: 'glow', gravity: -0.04, rate: 0.5 },
  first_words: { colors: ['#6c5ce7', '#a29bfe', '#4B0082'], speed: 0.3, life: 180, size: 2, type: 'glow', gravity: 0, rate: 0.2 },
  reveal: { colors: ['#FFD700', '#FFC107', '#fff'], speed: 2, life: 80, size: 3, type: 'glow', gravity: -0.01, rate: 2 },
};

export function OnboardingCanvas({ scene, characterPreview, showCharacter, characterClass }: OnboardingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<ParticleEngine>(new ParticleEngine());
  const rafRef = useRef(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const particles = particlesRef.current;
    particles.clear();

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

      // Emit scene particles (identity uses class-specific colors)
      const baseConfig = SCENE_PARTICLES[scene];
      const config = (scene === 'identity' && characterClass && CLASS_PARTICLE_COLORS[characterClass])
        ? { ...baseConfig, colors: CLASS_PARTICLE_COLORS[characterClass] }
        : baseConfig;
      if (config) {
        frameRef.current++;
        const emitCount = Math.random() < config.rate ? 1 : 0;
        if (emitCount > 0) {
          const x = Math.random() * rect.width;
          const y = scene === 'first_seed'
            ? rect.height  // grow up from bottom
            : Math.random() * rect.height;

          particles.emit(x, y, 1, {
            colors: config.colors,
            speed: config.speed,
            life: config.life,
            size: config.size,
            type: config.type,
            gravity: config.gravity,
          });
        }
      }

      // Reveal burst (one-time)
      if (scene === 'reveal' && frameRef.current === 1) {
        particles.emit(rect.width / 2, rect.height / 2, 50, {
          colors: ['#FFD700', '#FFC107', '#fff', '#D4AF37'],
          speed: 4,
          life: 100,
          size: 3,
          type: 'glow',
          gravity: 0.02,
        });
      }

      particles.update();
      particles.render(ctx, 0, 0, 1);

      // Draw character preview
      if (showCharacter && characterPreview) {
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const unit = Math.min(rect.width, rect.height) * 0.04;

        drawCharacter({
          ctx,
          cx,
          cy,
          unit,
          skinTone: characterPreview.skinTone,
          hairColor: characterPreview.hairColor,
          bodyColor: characterPreview.bodyColor,
          classIcon: characterPreview.classIcon,
          name: characterPreview.name,
          level: characterPreview.level,
          direction: 'down',
          isMoving: false,
          mood: 4,
          bestStreak: 0,
          energy: 5,
          showName: true,
          showClassIcon: true,
          frameCount: frameRef.current,
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    // Reset frame counter on scene change
    frameRef.current = 0;
    tick();

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [scene, showCharacter, characterPreview, characterClass]);

  return (
    <canvas
      ref={canvasRef}
      className="realm-onboarding-canvas"
    />
  );
}
