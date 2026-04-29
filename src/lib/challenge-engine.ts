// ============================================================================
// LifeOS Challenge Engine
// Interactive challenge/lesson system inspired by freeCodeCamp
// ============================================================================

export type ChallengeType =
  | 'multiple-choice'
  | 'fill-blank'
  | 'code-challenge'
  | 'reflection'
  | 'ordering'
  | 'flash-card'
  | 'scenario';

export type ChallengeDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface ChallengeOption {
  id: string;
  text: string;
  isCorrect: boolean;
  explanation?: string;
}

export interface FillBlank {
  id: string;
  answer: string;
  hint?: string;
}

export interface TestCase {
  input: string;
  expected: string;
}

export interface OrderingItem {
  id: string;
  text: string;
  order: number;
}

export interface Challenge {
  id: string;
  lessonId: string;
  type: ChallengeType;
  title: string;
  description: string;
  hint?: string;
  options?: ChallengeOption[];
  blanks?: FillBlank[];
  codeTemplate?: string;
  testCases?: TestCase[];
  reflectionPrompt?: string;
  orderingItems?: OrderingItem[];
  hermeticPrinciple?: number;
  difficulty: ChallengeDifficulty;
  xpReward: number;
  prerequisiteIds?: string[];
}

export interface ChallengeResult {
  challengeId: string;
  correct: boolean;
  answer: string;
  timeMs: number;
  attempts: number;
  completedAt: string;
  xpEarned: number;
}

// Map of hermetic principle indices to names
export const HERMETIC_PRINCIPLES: Record<number, string> = {
  0: 'Mentalism',
  1: 'Correspondence',
  2: 'Vibration',
  3: 'Polarity',
  4: 'Rhythm',
  5: 'Cause & Effect',
  6: 'Gender',
};

// Difficulty multiplier for XP calculation
const DIFFICULTY_MULTIPLIER: Record<ChallengeDifficulty, number> = {
  beginner: 1.0,
  intermediate: 1.5,
  advanced: 2.0,
};

// Speed bonus thresholds (ms)
const SPEED_BONUS_THRESHOLD_FAST = 15_000;   // under 15s
const SPEED_BONUS_THRESHOLD_MEDIUM = 60_000; // under 60s

// ---------------------------------------------------------------------------
// validateChallenge
// ---------------------------------------------------------------------------
// Validates a user's answer against the challenge definition.
// Returns whether the answer is correct and an optional explanation.

export function validateChallenge(
  challenge: Challenge,
  answer: string,
): { correct: boolean; explanation?: string } {
  switch (challenge.type) {
    case 'multiple-choice': {
      const selected = challenge.options?.find((o) => o.id === answer);
      if (!selected) {
        return { correct: false, explanation: 'No option selected.' };
      }
      return {
        correct: selected.isCorrect,
        explanation: selected.explanation,
      };
    }

    case 'fill-blank': {
      // answer is expected as JSON array of { id, value } or comma-separated
      let answers: { id: string; value: string }[];
      try {
        answers = JSON.parse(answer);
      } catch {
        // fallback: treat as single blank answer
        if (challenge.blanks && challenge.blanks.length === 1) {
          answers = [{ id: challenge.blanks[0].id, value: answer }];
        } else {
          return { correct: false, explanation: 'Invalid answer format.' };
        }
      }

      let allCorrect = true;
      let explanations: string[] = [];

      for (const blank of challenge.blanks ?? []) {
        const provided = answers.find((a) => a.id === blank.id);
        if (!provided) {
          allCorrect = false;
          continue;
        }
        const isMatch =
          provided.value.trim().toLowerCase() ===
          blank.answer.trim().toLowerCase();
        if (!isMatch) {
          allCorrect = false;
          if (blank.hint) {
            explanations.push(`Hint: ${blank.hint}`);
          }
        }
      }

      return {
        correct: allCorrect,
        explanation: explanations.length > 0 ? explanations.join(' | ') : undefined,
      };
    }

    case 'code-challenge': {
      // For code challenges, we check against test cases.
      // answer is the submitted code string.
      // In a full implementation, this would sandbox-execute the code.
      // Here we do a simplified check: the answer must contain expected output patterns.
      let passedCount = 0;
      const totalTests = challenge.testCases?.length ?? 0;

      for (const tc of challenge.testCases ?? []) {
        // Simplified: check if the expected output appears in the answer
        // Real implementation would execute the code against the input
        if (answer.includes(tc.expected)) {
          passedCount++;
        }
      }

      const correct = totalTests > 0 && passedCount === totalTests;
      return {
        correct,
        explanation: correct
          ? `All ${totalTests} test cases passed.`
          : `${passedCount}/${totalTests} test cases passed. Review your code and try again.`,
      };
    }

    case 'reflection': {
      // Reflections are always "correct" — they're auto-graded as complete
      // as long as the user provides a non-trivial answer
      const isNonTrivial = answer.trim().length >= 10;
      return {
        correct: isNonTrivial,
        explanation: isNonTrivial
          ? 'Reflection recorded. Take a moment to revisit this insight later.'
          : 'Write at least a sentence to capture your reflection meaningfully.',
      };
    }

    case 'ordering': {
      // answer is expected as JSON array of IDs in the order the user placed them
      let orderedIds: string[];
      try {
        orderedIds = JSON.parse(answer);
      } catch {
        return { correct: false, explanation: 'Invalid ordering format.' };
      }

      const correctOrder = [...(challenge.orderingItems ?? [])].sort(
        (a, b) => a.order - b.order,
      );
      const correctIds = correctOrder.map((item) => item.id);

      const isCorrect =
        orderedIds.length === correctIds.length &&
        orderedIds.every((id, idx) => id === correctIds[idx]);

      return {
        correct: isCorrect,
        explanation: isCorrect
          ? 'Correct order!'
          : 'The order is not quite right. Think about the logical sequence and try again.',
      };
    }

    case 'flash-card': {
      // answer is a self-assessed confidence level (1-5)
      // Always "correct" — the SRS scheduling is adjusted by confidence
      const confidence = parseInt(answer, 10);
      return {
        correct: true,
        explanation: `Card reviewed with confidence level ${confidence}. Review schedule updated.`,
      };
    }

    case 'scenario': {
      // answer is the selected scenario option ID
      // Scenarios may have multiple valid outcomes; we check the options
      const option = challenge.options?.find((o) => o.id === answer);
      if (!option) {
        return { correct: false, explanation: 'No scenario option selected.' };
      }
      return {
        correct: option.isCorrect,
        explanation: option.explanation,
      };
    }

    default:
      return { correct: false, explanation: 'Unknown challenge type.' };
  }
}

// ---------------------------------------------------------------------------
// calculateXP
// ---------------------------------------------------------------------------
// Calculates XP earned for a challenge attempt.
// Base XP comes from the challenge's xpReward, then adjustments:
//   - Difficulty multiplier
//   - Speed bonus for fast completion
//   - Attempt penalty (reduced XP for repeated attempts)
//   - Incorrect answers earn 0 XP

export function calculateXP(
  challenge: Challenge,
  result: { correct: boolean; attempts: number; timeMs: number },
): number {
  if (!result.correct) return 0;

  const diffMultiplier = DIFFICULTY_MULTIPLIER[challenge.difficulty];
  let baseXP = challenge.xpReward * diffMultiplier;

  // Speed bonus: reward fast completion
  if (result.timeMs < SPEED_BONUS_THRESHOLD_FAST) {
    baseXP = Math.round(baseXP * 1.25); // +25%
  } else if (result.timeMs < SPEED_BONUS_THRESHOLD_MEDIUM) {
    baseXP = Math.round(baseXP * 1.1); // +10%
  }

  // Attempt penalty: reduce XP for multiple attempts
  // 1st attempt = 100%, 2nd = 80%, 3rd = 60%, 4th+ = 50%
  const attemptMultiplier =
    result.attempts <= 1
      ? 1.0
      : result.attempts === 2
        ? 0.8
        : result.attempts === 3
          ? 0.6
          : 0.5;

  return Math.max(1, Math.round(baseXP * attemptMultiplier));
}

// ---------------------------------------------------------------------------
// getNextChallenge
// ---------------------------------------------------------------------------
// Finds the next challenge in sequence that the user hasn't completed and
// whose prerequisites are satisfied.

export function getNextChallenge(
  completedIds: string[],
  challenges: Challenge[],
): Challenge | null {
  const completedSet = new Set(completedIds);

  // Priority: challenges with all prerequisites met, ordered by first uncompleted
  for (const challenge of challenges) {
    if (completedSet.has(challenge.id)) continue;

    const prereqs = challenge.prerequisiteIds ?? [];
    const prereqsMet = prereqs.every((pid) => completedSet.has(pid));

    if (prereqsMet) {
      return challenge;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// getChallengesByLesson
// ---------------------------------------------------------------------------
// Returns all challenges for a given lesson ID.

export function getChallengesByLesson(
  lessonId: string,
  challenges: Challenge[],
): Challenge[] {
  return challenges.filter((c) => c.lessonId === lessonId);
}

// ---------------------------------------------------------------------------
// getChallengesByHermeticPrinciple
// ---------------------------------------------------------------------------
// Returns all challenges aligned with a specific Hermetic principle.

export function getChallengesByHermeticPrinciple(
  principle: number,
  challenges: Challenge[],
): Challenge[] {
  return challenges.filter((c) => c.hermeticPrinciple === principle);
}

// ---------------------------------------------------------------------------
// getChallengesByDifficulty
// ---------------------------------------------------------------------------

export function getChallengesByDifficulty(
  difficulty: ChallengeDifficulty,
  challenges: Challenge[],
): Challenge[] {
  return challenges.filter((c) => c.difficulty === difficulty);
}

// ---------------------------------------------------------------------------
// getProgressStats
// ---------------------------------------------------------------------------
// Computes overall progress statistics across a set of challenges.

export function getProgressStats(
  challenges: Challenge[],
  results: ChallengeResult[],
): { completed: number; total: number; percent: number; xpEarned: number } {
  const completedIds = new Set(results.filter((r) => r.correct).map((r) => r.challengeId));
  const completed = completedIds.size;
  const total = challenges.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const xpEarned = results.reduce((sum, r) => sum + r.xpEarned, 0);

  return { completed, total, percent, xpEarned };
}

// ---------------------------------------------------------------------------
// getLessonProgress
// ---------------------------------------------------------------------------
// Returns progress stats scoped to a single lesson.

export function getLessonProgress(
  lessonId: string,
  challenges: Challenge[],
  results: ChallengeResult[],
): { completed: number; total: number; percent: number; xpEarned: number } {
  const lessonChallenges = getChallengesByLesson(lessonId, challenges);
  const lessonResults = results.filter((r) =>
    lessonChallenges.some((c) => c.id === r.challengeId),
  );
  return getProgressStats(lessonChallenges, lessonResults);
}

// ---------------------------------------------------------------------------
// isChallengeUnlocked
// ---------------------------------------------------------------------------
// Checks whether a challenge's prerequisites have been completed.

export function isChallengeUnlocked(
  challenge: Challenge,
  completedIds: string[],
): boolean {
  if (!challenge.prerequisiteIds || challenge.prerequisiteIds.length === 0) {
    return true;
  }
  const completedSet = new Set(completedIds);
  return challenge.prerequisiteIds.every((pid) => completedSet.has(pid));
}

// ---------------------------------------------------------------------------
// getUnlockedChallenges
// ---------------------------------------------------------------------------
// Returns all challenges that are currently unlocked for the user.

export function getUnlockedChallenges(
  challenges: Challenge[],
  completedIds: string[],
): Challenge[] {
  const completedSet = new Set(completedIds);
  return challenges.filter(
    (c) =>
      !completedSet.has(c.id) && isChallengeUnlocked(c, completedIds),
  );
}

// ---------------------------------------------------------------------------
// createChallengeResult
// ---------------------------------------------------------------------------
// Helper to create a ChallengeResult object with computed XP.

export function createChallengeResult(
  challenge: Challenge,
  answer: string,
  timeMs: number,
  attempts: number,
): ChallengeResult {
  const { correct } = validateChallenge(challenge, answer);
  const xpEarned = correct
    ? calculateXP(challenge, { correct, attempts, timeMs })
    : 0;

  return {
    challengeId: challenge.id,
    correct,
    answer,
    timeMs,
    attempts,
    completedAt: new Date().toISOString(),
    xpEarned,
  };
}