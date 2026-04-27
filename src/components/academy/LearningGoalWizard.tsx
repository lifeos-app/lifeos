/**
 * LearningGoalWizard — 5-step wizard for creating adaptive learning goals.
 * Full-screen overlay: Topic → Level → Time → Style → Preview.
 */

import { useState } from 'react';
import {
  X, ArrowLeft, ArrowRight, Loader2, CheckCircle2,
  Music, Globe, Dumbbell, Briefcase, Laptop, Palette, GraduationCap, Star,
} from 'lucide-react';
import { useAcademyStore2 } from '../../stores/useAcademyStore2';
import { useUserStore } from '../../stores/useUserStore';
import type {
  GoalDomain, SkillLevel, LearningStyle, WizardInput,
} from '../../types/academy';

// ── Props ──

interface LearningGoalWizardProps {
  onClose: () => void;
  onCreated: (goalId: string) => void;
}

// ── Domain Cards ──

const DOMAIN_OPTIONS: { value: GoalDomain; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'music', label: 'Music', icon: <Music size={24} />, color: '#FFD700' },
  { value: 'language', label: 'Language', icon: <Globe size={24} />, color: '#00D4FF' },
  { value: 'fitness', label: 'Fitness', icon: <Dumbbell size={24} />, color: '#39FF14' },
  { value: 'business', label: 'Business', icon: <Briefcase size={24} />, color: '#D4AF37' },
  { value: 'tech', label: 'Tech', icon: <Laptop size={24} />, color: '#A855F7' },
  { value: 'creative', label: 'Creative', icon: <Palette size={24} />, color: '#F97316' },
  { value: 'academic', label: 'Academic', icon: <GraduationCap size={24} />, color: '#EC4899' },
  { value: 'other', label: 'Other', icon: <Star size={24} />, color: '#8BA4BE' },
];

const LEVEL_OPTIONS: { value: SkillLevel; label: string; description: string }[] = [
  { value: 'complete_beginner', label: 'Complete Beginner', description: 'Never tried this before' },
  { value: 'some_exposure', label: 'Some Exposure', description: 'Tried a few times, know the basics' },
  { value: 'intermediate', label: 'Intermediate', description: 'Comfortable with fundamentals' },
  { value: 'advanced', label: 'Advanced', description: 'Strong skills, want to go deeper' },
];

const TIME_OPTIONS = [15, 30, 45, 60, 90];

const STYLE_OPTIONS: { value: LearningStyle; label: string; description: string }[] = [
  { value: 'visual', label: 'Visual', description: 'Diagrams, videos, and charts' },
  { value: 'reading', label: 'Reading', description: 'Articles, books, and written guides' },
  { value: 'hands_on', label: 'Hands-on', description: 'Practice exercises and projects' },
  { value: 'mixed', label: 'Mixed', description: 'A blend of all styles' },
];

// ── Component ──

export function LearningGoalWizard({ onClose, onCreated }: LearningGoalWizardProps) {
  const [step, setStep] = useState(1);
  const [topic, setTopic] = useState('');
  const [domain, setDomain] = useState<GoalDomain>('other');
  const [level, setLevel] = useState<SkillLevel>('complete_beginner');
  const [minutesPerDay, setMinutesPerDay] = useState(30);
  const [targetDate, setTargetDate] = useState('');
  const [learningStyle, setLearningStyle] = useState<LearningStyle>('mixed');
  const [createdGoalId, setCreatedGoalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { createLearningGoal, generatingCurriculum } = useAcademyStore2();
  const goal = useAcademyStore2(s => s.activeLearningGoals.find(g => g.id === createdGoalId));

  const canProceed = () => {
    if (step === 1) return topic.trim().length >= 3;
    return true;
  };

  const handleNext = () => {
    if (step < 5) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleGenerate = async () => {
    setStep(5);
    setError(null);

    const input: WizardInput = {
      topic: topic.trim(),
      domain,
      currentLevel: level,
      targetDescription: `Learn ${topic.trim()} from ${level.replace(/_/g, ' ')} level`,
      minutesPerDay,
      targetDate: targetDate || null,
      learningStyle,
    };

    const goalId = await createLearningGoal(input);
    if (goalId) {
      setCreatedGoalId(goalId);
    } else {
      setError('Failed to generate curriculum. Please try again.');
    }
  };

  const handleActivate = () => {
    if (createdGoalId) {
      onCreated(createdGoalId);
    }
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 1000, background: 'rgba(10, 22, 40, 0.97)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      overflowY: 'auto', padding: '40px 20px',
    }}>
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 16, right: 16,
          background: 'rgba(255,255,255,0.06)', border: 'none',
          borderRadius: 8, padding: 8, cursor: 'pointer', color: '#8BA4BE',
        }}
      >
        <X size={20} />
      </button>

      {/* Progress indicator */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {[1, 2, 3, 4, 5].map(s => (
          <div key={s} style={{
            width: s === step ? 32 : 12, height: 4, borderRadius: 2,
            background: s <= step ? '#00D4FF' : 'rgba(255,255,255,0.1)',
            transition: 'all 0.2s',
          }} />
        ))}
      </div>

      <div style={{ maxWidth: 600, width: '100%' }}>
        {/* Step 1: Topic */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 8, textAlign: 'center' }}>
              What do you want to learn?
            </h2>
            <p style={{ fontSize: 14, color: '#8BA4BE', marginBottom: 24, textAlign: 'center' }}>
              Describe what you want to master
            </p>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g., Play classical guitar, Learn Python, Speak Japanese..."
              autoFocus
              style={{
                width: '100%', padding: '16px 20px', fontSize: 18,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12, color: '#fff', outline: 'none',
                marginBottom: 24, boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: 13, color: '#8BA4BE', marginBottom: 16 }}>Choose a domain:</p>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
            }}>
              {DOMAIN_OPTIONS.map(d => (
                <button
                  key={d.value}
                  onClick={() => setDomain(d.value)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    padding: '16px 8px', borderRadius: 12, cursor: 'pointer',
                    background: domain === d.value ? `${d.color}15` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${domain === d.value ? d.color + '50' : 'rgba(255,255,255,0.06)'}`,
                    color: domain === d.value ? d.color : '#8BA4BE',
                    transition: 'all 0.15s',
                  }}
                >
                  {d.icon}
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{d.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Level */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 8, textAlign: 'center' }}>
              Where are you now?
            </h2>
            <p style={{ fontSize: 14, color: '#8BA4BE', marginBottom: 24, textAlign: 'center' }}>
              Your current skill level in {topic}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {LEVEL_OPTIONS.map(l => (
                <button
                  key={l.value}
                  onClick={() => setLevel(l.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '16px 20px', borderRadius: 12, cursor: 'pointer',
                    background: level === l.value ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${level === l.value ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    textAlign: 'left', width: '100%',
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    border: `2px solid ${level === l.value ? '#00D4FF' : 'rgba(255,255,255,0.15)'}`,
                    background: level === l.value ? '#00D4FF' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {level === l.value && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0A1628' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{l.label}</div>
                    <div style={{ fontSize: 12, color: '#8BA4BE' }}>{l.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Time */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 8, textAlign: 'center' }}>
              How much time per day?
            </h2>
            <p style={{ fontSize: 14, color: '#8BA4BE', marginBottom: 24, textAlign: 'center' }}>
              Choose a realistic daily study commitment
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 32 }}>
              {TIME_OPTIONS.map(t => (
                <button
                  key={t}
                  onClick={() => setMinutesPerDay(t)}
                  style={{
                    padding: '12px 20px', borderRadius: 20, cursor: 'pointer',
                    background: minutesPerDay === t ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${minutesPerDay === t ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    color: minutesPerDay === t ? '#00D4FF' : '#8BA4BE',
                    fontSize: 14, fontWeight: 600,
                  }}
                >
                  {t} min
                </button>
              ))}
            </div>
            <p style={{ fontSize: 13, color: '#8BA4BE', marginBottom: 12 }}>
              Target date (optional):
            </p>
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              style={{
                width: '100%', padding: '12px 16px', fontSize: 14,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, color: '#fff', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* Step 4: Style */}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 8, textAlign: 'center' }}>
              How do you learn best?
            </h2>
            <p style={{ fontSize: 14, color: '#8BA4BE', marginBottom: 24, textAlign: 'center' }}>
              Choose your preferred learning style
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {STYLE_OPTIONS.map(s => (
                <button
                  key={s.value}
                  onClick={() => setLearningStyle(s.value)}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 6,
                    padding: '20px 16px', borderRadius: 12, cursor: 'pointer',
                    background: learningStyle === s.value ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${learningStyle === s.value ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 16, fontWeight: 600, color: learningStyle === s.value ? '#00D4FF' : '#fff' }}>
                    {s.label}
                  </span>
                  <span style={{ fontSize: 12, color: '#8BA4BE' }}>{s.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Preview / Generating */}
        {step === 5 && (
          <div style={{ textAlign: 'center' }}>
            {generatingCurriculum && !createdGoalId && (
              <div>
                <Loader2 size={48} color="#00D4FF" style={{ animation: 'spin 1s linear infinite', marginBottom: 20 }} />
                <h2 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
                  Generating your curriculum...
                </h2>
                <p style={{ fontSize: 14, color: '#8BA4BE' }}>
                  Creating a personalised learning plan for "{topic}"
                </p>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {error && (
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 700, color: '#F43F5E', marginBottom: 8 }}>
                  Something went wrong
                </h2>
                <p style={{ fontSize: 14, color: '#8BA4BE', marginBottom: 16 }}>{error}</p>
                <button
                  onClick={() => { setStep(4); setError(null); }}
                  style={{
                    padding: '10px 24px', borderRadius: 10, border: 'none',
                    background: 'rgba(0,212,255,0.15)', color: '#00D4FF',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Go Back
                </button>
              </div>
            )}

            {createdGoalId && goal?.curriculum && (
              <div>
                <CheckCircle2 size={48} color="#39FF14" style={{ marginBottom: 16 }} />
                <h2 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
                  Your learning plan is ready!
                </h2>

                <div style={{
                  background: 'rgba(255,255,255,0.03)', borderRadius: 12,
                  padding: 20, textAlign: 'left', marginBottom: 24,
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 12 }}>
                    {goal.topic}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{
                      padding: '10px 14px', background: 'rgba(0,212,255,0.08)',
                      borderRadius: 8, fontSize: 13,
                    }}>
                      <div style={{ color: '#8BA4BE', marginBottom: 2 }}>Phases</div>
                      <div style={{ color: '#00D4FF', fontWeight: 600 }}>
                        {goal.curriculum.phases.length}
                      </div>
                    </div>
                    <div style={{
                      padding: '10px 14px', background: 'rgba(57,255,20,0.08)',
                      borderRadius: 8, fontSize: 13,
                    }}>
                      <div style={{ color: '#8BA4BE', marginBottom: 2 }}>Total Lessons</div>
                      <div style={{ color: '#39FF14', fontWeight: 600 }}>
                        {goal.curriculum.totalLessons}
                      </div>
                    </div>
                    <div style={{
                      padding: '10px 14px', background: 'rgba(212,175,55,0.08)',
                      borderRadius: 8, fontSize: 13,
                    }}>
                      <div style={{ color: '#8BA4BE', marginBottom: 2 }}>Est. Hours</div>
                      <div style={{ color: '#D4AF37', fontWeight: 600 }}>
                        {goal.curriculum.totalEstimatedHours}h
                      </div>
                    </div>
                    <div style={{
                      padding: '10px 14px', background: 'rgba(168,85,247,0.08)',
                      borderRadius: 8, fontSize: 13,
                    }}>
                      <div style={{ color: '#8BA4BE', marginBottom: 2 }}>Weekly Target</div>
                      <div style={{ color: '#A855F7', fontWeight: 600 }}>
                        {goal.weeklyTargetLessons} lessons/week
                      </div>
                    </div>
                  </div>
                  <div style={{
                    marginTop: 12, padding: '10px 14px',
                    background: 'rgba(255,255,255,0.03)', borderRadius: 8,
                    fontSize: 12, color: '#8BA4BE', lineHeight: 1.5,
                  }}>
                    Your study habit and goal will be created automatically.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <button
                    onClick={() => { setCreatedGoalId(null); setStep(4); }}
                    style={{
                      padding: '12px 24px', borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'transparent', color: '#8BA4BE',
                      fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleActivate}
                    style={{
                      padding: '12px 32px', borderRadius: 10, border: 'none',
                      background: 'linear-gradient(135deg, #00D4FF, #0088CC)',
                      color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Activate Plan
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons (steps 1-4) */}
        {step < 5 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: 32,
          }}>
            <button
              onClick={step === 1 ? onClose : handleBack}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 20px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: '#8BA4BE',
                fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}
            >
              <ArrowLeft size={16} /> {step === 1 ? 'Cancel' : 'Back'}
            </button>
            <button
              onClick={step === 4 ? handleGenerate : handleNext}
              disabled={!canProceed()}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 24px', borderRadius: 10, border: 'none',
                background: canProceed() ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
                color: canProceed() ? '#00D4FF' : '#5A7A9A',
                fontSize: 14, fontWeight: 600, cursor: canProceed() ? 'pointer' : 'default',
              }}
            >
              {step === 4 ? 'Generate Plan' : 'Next'} <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
