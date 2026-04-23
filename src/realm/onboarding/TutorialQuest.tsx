/**
 * TutorialQuest — Genesis Garden Tutorial
 *
 * Guides new players through basic Realm controls:
 * 1. Move (walk to highlighted tile)
 * 2. Interact (talk to the Sage)
 * 3. Water (interact with garden)
 * 4. Quest Board (check your first quest)
 * 5. Portal (step through to Life Town)
 *
 * Steps persist to localStorage + Supabase preferences.
 * On completion, calls onComplete which transitions to Life Town.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Tutorial Steps ─────────────────────────────────

export type TutorialStep =
  | 'move'        // Walk around with arrow keys / tap tiles
  | 'interact'    // Talk to the Sage NPC
  | 'water'       // Water a plant in the garden
  | 'quest_board' // Check the Quest Board
  | 'portal';     // Step through the portal to Life Town

export const TUTORIAL_STEPS: TutorialStep[] = ['move', 'interact', 'water', 'quest_board', 'portal'];

const STEP_INFO: Record<TutorialStep, { title: string; description: string; icon: string }> = {
  move: {
    title: 'Move',
    description: 'Use arrow keys or tap a tile to walk around the Garden.',
    icon: '🏃',
  },
  interact: {
    title: 'Talk to the Sage',
    description: 'Walk up to the Sage and tap them to learn about the Realm.',
    icon: '💬',
  },
  water: {
    title: 'Water a Plant',
    description: 'Tap the garden patch to water your first habit plant.',
    icon: '🌱',
  },
  quest_board: {
    title: 'Check the Quest Board',
    description: 'Tap the bulletin board to see your first quest.',
    icon: '📋',
  },
  portal: {
    title: 'Enter Life Town',
    description: 'Walk north to the glowing portal. Step through to begin your adventure!',
    icon: '🌅',
  },
};

const STORAGE_KEY = 'lifeos_tutorial_progress';

export interface TutorialProgress {
  completedSteps: TutorialStep[];
  currentStep: TutorialStep;
  done: boolean;
}

// ── Component ─────────────────────────────────────

interface TutorialQuestProps {
  /** Called when tutorial is fully complete — player is ready for Life Town */
  onComplete: () => void;
  /** Called when user skips tutorial */
  onSkip?: () => void;
}

export function TutorialQuest({ onComplete, onSkip }: TutorialQuestProps) {
  const [completedSteps, setCompletedSteps] = useState<TutorialStep[]>([]);
  const [skipConfirm, setSkipConfirm] = useState(false);
  const mountedRef = useRef(true);

  // Restore progress from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const progress: TutorialProgress = JSON.parse(saved);
        if (progress.completedSteps) {
          setCompletedSteps(progress.completedSteps);
        }
        if (progress.done) {
          onComplete();
        }
      }
    } catch { /* ignore */ }

    return () => { mountedRef.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist progress whenever steps change
  useEffect(() => {
    const currentStep = TUTORIAL_STEPS.find(s => !completedSteps.includes(s)) || 'portal';
    const progress: TutorialProgress = {
      completedSteps,
      currentStep,
      done: completedSteps.length >= TUTORIAL_STEPS.length,
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch { /* ignore */ }
  }, [completedSteps]);

  const currentStep = TUTORIAL_STEPS.find(s => !completedSteps.includes(s)) || 'portal';

  const markStep = useCallback((step: TutorialStep) => {
    if (!mountedRef.current) return;
    setCompletedSteps(prev => {
      if (prev.includes(step)) return prev;
      const next = [...prev, step];
      // If all steps done, call onComplete
      if (next.length >= TUTORIAL_STEPS.length) {
        setTimeout(() => onComplete(), 500);
      }
      return next;
    });
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ completedSteps: TUTORIAL_STEPS, currentStep: 'portal', done: true })); } catch { /* ignore */ }
    onComplete();
  }, [onComplete]);

  const info = STEP_INFO[currentStep];
  const stepIndex = TUTORIAL_STEPS.indexOf(currentStep);
  const progress = completedSteps.length / TUTORIAL_STEPS.length;

  return (
    <div className="realm-onboarding-container" style={{
      background: 'linear-gradient(180deg, rgba(5,14,26,0.95) 0%, rgba(15,45,74,0.9) 100%)',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      maxHeight: '220px',
      borderTop: '2px solid #00D4FF33',
    }}>
      {/* Progress bar */}
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{
          height: '4px',
          background: '#1A3A5C',
          borderRadius: '2px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress * 100}%`,
            background: 'linear-gradient(90deg, #00D4FF, #39FF14)',
            transition: 'width 0.5s ease',
            borderRadius: '2px',
          }} />
        </div>
      </div>

      {/* Step indicator dots */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {TUTORIAL_STEPS.map((step, i) => (
          <div
            key={step}
            style={{
              width: i === stepIndex ? '24px' : '8px',
              height: '8px',
              borderRadius: '4px',
              background: completedSteps.includes(step)
                ? '#39FF14'
                : i === stepIndex
                  ? '#00D4FF'
                  : '#1A3A5C',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>

      {/* Current step info */}
      <div style={{
        background: '#0F2D4A',
        border: '1px solid #1A3A5C',
        borderRadius: '12px',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        maxWidth: '400px',
        width: '100%',
      }}>
        <span style={{ fontSize: '24px' }}>{info.icon}</span>
        <div>
          <div style={{ color: '#00D4FF', fontSize: '13px', fontWeight: 600 }}>
            Step {stepIndex + 1}: {info.title}
          </div>
          <div style={{ color: '#8BA4BE', fontSize: '12px', marginTop: '2px' }}>
            {info.description}
          </div>
        </div>
      </div>

      {/* Skip button */}
      {skipConfirm ? (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ color: '#8BA4BE', fontSize: '12px' }}>Skip tutorial?</span>
          <button
            onClick={handleSkip}
            style={{
              background: 'none',
              border: '1px solid #F43F5E',
              color: '#F43F5E',
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Yes, skip
          </button>
          <button
            onClick={() => setSkipConfirm(false)}
            style={{
              background: 'none',
              border: '1px solid #1A3A5C',
              color: '#8BA4BE',
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Continue
          </button>
        </div>
      ) : (
        <button
          onClick={() => setSkipConfirm(true)}
          style={{
            background: 'none',
            border: 'none',
            color: '#5A7A9A',
            fontSize: '11px',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Skip tutorial
        </button>
      )}
    </div>
  );
}

// ── External step markers (called by RealmEntry when player performs actions) ──

export function markTutorialStep(step: TutorialStep): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const progress: TutorialProgress = saved ? JSON.parse(saved) : {
      completedSteps: [],
      currentStep: 'move',
      done: false,
    };
    if (!progress.completedSteps.includes(step)) {
      progress.completedSteps.push(step);
      progress.currentStep = TUTORIAL_STEPS.find(s => !progress.completedSteps.includes(s)) || 'portal';
      progress.done = progress.completedSteps.length >= TUTORIAL_STEPS.length;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    }
  } catch { /* ignore */ }
}

export function isTutorialComplete(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;
    const progress: TutorialProgress = JSON.parse(saved);
    return progress.done === true;
  } catch { return false; }
}

export function clearTutorialProgress(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}