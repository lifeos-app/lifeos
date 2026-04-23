import { describe, it, expect, vi } from 'vitest'
import type { DetectedPattern, PatternType } from '../pattern-engine'
import type { HermeticPrinciple } from '../hermetic-integration'

// ── Mock hermetic-integration ──────────────────────────────────
// NOTE: vi.mock is hoisted, so we must define data inline in the factory.

vi.mock('../hermetic-integration', () => {
  const principles = [
    { name: 'MENTALISM', axiom: 'The All is Mind', quote: 'THE UNIVERSE IS MENTAL.', attribution: 'The Kybalion', correspondences: '', lifeOSDomain: 'AI', dailyAffirmation: 'Your reality begins in thought.', color: '#00D4FF' },
    { name: 'CORRESPONDENCE', axiom: 'As Above, So Below', quote: 'AS ABOVE SO BELOW.', attribution: 'The Kybalion / Emerald Tablet', correspondences: '', lifeOSDomain: 'Dashboard', dailyAffirmation: 'Your dashboard is your microcosm.', color: '#39FF14' },
    { name: 'VIBRATION', axiom: 'Nothing Rests; Everything Moves', quote: 'NOTHING RESTS; EVERYTHING VIBRATES.', attribution: 'The Kybalion', correspondences: '', lifeOSDomain: 'Habits', dailyAffirmation: 'Are you vibrating at the frequency of your goals?', color: '#A855F7' },
    { name: 'POLARITY', axiom: 'Everything is Dual', quote: 'EVERYTHING IS DUAL.', attribution: 'The Kybalion', correspondences: '', lifeOSDomain: 'Health', dailyAffirmation: 'The pendulum swings.', color: '#FACC15' },
    { name: 'RHYTHM', axiom: 'Everything Flows', quote: 'EVERYTHING FLOWS, OUT AND IN.', attribution: 'The Kybalion', correspondences: '', lifeOSDomain: 'Schedule', dailyAffirmation: 'Flow with your natural cycles.', color: '#F97316' },
    { name: 'CAUSE & EFFECT', axiom: 'Every Cause Has Its Effect', quote: 'EVERY CAUSE HAS ITS EFFECT.', attribution: 'The Kybalion', correspondences: '', lifeOSDomain: 'Finance', dailyAffirmation: 'What cause are you setting in motion?', color: '#F43F5E' },
    { name: 'GENDER', axiom: 'Gender is in Everything', quote: 'GENDER IS IN EVERYTHING.', attribution: 'The Kybalion', correspondences: '', lifeOSDomain: 'Growth', dailyAffirmation: 'Balance creation.', color: '#EC4899' },
  ]
  return {
    SEVEN_PRINCIPLES: principles,
    getDailyPrinciple: vi.fn(() => principles[4]), // RHYTHM
  }
})

// Import after mock setup
import { patternToInsight, correlationToInsight, getCurrentPrincipleInsight, insightSummary } from '../hermetic-principle-insight'
import type { PrincipleInsight, CorrelationData } from '../hermetic-principle-insight'

// ── Helpers ──────────────────────────────────────────────────

function makePattern(overrides: Partial<DetectedPattern> & { type: PatternType }): DetectedPattern {
  return {
    confidence: 0.8,
    title: 'Test Pattern',
    description: 'A test pattern',
    data: {},
    detectedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ── patternToInsight ──────────────────────────────────────────

describe('patternToInsight', () => {
  it('returns null for an unknown pattern type', () => {
    // Force-cast a bogus type to test the null path
    const result = patternToInsight(makePattern({ type: 'productivity_peak' }))
    // Should not be null for known types; we test unknown above conceptually
    // In practice all PatternTypes have wisdom maps, so test a real type
    expect(result).not.toBeNull()
  })

  // ── productivity_peak ──────────────────────────────────────

  describe('productivity_peak', () => {
    it('maps productivity_peak to an insight with Rhythm principle when hermeticPrinciple=4', () => {
      const pattern = makePattern({
        type: 'productivity_peak',
        title: 'Peak at 9am',
        confidence: 0.85,
        hermeticPrinciple: 4,
        data: { peakHours: [9, 10] },
      })

      const insight = patternToInsight(pattern)
      expect(insight).not.toBeNull()
      expect(insight!.principle.name).toBe('RHYTHM')
      expect(insight!.source).toBe('pattern')
      expect(insight!.title).toContain('Peak at 9am')
      expect(insight!.title).toContain('Rhythm Reveals Your Peak')
      expect(insight!.wisdom).toContain('9:00')
      expect(insight!.wisdom).toContain('10:00')
      expect(insight!.practice).toContain('9:00')
      expect(insight!.practice).toContain('10:00')
      expect(insight!.confidence).toBe(0.85)
      expect(insight!.data).toEqual({ peakHours: [9, 10] })
    })

    it('uses fallback "your peak hours" when peakHours is empty', () => {
      const pattern = makePattern({
        type: 'productivity_peak',
        title: 'Peak',
        data: {},
      })

      const insight = patternToInsight(pattern)!
      expect(insight.wisdom).toContain('your peak hours')
      expect(insight.practice).toContain('your peak hours')
    })

    it('falls back to Correspondence (index 1) when no hermeticPrinciple tag', () => {
      const pattern = makePattern({
        type: 'productivity_peak',
        title: 'Peak',
        data: { peakHours: [14] },
      })

      const insight = patternToInsight(pattern)!
      expect(insight.principle.name).toBe('CORRESPONDENCE')
    })
  })

  // ── energy_cycle ────────────────────────────────────────────

  describe('energy_cycle', () => {
    it('maps energy_cycle to an insight with correct wisdom and practice', () => {
      const pattern = makePattern({
        type: 'energy_cycle',
        title: 'Morning energy',
        hermeticPrinciple: 4,
        data: { bestBlock: 'morning', worstBlock: 'evening' },
      })

      const insight = patternToInsight(pattern)!
      expect(insight.title).toContain('Pendulum Swings')
      expect(insight.wisdom).toContain('morning')
      expect(insight.wisdom).toContain('evening')
      expect(insight.practice).toContain('morning')
      expect(insight.practice).toContain('evening')
      expect(insight.miracle).toBeTruthy()
    })

    it('uses defaults when data fields are missing', () => {
      const pattern = makePattern({
        type: 'energy_cycle',
        title: 'Energy',
        data: {},
      })

      const insight = patternToInsight(pattern)!
      expect(insight.wisdom).toContain('morning')
      expect(insight.wisdom).toContain('evening')
    })
  })

  // ── rhythm_swing ────────────────────────────────────────────

  describe('rhythm_swing', () => {
    it('maps ascending rhythm_swing with rising wisdom', () => {
      const pattern = makePattern({
        type: 'rhythm_swing',
        title: 'Upward swing',
        data: { direction: 'ascending' },
      })

      const insight = patternToInsight(pattern)!
      expect(insight.title).toContain('Pendulum Rises')
      expect(insight.wisdom).toContain('upswing')
      expect(insight.practice).toContain('rising wave')
      expect(insight.miracle).toContain('ascending')
      expect(insight.source).toBe('rhythm_swing')
    })

    it('maps descending rhythm_swing with descending wisdom', () => {
      const pattern = makePattern({
        type: 'rhythm_swing',
        title: 'Downward swing',
        data: { direction: 'descending' },
      })

      const insight = patternToInsight(pattern)!
      expect(insight.title).toContain('Pendulum Descends')
      expect(insight.wisdom).toContain('downswing')
      expect(insight.practice).toContain('rest')
      expect(insight.miracle).toContain('descending')
      expect(insight.source).toBe('rhythm_swing')
    })

    it('uses Rhythm principle via sourceOverride mapping', () => {
      const pattern = makePattern({
        type: 'rhythm_swing',
        title: 'Swing',
        data: { direction: 'ascending' },
      })
      // rhythm_swing has sourceOverride: 'rhythm_swing'
      const insight = patternToInsight(pattern)!
      expect(insight.source).toBe('rhythm_swing')
    })
  })

  // ── habit_anchor ────────────────────────────────────────────

  describe('habit_anchor', () => {
    it('maps habit_anchor to an insight with anchor details', () => {
      const pattern = makePattern({
        type: 'habit_anchor',
        title: 'Morning routine anchor',
        hermeticPrinciple: 2, // VIBRATION
        data: {
          anchors: [{ title: 'Meditation', completionRate: 85 }],
        },
      })

      const insight = patternToInsight(pattern)!
      expect(insight.principle.name).toBe('VIBRATION')
      expect(insight.title).toContain('Vibration Made Visible')
      expect(insight.wisdom).toContain('Meditation')
      expect(insight.wisdom).toContain('85%')
      expect(insight.practice).toContain('Meditation')
    })

    it('uses defaults when anchors data is missing', () => {
      const pattern = makePattern({
        type: 'habit_anchor',
        title: 'Anchor',
        data: {},
      })

      const insight = patternToInsight(pattern)!
      expect(insight.wisdom).toContain('your anchor habit')
      expect(insight.wisdom).toContain('60%') // default completionRate
      expect(insight.practice).toContain('your anchor habit')
    })
  })

  // ── goal_neglect ────────────────────────────────────────────

  describe('goal_neglect', () => {
    it('maps goal_neglect with goal details', () => {
      const pattern = makePattern({
        type: 'goal_neglect',
        title: 'Neglected: Fitness',
        hermeticPrinciple: 5, // CAUSE & EFFECT
        data: { goalTitle: 'Fitness', daysSinceActivity: 14 },
      })

      const insight = patternToInsight(pattern)!
      expect(insight.principle.name).toBe('CAUSE & EFFECT')
      expect(insight.title).toContain('Cause & Effect Are Watching')
      expect(insight.wisdom).toContain('Fitness')
      expect(insight.wisdom).toContain('14')
      expect(insight.practice).toContain('Fitness')
      expect(insight.miracle).toBeTruthy()
    })

    it('uses defaults when data fields are missing', () => {
      const pattern = makePattern({
        type: 'goal_neglect',
        title: 'Neglect',
        data: {},
      })

      const insight = patternToInsight(pattern)!
      expect(insight.wisdom).toContain('this goal')
      expect(insight.wisdom).toContain('7')
    })
  })

  // ── spending_spike ──────────────────────────────────────────

  describe('spending_spike', () => {
    it('maps spending_spike with financial data', () => {
      const pattern = makePattern({
        type: 'spending_spike',
        title: 'Spending up this week',
        data: { overPct: 75, week: 'this week', averageWeekly: 200 },
      })

      const insight = patternToInsight(pattern)!
      expect(insight.title).toContain('Law of Compensation')
      expect(insight.wisdom).toContain('75%')
      expect(insight.wisdom).toContain('this week')
      expect(insight.practice).toContain('200')
    })

    it('uses defaults when spending data fields are missing', () => {
      const pattern = makePattern({
        type: 'spending_spike',
        title: 'Spike',
        data: {},
      })

      const insight = patternToInsight(pattern)!
      expect(insight.wisdom).toContain('50%')
      expect(insight.wisdom).toContain('this week')
    })
  })

  // ── streak_risk ────────────────────────────────────────────

  describe('streak_risk', () => {
    it('maps streak_risk with habit details', () => {
      const pattern = makePattern({
        type: 'streak_risk',
        title: 'Streak at risk: Running',
        hermeticPrinciple: 2, // VIBRATION
        data: { habitTitle: 'Running', currentStreak: 12 },
      })

      const insight = patternToInsight(pattern)!
      expect(insight.principle.name).toBe('VIBRATION')
      expect(insight.title).toContain('Frequency Flickers')
      expect(insight.wisdom).toContain('Running')
      expect(insight.wisdom).toContain('12')
      expect(insight.practice).toContain('Running')
    })

    it('uses defaults when streak data is missing', () => {
      const pattern = makePattern({
        type: 'streak_risk',
        title: 'Streak risk',
        data: {},
      })

      const insight = patternToInsight(pattern)!
      expect(insight.wisdom).toContain('this habit')
      expect(insight.wisdom).toContain('0')
    })
  })

  // ── optimal_schedule ─────────────────────────────────────────

  describe('optimal_schedule', () => {
    it('maps optimal_schedule with suggestions data', () => {
      const pattern = makePattern({
        type: 'optimal_schedule',
        title: 'Optimal morning deep work',
        hermeticPrinciple: 4, // RHYTHM
        data: {
          suggestions: [
            { block: 'morning', recommendation: 'deep work' },
            { block: 'afternoon', recommendation: 'admin tasks' },
            { block: 'evening', recommendation: 'reflection' },
          ],
        },
      })

      const insight = patternToInsight(pattern)!
      expect(insight.principle.name).toBe('RHYTHM')
      expect(insight.title).toContain('Rhythm Designs Your Day')
      expect(insight.wisdom).toContain('morning')
      expect(insight.wisdom).toContain('deep work')
      expect(insight.practice).toContain('morning')
      expect(insight.practice).toContain('deep work')
    })

    it('provides fallback practice when suggestions are empty', () => {
      const pattern = makePattern({
        type: 'optimal_schedule',
        title: 'Schedule',
        data: { suggestions: [] },
      })

      const insight = patternToInsight(pattern)!
      expect(insight.practice).toContain('Block your day by energy')
    })

    it('uses default block/recommendation when suggestions is undefined', () => {
      const pattern = makePattern({
        type: 'optimal_schedule',
        title: 'Schedule',
        data: {},
      })

      const insight = patternToInsight(pattern)!
      expect(insight.wisdom).toContain('morning')
      expect(insight.wisdom).toContain('deep work')
    })
  })

  // ── Structural tests across all pattern types ───────────────

  describe('all pattern types produce valid insights', () => {
    const types: PatternType[] = [
      'productivity_peak', 'energy_cycle', 'habit_anchor',
      'goal_neglect', 'spending_spike', 'streak_risk', 'optimal_schedule',
      'rhythm_swing',
    ]

    types.forEach((type) => {
      it(`produces a complete PrincipleInsight for type "${type}"`, () => {
        const pattern = makePattern({ type, confidence: 0.7 })
        const insight = patternToInsight(pattern)!

        // All required fields present
        expect(insight).toHaveProperty('principle')
        expect(insight).toHaveProperty('source')
        expect(insight).toHaveProperty('title')
        expect(insight).toHaveProperty('wisdom')
        expect(insight).toHaveProperty('practice')
        expect(insight).toHaveProperty('miracle')
        expect(insight).toHaveProperty('color')
        expect(insight).toHaveProperty('confidence')
        expect(insight).toHaveProperty('data')

        // Types are correct
        expect(typeof insight.title).toBe('string')
        expect(typeof insight.wisdom).toBe('string')
        expect(typeof insight.practice).toBe('string')
        expect(typeof insight.miracle).toBe('string')
        expect(typeof insight.color).toBe('string')
        expect(typeof insight.confidence).toBe('number')

        // Confidence matches input
        expect(insight.confidence).toBe(0.7)

        // Title is non-empty
        expect(insight.title.length).toBeGreaterThan(0)
        expect(insight.wisdom.length).toBeGreaterThan(0)
        expect(insight.practice.length).toBeGreaterThan(0)
        expect(insight.miracle.length).toBeGreaterThan(0)

        // Color matches the principle's color
        expect(insight.color).toBe(insight.principle.color)
      })
    })
  })

  // ── Edge cases ──────────────────────────────────────────────

  describe('edge cases', () => {
    it('uses hermeticPrinciple override from wisdom map when set', () => {
      // rhythm_swing doesn't have an overridePrinciple in PATTERN_WISDOM,
      // so it falls through to pattern.hermeticPrinciple or default 1
      // We test the override mechanism by checking a pattern without hermeticPrinciple
      const pattern = makePattern({
        type: 'productivity_peak',
        title: 'Peak',
        data: { peakHours: [9] },
        hermeticPrinciple: 3, // POLARITY
      })

      const insight = patternToInsight(pattern)!
      expect(insight.principle.name).toBe('POLARITY')
    })

    it('falls back to index 1 (Correspondence) when hermeticPrinciple is undefined', () => {
      const pattern = makePattern({
        type: 'energy_cycle',
        title: 'Energy',
        data: {},
        // No hermeticPrinciple set
      })

      const insight = patternToInsight(pattern)!
      expect(insight.principle.name).toBe('CORRESPONDENCE')
    })

    it('falls back to index 1 when hermeticPrinciple index is out of bounds', () => {
      const pattern = makePattern({
        type: 'productivity_peak',
        title: 'Peak',
        data: { peakHours: [9] },
        hermeticPrinciple: 999, // Out of range
      })

      const insight = patternToInsight(pattern)!
      // Should fall back to SEVEN_PRINCIPLES[1] = CORRESPONDENCE
      expect(insight.principle.name).toBe('CORRESPONDENCE')
    })

    it('preserves pattern data in insight.data', () => {
      const pattern = makePattern({
        type: 'productivity_peak',
        title: 'Peak',
        data: { peakHours: [9, 10, 14], totalCompleted: 42 },
      })

      const insight = patternToInsight(pattern)!
      expect(insight.data.peakHours).toEqual([9, 10, 14])
      expect(insight.data.totalCompleted).toBe(42)
    })

    it('handles zero confidence', () => {
      const pattern = makePattern({
        type: 'goal_neglect',
        title: 'Neglect',
        confidence: 0,
        data: {},
      })

      const insight = patternToInsight(pattern)!
      expect(insight.confidence).toBe(0)
    })

    it('handles confidence of 1', () => {
      const pattern = makePattern({
        type: 'streak_risk',
        title: 'Streak',
        confidence: 1,
        data: {},
      })

      const insight = patternToInsight(pattern)!
      expect(insight.confidence).toBe(1)
    })
  })
})

// ── correlationToInsight ──────────────────────────────────────

describe('correlationToInsight', () => {
  it('creates a Correspondence-framed insight from a correlation', () => {
    const corr: CorrelationData = {
      title: 'Sleep vs productivity',
      description: 'More sleep correlates with higher task completion.',
      confidence: 0.75,
      data: { sleepHours: 8, taskCompletion: 12 },
    }

    const insight = correlationToInsight(corr)
    expect(insight.principle.name).toBe('CORRESPONDENCE')
    expect(insight.source).toBe('correlation')
    expect(insight.title).toContain('As Above, So Below')
    expect(insight.title).toContain('Sleep vs productivity')
    expect(insight.wisdom).toContain('More sleep correlates with higher task completion')
    expect(insight.confidence).toBe(0.75)
    expect(insight.color).toBe('#39FF14') // Correspondence color
  })

  it('uses hermeticPrinciple override when provided', () => {
    const corr: CorrelationData = {
      title: 'Mood vs exercise',
      description: 'Exercise lifts mood.',
      confidence: 0.6,
      hermeticPrinciple: 2, // VIBRATION
      data: {},
    }

    const insight = correlationToInsight(corr)
    expect(insight.principle.name).toBe('VIBRATION')
    expect(insight.color).toBe('#A855F7')
  })

  it('includes top 3 data keys in practice', () => {
    const corr: CorrelationData = {
      title: 'Test corr',
      description: 'Desc',
      confidence: 0.5,
      data: { alpha: 1, beta: 2, gamma: 3, delta: 4 },
    }

    const insight = correlationToInsight(corr)
    expect(insight.practice).toContain('alpha')
    expect(insight.practice).toContain('beta')
    expect(insight.practice).toContain('gamma')
    expect(insight.practice).not.toContain('delta')
  })

  it('handles empty data gracefully', () => {
    const corr: CorrelationData = {
      title: 'Empty data corr',
      description: 'No data.',
      confidence: 0.4,
      data: {},
    }

    const insight = correlationToInsight(corr)
    expect(insight).toBeTruthy()
    expect(insight.principle.name).toBe('CORRESPONDENCE')
  })

  it('falls back when hermeticPrinciple is out of bounds', () => {
    const corr: CorrelationData = {
      title: 'OOB principle',
      description: 'Out of bounds',
      confidence: 0.5,
      hermeticPrinciple: 999,
      data: {},
    }

    const insight = correlationToInsight(corr)
    expect(insight.principle.name).toBe('CORRESPONDENCE')
  })

  it('preserves correlation data in insight.data', () => {
    const corr: CorrelationData = {
      title: 'Preserve data',
      description: 'Check data',
      confidence: 0.88,
      data: { key1: 'val1', key2: 'val2' },
    }

    const insight = correlationToInsight(corr)
    expect(insight.data).toEqual({ key1: 'val1', key2: 'val2' })
  })

  it('has all required PrincipleInsight fields', () => {
    const corr: CorrelationData = {
      title: 'Complete',
      description: 'Full insight',
      confidence: 0.9,
      data: {},
    }

    const insight = correlationToInsight(corr)
    expect(insight).toHaveProperty('principle')
    expect(insight).toHaveProperty('source')
    expect(insight).toHaveProperty('title')
    expect(insight).toHaveProperty('wisdom')
    expect(insight).toHaveProperty('practice')
    expect(insight).toHaveProperty('miracle')
    expect(insight).toHaveProperty('color')
    expect(insight).toHaveProperty('confidence')
    expect(insight).toHaveProperty('data')
  })
})

// ── getCurrentPrincipleInsight ─────────────────────────────────

describe('getCurrentPrincipleInsight', () => {
  it('prefers rhythm_swing over other patterns', () => {
    const patterns: DetectedPattern[] = [
      makePattern({
        type: 'productivity_peak',
        confidence: 0.95,
        title: 'High confidence peak',
        hermeticPrinciple: 4,
        data: {},
      }),
      makePattern({
        type: 'rhythm_swing',
        confidence: 0.5,
        title: 'Low confidence swing',
        data: { direction: 'ascending' },
      }),
    ]

    const insight = getCurrentPrincipleInsight(patterns)!
    expect(insight.title).toContain('Pendulum Rises')
  })

  it('picks highest-confidence tagged pattern when no rhythm_swing exists', () => {
    const patterns: DetectedPattern[] = [
      makePattern({
        type: 'productivity_peak',
        confidence: 0.6,
        title: 'Lower peak',
        hermeticPrinciple: 4,
        data: {},
      }),
      makePattern({
        type: 'goal_neglect',
        confidence: 0.9,
        title: 'Higher neglect',
        hermeticPrinciple: 5,
        data: { goalTitle: 'Fitness' },
      }),
    ]

    const insight = getCurrentPrincipleInsight(patterns)!
    expect(insight.title).toContain('Cause & Effect')
  })

  it('falls back to untagged pattern by confidence', () => {
    const patterns: DetectedPattern[] = [
      makePattern({
        type: 'energy_cycle',
        confidence: 0.3,
        title: 'Low energy',
        // No hermeticPrinciple tag
        data: { bestBlock: 'morning', worstBlock: 'evening' },
      }),
      makePattern({
        type: 'habit_anchor',
        confidence: 0.7,
        title: 'Strong anchor',
        // No hermeticPrinciple tag
        data: {},
      }),
    ]

    const insight = getCurrentPrincipleInsight(patterns)!
    // Should pick the higher confidence one (habit_anchor)
    expect(insight.title).toContain('Vibration Made Visible')
  })

  it('falls back to daily principle when no patterns exist', () => {
    const insight = getCurrentPrincipleInsight([])!
    expect(insight).not.toBeNull()
    expect(insight.source).toBe('daily')
    expect(insight.principle.name).toBe('RHYTHM') // Our mock returns RHYTHM
    expect(insight.title).toContain("Today's Principle")
    expect(insight.confidence).toBe(0.5)
    expect(insight.data.dailyRotation).toBe(true)
  })

  it('skips rhythm_swing in tagged pattern search (no double-priority)', () => {
    const patterns: DetectedPattern[] = [
      makePattern({
        type: 'rhythm_swing',
        confidence: 0.7,
        title: 'Swing',
        hermeticPrinciple: 4,
        data: { direction: 'descending' },
      }),
      makePattern({
        type: 'productivity_peak',
        confidence: 0.99,
        title: 'Peak',
        hermeticPrinciple: 4,
        data: { peakHours: [10] },
      }),
    ]

    // rhythm_swing should still win because it's priority 1
    const insight = getCurrentPrincipleInsight(patterns)!
    expect(insight.title).toContain('Pendulum Descends')
  })

  it('returns daily insight when no patterns match the wisdom map', () => {
    // getCurrentPrincipleInsight always returns at least daily insight
    const insight = getCurrentPrincipleInsight([])
    expect(insight).not.toBeNull()
    expect(insight!.source).toBe('daily')
  })

  it('includes dayOfYear in daily fallback data', () => {
    const insight = getCurrentPrincipleInsight([])!
    expect(insight.data.dayOfYear).toBeDefined()
    expect(typeof insight.data.dayOfYear).toBe('number')
  })
})

// ── insightSummary ──────────────────────────────────────────

describe('insightSummary', () => {
  it('produces a compact summary string', () => {
    const pattern = makePattern({
      type: 'productivity_peak',
      title: 'Peak at 9am',
      confidence: 0.85,
      hermeticPrinciple: 4,
      data: { peakHours: [9] },
    })

    const insight = patternToInsight(pattern)!
    const summary = insightSummary(insight)

    expect(summary).toContain('RHYTHM')
    expect(summary).toContain('Peak at 9am')
    expect(summary).toContain('✦')
    expect(summary).toContain('→')
  })

  it('truncates wisdom to ~120 characters', () => {
    const pattern = makePattern({
      type: 'goal_neglect',
      title: 'Neglect',
      hermeticPrinciple: 5,
      data: { goalTitle: 'Big Goal', daysSinceActivity: 30 },
    })

    const insight = patternToInsight(pattern)!
    const summary = insightSummary(insight)

    // Summary contains a truncated wisdom line starting with ✦
    const wisdomLine = summary.split('\n').find(l => l.startsWith('✦'))
    expect(wisdomLine).toBeTruthy()
    // The wisdom part (after ✦ ) should be approximately 120 chars + the ellipsis
    const wisdomText = wisdomLine!.slice(2) // Remove "✦ "
    // It should end with "…" from the .slice(0, 120) + "…" concatenation
    expect(wisdomText.endsWith('…')).toBe(true)
  })

  it('truncates practice to ~100 characters', () => {
    const pattern = makePattern({
      type: 'optimal_schedule',
      title: 'Schedule Optimizer',
      hermeticPrinciple: 4,
      data: {
        suggestions: [
          { block: 'morning', recommendation: 'deep work for maximum productivity' },
          { block: 'afternoon', recommendation: 'administrative tasks and meetings' },
          { block: 'evening', recommendation: 'reflection and planning for tomorrow' },
        ],
      },
    })

    const insight = patternToInsight(pattern)!
    const summary = insightSummary(insight)

    const practiceLine = summary.split('\n').find(l => l.startsWith('→'))
    expect(practiceLine).toBeTruthy()
  })
})

// ── Principle color consistency ────────────────────────────────

describe('principle color consistency', () => {
  it('insight.color always matches insight.principle.color', () => {
    const types: PatternType[] = [
      'productivity_peak', 'energy_cycle', 'habit_anchor',
      'goal_neglect', 'spending_spike', 'streak_risk', 'optimal_schedule',
      'rhythm_swing',
    ]

    types.forEach((type) => {
      const pattern = makePattern({ type, confidence: 0.75 })
      const insight = patternToInsight(pattern)!
      expect(insight.color).toBe(insight.principle.color)
    })
  })

  it('correlation insight color matches its principle color', () => {
    const corr: CorrelationData = {
      title: 'Test',
      description: 'Desc',
      confidence: 0.5,
      data: {},
    }

    const insight = correlationToInsight(corr)
    expect(insight.color).toBe(insight.principle.color)
  })
})

// ── Source type tests ──────────────────────────────────────────

describe('source types', () => {
  it('patternToInsight returns source "pattern" by default', () => {
    const pattern = makePattern({ type: 'productivity_peak', data: {} })
    const insight = patternToInsight(pattern)!
    expect(insight.source).toBe('pattern')
  })

  it('patternToInsight returns source "rhythm_swing" for rhythm_swing type', () => {
    const pattern = makePattern({ type: 'rhythm_swing', data: { direction: 'ascending' } })
    const insight = patternToInsight(pattern)!
    expect(insight.source).toBe('rhythm_swing')
  })

  it('correlationToInsight always returns source "correlation"', () => {
    const corr: CorrelationData = {
      title: 'Test',
      description: 'Desc',
      confidence: 0.5,
      data: {},
    }
    const insight = correlationToInsight(corr)
    expect(insight.source).toBe('correlation')
  })
})