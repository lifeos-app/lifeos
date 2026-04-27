/**
 * OnboardingQuest — The Awakening
 *
 * Thin orchestrator for the LLM-powered onboarding quest.
 * Guides new users through 7 scenes to create their character,
 * first habit, first goal, and first journal entry.
 *
 * State logic: useOnboardingQuest.ts
 * Step components: OnboardingSteps.tsx
 * UI shell: OnboardingUI.tsx
 */

import { useOnboardingQuest } from './useOnboardingQuest';
import { OnboardingUI } from './OnboardingUI';
import type { RealmCharacterData } from '../RealmEngine';

// ── Props ────────────────────────────────────────

interface OnboardingQuestProps {
  userId: string;
  onComplete: (charData: RealmCharacterData) => void;
  /** Called when user chooses "Later" — skip onboarding without creating character */
  onSkipLater?: () => void;
}

// ── Component ────────────────────────────────────

export function OnboardingQuest({ userId, onComplete, onSkipLater }: OnboardingQuestProps) {
  const state = useOnboardingQuest({ userId, onComplete, onSkipLater });

  return <OnboardingUI state={state} />;
}