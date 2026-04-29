/**
 * srs-engine.ts — Spaced Repetition Scheduler (SRS) Engine for LifeOS
 *
 * A pure TypeScript implementation inspired by Anki's scheduling approach.
 * All functions are pure — no side effects, no React, no localStorage.
 * The Zustand store handles persistence; this module handles scheduling math.
 *
 * Card lifecycle:
 *   new → learning (steps) → review (ease-based intervals)
 *   review → relearning (on lapse/Again) → learning steps → review
 */

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

/** Rating given by user after reviewing a card */
export type Rating = 'again' | 'hard' | 'good' | 'easy';

/** Card scheduling state */
export type CardState = 'new' | 'learning' | 'review' | 'relearning';

/** Core SRS state fields (the part that gets scheduled) */
export interface SRSState {
  state: CardState;
  ease: number;          // ease factor (starts at INITIAL_EASE, min MIN_EASE)
  interval: number;      // days until next review
  due: number;           // timestamp (ms) when card is due
  lapses: number;        // times user forgot (rated 'again')
  reviews: number;       // total reviews
  lastReview: number;    // timestamp (ms) of last review
  elapsedDays: number;   // days since last review
}

/** Full scheduling outcome after a review */
export interface SchedulingOutcome {
  state: CardState;
  ease: number;
  interval: number;
  due: number;
}

/** A knowledge card with scheduling metadata */
export interface SRSCard extends SRSState {
  id: string;
  deckId: string;
  front: string;                // question/content (supports markdown)
  back: string;                  // answer/explanation (supports markdown)
  tags: string[];
  hermeticPrinciple?: number;   // 0-6 mapping to Hermetic principles
  source?: string;               // where this card came from
  difficulty?: number;           // 0-1, FSRS-style difficulty
  stability?: number;            // FSRS-style memory stability
  isLeech?: boolean;             // flagged after LEECH_THRESHOLD lapses
}

// ══════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════

export const INITIAL_EASE = 2.5;
export const MIN_EASE = 1.3;
export const EASE_DELTA_AGAIN = -0.20;
export const EASE_DELTA_HARD = -0.15;
export const EASE_DELTA_EASY = +0.15;
export const LEARNING_STEPS = [1, 10];       // minutes
export const RELEARNING_STEPS = [10];         // minutes
export const GRADUATING_INTERVAL = 1;        // days
export const EASY_INTERVAL = 4;               // days
export const LEECH_THRESHOLD = 8;             // mark as leech after this many lapses
export const FUZZ_RANGE = 0.15;               // 15% fuzz to prevent clustering

export const HARD_INTERVAL_MULTIPLIER = 1.2;  // multiplier for "hard" rating in review
export const MINIMUM_INTERVAL = 1;            // minimum review interval in days

/** Milliseconds per day */
const MS_PER_DAY = 86_400_000;
/** Milliseconds per minute */
const MS_PER_MINUTE = 60_000;

// ══════════════════════════════════════════════════════════════
// Internal Helpers
// ══════════════════════════════════════════════════════════════

/**
 * Apply fuzz to an interval to prevent cards from clustering on the same day.
 * Adds a random offset of ±FUZZ_RANGE (15%) to the interval.
 */
function applyFuzz(interval: number): number {
  if (interval < 2.5) return interval;  // no fuzz for very short intervals
  const fuzzAmount = interval * FUZZ_RANGE;
  // Deterministic-seeming fuzz based on interval — uses fractional jitter
  // For true randomness, components should pass in fuzz externally.
  // Here we use a simple hash-like approach for predictability in tests.
  const jitter = (Math.sin(interval * 127.1) * 0.5 + 0.5) * 2 - 1; // -1 to +1
  const fuzzed = interval + jitter * fuzzAmount;
  return Math.max(MINIMUM_INTERVAL, Math.round(fuzzed * 10) / 10);  // 1 decimal
}

/**
 * Clamp ease to [MIN_EASE, Infinity).
 */
function clampEase(ease: number): number {
  return Math.max(MIN_EASE, ease);
}

/**
 * Get the current step index for a card in learning/relearning state.
 * Returns -1 if the card isn't in a step-based state.
 */
function getCurrentStepIndex(card: SRSCard): number {
  if (card.state === 'learning') {
    const steps = LEARNING_STEPS;
    // Determine which step the card is on based on elapsed time
    // If never reviewed (elapsedDays=0, lastReview=0), it's at step 0
    if (card.lastReview === 0) return 0;
    const elapsedMs = Date.now() - card.lastReview;
    let cumulative = 0;
    for (let i = 0; i < steps.length; i++) {
      cumulative += steps[i] * MS_PER_MINUTE;
      if (elapsedMs < cumulative) return i;
    }
    return steps.length - 1;  // past last step, will graduate
  }
  if (card.state === 'relearning') {
    const steps = RELEARNING_STEPS;
    if (card.lastReview === 0) return 0;
    const elapsedMs = Date.now() - card.lastReview;
    let cumulative = 0;
    for (let i = 0; i < steps.length; i++) {
      cumulative += steps[i] * MS_PER_MINUTE;
      if (elapsedMs < cumulative) return i;
    }
    return steps.length - 1;
  }
  return -1;
}

// ══════════════════════════════════════════════════════════════
// Core Scheduling — New Cards
// ══════════════════════════════════════════════════════════════

/**
 * Schedule a brand-new card based on the first rating.
 */
function scheduleNewCard(rating: Rating, now: number): SchedulingOutcome {
  switch (rating) {
    case 'again': {
      // Goes into learning at step 0
      const intervalMs = LEARNING_STEPS[0] * MS_PER_MINUTE;
      return {
        state: 'learning',
        ease: INITIAL_EASE,
        interval: 0,  // in learning, due is step-based
        due: now + intervalMs,
      };
    }
    case 'hard': {
      // Goes into learning, but harder step
      const stepMs = LEARNING_STEPS[Math.min(1, LEARNING_STEPS.length - 1)] * MS_PER_MINUTE;
      return {
        state: 'learning',
        ease: INITIAL_EASE + EASE_DELTA_HARD,
        interval: 0,
        due: now + stepMs,
      };
    }
    case 'good': {
      // Graduate immediately to review
      return {
        state: 'review',
        ease: INITIAL_EASE,
        interval: GRADUATING_INTERVAL,
        due: now + GRADUATING_INTERVAL * MS_PER_DAY,
      };
    }
    case 'easy': {
      // Skip ahead to easy interval
      return {
        state: 'review',
        ease: INITIAL_EASE + EASE_DELTA_EASY,
        interval: EASY_INTERVAL,
        due: now + EASY_INTERVAL * MS_PER_DAY,
      };
    }
  }
}

// ══════════════════════════════════════════════════════════════
// Core Scheduling — Learning / Relearning Cards
// ══════════════════════════════════════════════════════════════

/**
 * Schedule a card in learning/relearning state based on rating.
 * Cards move through steps; after the last step they graduate to review.
 */
function scheduleLearningCard(
  card: SRSCard,
  rating: Rating,
  now: number,
): SchedulingOutcome {
  const steps = card.state === 'relearning' ? RELEARNING_STEPS : LEARNING_STEPS;
  const stepIndex = getCurrentStepIndex(card);
  const isRelearning = card.state === 'relearning';

  switch (rating) {
    case 'again': {
      // Reset to first step
      const intervalMs = steps[0] * MS_PER_MINUTE;
      const newEase = isRelearning
        ? card.ease  // don't further reduce ease on relearning Again
        : clampEase(card.ease + EASE_DELTA_AGAIN);
      return {
        state: card.state,
        ease: newEase,
        interval: 0,
        due: now + intervalMs,
      };
    }
    case 'hard': {
      // Repeat current step with extra time
      const currentStepTime = steps[Math.min(stepIndex, steps.length - 1)] * MS_PER_MINUTE;
      const intervalMs = currentStepTime * 1.5;
      // For relearning, hard doesn't change ease (already lapsed)
      const newEase = isRelearning ? card.ease : clampEase(card.ease + EASE_DELTA_HARD);
      return {
        state: card.state,
        ease: newEase,
        interval: 0,
        due: now + intervalMs,
      };
    }
    case 'good': {
      const nextStep = stepIndex + 1;
      if (nextStep >= steps.length) {
        // Graduate to review
        const graduateInterval = isRelearning
          ? Math.max(MINIMUM_INTERVAL, Math.round(card.ease * (card.interval || 1)))
          : GRADUATING_INTERVAL;
        return {
          state: 'review',
          ease: card.ease,
          interval: graduateInterval,
          due: now + graduateInterval * MS_PER_DAY,
        };
      }
      // Move to next step
      const intervalMs = steps[nextStep] * MS_PER_MINUTE;
      return {
        state: card.state,
        ease: card.ease,
        interval: 0,
        due: now + intervalMs,
      };
    }
    case 'easy': {
      // Graduate immediately with bonus
      const easyIv = isRelearning
        ? Math.max(EASY_INTERVAL, Math.round(card.ease * (card.interval || 1) * 1.3))
        : EASY_INTERVAL;
      return {
        state: 'review',
        ease: clampEase(card.ease + EASE_DELTA_EASY),
        interval: easyIv,
        due: now + easyIv * MS_PER_DAY,
      };
    }
  }
}

// ══════════════════════════════════════════════════════════════
// Core Scheduling — Review Cards
// ══════════════════════════════════════════════════════════════

/**
 * Schedule a card in review state based on rating.
 * This is where the ease factor and intervals are calculated.
 */
function scheduleReviewCard(
  card: SRSCard,
  rating: Rating,
  now: number,
): SchedulingOutcome {
  const elapsedDays = card.elapsedDays > 0 ? card.elapsedDays : 1;

  switch (rating) {
    case 'again': {
      // Lapse — card enters relearning
      const newEase = clampEase(card.ease + EASE_DELTA_AGAIN);
      const relearningStepMs = RELEARNING_STEPS[0] * MS_PER_MINUTE;
      return {
        state: 'relearning',
        ease: newEase,
        interval: 0,  // in relearning, due is step-based
        due: now + relearningStepMs,
      };
    }
    case 'hard': {
      // Hard — interval increases modestly, ease decreases slightly
      const hardInterval = Math.max(
        MINIMUM_INTERVAL,
        Math.round(elapsedDays * HARD_INTERVAL_MULTIPLIER),
      );
      const newEase = clampEase(card.ease + EASE_DELTA_HARD);
      const fuzzed = applyFuzz(hardInterval);
      return {
        state: 'review',
        ease: newEase,
        interval: fuzzed,
        due: now + fuzzed * MS_PER_DAY,
      };
    }
    case 'good': {
      // Good — standard ease-based review
      const newInterval = Math.max(
        MINIMUM_INTERVAL,
        Math.round(elapsedDays * card.ease),
      );
      const fuzzed = applyFuzz(newInterval);
      return {
        state: 'review',
        ease: card.ease,
        interval: fuzzed,
        due: now + fuzzed * MS_PER_DAY,
      };
    }
    case 'easy': {
      // Easy — interval increases more, ease bumps up
      const easyInterval = Math.max(
        MINIMUM_INTERVAL,
        Math.round(elapsedDays * card.ease * 1.3),
      );
      const newEase = clampEase(card.ease + EASE_DELTA_EASY);
      const fuzzed = applyFuzz(easyInterval);
      return {
        state: 'review',
        ease: newEase,
        interval: fuzzed,
        due: now + fuzzed * MS_PER_DAY,
      };
    }
  }
}

// ══════════════════════════════════════════════════════════════
// Public API
// ══════════════════════════════════════════════════════════════

/**
 * Schedule a card based on the current state and the user's rating.
 *
 * @param card   The card to schedule (state, ease, interval, etc.)
 * @param rating The user's rating after reviewing
 * @param now    Current timestamp in ms (defaults to Date.now())
 * @returns The new scheduling outcome (state, ease, interval, due)
 *
 * @example
 * ```ts
 * const outcome = scheduleCard(card, 'good');
 * // outcome => { state: 'review', ease: 2.5, interval: 1, due: 1714500000000 }
 * ```
 */
export function scheduleCard(
  card: SRSCard,
  rating: Rating,
  now: number = Date.now(),
): SchedulingOutcome {
  switch (card.state) {
    case 'new':
      return scheduleNewCard(rating, now);
    case 'learning':
    case 'relearning':
      return scheduleLearningCard(card, rating, now);
    case 'review':
      return scheduleReviewCard(card, rating, now);
    default:
      // Fallback — should never happen
      return scheduleNewCard(rating, now);
  }
}

/**
 * Get all cards that are due for review right now.
 * A card is due if its `due` timestamp is <= now, or if it's new (never reviewed).
 *
 * @param cards Array of all cards
 * @param now   Current timestamp (defaults to Date.now())
 * @returns Cards that are due for review
 */
export function getDueCards(cards: SRSCard[], now: number = Date.now()): SRSCard[] {
  return cards.filter(card => {
    // New cards are always due
    if (card.state === 'new') return true;
    // Cards with due <= now are due
    if (card.due <= now) return true;
    return false;
  });
}

/**
 * Get a review forecast — how many cards are due each day for the next N days.
 *
 * @param cards Array of all cards
 * @param days Number of days to forecast
 * @param now  Current timestamp (defaults to Date.now())
 * @returns Array of { date: 'YYYY-MM-DD', count: number }
 */
export function getForecast(
  cards: SRSCard[],
  days: number,
  now: number = Date.now(),
): { date: string; count: number }[] {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startMs = startOfDay.getTime();

  const forecast: { date: string; count: number }[] = [];

  for (let d = 0; d < days; d++) {
    const dayStart = startMs + d * MS_PER_DAY;
    const dayEnd = dayStart + MS_PER_DAY;

    const dateStr = new Date(dayStart).toISOString().split('T')[0];
    const count = cards.filter(card => {
      // New cards count for today (day 0)
      if (card.state === 'new' && d === 0) return true;
      // Cards whose due falls within this day
      if (card.due >= dayStart && card.due < dayEnd) return true;
      // overdue cards (due < now) count for today
      if (d === 0 && card.due < now && card.state !== 'new') return true;
      return false;
    }).length;

    forecast.push({ date: dateStr, count });
  }

  return forecast;
}

/**
 * Create a new SRSCard with default values for a brand-new card.
 */
export function createNewCard(partial: Partial<SRSCard> & Pick<SRSCard, 'id' | 'deckId' | 'front' | 'back'>): SRSCard {
  return {
    state: 'new',
    ease: INITIAL_EASE,
    interval: 0,
    due: 0,  // new cards are immediately due
    lapses: 0,
    reviews: 0,
    lastReview: 0,
    elapsedDays: 0,
    tags: [],
    ...partial,
  };
}

/**
 * Check if a card has become a leech (exceeded LEECH_THRESHOLD lapses).
 * Leeches should be flagged for review/editing.
 */
export function isLeech(card: SRSCard): boolean {
  return card.lapses >= LEECH_THRESHOLD;
}

/**
 * Get a human-readable label for a card's state.
 */
export function getCardStateLabel(state: CardState): string {
  switch (state) {
    case 'new': return 'New';
    case 'learning': return 'Learning';
    case 'review': return 'Review';
    case 'relearning': return 'Relearning';
  }
}

/**
 * Calculate the retention rate for a set of cards based on review history.
 * Returns a number between 0 and 1.
 */
export function calculateRetentionRate(
  reviews: { rating: Rating }[],
): number {
  if (reviews.length === 0) return 1;
  const successful = reviews.filter(r => r.rating !== 'again').length;
  return successful / reviews.length;
}

/**
 * Get the next review interval in a human-readable format.
 */
export function formatInterval(intervalDays: number): string {
  if (intervalDays < 1) {
    const hours = Math.round(intervalDays * 24);
    if (hours < 1) return '<1h';
    return `${hours}h`;
  }
  if (intervalDays < 30) {
    const days = Math.round(intervalDays);
    return `${days}d`;
  }
  if (intervalDays < 365) {
    const months = Math.round(intervalDays / 30);
    return `${months}mo`;
  }
  const years = Math.round(intervalDays / 365 * 10) / 10;
  return `${years}y`;
}