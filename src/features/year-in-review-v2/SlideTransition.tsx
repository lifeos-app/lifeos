/**
 * SlideTransition — Reusable cinematic transition component.
 *
 * Supports multiple animation types with smooth easing curves,
 * auto-advance timer, and swipe detection for manual navigation.
 */

import React, { useEffect, useState, useCallback, useRef, type ReactNode } from 'react';

export type AnimationType = 'fadeIn' | 'slideUp' | 'scaleUp' | 'typewriter' | 'countUp';

interface SlideTransitionProps {
  children: ReactNode;
  animation: AnimationType;
  active: boolean;
  duration?: number; // animation duration ms
  autoAdvanceMs?: number; // time before auto-advancing (0 = no auto)
  onAutoAdvance?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  className?: string;
}

// ── Animation Keyframes (injected once) ──────────────────────────

let keyframesInjected = false;

function injectKeyframes() {
  if (keyframesInjected && document.getElementById('yir-keyframes')) return;
  keyframesInjected = true;

  const style = document.createElement('style');
  style.id = 'yir-keyframes';
  style.textContent = `
    @keyframes yir-fadeIn {
      from { opacity: 0; transform: scale(0.98); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes yir-slideUp {
      from { opacity: 0; transform: translateY(60px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes yir-scaleUp {
      from { opacity: 0; transform: scale(0.7); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes yir-typewriter {
      from { opacity: 0; letter-spacing: 0.1em; filter: blur(4px); }
      to { opacity: 1; letter-spacing: normal; filter: blur(0); }
    }
    @keyframes yir-countUp {
      from { opacity: 0; transform: translateY(20px) scale(0.9); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes yir-exit {
      from { opacity: 1; transform: scale(1); }
      to { opacity: 0; transform: scale(0.95); }
    }
    @keyframes yir-pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 0.8; }
    }
    @keyframes yir-float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
  `;
  document.head.appendChild(style);
}

const ANIMATION_MAP: Record<AnimationType, string> = {
  fadeIn: 'yir-fadeIn',
  slideUp: 'yir-slideUp',
  scaleUp: 'yir-scaleUp',
  typewriter: 'yir-typewriter',
  countUp: 'yir-countUp',
};

const EASING = 'cubic-bezier(0.16, 1, 0.3, 1)'; // easeOutExpo-like

export function SlideTransition({
  children,
  animation,
  active,
  duration = 900,
  autoAdvanceMs = 6000,
  onAutoAdvance,
  onSwipeLeft,
  onSwipeRight,
  className = '',
}: SlideTransitionProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Mount animation
  useEffect(() => {
    injectKeyframes();
    if (active) {
      // Delay to allow mount
      const t = requestAnimationFrame(() => {
        setVisible(true);
      });
      return () => cancelAnimationFrame(t);
    } else {
      setVisible(false);
      setExiting(false);
    }
  }, [active]);

  // Auto-advance
  useEffect(() => {
    if (!active || !autoAdvanceMs || !onAutoAdvance) return;
    autoTimerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onAutoAdvance(), 400);
    }, autoAdvanceMs);
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
  }, [active, autoAdvanceMs, onAutoAdvance]);

  // Swipe detection
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;

    // Only horizontal swipes, fast enough and far enough
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 500) {
      if (dx < 0 && onSwipeLeft) onSwipeLeft();
      if (dx > 0 && onSwipeRight) onSwipeRight();
    }
    touchStartRef.current = null;
  }, [onSwipeLeft, onSwipeRight]);

  const animName = exiting ? 'yir-exit' : (ANIMATION_MAP[animation] || 'yir-fadeIn');
  const animDuration = exiting ? 400 : duration;

  return (
    <div
      className={`w-full h-full ${className}`}
      style={{
        opacity: visible ? 1 : 0,
        animation: visible ? `${animName} ${animDuration}ms ${EASING} forwards` : 'none',
        willChange: 'transform, opacity',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </div>
  );
}

// ── Animated Count Up ─────────────────────────────────────────────

interface CountUpProps {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  trigger?: boolean;
}

export function CountUp({
  end,
  duration = 1500,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
  trigger = true,
}: CountUpProps) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!trigger) return;
    startRef.current = null;

    const animate = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const progress = Math.min((timestamp - startRef.current) / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(eased * end);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [end, duration, trigger]);

  return (
    <span className={className}>
      {prefix}{value.toFixed(decimals)}{suffix}
    </span>
  );
}

// ── Typewriter Text Effect ────────────────────────────────────────

interface TypewriterProps {
  text: string;
  speed?: number; // ms per character
  className?: string;
  trigger?: boolean;
}

export function TypewriterText({
  text,
  speed = 40,
  className = '',
  trigger = true,
}: TypewriterProps) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    if (!trigger) { setDisplayed(''); return; }
    indexRef.current = 0;
    setDisplayed('');

    const interval = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayed(text.substring(0, indexRef.current + 1));
        indexRef.current++;
      } else {
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, trigger]);

  return (
    <span className={className}>
      {displayed}
      {displayed.length < text.length && (
        <span className="animate-pulse">|</span>
      )}
    </span>
  );
}

// ── Progress Ring ─────────────────────────────────────────────────

interface ProgressRingProps {
  value: number; // 0–1
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  className?: string;
  children?: ReactNode;
}

export function ProgressRing({
  value,
  size = 120,
  strokeWidth = 6,
  color = '#00D4FF',
  bgColor = 'rgba(255,255,255,0.1)',
  className = '',
  children,
}: ProgressRingProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - animatedValue * circumference;

  useEffect(() => {
    const t = setTimeout(() => setAnimatedValue(value), 200);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={bgColor} strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

// ── Particle Effects ──────────────────────────────────────────────

interface ParticleProps {
  count?: number;
  color?: string;
  className?: string;
}

export function AmbientParticles({ count = 30, color = 'rgba(255,255,255,0.3)', className = '' }: ParticleProps) {
  const particles = useRef(
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 1,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * -20,
    }))
  );

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {particles.current.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: color,
            animation: `yir-float ${p.duration}s ${p.delay}s ease-in-out infinite, yir-pulse ${p.duration / 2}s ${p.delay}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}

interface BurstParticlesProps {
  trigger?: boolean;
  color?: string;
  className?: string;
}

export function BurstParticles({ trigger = false, color = '#FFD700', className = '' }: BurstParticlesProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (trigger) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(t);
    }
  }, [trigger]);

  if (!visible) return null;

  const particles = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * 360;
    const distance = 60 + Math.random() * 80;
    return { id: i, angle, distance, size: Math.random() * 6 + 2, delay: Math.random() * 200 };
  });

  return (
    <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${className}`}>
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: color,
            animation: `yir-fadeIn 0.4s ${p.delay}ms ease-out forwards`,
            transform: `rotate(${p.angle}deg) translateX(${p.distance}px)`,
          }}
        />
      ))}
    </div>
  );
}

export default SlideTransition;