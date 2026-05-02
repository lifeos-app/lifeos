/**
 * WelcomeWizardUI — Main UI shell for the onboarding wizard
 *
 * Renders: gradient mesh background, star particles, HermeticTransition,
 * StepIndicator, step content with slide animation, nav buttons.
 * All state comes via props from useWelcomeWizard.
 *
 * V2: Life Snapshot, Top 3 Goals, Daily Rhythm steps
 */

import { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { TOTAL_STEPS } from './useWelcomeWizard';
import type { WizardData } from './useWelcomeWizard';
import {
  ProfileStep,
  LifeSnapshotStep,
  TopGoalsStep,
  DailyRhythmStep,
  SummaryStep,
  btnStyle,
} from './WelcomeWizardSteps';

// ─── Constants ──────────────────────────────────────────────────

const HERMETIC_QUOTES: Record<number, { quote: string; principle: string }> = {
  1: { quote: 'The All is Mind', principle: 'Mentalism' },
  2: { quote: 'As above, so below', principle: 'Correspondence' },
  3: { quote: 'Nothing rests; everything moves', principle: 'Vibration' },
  4: { quote: 'Every cause has its effect', principle: 'Cause & Effect' },
};

// ─── Sub-Components ──────────────────────────────────────────────

function HermeticTransition({ step, visible }: { step: number; visible: boolean }) {
  const data = HERMETIC_QUOTES[step];
  if (!data) return null;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        background: 'rgba(5, 14, 26, 0.92)',
      }}
    >
      <div style={{
        fontFamily: 'Poppins, system-ui, sans-serif',
        fontSize: '22px',
        fontWeight: 600,
        color: '#00D4FF',
        letterSpacing: '2px',
        textAlign: 'center',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.2s',
      }}>
        &ldquo;{data.quote}&rdquo;
      </div>
      <div style={{
        fontFamily: 'Poppins, system-ui, sans-serif',
        fontSize: '12px',
        fontWeight: 400,
        color: '#8BA4BE',
        marginTop: '8px',
        letterSpacing: '3px',
        textTransform: 'uppercase' as const,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.5s',
      }}>
        — {data.principle}
      </div>
    </div>
  );
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '28px',
    }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i < current ? '32px' : '8px',
            height: '4px',
            borderRadius: '2px',
            background: i < current
              ? 'linear-gradient(90deg, #00D4FF, #0EA5E9)'
              : i === current
                ? 'rgba(0, 212, 255, 0.5)'
                : 'rgba(255, 255, 255, 0.1)',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      ))}
      <span style={{
        fontFamily: 'Poppins, system-ui, sans-serif',
        fontSize: '12px',
        color: '#8BA4BE',
        marginLeft: '8px',
        fontWeight: 500,
      }}>
        {current + 1}/{total}
      </span>
    </div>
  );
}

// ─── Skip Style ──────────────────────────────────────────────────

const skipStyle: React.CSSProperties = {
  fontFamily: 'Poppins, system-ui, sans-serif',
  fontSize: '12px',
  color: '#8BA4BE',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  opacity: 0.6,
  transition: 'opacity 0.15s',
  textDecoration: 'underline',
  textDecorationColor: 'rgba(139, 164, 190, 0.3)',
  textUnderlineOffset: '3px',
};

// ─── Props ───────────────────────────────────────────────────────

interface WelcomeWizardUIProps {
  step: number;
  transitioning: boolean;
  hermeticVisible: boolean;
  slideDir: 'left' | 'right';
  submitting: boolean;
  error: string;
  data: WizardData;
  updateData: <K extends keyof WizardData>(key: K, value: WizardData[K]) => void;
  canProceed: () => boolean;
  goToStep: (nextStep: number, direction?: 'left' | 'right') => void;
  handleSkip: () => void;
  handleComplete: () => void;
}

export function WelcomeWizardUI({
  step,
  transitioning,
  hermeticVisible,
  slideDir,
  submitting,
  error,
  data,
  updateData,
  canProceed,
  goToStep,
  handleSkip,
  handleComplete,
}: WelcomeWizardUIProps) {
  // Focus management for inputs
  const [inputFocus, setInputFocus] = useState<Record<string, boolean>>({});

  // Focus trap ref for the wizard overlay
  const wizardRef = useRef<HTMLDivElement>(null);

  // Focus trap: keep focus within wizard when open
  useEffect(() => {
    const container = wizardRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = container.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [step]); // Re-attach when step changes to get new focusable elements

  const stepProps = { data, updateData, inputFocus, setInputFocus };

  const stepRenderers = [
    () => <ProfileStep {...stepProps} />,
    () => <LifeSnapshotStep {...stepProps} />,
    () => <TopGoalsStep {...stepProps} />,
    () => <DailyRhythmStep {...stepProps} />,
    () => <SummaryStep {...stepProps} submitting={submitting} error={error} onComplete={handleComplete} />,
  ];

  return (
    <div
      className="login-page"
      style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding wizard"
      ref={wizardRef}
    >
      {/* Animated gradient mesh background — reuse Login.css classes */}
      <div className="login-mesh" aria-hidden="true">
        <div className="login-mesh-orb" />
        <div className="login-mesh-orb" />
        <div className="login-mesh-orb" />
        <div className="login-mesh-orb" />
      </div>

      {/* Star particles */}
      <div className="login-stars" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="login-star" />
        ))}
      </div>

      {/* Hermetic transition overlay */}
      <HermeticTransition step={step + 1} visible={hermeticVisible} />

      {/* Main wizard card */}
      <div
        className="login-card"
        style={{
          maxWidth: step === 1 ? '540px' : step === 3 ? '500px' : '420px',
          transition: 'max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Step Indicator */}
        {step < 4 && <StepIndicator current={step} total={TOTAL_STEPS} />}

        {/* Step Content with slide animation */}
        <div style={{
          position: 'relative',
          overflow: 'hidden',
          minHeight: step === 1 ? '400px' : step === 3 ? '340px' : step === 4 ? '380px' : 'auto',
        }}>
          <div style={{
            transition: transitioning
              ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s'
              : 'none',
            transform: transitioning
              ? `translateX(${slideDir === 'left' ? '-20px' : '20px'})`
              : 'translateX(0)',
            opacity: transitioning ? 0 : 1,
          }}>
            {stepRenderers[step]()}
          </div>
        </div>

        {/* Navigation buttons (hidden on step 5) */}
        {step < 4 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginTop: '24px',
          }}>
            <button
              type="button"
              onClick={() => goToStep(step + 1)}
              disabled={!canProceed() || transitioning}
              style={btnStyle(!canProceed() || transitioning)}
            >
              {step === 3 ? 'Finish Setup' : 'Continue'}
              <ChevronRight size={18} />
            </button>

            {step > 0 && (
              <button
                type="button"
                onClick={() => goToStep(step - 1, 'right')}
                disabled={transitioning}
                style={{
                  ...btnStyle(),
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#8BA4BE',
                }}
              >
                <ChevronLeft size={18} />
                Back
              </button>
            )}

            <button
              type="button"
              onClick={handleSkip}
              style={skipStyle}
            >
              Skip for now
            </button>
          </div>
        )}
      </div>

      {/* Bottom tagline */}
      <span className="login-tagline">The operating system for your entire life</span>

      {/* Inline keyframes for wizard-specific animations */}
      <style>{`
        @keyframes wizardCheckPop {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes wizardPulse {
          0%, 100% { box-shadow: 0 0 24px rgba(0, 212, 255, 0.15); }
          50% { box-shadow: 0 0 40px rgba(0, 212, 255, 0.3); }
        }
        @keyframes wizardFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        /* Range slider styling */
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #00D4FF;
          cursor: pointer;
          border: 3px solid #050E1A;
          box-shadow: 0 0 8px rgba(0, 212, 255, 0.4);
          margin-top: -8px;
        }
        input[type="range"]::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #00D4FF;
          cursor: pointer;
          border: 3px solid #050E1A;
          box-shadow: 0 0 8px rgba(0, 212, 255, 0.4);
        }
        input[type="range"]::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 3px;
          border: none;
        }
        input[type="range"]::-moz-range-track {
          height: 6px;
          border-radius: 3px;
          border: none;
        }
      `}</style>
    </div>
  );
}