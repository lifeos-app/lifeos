/**
 * SetupCanvas — Atmospheric background canvas for Life Setup phases.
 * 
 * Renders themed particle effects based on the phase NPC.
 * Reuses the ParticleEngine from the Realm renderer.
 */

import { useRef, useEffect } from 'react';
import { ParticleEngine } from '../../realm/renderer/ParticleEngine';

export type SetupPhaseTheme = 'sage' | 'warrior' | 'merchant';

interface SetupCanvasProps {
  theme: SetupPhaseTheme;
  intensity?: number; // 0-1, controls particle rate
}

// NPC-themed particle configs
const THEME_PARTICLES: Record<SetupPhaseTheme, {
  colors: string[];
  speed: number;
  life: number;
  size: number;
  type: 'dot' | 'glow';
  gravity: number;
  rate: number;
}> = {
  sage: {
    colors: ['#00D4FF', '#0088CC', '#66E0FF', '#004466'],
    speed: 0.25,
    life: 200,
    size: 2,
    type: 'glow',
    gravity: -0.003,
    rate: 0.15,
  },
  warrior: {
    colors: ['#39FF14', '#2ECC71', '#27AE60', '#1ABC9C'],
    speed: 0.4,
    life: 150,
    size: 2,
    type: 'dot',
    gravity: -0.008,
    rate: 0.2,
  },
  merchant: {
    colors: ['#FFD93D', '#F0C040', '#DAA520', '#FFB700'],
    speed: 0.3,
    life: 180,
    size: 2,
    type: 'glow',
    gravity: 0,
    rate: 0.18,
  },
};

export function SetupCanvas({ theme, intensity = 1 }: SetupCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<ParticleEngine>(new ParticleEngine());
  const rafRef = useRef(0);

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

      const config = THEME_PARTICLES[theme];
      if (config && Math.random() < config.rate * intensity) {
        const x = Math.random() * rect.width;
        const y = Math.random() * rect.height;
        particles.emit(x, y, 1, {
          colors: config.colors,
          speed: config.speed,
          life: config.life,
          size: config.size,
          type: config.type,
          gravity: config.gravity,
        });
      }

      particles.update();
      particles.render(ctx, 0, 0, 1);

      rafRef.current = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [theme, intensity]);

  return (
    <canvas
      ref={canvasRef}
      className="setup-dialogue-canvas"
    />
  );
}
