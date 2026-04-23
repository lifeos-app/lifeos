/**
 * hermetic-gender-balance.ts — Gender Principle (2/10) Implementation
 *
 * The Kybalion teaches: "Gender is in everything; everything has its
 * Masculine and Feminine principles." Creation requires BOTH forces.
 *
 * In LifeOS, the Gender principle manifests in goals:
 *   - Vision (Feminine): dreaming, imagining, seed-planting, receiving
 *   - Action (Masculine): executing, building, watering, pushing forward
 *   - Balanced: goals that weave both forces together
 *
 * This module analyzes a user's goals to detect imbalance between
 * vision and action, and offers Hermetic-framed advice.
 *
 * "One without the other is sterile." — The Kybalion
 */

// ── Types ────────────────────────────────────────────────────────

/** The Hermetic force classification for a goal */
export type HermeticForce = 'vision' | 'action' | 'balanced';

/** Result of analyzing the gender balance across a goal set */
export interface GenderBalance {
  /** Number of vision-dominant goals */
  visionCount: number;
  /** Number of action-dominant goals */
  actionCount: number;
  /** Number of balanced goals */
  balancedCount: number;
  /** Vision-to-Action ratio (visionCount / actionCount, or Infinity/0) */
  ratio: number;
  /** Which force currently dominates the user's goal set */
  dominantForce: 'vision' | 'action' | 'balanced';
  /** Hermetic-framed advice based on the balance */
  advice: string;
}

// ── Word Scoring ──────────────────────────────────────────────────

/** Words that signal the Feminine/Vision force — dreaming, seeding, receiving */
const VISION_WORDS: Record<string, number> = {
  // Dreaming & imagining
  dream: 2, imagine: 2, envision: 2, visualize: 2, envision: 2,
  vision: 3, envision: 2, aspire: 2, wish: 1, desire: 1,
  fantasy: 1, ideal: 1, inspire: 2, inspiration: 2,

  // Seeding & planting
  seed: 2, plant: 2, nurture: 2, cultivate: 2, grow: 1,
  bloom: 1, blossom: 1, blossom: 1, sprout: 1, root: 1,

  // Receiving & holding space
  receive: 2, feel: 1, sense: 1, intuit: 2, intuition: 2,
  attract: 2, manifest: 2, allow: 1, invite: 2,

  // Being & becoming
  become: 1, explore: 1, discover: 1, learn: 1, understand: 1,
  meditate: 2, reflect: 2, contemplate: 2, journal: 1,

  // Creative expression
  create: 1, design: 1, art: 1, creative: 1, express: 1,
  imagine: 2, imagine: 2, envision: 2, muse: 2,
};

/** Words that signal the Masculine/Action force — executing, building, pushing */
const ACTION_WORDS: Record<string, number> = {
  // Executing & doing
  do: 2, execute: 3, implement: 2, complete: 2, finish: 2,
  deliver: 2, accomplish: 2, achieve: 2, perform: 2,

  // Building & constructing
  build: 2, construct: 2, make: 1, build: 2, develop: 2,
  produce: 2, forge: 2, craft: 2, assemble: 2, ship: 3,

  // Pushing forward & driving
  push: 2, drive: 2, force: 1, advance: 2, progress: 2,
  launch: 2, deploy: 2, ship: 3, release: 2, publish: 2,

  // Measuring & controlling
  track: 1, measure: 1, optimize: 2, improve: 1, fix: 1,
  reduce: 1, increase: 1, target: 1, goal: 1, milestone: 1,

  // Structuring & organizing
  plan: 1, schedule: 1, organize: 1, structure: 1, system: 1,
  process: 1, method: 1, framework: 1, routine: 1, habit: 1,

  // Decisive action
  decide: 2, commit: 2, start: 1, begin: 1, run: 2,
  sprint: 2, workout: 1, exercise: 1, train: 1, practice: 1,
};

// ── suggestForce ─────────────────────────────────────────────────

/**
 * Score a goal's title and optional description to determine whether
 * it leans Vision (Feminine), Action (Masculine), or Balanced.
 *
 * The scoring is intentionally simple — word-level matching — because
 * the Gender principle is about felt direction, not precision.
 * A vision-heavy goal is a seed; an action-heavy goal is a hammer.
 * Both are needed. The score tells you which the goal is.
 */
export function suggestForce(title: string, description?: string): HermeticForce {
  const text = `${title} ${description ?? ''}`.toLowerCase();

  let visionScore = 0;
  let actionScore = 0;

  // Tokenize by splitting on non-word characters
  const words = text.split(/\W+/).filter(Boolean);

  for (const word of words) {
    if (VISION_WORDS[word]) {
      visionScore += VISION_WORDS[word];
    }
    if (ACTION_WORDS[word]) {
      actionScore += ACTION_WORDS[word];
    }
  }

  // Determine dominant force with a threshold
  const total = visionScore + actionScore;

  // If neither force is meaningfully present, default to balanced
  if (total === 0) return 'balanced';

  const visionRatio = visionScore / total;
  const actionRatio = actionScore / total;

  // Need >60% dominance to classify as one force; otherwise balanced
  if (visionRatio > 0.6) return 'vision';
  if (actionRatio > 0.6) return 'action';
  return 'balanced';
}

// ── calculateGenderBalance ────────────────────────────────────────

/**
 * Analyze the Gender balance across a set of goals.
 *
 * The Kybalion warns: creation requires BOTH the masculine (action)
 * and the feminine (vision). If one force dominates by >1.5x ratio,
 * advice steers the user toward restoring the dance.
 *
 * @param goals - Array of goals with optional hermeticForce classification
 * @returns GenderBalance with counts, ratio, dominant force, and advice
 */
export function calculateGenderBalance(
  goals: { hermeticForce?: HermeticForce }[]
): GenderBalance {
  // Auto-classify goals that don't have an explicit force
  // (For this function, we only count goals that already have a force assigned.
  // Goals without a force are counted as 'balanced' by default.)
  const classified = goals.map(g => g.hermeticForce ?? 'balanced');

  const visionCount = classified.filter(f => f === 'vision').length;
  const actionCount = classified.filter(f => f === 'action').length;
  const balancedCount = classified.filter(f => f === 'balanced').length;

  // Calculate vision-to-action ratio
  // If no action goals, ratio is Infinity; if no vision goals, ratio is 0
  let ratio: number;
  if (actionCount === 0 && visionCount === 0) {
    ratio = 1; // No goals at all → neutral
  } else if (actionCount === 0) {
    ratio = Infinity;
  } else {
    ratio = visionCount / actionCount;
  }

  // Determine dominant force
  let dominantForce: 'vision' | 'action' | 'balanced';
  if (ratio > 1.5) {
    dominantForce = 'vision';
  } else if (ratio < 0.67) {
    dominantForce = 'action';
  } else {
    dominantForce = 'balanced';
  }

  // Generate Hermetic-framed advice
  let advice: string;
  if (ratio > 1.5) {
    advice =
      'Many dreams, few deeds. The Feminine force of Vision is strong, but without the Masculine force of Action, seeds remain seeds. The Kybalion teaches: creation requires both. Choose one vision and take the first concrete step today — water what you have planted.';
  } else if (ratio < 0.67) {
    advice =
      'Much doing, little dreaming. The Masculine force of Action dominates, but without the Feminine force of Vision, effort becomes noise. The Kybalion teaches: every deed needs a dream behind it. Pause and ask — "What is the vision driving all this motion?" — before you act again.';
  } else {
    advice =
      'Vision and action dance in balance. The Feminine seeds and the Masculine waters; together they create. The Kybalion teaches that both forces are required — and you have both. Nurture this balance, for it is the engine of all creation.';
  }

  return {
    visionCount,
    actionCount,
    balancedCount,
    ratio,
    dominantForce,
    advice,
  };
}