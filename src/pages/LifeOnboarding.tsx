/**
 * Life Foundation Onboarding — Phase 1 (Immersive Dialogue with The Sage)
 *
 * Full-page RPG-styled conversation that gathers values, goals, purpose,
 * habits, and life priorities. The foundational phase — all other phases
 * build upon the context gathered here.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/useUserStore';
import { PHASES } from '../lib/onboarding-phases';
import { SetupDialogue } from '../components/setup/SetupDialogue';
import { materializeFoundation } from '../lib/materialize';
import { logger } from '../utils/logger';

const phase = PHASES.life;

export function LifeOnboarding() {
  const user = useUserStore(s => s.user);
  const navigate = useNavigate();
  const [savedData, setSavedData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore saved progress
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase.from('user_profiles').select('preferences').eq('user_id', user.id).single()
      .then(({ data: profile }) => {
        const prefs = profile?.preferences as any;
        if (prefs?.ai_chat_data) {
          setSavedData(prefs.ai_chat_data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  const handleComplete = async (data: Record<string, any>) => {
    if (!user) return;
    try {
      // Deterministic materialisation — goals, tasks, habits from life data
      logger.log('[LifeOnboarding] Materialising life foundation data...');
      const result = await materializeFoundation(user.id, data, { cleanFirst: true });
      logger.log('[LifeOnboarding] Result:', result);

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

  return (
    <SetupDialogue
      phase={phase}
      onComplete={handleComplete}
      initialData={savedData || undefined}
    />
  );
}
