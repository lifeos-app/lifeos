/**
 * Generic Phase Form — step-by-step manual form for any onboarding phase.
 * Alternative to AI chat for users who prefer filling out forms directly.
 */
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Rocket, Loader2, X, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/useUserStore';
import { type PhaseConfig, calculatePhaseCoverage } from '../lib/onboarding-phases';
import { logger } from '../utils/logger';

interface PhaseFormProps {
  phase: PhaseConfig;
  onComplete: (data: Record<string, any>) => void;
  onBack: () => void;
  onSkip: () => void;
  initialData?: Record<string, any>;
}

// ─── Health Form Steps ──────────────────────────────────────

const HEALTH_STEPS = [
  { key: 'fitness', title: 'Fitness Level', hint: 'Where are you at with your fitness?' },
  { key: 'exercise', title: 'Exercise', hint: 'What activities do you do or want to do?' },
  { key: 'nutrition', title: 'Nutrition', hint: 'Tell us about your diet and eating habits.' },
  { key: 'body', title: 'Body Goals', hint: 'What physical changes are you working toward?' },
  { key: 'sleep', title: 'Sleep', hint: 'How\'s your sleep?' },
  { key: 'mental', title: 'Mental Health', hint: 'Stress, meditation, and mental wellness.' },
  { key: 'review', title: 'Review', hint: 'Here\'s what we\'ve gathered.' },
];

const FITNESS_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const EXERCISE_OPTIONS = [
  'Running', 'Walking', 'Weight Training', 'HIIT', 'Yoga', 'Pilates',
  'Swimming', 'Cycling', 'Boxing', 'CrossFit', 'Calisthenics', 'Dance',
  'Hiking', 'P90X', 'Home Workout',
];
const DIET_TYPES = ['No restrictions', 'Vegetarian', 'Vegan', 'Pescatarian', 'Keto', 'Paleo', 'Flexitarian', 'Other'];
const STRESS_LEVELS = ['Low', 'Moderate', 'High'];

// ─── Finance Form Steps ──────────────────────────────────────

const FINANCE_STEPS = [
  { key: 'income', title: 'Income', hint: 'What do you do for work?' },
  { key: 'expenses', title: 'Expenses', hint: 'Your regular outgoings.' },
  { key: 'savings', title: 'Savings & Debt', hint: 'Where are you financially?' },
  { key: 'goals', title: 'Financial Goals', hint: 'What are you working toward?' },
  { key: 'business', title: 'Business & Tax', hint: 'If you run a business or side hustle.' },
  { key: 'review', title: 'Review', hint: 'Here\'s your financial snapshot.' },
];

const EMPLOYMENT_TYPES = ['Employed', 'Self-employed', 'Business owner', 'Freelance', 'Student', 'Multiple'];
const DEBT_TYPES = ['Mortgage', 'Car loan', 'Credit card', 'HECS/Student loan', 'Personal loan', 'None'];

export function PhaseForm({ phase, onComplete, onBack, onSkip, initialData }: PhaseFormProps) {
  const user = useUserStore(s => s.user);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<Record<string, any>>(() => {
    const empty = phase.emptyData();
    if (initialData) return phase.mergeData(empty, initialData);
    return empty;
  });

  const steps = phase.id === 'health' ? HEALTH_STEPS : FINANCE_STEPS;
  const totalSteps = steps.length;

  const update = (updates: Record<string, any>) => setData(prev => ({ ...prev, ...updates }));

  const toggleInArray = (key: string, value: string, max?: number) => {
    const arr = data[key] || [];
    if (arr.includes(value)) {
      update({ [key]: arr.filter((v: string) => v !== value) });
    } else if (!max || arr.length < max) {
      update({ [key]: [...arr, value] });
    }
  };

  const saveProgress = async () => {
    if (!user?.id) return;
    try {
      const { data: currentProfile } = await supabase
        .from('user_profiles').select('preferences').eq('user_id', user.id).single();
      const prefs = (currentProfile?.preferences || {}) as Record<string, any>;
      const { percent } = calculatePhaseCoverage(phase.id, data);

      await supabase.from('user_profiles').upsert({
        user_id: user.id,
        preferences: {
          ...prefs,
          [phase.prefsKey]: data,
          [phase.percentKey]: percent,
          [`${phase.id}_onboarding_method`]: 'form',
        },
      }, { onConflict: 'user_id' });
    } catch (err) {
      logger.error('Save progress error:', err);
    }
  };

  const goNext = async () => {
    await saveProgress();
    setStep(s => Math.min(totalSteps - 1, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBackStep = () => {
    if (step === 0) { onBack(); return; }
    setStep(s => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFinalize = async () => {
    setSaving(true);
    await saveProgress();
    onComplete(data);
  };

  // ─── Shared Styles ────────────────────────────────────────
  const s = {
    page: { maxWidth: 720, margin: '0 auto', padding: '24px 16px', color: '#fff' } as const,
    header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 } as const,
    title: { fontSize: 22, fontWeight: 700, margin: '0 0 8px', background: 'linear-gradient(135deg, #fff 30%, ' + phase.color + ')', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } as const,
    hint: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 24 } as const,
    card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 24, marginBottom: 16 } as const,
    label: { fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 8, display: 'block' } as const,
    input: { width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 14, fontFamily: 'inherit', outline: 'none' } as const,
    textarea: { width: '100%', minHeight: 80, padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical' as const } as const,
    pill: (selected: boolean) => ({
      padding: '10px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 500,
      border: `1px solid ${selected ? phase.color + '60' : 'rgba(255,255,255,0.1)'}`,
      background: selected ? phase.color + '15' : 'rgba(255,255,255,0.04)',
      color: selected ? phase.color : 'rgba(255,255,255,0.7)',
      transition: 'all 0.15s ease', fontFamily: 'inherit',
    }) as const,
    pillGrid: { display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginBottom: 16 },
    footer: { display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)' } as const,
    btnPrimary: { padding: '10px 24px', borderRadius: 10, border: 'none', background: phase.color, color: '#000', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' } as const,
    btnSecondary: { padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' } as const,
    progressBar: { height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' as const, marginBottom: 24 },
  };

  // ─── Health Step Renderers ─────────────────────────────────
  const renderHealthStep = () => {
    const currentStep = steps[step];
    switch (currentStep.key) {
      case 'fitness':
        return (
          <div>
            <label style={s.label}>Fitness Level</label>
            <div style={s.pillGrid}>
              {FITNESS_LEVELS.map(level => (
                <button key={level} style={s.pill(data.fitnessLevel === level.toLowerCase())} onClick={() => update({ fitnessLevel: level.toLowerCase() })}>
                  {level}
                </button>
              ))}
            </div>
            <label style={{ ...s.label, marginTop: 20 }}>Fitness Goals</label>
            <div style={s.pillGrid}>
              {['Fat loss', 'Build muscle', 'Improve endurance', 'Increase flexibility', 'Maintain strength', 'Better energy', 'Aesthetics', 'Functional fitness'].map(goal => (
                <button key={goal} style={s.pill((data.fitnessGoals || []).includes(goal))} onClick={() => toggleInArray('fitnessGoals', goal, 5)}>
                  {goal}
                </button>
              ))}
            </div>
          </div>
        );
      case 'exercise':
        return (
          <div>
            <label style={s.label}>Exercise Types (pick all that apply)</label>
            <div style={s.pillGrid}>
              {EXERCISE_OPTIONS.map(type => (
                <button key={type} style={s.pill((data.exerciseTypes || []).includes(type))} onClick={() => toggleInArray('exerciseTypes', type)}>
                  {type}
                </button>
              ))}
            </div>
            <label style={{ ...s.label, marginTop: 20 }}>How often do you exercise?</label>
            <input style={s.input} placeholder="e.g. 3x/week, almost every day" value={data.exerciseFrequency || ''} onChange={e => update({ exerciseFrequency: e.target.value })} />
            <label style={{ ...s.label, marginTop: 20 }}>Any injuries or limitations?</label>
            <input style={s.input} placeholder="e.g. bad knee, shoulder injury (leave blank if none)" value={(data.injuries || []).join(', ')} onChange={e => update({ injuries: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })} />
          </div>
        );
      case 'nutrition':
        return (
          <div>
            <label style={s.label}>Diet Type</label>
            <div style={s.pillGrid}>
              {DIET_TYPES.map(diet => (
                <button key={diet} style={s.pill(data.dietType === diet.toLowerCase())} onClick={() => update({ dietType: diet.toLowerCase() })}>
                  {diet}
                </button>
              ))}
            </div>
            <label style={{ ...s.label, marginTop: 20 }}>Nutrition Goals</label>
            <div style={s.pillGrid}>
              {['Enough protein', 'More vitamins', 'Better energy', 'Weight management', 'Reduce sugar', 'Meal prep consistency', 'More whole foods'].map(goal => (
                <button key={goal} style={s.pill((data.dietGoals || []).includes(goal))} onClick={() => toggleInArray('dietGoals', goal, 5)}>
                  {goal}
                </button>
              ))}
            </div>
            <label style={{ ...s.label, marginTop: 20 }}>Daily Water Intake</label>
            <input style={s.input} placeholder="e.g. 2L, 8 glasses" value={data.waterIntake || ''} onChange={e => update({ waterIntake: e.target.value })} />
            <label style={{ ...s.label, marginTop: 20 }}>Any allergies?</label>
            <input style={s.input} placeholder="e.g. nuts, dairy (leave blank if none)" value={(data.allergies || []).join(', ')} onChange={e => update({ allergies: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })} />
            <label style={{ ...s.label, marginTop: 20 }}>How do you usually eat? (meal prep, cook, eat out?)</label>
            <input style={s.input} placeholder="e.g. Cook at home, meal prep on Sundays" value={data.mealPrep || ''} onChange={e => update({ mealPrep: e.target.value })} />
            <label style={{ ...s.label, marginTop: 20 }}>Any supplements?</label>
            <input style={s.input} placeholder="e.g. B12, Iron, Protein powder" value={(data.supplements || []).join(', ')} onChange={e => update({ supplements: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })} />
          </div>
        );
      case 'body':
        return (
          <div>
            <label style={s.label}>Body Goals</label>
            <div style={s.pillGrid}>
              {['Fat loss', 'Muscle gain', 'Aesthetics', 'Functional strength', 'Maintain current', 'Flexibility', 'Posture improvement'].map(goal => (
                <button key={goal} style={s.pill((data.bodyGoals || []).includes(goal))} onClick={() => toggleInArray('bodyGoals', goal, 4)}>
                  {goal}
                </button>
              ))}
            </div>
            <label style={{ ...s.label, marginTop: 20 }}>Current Weight (optional)</label>
            <input style={s.input} placeholder="e.g. 80kg" value={data.currentWeight || ''} onChange={e => update({ currentWeight: e.target.value })} />
            <label style={{ ...s.label, marginTop: 20 }}>Target Weight (optional)</label>
            <input style={s.input} placeholder="e.g. 75kg" value={data.targetWeight || ''} onChange={e => update({ targetWeight: e.target.value })} />
          </div>
        );
      case 'sleep':
        return (
          <div>
            <label style={s.label}>Average Sleep Per Night</label>
            <input style={s.input} placeholder="e.g. 7 hours" value={data.sleepHours || ''} onChange={e => update({ sleepHours: e.target.value })} />
            <label style={{ ...s.label, marginTop: 20 }}>Usual Bedtime</label>
            <input style={s.input} placeholder="e.g. 11pm, varies" value={data.bedtime || ''} onChange={e => update({ bedtime: e.target.value })} />
            <label style={{ ...s.label, marginTop: 20 }}>Usual Wake Time</label>
            <input style={s.input} placeholder="e.g. 6am, varies" value={data.wakeTime || ''} onChange={e => update({ wakeTime: e.target.value })} />
            <label style={{ ...s.label, marginTop: 20 }}>Any Sleep Issues?</label>
            <div style={s.pillGrid}>
              {['Trouble falling asleep', 'Wake up during night', 'Fragmented sleep', 'Irregular schedule', 'Too little sleep', 'Napping a lot', 'Sleep apnea'].map(issue => (
                <button key={issue} style={s.pill((data.sleepIssues || []).includes(issue))} onClick={() => toggleInArray('sleepIssues', issue)}>
                  {issue}
                </button>
              ))}
            </div>
          </div>
        );
      case 'mental':
        return (
          <div>
            <label style={s.label}>Stress Level</label>
            <div style={s.pillGrid}>
              {STRESS_LEVELS.map(level => (
                <button key={level} style={s.pill(data.stressLevel === level.toLowerCase())} onClick={() => update({ stressLevel: level.toLowerCase() })}>
                  {level}
                </button>
              ))}
            </div>
            <label style={{ ...s.label, marginTop: 20 }}>Stress Management Techniques</label>
            <div style={s.pillGrid}>
              {['Meditation', 'Exercise', 'Journaling', 'Prayer', 'Breathing exercises', 'Walks in nature', 'Talking to friends', 'Music'].map(tech => (
                <button key={tech} style={s.pill((data.stressManagement || []).includes(tech))} onClick={() => toggleInArray('stressManagement', tech)}>
                  {tech}
                </button>
              ))}
            </div>
            <label style={{ ...s.label, marginTop: 20 }}>Meditation Experience</label>
            <div style={s.pillGrid}>
              {[{ label: 'None', value: 'none' }, { label: 'Beginner', value: 'beginner' }, { label: 'Regular practice', value: 'regular' }].map(opt => (
                <button key={opt.value} style={s.pill(data.meditationExperience === opt.value)} onClick={() => update({ meditationExperience: opt.value })}>
                  {opt.label}
                </button>
              ))}
            </div>
            <label style={{ ...s.label, marginTop: 20 }}>Any health conditions to be aware of?</label>
            <input style={s.input} placeholder="e.g. asthma, diabetes (leave blank if none)" value={(data.healthConditions || []).join(', ')} onChange={e => update({ healthConditions: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })} />
          </div>
        );
      case 'review':
        return renderReview();
      default:
        return null;
    }
  };

  // ─── Finance Step Renderers ─────────────────────────────────
  const renderFinanceStep = () => {
    const currentStep = steps[step];
    switch (currentStep.key) {
      case 'income':
        return (
          <div>
            <label style={s.label}>Employment Type</label>
            <div style={s.pillGrid}>
              {EMPLOYMENT_TYPES.map(type => (
                <button key={type} style={s.pill(data.employmentType === type.toLowerCase())} onClick={() => update({ employmentType: type.toLowerCase() })}>
                  {type}
                </button>
              ))}
            </div>
            <label style={{ ...s.label, marginTop: 20 }}>Income Sources</label>
            <input style={s.input} placeholder="e.g. Salary, Cleaning business, Security shifts" value={(data.incomeSources || []).join(', ')} onChange={e => update({ incomeSources: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })} />
            <label style={{ ...s.label, marginTop: 20 }}>Monthly Income Range</label>
            <input style={s.input} placeholder="e.g. $5,000-6,000/month" value={data.incomeRange || ''} onChange={e => update({ incomeRange: e.target.value })} />
          </div>
        );
      case 'expenses':
        return (
          <div>
            <label style={s.label}>Regular Expenses</label>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>Add your main recurring expenses</p>
            {(data.fixedExpenses || []).map((exp: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input style={{ ...s.input, flex: 2 }} placeholder="Name (e.g. Rent)" value={exp.name || ''} onChange={e => {
                  const updated = [...(data.fixedExpenses || [])]; updated[idx] = { ...exp, name: e.target.value }; update({ fixedExpenses: updated });
                }} />
                <input style={{ ...s.input, flex: 1 }} placeholder="$" value={exp.amount || ''} onChange={e => {
                  const updated = [...(data.fixedExpenses || [])]; updated[idx] = { ...exp, amount: e.target.value }; update({ fixedExpenses: updated });
                }} />
                <select style={{ ...s.input, flex: 1, appearance: 'auto' as any }} value={exp.frequency || 'monthly'} onChange={e => {
                  const updated = [...(data.fixedExpenses || [])]; updated[idx] = { ...exp, frequency: e.target.value }; update({ fixedExpenses: updated });
                }}>
                  <option value="weekly">Weekly</option>
                  <option value="fortnightly">Fortnightly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <button onClick={() => update({ fixedExpenses: (data.fixedExpenses || []).filter((_: any, i: number) => i !== idx) })} style={{ background: 'rgba(255,68,68,0.1)', border: 'none', borderRadius: 8, color: '#f44', padding: '8px', cursor: 'pointer' }}>
                  <X size={14} />
                </button>
              </div>
            ))}
            <button onClick={() => update({ fixedExpenses: [...(data.fixedExpenses || []), { name: '', amount: '', frequency: 'monthly' }] })} style={{ ...s.btnSecondary, marginTop: 8 }}>
              <Plus size={14} /> Add expense
            </button>
          </div>
        );
      case 'savings':
        return (
          <div>
            <label style={s.label}>Savings Goals</label>
            <input style={s.input} placeholder="e.g. Emergency fund, House deposit, Travel" value={(data.savingsGoals || []).join(', ')} onChange={e => update({ savingsGoals: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })} />
            <label style={{ ...s.label, marginTop: 20 }}>Savings Rate</label>
            <input style={s.input} placeholder="e.g. 10% of income" value={data.savingsRate || ''} onChange={e => update({ savingsRate: e.target.value })} />
            <label style={{ ...s.label, marginTop: 20 }}>Debt Types</label>
            <div style={s.pillGrid}>
              {DEBT_TYPES.map(type => (
                <button key={type} style={s.pill((data.debtTypes || []).includes(type))} onClick={() => toggleInArray('debtTypes', type)}>
                  {type}
                </button>
              ))}
            </div>
            {(data.debtTypes || []).length > 0 && !(data.debtTypes || []).includes('None') && (
              <>
                <label style={{ ...s.label, marginTop: 20 }}>Approximate Total Debt</label>
                <input style={s.input} placeholder="e.g. $50,000" value={data.debtTotal || ''} onChange={e => update({ debtTotal: e.target.value })} />
              </>
            )}
            <label style={{ ...s.label, marginTop: 20 }}>Emergency Fund</label>
            <input style={s.input} placeholder="e.g. 3 months of expenses, none" value={data.emergencyFund || ''} onChange={e => update({ emergencyFund: e.target.value })} />
          </div>
        );
      case 'goals':
        return (
          <div>
            <label style={s.label}>Financial Goals (list your top goals)</label>
            <textarea style={s.textarea} placeholder="e.g.&#10;Pay off mortgage faster&#10;Build 6-month emergency fund&#10;Start investing&#10;Grow business revenue" value={(data.financialGoals || []).join('\n')} onChange={e => update({ financialGoals: e.target.value.split('\n').filter((l: string) => l.trim()) })} />
            <label style={{ ...s.label, marginTop: 20 }}>Financial Stress Level</label>
            <div style={s.pillGrid}>
              {STRESS_LEVELS.map(level => (
                <button key={level} style={s.pill(data.financialStress === level.toLowerCase())} onClick={() => update({ financialStress: level.toLowerCase() })}>
                  {level}
                </button>
              ))}
            </div>
            <label style={{ ...s.label, marginTop: 20 }}>Budgeting Method</label>
            <div style={s.pillGrid}>
              {['None yet', '50/30/20', 'Envelope method', 'Zero-based', 'Spreadsheet', 'App-based'].map(method => (
                <button key={method} style={s.pill(data.budgetingMethod === method.toLowerCase())} onClick={() => update({ budgetingMethod: method.toLowerCase() })}>
                  {method}
                </button>
              ))}
            </div>
          </div>
        );
      case 'business':
        return (
          <div>
            <label style={s.label}>Tax Situation</label>
            <div style={s.pillGrid}>
              {['PAYG', 'Sole trader', 'Company', 'Trust', 'Not sure'].map(tax => (
                <button key={tax} style={s.pill(data.taxSituation === tax.toLowerCase())} onClick={() => update({ taxSituation: tax.toLowerCase() })}>
                  {tax}
                </button>
              ))}
            </div>
            {(data.employmentType === 'self-employed' || data.employmentType === 'business owner') && (
              <>
                <label style={{ ...s.label, marginTop: 20 }}>Business Name</label>
                <input style={s.input} placeholder="Your business name" value={data.businessName || ''} onChange={e => update({ businessName: e.target.value })} />
                <label style={{ ...s.label, marginTop: 20 }}>Business Type</label>
                <input style={s.input} placeholder="e.g. Cleaning, Consulting, Tech" value={data.businessType || ''} onChange={e => update({ businessType: e.target.value })} />
                <label style={{ ...s.label, marginTop: 20 }}>Monthly Revenue Range</label>
                <input style={s.input} placeholder="e.g. $5,000-10,000/month" value={data.businessRevenue || ''} onChange={e => update({ businessRevenue: e.target.value })} />
              </>
            )}
          </div>
        );
      case 'review':
        return renderReview();
      default:
        return null;
    }
  };

  // ─── Review ────────────────────────────────────────────────
  const renderReview = () => {
    const { coverage, percent } = calculatePhaseCoverage(phase.id, data);
    const filledKeys = Object.entries(coverage).filter(([, v]) => v).map(([k]) => k);
    const missingKeys = Object.entries(coverage).filter(([, v]) => !v).map(([k]) => k);

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ width: `${percent}%`, height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${phase.color}, #00D4FF)`, transition: 'width 0.5s ease' }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: phase.color }}>{percent}%</span>
        </div>

        {filledKeys.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>✅ Covered:</p>
            <div style={s.pillGrid}>
              {filledKeys.map(k => {
                const field = phase.coverageFields.find(f => f.key === k);
                return <span key={k} style={{ ...s.pill(true), cursor: 'default' }}>{field?.icon} {field?.label}</span>;
              })}
            </div>
          </div>
        )}

        {missingKeys.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Missing (optional):</p>
            <div style={s.pillGrid}>
              {missingKeys.map(k => {
                const field = phase.coverageFields.find(f => f.key === k);
                return <span key={k} style={{ ...s.pill(false), cursor: 'default' }}>{field?.icon} {field?.label}</span>;
              })}
            </div>
          </div>
        )}

        <button onClick={handleFinalize} disabled={saving} style={{
          ...s.btnPrimary, width: '100%', justifyContent: 'center', padding: '16px 32px',
          fontSize: 16, marginTop: 24, background: `linear-gradient(135deg, ${phase.color}, #00D4FF)`,
        }}>
          {saving ? <><Loader2 size={18} className="spin" /> Building...</> : <><Rocket size={18} /> Build My {phase.title}</>}
        </button>
      </div>
    );
  };

  // ─── Main Render ───────────────────────────────────────────
  const currentStep = steps[step];

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <button onClick={goBackStep} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex', padding: 4 }}>
          <ArrowLeft size={18} />
        </button>
        <span style={{ fontSize: 16 }}>{phase.icon}</span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{phase.title}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          {step + 1} / {totalSteps}
        </span>
        <button onClick={onSkip} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: 'inherit' }}>
          Skip
        </button>
      </div>

      {/* Progress */}
      <div style={s.progressBar}>
        <div style={{ width: `${((step + 1) / totalSteps) * 100}%`, height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${phase.color}, #00D4FF)`, transition: 'width 0.3s ease' }} />
      </div>

      {/* Step Content */}
      <h2 style={s.title}>{currentStep.title}</h2>
      <p style={s.hint}>{currentStep.hint}</p>

      <div style={s.card}>
        {phase.id === 'health' ? renderHealthStep() : renderFinanceStep()}
      </div>

      {/* Footer */}
      {currentStep.key !== 'review' && (
        <div style={s.footer}>
          <button onClick={goBackStep} style={s.btnSecondary}>
            <ArrowLeft size={14} /> Back
          </button>
          <button onClick={goNext} style={s.btnPrimary}>
            Continue <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
