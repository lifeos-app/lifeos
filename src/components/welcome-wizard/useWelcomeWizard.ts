/**
 * useWelcomeWizard — Custom hook encapsulating all wizard state & logic
 *
 * Manages: currentStep, WizardData, step validation, navigation
 * with Hermetic transitions, supabase submit, and skip handling.
 *
 * V2: Life Snapshot sliders, Top 3 Goals, Daily Rhythm
 */

import { useState, useCallback } from 'react';
import { supabase } from '../../lib/data-access';
import { useUserStore } from '../../stores/useUserStore';
import type { UserProfile } from '../../stores/useUserStore';
import { useGoalsStore, type GoalNode } from '../../stores/useGoalsStore';

// ─── Types ───────────────────────────────────────────────────────

export interface WizardData {
  displayName: string;
  timezone: string;
  // V2 fields
  lifeSnapshot: Record<string, number>; // keys: health, career, finance, relationships, growth, wellbeing — values 1-10
  topGoals: string[];  // up to 3 goal strings
  wakeTime: string;    // e.g. '06:30'
  dayTemplate: 'student' | '9-5' | 'shift' | 'freelancer' | 'parent' | 'custom';
  // Legacy fields kept for backward compat / migration
  selectedModules: string[];
  habitTitle: string;
  habitFrequency: 'daily' | 'weekly' | 'monthly';
  habitCategory: string;
  habitIcon: string;
  goalTitle: string;
  goalDescription: string;
  goalTargetDate: string;
  goalIcon: string;
}

// ─── Constants ──────────────────────────────────────────────────

export const TOTAL_STEPS = 5;

export const GOAL_COLORS = ['#00D4FF', '#8B5CF6', '#39FF14', '#F43F5E', '#F59E0B', '#10B981'];

export const LIFE_AREAS = [
  { key: 'health', label: 'Health', color: '#10B981' },
  { key: 'career', label: 'Career', color: '#00D4FF' },
  { key: 'finance', label: 'Finance', color: '#F59E0B' },
  { key: 'relationships', label: 'Relationships', color: '#F43F5E' },
  { key: 'growth', label: 'Growth', color: '#8B5CF6' },
  { key: 'wellbeing', label: 'Wellbeing', color: '#39FF14' },
] as const;

// ─── Hook ───────────────────────────────────────────────────────

export function useWelcomeWizard(userId: string, onComplete: () => void, onSkip?: () => void) {
  const profile = useUserStore(s => s.profile);

  const [step, setStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [hermeticVisible, setHermeticVisible] = useState(false);
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [data, setData] = useState<WizardData>({
    displayName: profile?.display_name || '',
    timezone: profile?.timezone || 'Australia/Melbourne',
    // V2 fields
    lifeSnapshot: { health: 5, career: 5, finance: 5, relationships: 5, growth: 5, wellbeing: 5 },
    topGoals: ['', '', ''],
    wakeTime: '06:30',
    dayTemplate: 'custom',
    // Legacy fields
    selectedModules: [],
    habitTitle: '',
    habitFrequency: 'daily',
    habitCategory: '',
    habitIcon: 'zap',
    goalTitle: '',
    goalDescription: '',
    goalTargetDate: '',
    goalIcon: 'target',
  });

  const updateData = useCallback(<K extends keyof WizardData>(key: K, value: WizardData[K]) => {
    setData(prev => ({ ...prev, [key]: value }));
  }, []);

  // ── Transition logic with Hermetic quotes ──
  const goToStep = useCallback((nextStep: number, direction: 'left' | 'right' = 'left') => {
    if (transitioning) return;
    setSlideDir(direction);
    setTransitioning(true);
    setError('');

    // Show Hermetic quote for forward transitions (1→2, 2→3, 3→4, 4→5)
    if (direction === 'left' && nextStep > 0 && nextStep <= 4) {
      setHermeticVisible(true);
      setTimeout(() => {
        setHermeticVisible(false);
        setTimeout(() => {
          setStep(nextStep);
          setTransitioning(false);
        }, 300);
      }, 1800);
    } else {
      // Back transitions or step 5 — no quote
      setTimeout(() => {
        setStep(nextStep);
        setTransitioning(false);
      }, 300);
    }
  }, [transitioning]);

  // ── Skip handler ──
  const handleSkip = useCallback(async () => {
    try {
      await supabase
        .from('user_profiles')
        .update({ onboarding_complete: true })
        .eq('user_id', userId);
    } catch {
      // Best effort — don't block skip
    }
    onSkip?.();
  }, [userId, onSkip]);

  // ── Final completion ──
  const handleComplete = useCallback(async () => {
    setSubmitting(true);
    setError('');

    try {
      // 1. Update profile: onboarding_complete, display_name, preferences with V2 data
      const existingPrefs = (profile?.preferences || {}) as Record<string, unknown>;
      const profilePayload: Partial<UserProfile> & Record<string, unknown> = {
        onboarding_complete: true,
        display_name: data.displayName.trim() || null,
        preferences: {
          ...existingPrefs,
          selected_modules: data.selectedModules,
          timezone: data.timezone,
          life_snapshot: data.lifeSnapshot,
          day_template: data.dayTemplate,
          wake_time: data.wakeTime,
        },
      };

      const { error: profileErr } = await supabase
        .from('user_profiles')
        .update(profilePayload)
        .eq('user_id', userId);

      if (profileErr) {
        console.warn('[WelcomeWizard] Profile update error:', profileErr);
      }

      // 2. Create goals from topGoals (up to 3)
      const validGoals = data.topGoals.filter(g => g.trim().length > 0);
      for (let i = 0; i < validGoals.length; i++) {
        const goalText = validGoals[i].trim();
        const goalColor = GOAL_COLORS[i % GOAL_COLORS.length];
        try {
          await useGoalsStore.getState().createGoal({
            title: goalText,
            description: '',
            status: 'active',
            domain: 'goals',
            target_date: null,
            icon: 'target',
            color: goalColor,
            sort_order: i,
            priority: i === 0 ? 'high' : 'medium',
            is_deleted: false,
            source: 'manual',
            user_id: userId,
          } as Partial<GoalNode>);
        } catch (err) {
          console.warn('[WelcomeWizard] Failed to create goal:', goalText, err);
        }
      }

      // 3. Refresh profile in store
      await useUserStore.getState().fetchProfile();

      // 4. Callback
      onComplete();
    } catch (err) {
      console.error('[WelcomeWizard] Completion error:', err);
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }, [userId, data, profile, onComplete]);

  // ── Validation ──
  const canProceed = (): boolean => {
    switch (step) {
      case 0: return data.displayName.trim().length > 0;
      case 1: return Object.values(data.lifeSnapshot).some(v => v !== 5); // at least one slider moved
      case 2: return data.topGoals.filter(g => g.trim().length > 0).length >= 1; // at least 1 goal
      case 3: return data.wakeTime.trim().length > 0; // wake time is set
      case 4: return true;
      default: return false;
    }
  };

  return {
    // State
    step,
    transitioning,
    hermeticVisible,
    slideDir,
    submitting,
    error,
    data,
    // Actions
    updateData,
    goToStep,
    handleSkip,
    handleComplete,
    canProceed,
  };
}