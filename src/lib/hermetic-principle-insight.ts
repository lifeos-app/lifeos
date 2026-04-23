/**
 * hermetic-principle-insight.ts — Bridge Module: Engine Data → Hermetic Wisdom
 *
 * Converts tagged pattern/correlation/XP data from the pattern engine into
 * PrincipleInsight objects framed with PRINCIPLE / WISDOM / PRACTICE / MIRACLE.
 *
 * Each insight connects the user's lived data to the timeless truths of the
 * Seven Hermetic Principles — making the Kybalion's wisdom personal, actionable,
 * and miraculous.
 *
 * "The lips of wisdom are closed, except to the ears of understanding."
 * — The Kybalion
 */

import type { DetectedPattern, PatternType } from './pattern-engine';
import { SEVEN_PRINCIPLES, getDailyPrinciple } from './hermetic-integration';
import type { HermeticPrinciple } from './hermetic-integration';
import { getWisdomQuote, type WisdomQuote } from './multifaith-wisdom';

// ── Types ────────────────────────────────────────────────────────

/** The origin realm of this insight — where the data came from */
export type InsightSource = 'pattern' | 'correlation' | 'xp' | 'daily' | 'polarity' | 'rhythm_swing';

/**
 * A Hermetic-framed insight: the universal principle behind your data,
 * the wisdom it reveals, the practice it suggests, and the miracle it promises.
 */
export interface PrincipleInsight {
  /** The governing Hermetic principle */
  principle: HermeticPrinciple;
  /** Origin realm of this insight */
  source: InsightSource;
  /** Short title */
  title: string;
  /** Hermetic-framed wisdom — from the Kybalion tradition */
  wisdom: string;
  /** What the user can DO about it — practice aligned with the principle */
  practice: string;
  /** What becomes possible through this principle */
  miracle: string;
  /** Color associated with the principle */
  color: string;
  /** Confidence level of the underlying pattern (0-1) */
  confidence: number;
  /** Raw data from the engine that triggered this insight */
  data: Record<string, any>;
  /** Multifaith wisdom — a quote from across 28+ traditions that illuminates this principle */
  multifaithWisdom?: WisdomQuote;
}

// ── Pattern-Specific Wisdom Maps ─────────────────────────────────

interface PatternWisdom {
  title: (p: DetectedPattern) => string;
  wisdom: (p: DetectedPattern) => string;
  practice: (p: DetectedPattern) => string;
  miracle: (p: DetectedPattern) => string;
  overridePrinciple?: number; // override the pattern's hermeticPrinciple index
  sourceOverride?: InsightSource;
}

const PATTERN_WISDOM: Record<PatternType, PatternWisdom> = {
  productivity_peak: {
    title: (p) => `Rhythm Reveals Your Peak — ${p.title}`,
    wisdom: (p) =>
      `The Law of Rhythm governs all achievement. Your data shows you complete the most tasks around ${formatPeakHours(p)} — this is not random. It is rhythm expressing itself through your will. "Everything flows, out and in" — and your flow peaks where rhythm and intention converge.`,
    practice: (p) =>
      `Protect your peak hours (${formatPeakHours(p)}) as sacred time. Schedule your most important work there and eliminate distractions. Fight for this window — it is where Rhythm amplifies your effort tenfold.`,
    miracle: (_p) =>
      `When you align your deepest work with your natural rhythm, you enter flow states that compress hours of ordinary effort into minutes of inspired action. Ten hours of misaligned effort cannot match one hour at your rhythm's peak.`,
  },

  energy_cycle: {
    title: (p) => `Your Pendulum Swings — ${p.title}`,
    wisdom: (p) => {
      const best = p.data?.bestBlock ?? 'morning';
      const worst = p.data?.worstBlock ?? 'evening';
      return `The pendulum manifests in everything — including your energy. Your strongest period is the ${best}, your lightest the ${worst}. This is not weakness; it is Rhythm in its most honest form. The Kybalion teaches: the swing is inevitable, but the wise master uses both poles.`;
    },
    practice: (p) => {
      const best = p.data?.bestBlock ?? 'morning';
      const worst = p.data?.worstBlock ?? 'evening';
      return `Stack deep work in the ${best}. Use the ${worst} for admin, planning, and recovery. Never fight the pendulum — ride it. When energy is high, act. When it is low, reflect and restore.`;
    },
    miracle: () =>
      `The miracle of Rhythm: when you stop fighting your natural cycles and start flowing with them, you accomplish more in less time with less effort. What felt like inconsistency becomes a sustainable, powerful cadence.`,
  },

  rhythm_swing: {
    title: (p) => p.data?.direction === 'ascending'
      ? `The Pendulum Rises — ${p.title}`
      : `The Pendulum Descends — ${p.title}`,
    wisdom: (p) =>
      p.data?.direction === 'ascending'
        ? `After days of low activity, Rhythm guarantees the upswing. The pendulum cannot remain at rest — what descends must ascend. Your trough was not failure; it was the Law gathering momentum for your next rise.`
        : `After days of high productivity, Rhythm warns the downswing approaches. The pendulum cannot stay at its peak — what rises must descend. This is not failure; it is the Law of Rhythm. The wise master rests before the swing forces rest upon them.`,
    practice: (p) =>
      p.data?.direction === 'ascending'
        ? `Begin NOW. The pendulum is swinging upward — ride the rising wave with bold action. Start the task, send the message, take the step. Momentum is your ally.`
        : `Prepare with intention rather than pushing harder. Complete what is in progress, then deliberately rest. Rest now by choice so the pendulum's descent becomes restoration, not collapse.`,
    miracle: (p) =>
      p.data?.direction === 'ascending'
        ? `The miracle of the ascending swing: action taken during the upswing multiplies. Decisions made now carry disproportionate weight. What you start as the pendulum rises gains momentum you could not create by force alone.`
        : `The miracle of the descending swing: intentional rest during the downswing stores energy that explodes into action on the next rise. Athletes call this the taper. Sages call it wu wei. You will call it your secret weapon.`,
    sourceOverride: 'rhythm_swing',
  },

  habit_anchor: {
    title: (p) => `Vibration Made Visible — ${p.title}`,
    wisdom: (p) => {
      const anchors = p.data?.anchors as Array<{ title: string; completionRate: number }> | undefined;
      const anchor = anchors?.[0];
      const name = anchor?.title ?? 'your anchor habit';
      const rate = anchor?.completionRate ?? 60;
      return `Nothing rests; everything vibrates. "${name}" at ${rate}% consistency is vibration at its most powerful — a frequency so steady it becomes a force of nature. The Law of Vibration teaches that your most consistent habit is not just a behavior; it is the resonant frequency of your will.`;
    },
    practice: (p) => {
      const anchors = p.data?.anchors as Array<{ title: string } | undefined>;
      const anchor = anchors?.[0];
      const name = anchor?.title ?? 'your anchor habit';
      return `Use "${name}" as an anchor point. Attach one new habit immediately after it — habit stacking makes the new vibration ride the existing frequency. The anchor provides the wave; the new habit surfs it.`;
    },
    miracle: () =>
      `One unbreakable habit, stacked over months, transforms an entire life. The anchor habit is the tuning fork that brings all other habits into resonance. Master one frequency, and the entire instrument of your life retunes.`,
  },

  goal_neglect: {
    title: (p) => `Cause & Effect Are Watching — ${p.title}`,
    wisdom: (p) => {
      const days = p.data?.daysSinceActivity ?? 7;
      const goal = p.data?.goalTitle ?? 'this goal';
      return `Every cause has its effect; every effect has its cause. "${goal}" has had no activity for ${days} days. This is not simply neglect — it is a cause set in motion. The Law of Compensation ensures that what you ignore today demands payment tomorrow, with interest.`;
    },
    practice: (p) => {
      const goal = p.data?.goalTitle ?? 'this goal';
      return `Revisit "${goal}" today — even one微小 action breaks the cause chain of neglect. A single task, a five-minute review, a status update. Small causes can redirect large effects. Do not try to catch up; just take one step.`;
    },
    miracle: () =>
      `The miracle of Cause & Effect: a single action taken after days of neglect creates a cause that reverses the compounding cost of inaction. One step today is worth a week of scrambling tomorrow. The Law rewards the one who restarts.`,
  },

  spending_spike: {
    title: (p) => `The Law of Compensation Speaks — ${p.title}`,
    wisdom: (p) => {
      const overPct = p.data?.overPct ?? 50;
      const week = p.data?.week ?? 'this week';
      return `Every dollar spent is a cause with effects that ripple. Spending in ${week} was ${overPct}% above your average — this is the Law of Cause & Effect made financial. Money is energy; where it flows, reality follows. The Kybalion asks: what caused this effect, and what effects will it cause?`;
    },
    practice: (p) => {
      const week = p.data?.week ?? 'this week';
      const avg = p.data?.averageWeekly ?? 0;
      return `Investigate the cause behind the ${week} spike. Was it impulse, necessity, or emotional spending? Name the cause to master the effect. Next week, set an intentional spending intention at $${Math.round(avg)} and observe whether the Law of Compensation brings balance.`;
    },
    miracle: () =>
      `The miracle of financial Cause & Effect: when you trace every spike to its true cause, spending stops being mysterious and starts being conscious. Over months, this awareness alone redirects thousands of dollars from reaction to intention. The Law serves those who understand it.`,
  },

  streak_risk: {
    title: (p) => `A Frequency Flickers — ${p.title}`,
    wisdom: (p) => {
      const habit = p.data?.habitTitle ?? 'this habit';
      const streak = p.data?.currentStreak ?? 0;
      return `"${habit}" has a ${streak}-day streak at risk. The Law of Vibration teaches that consistency is frequency — and frequency is power. A streak is a vibration sustained against entropy. When the vibration falters, the Law warns: restore the frequency or watch it dissolve.`;
    },
    practice: (p) => {
      const habit = p.data?.habitTitle ?? 'this habit';
      return `Complete "${habit}" today — even minimally. The minimum viable action beats perfection when a frequency is at stake. A tiny completion restores the vibration; a missed day collapses it. Protect the streak not for the number, but for the frequency it represents.`;
    },
    miracle: () =>
      `The miracle of the restored streak: a habit saved at the brink becomes psychologically unbreakable. Each time you save a streak, the vibration deepens — what was fragile becomes resilient, what was effort becomes identity. The Law of Vibration rewards those who refuse to let their frequency break.`,
  },

  optimal_schedule: {
    title: (p) => `Rhythm Designs Your Day — ${p.title}`,
    wisdom: (p) => {
      const block = p.data?.suggestions?.[0]?.block ?? 'morning';
      const rec = p.data?.suggestions?.[0]?.recommendation ?? 'deep work';
      return `Your schedule is not arbitrary — it is Rhythm made visible. The Law of Rhythm reveals that ${block} is your natural ${rec.toLowerCase()} window. The universe runs on rhythm: tides, seasons, breath. Your day does too. Align with it and effort becomes flow; fight it and effort becomes struggle.`;
    },
    practice: (p) => {
      const suggestions = p.data?.suggestions ?? [];
      if (suggestions.length === 0) return 'Block your day by energy, not just by time. Match deep work to high-energy periods and light tasks to low-energy periods.';
      const lines = suggestions.map((s: any) =>
        `${s.block}: ${s.recommendation}`
      ).join(' | ');
      return `Redesign your daily blocks using Rhythm's blueprint: ${lines}. Protect the deep work block fiercely — it is where Rhythm and intention create the most powerful compound interest of your day.`;
    },
    miracle: () =>
      `The miracle of rhythmic scheduling: when your schedule matches your natural cycles, you stop forcing and start flowing. What took chaotic willpower becomes effortless alignment. The day stops being something you survive and becomes something that carries you.`,
  },
};

// ── Helpers ──────────────────────────────────────────────────────

function formatPeakHours(p: DetectedPattern): string {
  const hours: number[] = p.data?.peakHours ?? [];
  if (hours.length === 0) return 'your peak hours';
  return hours.map(h => `${h}:00`).join(', ');
}

// ── patternToInsight ─────────────────────────────────────────────

/**
 * Convert a DetectedPattern into a Hermetic-framed PrincipleInsight.
 * Returns null if the pattern type has no wisdom mapping.
 */
export function patternToInsight(pattern: DetectedPattern): PrincipleInsight | null {
  const wisdomMap = PATTERN_WISDOM[pattern.type];
  if (!wisdomMap) return null;

  // Determine principle: override takes precedence, then pattern tag, then fallback to Correspondence
  const principleIdx =
    wisdomMap.overridePrinciple ??
    pattern.hermeticPrinciple ??
    1; // Correspondence as fallback
  const principle = SEVEN_PRINCIPLES[principleIdx] ?? SEVEN_PRINCIPLES[1];

  const source: InsightSource = wisdomMap.sourceOverride ?? 'pattern';

  const multifaithQuote = getWisdomQuote(principle.name);

  return {
    principle,
    source,
    title: wisdomMap.title(pattern),
    wisdom: wisdomMap.wisdom(pattern),
    practice: wisdomMap.practice(pattern),
    miracle: wisdomMap.miracle(pattern),
    color: principle.color,
    confidence: pattern.confidence,
    data: pattern.data,
    multifaithWisdom: multifaithQuote || undefined,
  };
}

// ── correlationToInsight ────────────────────────────────────────

/**
 * Minimal correlation shape expected from correlation engines.
 * Any object with a `hermeticPrinciple` tag (index 1 = Correspondence) and
 * basic metadata can be bridged.
 */
export interface CorrelationData {
  title: string;
  description: string;
  confidence: number;
  data: Record<string, any>;
  /** Index into SEVEN_PRINCIPLES — defaults to 1 (Correspondence) */
  hermeticPrinciple?: number;
  [key: string]: any;
}

/**
 * Convert a Correspondence-tagged correlation into a PrincipleInsight.
 * "As above, so below" — correlations are Correspondence made visible.
 */
export function correlationToInsight(corr: CorrelationData): PrincipleInsight {
  // Correspondence-tagged correlations always map to Correspondence unless overridden
  const principleIdx = corr.hermeticPrinciple ?? 1; // Correspondence
  const principle = SEVEN_PRINCIPLES[principleIdx] ?? SEVEN_PRINCIPLES[1];

  const topKey = Object.keys(corr.data ?? {}).slice(0, 3).join(', ');

  return {
    principle,
    source: 'correlation',
    title: `As Above, So Below — ${corr.title}`,
    wisdom: `The Law of Correspondence reveals: "${corr.description}" Your inner world and outer data mirror each other. What appears in one domain echoes in another — the macrocosm is reflected in the microcosm, and your patterns prove it.`,
    practice: `Reflect on what this correlation mirrors. If ${topKey || 'these variables'} move together, look for the deeper correspondence in your life. Change the inner pattern, and watch the outer data shift to match.`,
    miracle: `The miracle of Correspondence: when you see the mirror, you gain the power to change what is reflected. Change the cause in one domain, and watch it ripple across all others. "As within, so without" becomes not a philosophy but a lived, measurable reality.`,
    color: principle.color,
    confidence: corr.confidence,
    data: corr.data,
  };
}

// ── getCurrentPrincipleInsight ───────────────────────────────────

/**
 * Determine the most relevant PrincipleInsight for the current moment.
 *
 * Priority:
 *   1. rhythm_swing patterns (most time-sensitive, deepest structural wisdom)
 *   2. Highest-confidence tagged pattern
 *   3. Daily principle fallback (rotating wisdom when no patterns exist)
 */
export function getCurrentPrincipleInsight(patterns: DetectedPattern[]): PrincipleInsight | null {
  // 1. Prefer rhythm swings — they are the most time-sensitive insight
  const rhythmSwing = patterns.find(p => p.type === 'rhythm_swing');
  if (rhythmSwing) {
    const insight = patternToInsight(rhythmSwing);
    if (insight) return insight;
  }

  // 2. Highest-confidence tagged pattern
  const taggedPatterns = patterns
    .filter(p => p.hermeticPrinciple !== undefined && p.type !== 'rhythm_swing')
    .sort((a, b) => b.confidence - a.confidence);

  if (taggedPatterns.length > 0) {
    const insight = patternToInsight(taggedPatterns[0]);
    if (insight) return insight;
  }

  // 3. Any pattern, even untagged, by confidence
  const anyPattern = patterns
    .filter(p => p.type !== 'rhythm_swing')
    .sort((a, b) => b.confidence - a.confidence)[0];

  if (anyPattern) {
    const insight = patternToInsight(anyPattern);
    if (insight) return insight;
  }

  // 4. Daily principle fallback — today's rotating Hermetic principle
  const daily = getDailyPrinciple();
  
  // Pull a multifaith wisdom quote for today's principle
  const multifaithQuote = getWisdomQuote(daily.name);
  
  return {
    principle: daily,
    source: 'daily',
    title: `Today's Principle: ${daily.name}`,
    wisdom: `${daily.axiom}. ${daily.quote} This is not abstract philosophy — it is the law governing your life right now. The principle of ${daily.name} is active in every pattern, every habit, every result you experience today.`,
    practice: daily.dailyAffirmation,
    miracle: `When you embody ${daily.name} fully for one day, you experience a shift that logic cannot explain. The principle is always active; aligning with it consciously accelerates everything it touches. Today, let ${daily.name} be your lens.`,
    color: daily.color,
    confidence: 0.5, // moderate — no specific data, but the principle is ever-active
    data: { dailyRotation: true, dayOfYear: Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000) },
    multifaithWisdom: multifaithQuote || undefined,
  };
}

// ── Utility: insight summary for quick display ──────────────────

/**
 * Compact summary of a PrincipleInsight for notifications, widgets, and headers.
 */
export function insightSummary(insight: PrincipleInsight): string {
  return `${insight.principle.name}: ${insight.title}\n✦ ${insight.wisdom.slice(0, 120)}…\n→ ${insight.practice.slice(0, 100)}`;
}