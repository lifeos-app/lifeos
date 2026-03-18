// ═══════════════════════════════════════════════════════════
// Junction Tutorial — Guided onboarding for new users
// Cinematic, mobile-first, dark theme with gold accents
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { JunctionTradition } from '../hooks/useJunction';
import { assetPath } from '../utils/assets';

// ═══ Tradition "feel" words for browsing cards ═══
const TRADITION_FEELS: Record<string, string> = {
  tewahedo: 'Ancient',
  islam: 'Devoted',
  buddhism: 'Still',
  hinduism: 'Cosmic',
  sikhism: 'Courageous',
  judaism: 'Sacred',
  stoicism: 'Sharp',
  catholic: 'Reverent',
  daoism: 'Flowing',
  dreaming: 'Eternal',
};

// ═══ Short descriptions for swipe cards ═══
const TRADITION_ONELINERS: Record<string, string> = {
  tewahedo: 'Fasting, prayer, and mystical devotion rooted in Ethiopia\'s ancient church.',
  islam: 'Five pillars of discipline — prayer, fasting, charity, and surrender to the One.',
  buddhism: 'The Middle Way — mindfulness, compassion, and liberation from suffering.',
  hinduism: 'Cosmic order, devotion, and the eternal dance of creation.',
  sikhism: 'One God, honest living, and the warrior-saint ideal of selfless service.',
  judaism: 'Covenant, Torah study, and the sanctification of everyday life.',
  stoicism: 'Virtue, reason, and mastery of the self through adversity.',
  catholic: 'Sacraments, saints, and the universal communion of faith.',
  daoism: 'Harmony, simplicity, and flowing with the Way of nature.',
  dreaming: 'Country, kinship, and the songlines of the oldest living tradition.',
};

// ═══ Vibe-to-tradition mapping for "Try Something" step ═══
const VIBE_TRADITIONS: Record<string, string[]> = {
  discipline: ['tewahedo', 'islam', 'stoicism'],
  peace: ['buddhism', 'daoism', 'hinduism'],
  purpose: ['sikhism', 'judaism', 'catholic'],
  harmony: ['dreaming', 'daoism', 'hinduism'],
};

// ═══ Sample practices for "Try Something" ═══
const SAMPLE_PRACTICES: Record<string, { name: string; instruction: string }> = {
  tewahedo: {
    name: 'Selam — The Bow',
    instruction: 'Stand still. Bow your head slowly. Whisper: "In the name of the Father, the Son, and the Holy Spirit." Hold the silence. That\'s how the Ethiopian saints began every day.',
  },
  islam: {
    name: 'Dhikr — Remembrance',
    instruction: 'Close your eyes. Breathe slowly. Repeat silently: "SubhanAllah" — Glory to God. Let each breath carry the words. That is the beginning of remembrance.',
  },
  buddhism: {
    name: 'Zazen — Just Sitting',
    instruction: 'Sit still for 30 seconds. Notice your breath — in, out. When your mind wanders, gently return. That\'s the beginning of the Buddhist path.',
  },
  hinduism: {
    name: 'Om — The Primordial Sound',
    instruction: 'Sit comfortably. Take a deep breath. On the exhale, hum "Ommm" slowly. Feel the vibration in your chest. That\'s the sound of creation itself.',
  },
  sikhism: {
    name: 'Simran — Meditation on the Name',
    instruction: 'Sit quietly. Breathe in deeply. On each exhale, think: "Waheguru" — the Wonderful Lord. Let the word fill you. This is how Sikhs begin their morning.',
  },
  judaism: {
    name: 'Modeh Ani — Morning Gratitude',
    instruction: 'Before you move, before you plan — pause. Say: "I am grateful." That\'s it. Jews begin every single day this way. Gratitude before ambition.',
  },
  stoicism: {
    name: 'The View From Above',
    instruction: 'Close your eyes. Imagine zooming out — your room, your city, the Earth, the cosmos. Your worries shrink. Your perspective expands. Marcus Aurelius did this daily.',
  },
  catholic: {
    name: 'The Sign of the Cross',
    instruction: 'Touch your forehead, then your chest, left shoulder, right shoulder. Slowly. With intention. A billion people begin their prayers this way. Now you have too.',
  },
  daoism: {
    name: 'Wu Wei — Non-Action',
    instruction: 'Do nothing. Seriously. For 30 seconds, stop trying. Stop planning. Just exist. Let the river carry you. That\'s the Dao.',
  },
  dreaming: {
    name: 'Listening to Country',
    instruction: 'Step outside if you can. Or close your eyes and imagine the land beneath you. Listen. The wind, the earth, the silence between sounds. Country is always speaking.',
  },
};

// ═══ Fallback traditions (same as Junction.tsx) ═══
const FALLBACK_TRADITIONS: JunctionTradition[] = [
  { id: 'tewahedo', name: 'Tewahedo', slug: 'tewahedo', icon: '☦️', description: 'Ethiopian Orthodox', color: '#D4AF37', background_gradient: null, available: true, calendar_type: 'ethiopian', paths: [] },
  { id: 'islam', name: 'Islam', slug: 'islam', icon: '☪️', description: 'Path of submission', color: '#2E7D32', background_gradient: null, available: true, calendar_type: 'hijri', paths: [] },
  { id: 'buddhism', name: 'Buddhism', slug: 'buddhism', icon: '☸️', description: 'The Middle Way', color: '#FF8F00', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },
  { id: 'hinduism', name: 'Hinduism', slug: 'hinduism', icon: '🕉️', description: 'Sanātana Dharma', color: '#E65100', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },
  { id: 'sikhism', name: 'Sikhism', slug: 'sikhism', icon: '🪯', description: 'One God, service', color: '#1565C0', background_gradient: null, available: true, calendar_type: 'nanakshahi', paths: [] },
  { id: 'judaism', name: 'Judaism', slug: 'judaism', icon: '✡️', description: 'Covenant and Torah', color: '#1A237E', background_gradient: null, available: true, calendar_type: 'hebrew', paths: [] },
  { id: 'stoicism', name: 'Stoicism', slug: 'stoicism', icon: '🏛️', description: 'Virtue and reason', color: '#455A64', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },
  { id: 'catholic', name: 'Catholic', slug: 'catholic', icon: '⛪', description: 'Universal Church', color: '#6B21A8', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },
  { id: 'daoism', name: 'Daoism', slug: 'daoism', icon: '☯️', description: 'The Way', color: '#059669', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },
  { id: 'dreaming', name: 'Aboriginal Dreaming', slug: 'dreaming', icon: '🌀', description: 'Oldest living tradition', color: '#B45309', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },
];

interface JunctionTutorialProps {
  traditions: JunctionTradition[];
  onComplete: () => void; // called when user finishes tutorial (moves to TraditionSelector)
  onSkip: () => void;     // called when user skips
}

export default function JunctionTutorial({ traditions, onComplete, onSkip }: JunctionTutorialProps) {
  const [step, setStep] = useState(0);
  const [selectedVibe, setSelectedVibe] = useState<string | null>(null);
  const [fadeClass, setFadeClass] = useState('jnc-tut-step-enter');
  const [timerActive, setTimerActive] = useState(false);
  const [timerDone, setTimerDone] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const displayTraditions = traditions.length > 0 ? traditions : FALLBACK_TRADITIONS;

  // ── Step transition ──
  const goToStep = useCallback((nextStep: number) => {
    setFadeClass('jnc-tut-step-exit');
    setTimeout(() => {
      setStep(nextStep);
      setFadeClass('jnc-tut-step-enter');
    }, 400);
  }, []);

  // ── Scroll hint for tradition grid (Step 2) — flash scrollbar ──
  useEffect(() => {
    if (step !== 2 || !scrollRef.current) return;
    const el = scrollRef.current;
    // Flash a brief scroll to hint that content is scrollable
    const timeout = setTimeout(() => {
      el.scrollTo({ top: 40, behavior: 'smooth' });
      setTimeout(() => el.scrollTo({ top: 0, behavior: 'smooth' }), 600);
    }, 800);
    return () => clearTimeout(timeout);
  }, [step]);

  // ── Timer for Step 3 ──
  useEffect(() => {
    if (!timerActive) return;

    timerRef.current = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setTimerActive(false);
          setTimerDone(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive]);

  // ── Pick a tradition for the "Try" step based on vibe ──
  const trySuggestion = useMemo(() => {
    let slugPool: string[];
    if (selectedVibe && VIBE_TRADITIONS[selectedVibe]) {
      slugPool = VIBE_TRADITIONS[selectedVibe];
    } else {
      slugPool = Object.keys(SAMPLE_PRACTICES);
    }
    // Pick pseudo-random from pool
    const idx = Math.floor(Math.random() * slugPool.length);
    const slug = slugPool[idx];
    const trad = displayTraditions.find(t => t.slug === slug) || displayTraditions[0];
    const practice = SAMPLE_PRACTICES[slug] || SAMPLE_PRACTICES.buddhism;
    return { slug, trad, practice };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVibe, step === 3]); // recalc when entering step 3

  // ── Timer progress (for SVG circle) ──
  const timerProgress = (30 - timerSeconds) / 30;
  const timerRadius = 42;
  const circumference = 2 * Math.PI * timerRadius;
  const strokeDashoffset = circumference * (1 - timerProgress);

  return (
    <div className="jnc-tut-container">
      {/* Cancel button — prominent, always visible, intentional action required */}
      <button className="jnc-tut-cancel" onClick={onSkip}>
        ✕ Cancel Tutorial
      </button>

      {/* Step indicator dots */}
      <div className="jnc-tut-dots">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={`jnc-tut-dot ${step === i ? 'active' : ''} ${step > i ? 'done' : ''}`}
          />
        ))}
      </div>

      {/* ═══ Step 0 — Alpha Video (The Invitation) ═══ */}
      {step === 0 && (
        <div className={`jnc-tut-step jnc-tut-alpha ${fadeClass}`}>
          <video
            className="jnc-tut-video"
            src={assetPath('/junction/tutorial/alpha.mp4')}
            autoPlay
            muted
            playsInline
            onEnded={(e) => {
              // Pause on last frame instead of looping
              const video = e.currentTarget;
              video.pause();
            }}
          />
          <div className="jnc-tut-video-overlay" />
          <div className="jnc-tut-alpha-content">
            <h1 className="jnc-tut-title">The Junction</h1>
            <p className="jnc-tut-body">
              Every civilisation that endured was built on something deeper than ambition. A rhythm. A practice. A path.
            </p>
            <p className="jnc-tut-body jnc-tut-body-2">
              Junction is where your daily life meets ancient wisdom. Choose a tradition. Walk its path. Let it shape your days.
            </p>
            <button className="jnc-tut-btn-primary" onClick={() => goToStep(1)}>
              Begin
            </button>
          </div>
        </div>
      )}

      {/* ═══ Step 1 — "What draws you?" ═══ */}
      {step === 1 && (
        <div className={`jnc-tut-step jnc-tut-vibes ${fadeClass}`}>
          <div className="jnc-tut-step-content">
            <h2 className="jnc-tut-step-title">What draws you?</h2>
            <p className="jnc-tut-step-subtitle">There are no wrong answers. Just instinct.</p>

            <div className="jnc-tut-vibe-grid">
              {[
                { key: 'discipline', icon: '🔥', label: 'Discipline', desc: 'Structure, routine, mastery' },
                { key: 'peace', icon: '🌊', label: 'Peace', desc: 'Stillness, letting go, flow' },
                { key: 'purpose', icon: '⚔️', label: 'Purpose', desc: 'Justice, service, meaning' },
                { key: 'harmony', icon: '🌿', label: 'Harmony', desc: 'Balance, nature, connection' },
              ].map(v => (
                <button
                  key={v.key}
                  className={`jnc-tut-vibe-card ${selectedVibe === v.key ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedVibe(v.key);
                    setTimeout(() => goToStep(2), 600);
                  }}
                >
                  <span className="jnc-tut-vibe-icon">{v.icon}</span>
                  <span className="jnc-tut-vibe-label">{v.label}</span>
                  <span className="jnc-tut-vibe-desc">{v.desc}</span>
                </button>
              ))}
            </div>

            <button className="jnc-tut-btn-skip-step" onClick={() => goToStep(2)}>
              I'll just browse →
            </button>
          </div>
        </div>
      )}

      {/* ═══ Step 2 — "The Traditions" (vertical scrollable grid) ═══ */}
      {step === 2 && (
        <div className={`jnc-tut-step jnc-tut-traditions ${fadeClass}`}>
          <div className="jnc-tut-step-content jnc-tut-scrollable">
            <h2 className="jnc-tut-step-title">The Traditions</h2>
            <p className="jnc-tut-step-subtitle">Ten paths. One destination — a life shaped by something greater.</p>

            <div className="jnc-tut-traditions-grid" ref={scrollRef}>
              {displayTraditions.filter(t => t.available).map(t => (
                <div
                  key={t.id}
                  className="jnc-tut-trad-card"
                  style={{ '--trad-color': t.color } as React.CSSProperties}
                >
                  <div className="jnc-tut-trad-icon">
                    <TutorialTraditionIcon slug={t.slug} emoji={t.icon} />
                  </div>
                  <div className="jnc-tut-trad-name">{t.name}</div>
                  <div className="jnc-tut-trad-oneliner">
                    {TRADITION_ONELINERS[t.slug] || t.description}
                  </div>
                  <div className="jnc-tut-trad-feel">{TRADITION_FEELS[t.slug] || 'Sacred'}</div>
                </div>
              ))}
            </div>

            <button className="jnc-tut-btn-primary" onClick={() => goToStep(3)}>
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ═══ Step 3 — "Try Something" ═══ */}
      {step === 3 && (
        <div className={`jnc-tut-step jnc-tut-try ${fadeClass}`}>
          <div className="jnc-tut-step-content">
            <p className="jnc-tut-try-label">Before you choose, try this:</p>
            <div className="jnc-tut-try-tradition">
              <TutorialTraditionIcon slug={trySuggestion.slug} emoji={trySuggestion.trad.icon} />
              <span>{trySuggestion.trad.name}</span>
            </div>
            <h2 className="jnc-tut-step-title">{trySuggestion.practice.name}</h2>
            <p className="jnc-tut-try-instruction">{trySuggestion.practice.instruction}</p>

            {/* Timer circle */}
            <div className="jnc-tut-timer-container">
              <svg className="jnc-tut-timer-svg" viewBox="0 0 96 96">
                <circle
                  className="jnc-tut-timer-track"
                  cx="48" cy="48" r={timerRadius}
                  fill="none"
                  strokeWidth="3"
                />
                <circle
                  className="jnc-tut-timer-progress"
                  cx="48" cy="48" r={timerRadius}
                  fill="none"
                  strokeWidth="3"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  transform="rotate(-90 48 48)"
                />
              </svg>
              <div className={`jnc-tut-timer-inner ${timerActive ? 'pulsing' : ''}`}>
                {!timerActive && !timerDone && (
                  <button className="jnc-tut-timer-start" onClick={() => setTimerActive(true)}>
                    Start
                  </button>
                )}
                {timerActive && (
                  <span className="jnc-tut-timer-count">{timerSeconds}s</span>
                )}
                {timerDone && (
                  <span className="jnc-tut-timer-done">✓</span>
                )}
              </div>
            </div>

            <button
              className="jnc-tut-btn-primary"
              onClick={() => goToStep(4)}
            >
              {timerDone ? 'I\'m ready to choose' : 'Done'}
            </button>
            {!timerDone && !timerActive && (
              <button className="jnc-tut-btn-skip-step" onClick={() => goToStep(4)}>
                Skip this →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══ Step 4 — "Choose Your Junction" ═══ */}
      {step === 4 && (
        <div className={`jnc-tut-step jnc-tut-choose ${fadeClass}`}>
          <div className="jnc-tut-step-content jnc-tut-choose-content">
            <h2 className="jnc-tut-step-title">Choose Your Junction</h2>
            <p className="jnc-tut-step-subtitle">
              You've taken your first step. Now choose the path you'll walk.
            </p>
            <button className="jnc-tut-btn-primary jnc-tut-btn-choose" onClick={onComplete}>
              Show Me The Traditions
            </button>
            <p className="jnc-tut-ai-hint">
              Not sure? The AI matching questionnaire will help you find your path.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tradition Icon for Tutorial (simplified — no external deps) ──
function TutorialTraditionIcon({ slug, emoji }: { slug: string; emoji: string }) {
  const [imgError, setImgError] = useState(false);
  const imgPath = assetPath(`/junction/traditions/${slug}/icon.webp`);

  if (imgError) {
    return <span className="jnc-tut-trad-emoji">{emoji}</span>;
  }

  return (
    <img
      src={imgPath}
      alt={slug}
      className="jnc-tut-trad-icon-img"
      onError={() => setImgError(true)}
      loading="lazy"
      decoding="async"
    />
  );
}
