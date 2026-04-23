/**
 * Hermetic Polarity — Transmutation Detection Module
 *
 * Implements the Law of Polarity from the Kybalion: "Everything is Dual;
 * everything has poles; everything has its pair of opposites."
 *
 * When a user's mood/energy/spending/productivity sits at an extreme pole
 * for 2+ days, the system detects the polarized state and offers guidance
 * for transmutation — the Hermetic art of shifting from one pole to another
 * not by fighting the opposite, but by raising the vibration until the
 * lower pole is transmuted into its higher aspect.
 *
 * "The Art of Polarization is the secret of the Masters."
 * — The Kybalion
 */

// ── Types ────────────────────────────────────────────────────────

/**
 * The domain of life being evaluated for extreme polarity.
 */
export type PolarityDomain = 'mood' | 'energy' | 'spending' | 'productivity';

/**
 * Which pole the user is currently occupying.
 * 'negative' = the lower/darker end of the spectrum.
 * 'positive' = the upper/brighter end — even positive extremes
 *              carry risk of unsustainable peaks.
 */
export type PolarityPole = 'negative' | 'positive';

/**
 * Full polarity state for a given domain.
 */
export interface PolarityState {
  /** The domain being evaluated */
  domain: PolarityDomain;
  /** Which extreme pole the user currently occupies */
  currentPole: PolarityPole;
  /** How intense the polarization is (0 = center, 1 = absolute extreme) */
  intensity: number;
  /** Consecutive days at or near this pole */
  daysAtPole: number;
  /** Whether transmutation guidance should be offered (2+ days at extreme) */
  transmutable: boolean;
  /** Specific guidance for transmuting this polarized state */
  transmutationHint: string;
}

// ── Configuration ─────────────────────────────────────────────────

/** Scale boundaries — values are always 1-5 in LifeOS */
const SCALE_MIN = 1;
const SCALE_MAX = 5;
const SCALE_MID = 3;

/** How many days at extreme before offering transmutation */
const DAYS_THRESHOLD = 2;

/** Proximity to pole required to count as "at" the pole (within 0.5 of extreme) */
const POLE_PROXIMITY = 0.5;

// ── Transmutation Wisdom ─────────────────────────────────────────

interface TransmutationGuidance {
  negative: string;
  positive: string;
}

const TRANSMUTATION_WISDOM: Record<PolarityDomain, TransmutationGuidance> = {
  mood: {
    negative:
      'The pendulum has rested at the dark pole long enough. The Law of Polarity guarantees the opposite exists within you right now — you need not create it, only choose it. Transmutation begins with one small shift: move, breathe, step outside. The pole reverses not by force, but by vibration.',
    positive:
      'You have been riding the high pole — a powerful state, but one the pendulum will not hold indefinitely. The Masters do not cling to peaks; they transmute the energy into sustainable rhythm. Anchor this state with gratitude and deliberate practice, so when the pendulum swings, you land on solid ground.',
  },
  energy: {
    negative:
      'Exhaustion is not failure — it is Polarity demanding transmutation. The opposite energy exists; it is merely dormant. Begin with stillness, not action. Rest deeply and without guilt. When the body is ready, movement of any kind begins the transmutation. The pendulum cannot rest at the bottom forever.',
    positive:
      'High energy sustained over days can burn without focus. The Law of Polarity warns: the higher the peak, the harder the swing unless you direct it consciously. Channel this energy into structured creation rather than scattered effort. What you build now at this frequency will endure.',
  },
  spending: {
    negative:
      'Financial contraction mirrors an inner contraction. The Law of Correspondence says: as within, so without. Transmute scarcity consciousness not by spending more, but by recognizing abundance in what already exists. Gratitude transmutes the lower pole of lack into the higher pole of enough.',
    positive:
      'Spending at this pace is the positive pole of abundance — but Polarity warns that unchecked, the swing reverses. Transmute this energy: redirect spending into investment, turn consumption into creation. The Masters do not stop the pendulum; they ride it from spending into building.',
  },
  productivity: {
    negative:
      'Low productivity is not laziness — it is the pendulum at rest. The Law of Polarity says the power to produce exists in equal measure within you. Transmutation begins not with forcing, but with one tiny action that breaks the inertia. The first step restarts the rhythm.',
    positive:
      'Exceptional productivity is the positive pole — and Polarity says the swing back is inevitable. The wise master does not resist the coming dip but transmutes it into planned recovery. Schedule rest now, while you are still ahead. The pendulum honors those who plan for its motion.',
  },
};

// ── Detection Logic ───────────────────────────────────────────────

/**
 * Determine which pole a single value occupies.
 * Values at or near 1 = negative pole.
 * Values at or near 5 = positive pole.
 * Values near center = no extreme pole.
 */
function classifyPole(
  value: number
): { pole: PolarityPole; proximity: number } | null {
  // How close to the negative extreme (1)?
  const negProximity = 1 - Math.abs(value - SCALE_MIN) / (SCALE_MAX - SCALE_MIN);
  // How close to the positive extreme (5)?
  const posProximity = 1 - Math.abs(value - SCALE_MAX) / (SCALE_MAX - SCALE_MIN);

  const maxProximity = Math.max(negProximity, posProximity);

  // Not near any extreme pole
  if (maxProximity < 1 - POLE_PROXIMITY) return null;

  if (negProximity > posProximity) {
    return { pole: 'negative', proximity: negProximity };
  }
  return { pole: 'positive', proximity: posProximity };
}

/**
 * Calculate how many consecutive days (from the most recent) the user
 * has been at the same extreme pole.
 */
function countConsecutivePoleDays(
  recentValues: number[],
  pole: PolarityPole
): number {
  const extremeValue = pole === 'negative' ? SCALE_MIN : SCALE_MAX;
  let days = 0;
  for (let i = 0; i < recentValues.length; i++) {
    const val = recentValues[i];
    if (val === extremeValue) {
      days++;
    } else if (Math.abs(val - extremeValue) <= POLE_PROXIMITY) {
      days++;
    } else {
      break;
    }
  }
  return days;
}

/**
 * Calculate intensity: how strongly the user is polarized.
 * 0 = perfectly centered, 1 = at absolute extreme.
 */
function calculateIntensity(values: number[]): number {
  if (values.length === 0) return 0;
  // Average deviation from the center (3) normalized to 0-1
  const avgDeviation = values.reduce((sum, v) => sum + Math.abs(v - SCALE_MID), 0) / values.length;
  // Maximum possible average deviation = 2 (all values at 1 or 5)
  return Math.min(1, avgDeviation / 2);
}

/**
 * Detect the polarity state for a given domain based on recent values.
 *
 * @param domain - Which life domain to evaluate
 * @param recentValues - Array of values (1-5 scale), most recent first.
 *                       Typically the last 7-14 days.
 * @returns PolarityState if extreme polarity is detected, null otherwise.
 */
export function detectPolarityState(
  domain: PolarityDomain,
  recentValues: number[]
): PolarityState | null {
  if (recentValues.length === 0) return null;

  // Check most recent value — determines current pole
  const currentValue = recentValues[0];
  const poleInfo = classifyPole(currentValue);

  if (!poleInfo) return null; // Not at an extreme

  // Count consecutive days at this pole
  const daysAtPole = countConsecutivePoleDays(recentValues, poleInfo.pole);

  // Calculate overall intensity
  const intensity = calculateIntensity(recentValues);

  // Transmutable if at extreme for 2+ days
  const transmutable = daysAtPole >= DAYS_THRESHOLD;

  // Get the appropriate hint
  const wisdom = TRANSMUTATION_WISDOM[domain];
  const transmutationHint = transmutable
    ? wisdom[poleInfo.pole]
    : '';

  return {
    domain,
    currentPole: poleInfo.pole,
    intensity,
    daysAtPole,
    transmutable,
    transmutationHint,
  };
}

/**
 * Check if a value is at an extreme pole (1 or 5).
 * Useful for UI gating — e.g., show transmutation card only when extreme.
 */
export function isExtremeValue(value: number): boolean {
  return value === SCALE_MIN || value === SCALE_MAX;
}

/**
 * Return the polarity color for a given pole.
 * Matches the Hermetic Polarity principle color (#FACC15) with
 * modifications for polar orientation.
 */
export function getPolarityColor(pole: PolarityPole): string {
  return pole === 'negative' ? '#F43F5E' : '#FACC15';
}

/**
 * Short label for a polarity state, suitable for UI display.
 */
export function getPolarityLabel(state: PolarityState): string {
  const poleLabel = state.currentPole === 'negative' ? 'Low Pole' : 'High Pole';
  const domainLabel = state.domain.charAt(0).toUpperCase() + state.domain.slice(1);
  return `${domainLabel} at ${poleLabel} — ${state.daysAtPole} day${state.daysAtPole !== 1 ? 's' : ''}`;
}