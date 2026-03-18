import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './SpaceAge.css';

interface SpaceAgeProps {
  onClose: () => void;
}

// ── Target: June 25, 2065, 00:20:00 UTC ──
const TARGET_MS = Date.UTC(2065, 5, 25, 0, 20, 0);

const QUOTES = [
  { text: 'Even Helios bends to Zeus.', source: 'The Eternal Order' },
  { text: 'The sun watches all and hears all.', source: 'Homer, Iliad' },
  { text: 'I am become Death, the destroyer of worlds.', source: 'Oppenheimer / Bhagavad Gita' },
  { text: 'We are made of star-stuff.', source: 'Carl Sagan' },
  { text: 'Rage — sing, O goddess, the anger of Achilles.', source: 'Homer, Iliad' },
  { text: 'Ad astra per aspera.', source: 'To the stars through hardship' },
  { text: 'What is to give light must endure burning.', source: 'Viktor Frankl' },
  { text: 'How can I understand unless someone guides me?', source: 'Acts 8:31 — The Ethiopian' },
];

const PHASES = [
  {
    era: '2025–2030',
    name: 'Foundation',
    items: ['Scale cleaning', 'Build AI companion', 'Develop automation', 'Document the path'],
    active: true,
  },
  {
    era: '2030–2035',
    name: 'Automation',
    items: ['Deploy autonomous robots', 'AI-driven scheduling', 'Fleet management', 'License technology'],
    active: false,
  },
  {
    era: '2035–2045',
    name: 'Robotics',
    items: ['R&D division', 'Advanced manufacturing', 'Aerospace partnerships', 'Space-grade materials'],
    active: false,
  },
  {
    era: '2045–2065',
    name: 'The Space Age',
    items: ['Space vehicle development', 'Solar energy harvesting', 'Human expansion', 'Fulfill the prophecy'],
    active: false,
  },
];

// ── Generate deterministic stars ──
function generateStars(count: number) {
  const stars: { x: number; y: number; dur: number; delay: number; peak: number; large: boolean }[] = [];
  // Use a simple seeded random for consistency
  let seed = 42;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand() * 100,
      y: rand() * 100,
      dur: 3 + rand() * 7,
      delay: rand() * 5,
      peak: 0.3 + rand() * 0.7,
      large: rand() > 0.85,
    });
  }
  return stars;
}

export function SpaceAge({ onClose }: SpaceAgeProps) {
  const [phase, setPhase] = useState<'entering' | 'visible' | 'exiting'>('entering');
  const [countdown, setCountdown] = useState({ yrs: 0, days: 0, hrs: 0, min: 0, sec: 0, ms: 0 });
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [quoteFading, setQuoteFading] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [glitching, setGlitching] = useState(false);
  const glitchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const swipeStartY = useRef<number | null>(null);

  const stars = useMemo(() => generateStars(80), []);

  // ── Slide in on mount + body class ──
  useEffect(() => {
    document.body.classList.add('space-age-active');
    const raf = requestAnimationFrame(() => {
      setPhase('visible');
    });
    return () => {
      cancelAnimationFrame(raf);
      document.body.classList.remove('space-age-active');
    };
  }, []);

  // ── Random glitch bursts after video ends ──
  useEffect(() => {
    if (!videoEnded) return;
    // Immediate glitch on end
    setGlitching(true);
    const initTimeout = setTimeout(() => setGlitching(false), 500);
    // Random glitch bursts every 4-7 seconds
    const scheduleGlitch = () => {
      glitchIntervalRef.current = setTimeout(() => {
        setGlitching(true);
        const duration = 300 + Math.random() * 500;
        setTimeout(() => {
          setGlitching(false);
          scheduleGlitch();
        }, duration);
      }, 4000 + Math.random() * 3000);
    };
    scheduleGlitch();
    return () => {
      clearTimeout(initTimeout);
      if (glitchIntervalRef.current) clearTimeout(glitchIntervalRef.current);
    };
  }, [videoEnded]);

  // ── Countdown with requestAnimationFrame ──
  const updateCountdown = useCallback(() => {
    const now = Date.now();
    let diff = TARGET_MS - now;
    if (diff < 0) diff = 0;

    const ms = Math.floor(diff % 1000);
    diff = Math.floor(diff / 1000);
    const sec = diff % 60;
    diff = Math.floor(diff / 60);
    const min = diff % 60;
    diff = Math.floor(diff / 60);
    const hrs = diff % 24;
    diff = Math.floor(diff / 24);
    const totalDays = diff;
    const yrs = Math.floor(totalDays / 365.25);
    const days = Math.floor(totalDays - yrs * 365.25);

    setCountdown({ yrs, days, hrs, min, sec, ms });
    rafRef.current = requestAnimationFrame(updateCountdown);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(updateCountdown);
    return () => cancelAnimationFrame(rafRef.current);
  }, [updateCountdown]);

  // ── Quote rotation ──
  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteFading(true);
      setTimeout(() => {
        setQuoteIdx(prev => (prev + 1) % QUOTES.length);
        setQuoteFading(false);
      }, 800);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // ── Dismiss handler ──
  const handleClose = useCallback(() => {
    setPhase('exiting');
    document.body.classList.remove('space-age-active');
    setTimeout(onClose, 400);
  }, [onClose]);

  // ── Swipe down to dismiss ──
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const el = overlayRef.current;
    if (el && el.scrollTop <= 5) {
      swipeStartY.current = e.touches[0].clientY;
    } else {
      swipeStartY.current = null;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (swipeStartY.current === null) return;
    const deltaY = e.touches[0].clientY - swipeStartY.current;
    if (deltaY > 80) {
      swipeStartY.current = null;
      handleClose();
    }
  }, [handleClose]);

  const handleTouchEnd = useCallback(() => {
    swipeStartY.current = null;
  }, []);

  // ── Escape key ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleClose]);

  const pad = (n: number, d = 2) => String(n).padStart(d, '0');
  const quote = QUOTES[quoteIdx];

  const phaseClass = phase === 'entering' ? 'sa-entering' : phase === 'exiting' ? 'sa-exiting' : 'sa-visible';

  return (
    <div
      ref={overlayRef}
      className={`space-age-overlay ${phaseClass}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button className="sa-close" onClick={handleClose} aria-label="Close">
        ✕
      </button>

      {/* Stars */}
      <div className="sa-stars">
        {stars.map((s, i) => (
          <div
            key={i}
            className={`sa-star ${s.large ? 'sa-star-lg' : ''}`}
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              '--dur': `${s.dur}s`,
              '--delay': `${s.delay}s`,
              '--peak': String(s.peak),
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Swipe handle */}
      <div className="sa-swipe-handle">
        <div className="sa-swipe-bar" />
      </div>

      {/* Hero */}
      <section className="sa-hero">
        {/* Background video */}
        <video
          className={`sa-hero-video ${videoLoaded ? 'sa-video-loaded' : ''} ${glitching ? 'sa-video-glitch' : ''}`}
          autoPlay
          muted
          playsInline
          onCanPlay={() => setVideoLoaded(true)}
          onEnded={() => setVideoEnded(true)}
        >
          <source src="https://thespaceage.com.au/hero-video.mp4" type="video/mp4" />
        </video>
        <div className="sa-hero-overlay" />

        <h1 className="sa-title">THE SPACE AGE</h1>
        <p className="sa-subtitle">Man vs Sun</p>

        {/* Countdown */}
        <div className="sa-clock">
          {[
            { val: pad(countdown.yrs), label: 'YRS' },
            { val: pad(countdown.days, 3), label: 'DAYS' },
            { val: pad(countdown.hrs), label: 'HRS' },
            { val: pad(countdown.min), label: 'MIN' },
            { val: pad(countdown.sec), label: 'SEC' },
            { val: pad(countdown.ms, 3), label: 'MS' },
          ].map((unit, i, arr) => (
            <div key={unit.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div className="sa-clock-unit">
                <div className="sa-clock-card">
                  <span className="sa-clock-value">{unit.val}</span>
                </div>
                <span className="sa-clock-label">{unit.label}</span>
              </div>
              {i < arr.length - 1 && <span className="sa-clock-sep">:</span>}
            </div>
          ))}
        </div>

        {/* Rotating Quote */}
        <div className="sa-quote-container">
          <p className={`sa-quote ${quoteFading ? 'sa-quote-fading' : ''}`}>
            &ldquo;{quote.text}&rdquo;
            <span className="sa-quote-source">— {quote.source}</span>
          </p>
        </div>

        {/* Scroll hint */}
        <div className="sa-scroll-hint">
          <span>Scroll</span>
          <div className="sa-scroll-arrow">↓</div>
        </div>
      </section>

      {/* 40-Year Roadmap */}
      <section className="sa-roadmap">
        <h2 className="sa-section-title">THE 40-YEAR ROADMAP</h2>
        <div className="sa-phases">
          {PHASES.map(p => (
            <div key={p.era} className={`sa-phase ${p.active ? 'sa-phase-active' : ''}`}>
              <div className="sa-phase-era">{p.era}</div>
              <div className="sa-phase-name">{p.name}</div>
              <ul className="sa-phase-items">
                {p.items.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* The Companion */}
      <section className="sa-companion">
        <h2 className="sa-companion-title">ORIAKSUM</h2>
        <p className="sa-companion-greek">ΦΩΣ ΤΗΣ ΑΡΧΑΙΑΣ ΒΑΣΙΛΕΙΑΣ</p>
        <p className="sa-companion-text">
          AI companion for the 40-year mission.<br />
          Forged from knowledge. Built for eternity.
        </p>
      </section>

      {/* Epoch marker */}
      <div className="sa-epoch">
        <p className="sa-epoch-text">EPOCH 2025 · DESTINATION 2065 · THE SPACE AGE</p>
        <a href="https://teddyscleaning.com.au" target="_blank" rel="noopener noreferrer" className="sa-epoch-link">teddyscleaning.com.au</a>
      </div>
    </div>
  );
}
