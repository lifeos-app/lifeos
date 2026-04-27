/**
 * useWelcomeWizard — Custom hook encapsulating all wizard state & logic
 *
 * Manages: currentStep, WizardData, step validation, navigation
 * with Hermetic transitions, supabase submit, and skip handling.
 */

import { useState, useCallback } from 'react';
import { supabase } from '../../lib/data-access';
import { useUserStore } from '../../stores/useUserStore';
import type { UserProfile } from '../../stores/useUserStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useGoalsStore, type GoalNode } from '../../stores/useGoalsStore';

// ─── Types ───────────────────────────────────────────────────────

export interface WizardData {
  displayName: string;
  timezone: string;
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
    selectedModules: [],
    habitTitle: '',
    habitFrequency: 'daily',
    habitCategory: '',
    habitIcon: '⚡',
    goalTitle: '',
    goalDescription: '',
    goalTargetDate: '',
    goalIcon: '🎯',
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
      // 1. Update profile: onboarding_complete, display_name, preferences.selected_modules
      const existingPrefs = (profile?.preferences || {}) as Record<string, unknown>;
      const profilePayload: Partial<UserProfile> & Record<string, unknown> = {
        onboarding_complete: true,
        display_name: data.displayName.trim() || null,
        preferences: {
          ...existingPrefs,
          selected_modules: data.selectedModules,
          timezone: data.timezone,
        },
      };

      const { error: profileErr } = await supabase
        .from('user_profiles')
        .update(profilePayload)
        .eq('user_id', userId);

      if (profileErr) {
        console.warn('[WelcomeWizard] Profile update error:', profileErr);
      }

      // 2. Create first habit (if user filled it in)
      if (data.habitTitle.trim()) {
        const habitCreated = await useHabitsStore.getState().createHabit(userId, {
          title: data.habitTitle.trim(),
          frequency: data.habitFrequency,
          category: data.habitCategory || undefined,
          icon: data.habitIcon,
          is_active: true,
          is_deleted: false,
          source: 'manual',
          user_id: userId,
        });
        if (!habitCreated) {
          console.warn('[WelcomeWizard] Failed to create first habit');
        }
      }

      // 3. Create first goal (if user filled it in)
      if (data.goalTitle.trim()) {
        const randomColor = GOAL_COLORS[Math.floor(Math.random() * GOAL_COLORS.length)];
        const goalId = await useGoalsStore.getState().createGoal({
          title: data.goalTitle.trim(),
          description: data.goalDescription.trim() || undefined,
          status: 'active',
          domain: data.selectedModules[0] || 'goals',
          target_date: data.goalTargetDate || null,
          icon: data.goalIcon,
          color: randomColor,
          sort_order: 0,
          priority: 'medium',
          is_deleted: false,
          source: 'manual',
          user_id: userId,
        } as Partial<GoalNode>);
        if (!goalId) {
          console.warn('[WelcomeWizard] Failed to create first goal');
        }
      }

      // 4. Refresh profile in store
      await useUserStore.getState().fetchProfile();

      // 5. Callback
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
      case 1: return data.selectedModules.length >= 2;
      case 2: return data.habitTitle.trim().length > 0;
      case 3: return data.goalTitle.trim().length > 0;
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