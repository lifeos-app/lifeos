/**
 * Life Foundation Onboarding — Phase 1 (Immersive Dialogue with The Sage)
 *
 * Full-page RPG-styled conversation that gathers values, goals, purpose,
 * habits, and life priorities. The foundational phase — all other phases
 * build upon the context gathered here.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/data-access';
import { useUserStore } from '../stores/useUserStore';
import { PHASES } from '../lib/onboarding-phases';
import { SetupDialogue } from '../components/setup/SetupDialogue';
import { materializeFoundation } from '../lib/materialize';
import { logger } from '../utils/logger';

const phase = PHASES.life;

type MaterializePhase = 'idle' | 'cleaning' | 'building-goals' | 'building-tasks' | 'building-habits' | 'complete' | 'error';

const PHASE_LABELS: Record<MaterializePhase, string> = {
  idle: '',
  cleaning: 'Clearing previous data...',
  'building-goals': 'Creating your goals and milestones...',
  'building-tasks': 'Generating tasks and schedule...',
  'building-habits': 'Setting up daily habits...',
  complete: 'Your life system is ready',
  error: 'Something went wrong — redirecting',
};

export function LifeOnboarding() {
  const user = useUserStore(s => s.user);
  const navigate = useNavigate();
  const [savedData, setSavedData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [materializing, setMaterializing] = useState(false);
  const [matPhase, setMatPhase] = useState<MaterializePhase>('idle');

  // Restore saved progress
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase.from('user_profiles').select('preferences').eq('user_id', user.id).single()
      .then(({ data: profile }) => {
        const prefs = profile?.preferences as Record<string, unknown>;
        if (prefs?.ai_chat_data) {
          setSavedData(prefs.ai_chat_data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  const handleComplete = async (data: Record<string, any>) => {
    if (!user) return;
    setMaterializing(true);
    setMatPhase('cleaning');
    try {
      // Deterministic materialisation — goals, tasks, habits from life data
      logger.log('[LifeOnboarding] Materialising life foundation data...');

      setMatPhase('building-goals');
      const result = await materializeFoundation(user.id, data, { cleanFirst: true });
      logger.log('[LifeOnboarding] Result:', result);

      setMatPhase('building-tasks');
      // Small delay so the user sees the phase transition
      await new Promise(r => setTimeout(r, 300));

      setMatPhase('building-habits');
      await new Promise(r => setTimeout(r, 200));

      setMatPhase('complete');
      await new Promise(r => setTimeout(r, 500));

      // Save completion
      const { data: currentProfile } = await supabase
        .from('user_profiles').select('preferences').eq('user_id', user.id).single();
      const prefs = (currentProfile?.preferences || {}) as Record<string, any>;

      await supabase.from('user_profiles').upsert({
        user_id: user.id,
        display_name: data.name || prefs.display_name || undefined,
        preferences: {
          ...prefs,
          ai_chat_data: data,
          onboarding_percent: 100,
          name: data.name || prefs.name,
          core_values: data.coreValues || prefs.core_values,
          strengths: data.strengths || prefs.strengths,
          purpose: data.purpose || prefs.purpose,
          focus_areas: data.focusAreas || prefs.focus_areas,
          good_habits: data.goodHabits || prefs.good_habits,
          morning_routine: data.morningRoutine || prefs.morning_routine,
          evening_routine: data.eveningRoutine || prefs.evening_routine,
        },
      }, { onConflict: 'user_id' });

      navigate('/');
    } catch (err) {
      logger.error('Life onboarding finalize error:', err);
      setMatPhase('error');
      await new Promise(r => setTimeout(r, 1500));
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div style={{
        height: '100dvh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#050E1A',
      }}>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  // Materialization progress screen
  if (materializing && matPhase !== 'idle') {
    const label = PHASE_LABELS[matPhase];
    const phases: MaterializePhase[] = ['cleaning', 'building-goals', 'building-tasks', 'building-habits', 'complete'];
    const currentIdx = phases.indexOf(matPhase);
    const progress = matPhase === 'complete' ? 100 : matPhase === 'error' ? 100 : Math.round(((currentIdx + 0.5) / phases.length) * 100);

    return (
      <div style={{
        height: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: '#050E1A',
        gap: 24,
      }}>
        <div style={{ color: '#00D4FF', fontSize: 16, fontWeight: 600 }}>
          {label}
        </div>
        <div style={{
          width: 240, height: 6, borderRadius: 3,
          background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 3,
            background: 'linear-gradient(90deg, #00D4FF, #7C5CFC)',
            width: `${progress}%`,
            transition: 'width 0.4s ease',
          }} />
        </div>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
          {progress}%
        </div>
      </div>
    );
  }

  return (
    <SetupDialogue
      phase={phase}
      onComplete={handleComplete}
      initialData={savedData || undefined}
    />
  );
}
