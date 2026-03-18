// ═══════════════════════════════════════════════════════════
// AI WORKOUT GENERATOR — LifeOS
// Full AI-powered workout generation with quick presets,
// start workout, and save-as-template functionality
// ═══════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import {
  Sparkles, Target, Clock, Calendar, Dumbbell, Flame, Heart,
  Wind, Zap, Check, Loader2, X, Play, Save, Timer,
  ChevronDown, ChevronUp, AlertTriangle, RotateCcw,
} from 'lucide-react';
import { logger } from '../utils/logger';
import {
  generateAIWorkout, generateFallbackWorkout,
  QUICK_PRESETS,
  type WorkoutRequest, type GeneratedWorkout, type GeneratedExercise, type QuickWorkoutPreset,
} from '../lib/llm/workout-ai';

// ═══ Constants ═══

const GOALS = [
  { id: 'lose_weight', label: 'Lose Weight', icon: <Flame size={16} />, color: '#F43F5E' },
  { id: 'build_muscle', label: 'Build Muscle', icon: <Dumbbell size={16} />, color: '#39FF14' },
  { id: 'stay_fit', label: 'Stay Fit', icon: <Heart size={16} />, color: '#00D4FF' },
  { id: 'flexibility', label: 'Flexibility', icon: <Wind size={16} />, color: '#74B9FF' },
  { id: 'endurance', label: 'Endurance', icon: <Zap size={16} />, color: '#FDCB6E' },
];

const TYPES = [
  { id: 'cardio', label: 'Cardio' },
  { id: 'strength', label: 'Strength' },
  { id: 'hiit', label: 'HIIT' },
  { id: 'mixed', label: 'Mixed' },
  { id: 'flexibility', label: 'Flexibility' },
];

const EQUIPMENT_OPTIONS = [
  { id: 'none', label: 'Bodyweight' },
  { id: 'dumbbells', label: 'Dumbbells' },
  { id: 'barbell', label: 'Barbell' },
  { id: 'kettlebell', label: 'Kettlebell' },
  { id: 'pull-up bar', label: 'Pull-up Bar' },
  { id: 'machine', label: 'Machines' },
  { id: 'resistance bands', label: 'Bands' },
  { id: 'mat', label: 'Mat' },
];

const FITNESS_LEVELS = [
  { id: 'beginner', label: 'Beginner', desc: 'Just starting out' },
  { id: 'intermediate', label: 'Intermediate', desc: 'Regular exerciser' },
  { id: 'advanced', label: 'Advanced', desc: 'Experienced lifter' },
];

const MUSCLE_GROUP_COLORS: Record<string, string> = {
  chest: '#F97316', back: '#00D4FF', legs: '#39FF14', arms: '#FACC15',
  shoulders: '#A855F7', core: '#F43F5E', cardio: '#38BDF8', full_body: '#818CF8',
};

// ═══ Component ═══

interface WorkoutGeneratorProps {
  onSaveTemplates: (templates: any[], workout?: GeneratedWorkout) => Promise<void>;
  onStartWorkout?: (workout: GeneratedWorkout) => void;
  onClose: () => void;
}

export function WorkoutGenerator({ onSaveTemplates, onStartWorkout, onClose }: WorkoutGeneratorProps) {
  const [step, setStep] = useState<'quick' | 'prefs' | 'generating' | 'preview'>('quick');
  const [prefs, setPrefs] = useState<WorkoutRequest>({
    goal: 'stay_fit',
    workoutType: 'mixed',
    durationMin: 45,
    equipment: ['none'],
    fitnessLevel: 'intermediate',
  });
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);

  const handleGenerate = useCallback(async () => {
    setStep('generating');
    setError(null);
    try {
      const workout = await generateAIWorkout(prefs);
      setGeneratedWorkout(workout);
      setStep('preview');
    } catch (err: any) {
      logger.error('[WorkoutGenerator] AI generation failed, using fallback:', err);
      // Fall back to local generation
      try {
        const fallback = generateFallbackWorkout(prefs);
        setGeneratedWorkout(fallback);
        setStep('preview');
        setError('AI unavailable — generated locally');
      } catch {
        setError('Failed to generate workout. Please try again.');
        setStep('prefs');
      }
    }
  }, [prefs]);

  const handleQuickPreset = (preset: QuickWorkoutPreset) => {
    const workout: GeneratedWorkout = {
      name: preset.name,
      description: preset.description,
      workout_type: preset.id.includes('hiit') ? 'hiit' : preset.id.includes('strength') ? 'strength' : 'mixed',
      estimated_duration_min: preset.durationMin,
      color: preset.color,
      icon: preset.icon,
      exercises: preset.exercises,
      difficulty: 'intermediate',
      muscle_groups_targeted: [...new Set(preset.exercises.map(e => e.muscle_group))],
    };
    setGeneratedWorkout(workout);
    setStep('preview');
  };

  const handleSaveAsTemplate = async () => {
    if (!generatedWorkout) return;
    setSaving(true);
    try {
      await onSaveTemplates([{
        name: generatedWorkout.name,
        description: generatedWorkout.description,
        color: generatedWorkout.color,
        icon: generatedWorkout.icon,
        workout_type: generatedWorkout.workout_type,
        estimated_duration_min: generatedWorkout.estimated_duration_min,
        day_of_week: [],
        preferred_time: '06:00',
        is_active: true,
        exercises: generatedWorkout.exercises.map(ex => ({
          name: ex.name,
          muscle_group: ex.muscle_group,
          sets: ex.sets,
          reps: ex.reps,
          weight_kg: ex.weight_kg,
          duration_min: ex.duration_min,
          rest_seconds: ex.rest_seconds,
          equipment: ex.equipment,
          sort_order: ex.sort_order,
        })),
      }], generatedWorkout);
    } finally {
      setSaving(false);
    }
  };

  const handleStartWorkout = () => {
    if (!generatedWorkout || !onStartWorkout) return;
    onStartWorkout(generatedWorkout);
  };

  const toggleEquipment = (id: string) => {
    setPrefs(p => {
      const has = p.equipment.includes(id);
      if (id === 'none') return { ...p, equipment: ['none'] };
      const newEquip = has
        ? p.equipment.filter(e => e !== id)
        : [...p.equipment.filter(e => e !== 'none'), id];
      return { ...p, equipment: newEquip.length === 0 ? ['none'] : newEquip };
    });
  };

  const totalWorkoutTime = (exercises: GeneratedExercise[]) => {
    return exercises.reduce((total, ex) => {
      const setTime = ex.duration_min
        ? ex.duration_min * ex.sets
        : (ex.reps * 3 / 60) * ex.sets; // ~3sec per rep
      const restTime = (ex.rest_seconds * (ex.sets - 1)) / 60;
      return total + setTime + restTime;
    }, 0);
  };

  return (
    <div className="wg-container">
      <div className="wg-header">
        <div className="wg-header-info">
          <Sparkles size={18} className="wg-sparkle" />
          <h3>AI Workout Generator</h3>
        </div>
        <button className="eo-btn close" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>

      {/* Tab Switch */}
      <div className="wg-tabs">
        <button className={`wg-tab ${step === 'quick' ? 'active' : ''}`} onClick={() => setStep('quick')}>
          <Timer size={13} /> Quick Start
        </button>
        <button className={`wg-tab ${step === 'prefs' || step === 'generating' ? 'active' : ''}`} onClick={() => setStep('prefs')}>
          <Sparkles size={13} /> AI Custom
        </button>
        {generatedWorkout && (
          <button className={`wg-tab ${step === 'preview' ? 'active' : ''}`} onClick={() => setStep('preview')}>
            <Target size={13} /> Workout
          </button>
        )}
      </div>

      {/* ═══ Quick Start Presets ═══ */}
      {step === 'quick' && (
        <div className="wg-quick">
          <p className="wg-preview-info">Pick a duration — instant workout, no setup needed.</p>
          <div className="wg-quick-grid">
            {QUICK_PRESETS.map(preset => (
              <button
                key={preset.id}
                className="wg-quick-card"
                style={{ '--qc-color': preset.color } as any}
                onClick={() => handleQuickPreset(preset)}
              >
                <div className="wg-quick-top">
                  <span className="wg-quick-icon">{preset.icon}</span>
                  <span className="wg-quick-duration">{preset.durationMin}min</span>
                </div>
                <h4>{preset.name}</h4>
                <p>{preset.description}</p>
                <div className="wg-quick-muscles">
                  {[...new Set(preset.exercises.map(e => e.muscle_group))].slice(0, 4).map(mg => (
                    <span key={mg} className="wg-muscle-badge" style={{ '--mg-color': MUSCLE_GROUP_COLORS[mg] || '#64748B' } as any}>
                      {mg}
                    </span>
                  ))}
                </div>
                <div className="wg-quick-count">
                  <Dumbbell size={11} /> {preset.exercises.length} exercises
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ AI Custom Preferences ═══ */}
      {step === 'prefs' && (
        <div className="wg-prefs">
          {/* Goal */}
          <div className="wg-section">
            <label className="wg-label">What's your goal?</label>
            <div className="wg-goal-grid">
              {GOALS.map(g => (
                <button key={g.id}
                  className={`wg-goal-btn ${prefs.goal === g.id ? 'active' : ''}`}
                  onClick={() => setPrefs(p => ({ ...p, goal: g.id }))}
                  style={{ '--goal-color': g.color } as any}
                >
                  {g.icon}
                  <span>{g.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Type */}
          <div className="wg-section">
            <label className="wg-label">Workout type</label>
            <div className="wg-type-pills">
              {TYPES.map(t => (
                <button key={t.id}
                  className={`wg-type-pill ${prefs.workoutType === t.id ? 'active' : ''}`}
                  onClick={() => setPrefs(p => ({ ...p, workoutType: t.id }))}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fitness Level */}
          <div className="wg-section">
            <label className="wg-label">Fitness level</label>
            <div className="wg-level-pills">
              {FITNESS_LEVELS.map(lvl => (
                <button key={lvl.id}
                  className={`wg-level-pill ${prefs.fitnessLevel === lvl.id ? 'active' : ''}`}
                  onClick={() => setPrefs(p => ({ ...p, fitnessLevel: lvl.id }))}
                >
                  <span className="wg-level-name">{lvl.label}</span>
                  <span className="wg-level-desc">{lvl.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="wg-section">
            <label className="wg-label"><Clock size={13} /> Duration</label>
            <div className="wg-freq-pills">
              {[15, 30, 45, 60, 90].map(d => (
                <button key={d}
                  className={`wg-freq-pill ${prefs.durationMin === d ? 'active' : ''}`}
                  onClick={() => setPrefs(p => ({ ...p, durationMin: d }))}
                >
                  {d}min
                </button>
              ))}
            </div>
          </div>

          {/* Equipment */}
          <div className="wg-section">
            <label className="wg-label"><Dumbbell size={13} /> Available equipment</label>
            <div className="wg-equip-pills">
              {EQUIPMENT_OPTIONS.map(eq => (
                <button key={eq.id}
                  className={`wg-equip-pill ${prefs.equipment.includes(eq.id) ? 'active' : ''}`}
                  onClick={() => toggleEquipment(eq.id)}
                >
                  {eq.label}
                </button>
              ))}
            </div>
          </div>

          <button className="wg-generate-btn" onClick={handleGenerate}>
            <Sparkles size={16} /> Generate AI Workout
          </button>
          <p className="wg-ai-note">
            Uses AI to create a personalized workout based on your preferences, recent history, and recovery needs.
          </p>
        </div>
      )}

      {/* ═══ Generating State ═══ */}
      {step === 'generating' && (
        <div className="wg-generating">
          <div className="wg-gen-spinner">
            <Loader2 size={32} className="spin" />
          </div>
          <h4>Building your workout...</h4>
          <p>Analyzing your history and creating a personalized plan</p>
          <div className="wg-gen-steps">
            <span className="wg-gen-step done"><Check size={12} /> Checking recent workouts</span>
            <span className="wg-gen-step done"><Check size={12} /> Analyzing muscle recovery</span>
            <span className="wg-gen-step active"><Loader2 size={12} className="spin" /> Generating exercises</span>
          </div>
        </div>
      )}

      {/* ═══ Workout Preview ═══ */}
      {step === 'preview' && generatedWorkout && (
        <div className="wg-preview">
          {error && (
            <div className="wg-error-banner">
              <AlertTriangle size={13} />
              <span>{error}</span>
            </div>
          )}

          {/* Workout Header */}
          <div className="wg-workout-header" style={{ '--wk-color': generatedWorkout.color } as any}>
            <span className="wg-workout-icon">{generatedWorkout.icon}</span>
            <div className="wg-workout-title">
              <h4>{generatedWorkout.name}</h4>
              <p>{generatedWorkout.description}</p>
            </div>
          </div>

          {/* Meta badges */}
          <div className="wg-workout-meta">
            <span className="wg-meta-badge"><Clock size={12} /> {generatedWorkout.estimated_duration_min}min</span>
            <span className="wg-meta-badge"><Target size={12} /> {generatedWorkout.exercises.length} exercises</span>
            <span className="wg-meta-badge"><Zap size={12} /> {generatedWorkout.difficulty}</span>
            <span className="wg-meta-badge">~{Math.round(totalWorkoutTime(generatedWorkout.exercises))}min active</span>
          </div>

          {/* Muscle groups targeted */}
          <div className="wg-targeted-muscles">
            {(generatedWorkout.muscle_groups_targeted || [...new Set(generatedWorkout.exercises.map(e => e.muscle_group))]).map(mg => (
              <span key={mg} className="wg-muscle-badge" style={{ '--mg-color': MUSCLE_GROUP_COLORS[mg] || '#64748B' } as any}>
                {mg}
              </span>
            ))}
          </div>

          {/* Warmup */}
          {generatedWorkout.warmup && (
            <div className="wg-warmup-note">
              <span className="wg-wn-label">🔥 Warmup</span>
              <span>{generatedWorkout.warmup}</span>
            </div>
          )}

          {/* Exercises */}
          <div className="wg-exercise-list">
            {generatedWorkout.exercises.map((ex, i) => (
              <div
                key={i}
                className={`wg-exercise-card ${expandedExercise === i ? 'expanded' : ''}`}
                style={{ '--ex-color': MUSCLE_GROUP_COLORS[ex.muscle_group] || '#64748B' } as any}
                onClick={() => setExpandedExercise(expandedExercise === i ? null : i)}
              >
                <div className="wg-ex-main">
                  <span className="wg-ex-num">{i + 1}</span>
                  <div className="wg-ex-info">
                    <span className="wg-ex-name">{ex.name}</span>
                    <span className="wg-ex-muscle">{ex.muscle_group}</span>
                  </div>
                  <div className="wg-ex-badges">
                    <span className="wg-ex-badge sets">{ex.sets}×{ex.duration_min ? `${ex.duration_min}min` : `${ex.reps}`}</span>
                    {ex.weight_kg && <span className="wg-ex-badge weight">{ex.weight_kg}kg</span>}
                    <span className="wg-ex-badge rest">{ex.rest_seconds}s rest</span>
                  </div>
                  {ex.notes && (
                    expandedExercise === i ? <ChevronUp size={14} className="wg-ex-chevron" /> : <ChevronDown size={14} className="wg-ex-chevron" />
                  )}
                </div>
                {expandedExercise === i && (
                  <div className="wg-ex-details">
                    {ex.equipment && ex.equipment !== 'none' && (
                      <span className="wg-ex-detail"><Dumbbell size={11} /> {ex.equipment}</span>
                    )}
                    {ex.notes && <span className="wg-ex-detail wg-ex-note">💡 {ex.notes}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Cooldown */}
          {generatedWorkout.cooldown && (
            <div className="wg-cooldown-note">
              <span className="wg-wn-label">❄️ Cooldown</span>
              <span>{generatedWorkout.cooldown}</span>
            </div>
          )}

          {/* Actions */}
          <div className="wg-preview-actions">
            <button className="wg-action-btn secondary" onClick={() => setStep('prefs')}>
              <RotateCcw size={14} /> Regenerate
            </button>
            <button className="wg-action-btn secondary" onClick={handleSaveAsTemplate} disabled={saving}>
              {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
              Save Template
            </button>
            {onStartWorkout && (
              <button className="wg-action-btn primary" onClick={handleStartWorkout}>
                <Play size={14} /> Start Workout
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
