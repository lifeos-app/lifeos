/**
 * Confetti — lightweight CSS-only burst animation.
 * Uses .confetti-piece class from onboarding-animations.css.
 */
import { useEffect, useState } from 'react';
import '../styles/onboarding-animations.css';

const COLORS = ['#00D4FF', '#7C5CFC', '#FFD93D', '#4ECB71', '#FF6B6B', '#FF9F43', '#A8E6CF'];
const SHAPES = ['rect', 'circle'];

interface Piece {
  id: number;
  x: number;
  color: string;
  w: number;
  h: number;
  duration: number;
  delay: number;
  rotStart: number;
  rotEnd: number;
  shape: string;
}

interface ConfettiProps {
  active: boolean;
  count?: number;
}

export function Confetti({ active, count = 90 }: ConfettiProps) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (!active) {
      setPieces([]);
      return;
    }
    const ps: Piece[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: COLORS[i % COLORS.length],
      w: 6 + Math.random() * 9,
      h: 8 + Math.random() * 14,
      duration: 2.4 + Math.random() * 2.2,
      delay: Math.random() * 1.4,
      rotStart: Math.random() * 360,
      rotEnd: 360 + Math.random() * 720,
      shape: SHAPES[i % 2],
    }));
    setPieces(ps);
    // Clean up after all pieces have fallen
    const maxDuration = Math.max(...ps.map(p => (p.duration + p.delay) * 1000)) + 200;
    const t = setTimeout(() => setPieces([]), maxDuration);
    return () => clearTimeout(t);
  }, [active, count]);

  if (!pieces.length) return null;

  return (
    <>
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.x}%`,
            width: p.shape === 'circle' ? p.w : p.w,
            height: p.shape === 'circle' ? p.w : p.h,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
            background: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            '--rot-start': `${p.rotStart}deg`,
            '--rot-end': `${p.rotEnd}deg`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}
