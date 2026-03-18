/**
 * Health Onboarding — Phase 2 (Immersive Dialogue with The Warrior)
 *
 * Full-page RPG-styled conversation that gathers health/fitness/nutrition/sleep data.
 * On finalize: creates workout templates, health habits, and initial metrics.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/useUserStore';
import { PHASES } from '../lib/onboarding-phases';
import { SetupDialogue } from '../components/setup/SetupDialogue';
import { materializeHealth } from '../lib/materialize';
import { logger } from '../utils/logger';

const phase = PHASES.health;

export function HealthOnboarding() {
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
        if (prefs?.health_onboarding_data) {
          setSavedData(prefs.health_onboarding_data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  const handleComplete = async (data: Record<string, any>) => {
    if (!user) return;
    try {
      // Deterministic materialisation — goals, tasks, habits, schedule events
      logger.log('[HealthOnboarding] Materialising health data...');
      const result = await materializeHealth(user.id, data, { cleanFirst: true });
      logger.log('[HealthOnboarding] Result:', result);

      // Save completion
      const { data: currentProfile } = await supabase
        .from('user_profiles').select('preferences').eq('user_id', user.id).single();
      const prefs = (currentProfile?.preferences || {}) as Record<string, any>;

      await supabase.from('user_profiles').upsert({
        user_id: user.id,
        preferences: {
          ...prefs,
          health_onboarding_data: data,
          health_onboarding_percent: 100,
          health_profile: {
            fitness_level: data.fitnessLevel,
            exercise_types: data.exerciseTypes,
            exercise_frequency: data.exerciseFrequency,
            diet_type: data.dietType,
            sleep_target: data.sleepHours,
            bedtime: data.bedtime,
            wake_time: data.wakeTime,
            stress_level: data.stressLevel,
            body_goals: data.bodyGoals,
            current_weight: data.currentWeight,
            target_weight: data.targetWeight,
          },
        },
      }, { onConflict: 'user_id' });

      navigate('/');
    } catch (err) {
      logger.error('Health onboarding finalize error:', err);
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
