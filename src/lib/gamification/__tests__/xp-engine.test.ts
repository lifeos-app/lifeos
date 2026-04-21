import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock external dependencies (paths relative to THIS test file in gamification/__tests__/)
vi.mock('../../local-db', () => ({
  localGetAll: vi.fn().mockResolvedValue([]),
  localInsert: vi.fn().mockResolvedValue(undefined),
  localGet: vi.fn().mockResolvedValue(null),
  localUpdate: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../sync-engine', () => ({
  syncNow: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../challenges', () => ({
  updateChallengeProgressFromXP: vi.fn(),
}))

vi.mock('../../../utils/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import {
  calculateXP,
  getStreakMultiplier,
  getStreakLabel,
} from '../xp-engine'
import type { ActionType, XPActionMetadata } from '../xp-engine'
import { xpForLevel, getLevelFromXP, getLevelProgress } from '../levels'

// ── getStreakMultiplier ───────────────────────────────────────

describe('getStreakMultiplier', () => {
  it('returns 1.0 for no streak (0 days)', () => {
    expect(getStreakMultiplier(0)).toBe(1.0)
  })

  it('returns 1.0 for streak less than 3 days', () => {
    expect(getStreakMultiplier(1)).toBe(1.0)
    expect(getStreakMultiplier(2)).toBe(1.0)
  })

  it('returns 1.5 for streak of 3-6 days', () => {
    expect(getStreakMultiplier(3)).toBe(1.5)
    expect(getStreakMultiplier(6)).toBe(1.5)
  })

  it('returns 2.0 for streak of 7-29 days', () => {
    expect(getStreakMultiplier(7)).toBe(2.0)
    expect(getStreakMultiplier(29)).toBe(2.0)
  })

  it('returns 3.0 for streak of 30-99 days', () => {
    expect(getStreakMultiplier(30)).toBe(3.0)
    expect(getStreakMultiplier(99)).toBe(3.0)
  })

  it('returns 5.0 for streak of 100+ days', () => {
    expect(getStreakMultiplier(100)).toBe(5.0)
    expect(getStreakMultiplier(365)).toBe(5.0)
  })
})

// ── getStreakLabel ─────────────────────────────────────────────

describe('getStreakLabel', () => {
  it('returns empty string for streak less than 3 days', () => {
    expect(getStreakLabel(0)).toBe('')
    expect(getStreakLabel(2)).toBe('')
  })

  it('returns warming up label for 3-6 days', () => {
    expect(getStreakLabel(3)).toContain('Warming up')
  })

  it('returns ON FIRE label for 7-29 days', () => {
    expect(getStreakLabel(7)).toContain('ON FIRE')
  })

  it('returns UNSTOPPABLE label for 30-99 days', () => {
    expect(getStreakLabel(30)).toContain('UNSTOPPABLE')
  })

  it('returns IMMORTAL STREAK label for 100+ days', () => {
    expect(getStreakLabel(100)).toContain('IMMORTAL STREAK')
  })
})

// ── calculateXP ──────────────────────────────────────────────

describe('calculateXP', () => {
  const baseContext = {
    isFirstOfDay: false,
    hourOfDay: 12,
    sessionActionTypes: new Set<ActionType>(),
  }

  it('calculates base XP for task_complete with low priority', () => {
    const result = calculateXP('task_complete', { priority: 'low' }, baseContext)
    expect(result.baseXP).toBe(10)
    expect(result.totalXP).toBe(10)
  })

  it('calculates base XP for task_complete with urgent priority', () => {
    const result = calculateXP('task_complete', { priority: 'urgent' }, baseContext)
    expect(result.baseXP).toBe(50)
    expect(result.totalXP).toBe(50)
  })

  it('calculates base XP for task_complete with medium priority (default)', () => {
    const result = calculateXP('task_complete', { priority: 'medium' }, baseContext)
    expect(result.baseXP).toBe(20)
  })

  it('calculates base XP for task_complete with high priority', () => {
    const result = calculateXP('task_complete', { priority: 'high' }, baseContext)
    expect(result.baseXP).toBe(35)
  })

  it('calculates base XP for habit_log without streak', () => {
    const result = calculateXP('habit_log', {}, baseContext)
    expect(result.baseXP).toBe(5)
    expect(result.totalXP).toBe(5)
  })

  it('adds streak milestone bonus for 7-day habit streak', () => {
    const result = calculateXP('habit_log', { streakDays: 7 }, baseContext)
    expect(result.baseXP).toBe(55) // 5 base + 50 milestone
  })

  it('adds streak milestone bonus for 30-day habit streak', () => {
    const result = calculateXP('habit_log', { streakDays: 30 }, baseContext)
    expect(result.baseXP).toBe(155) // 5 base + 150 milestone
  })

  it('adds full streak milestone for 365-day habit streak', () => {
    const result = calculateXP('habit_log', { streakDays: 365 }, baseContext)
    expect(result.baseXP).toBe(2005) // 5 base + 2000 milestone
  })

  it('calculates base XP for goal_complete with goal category', () => {
    const result = calculateXP('goal_complete', { goalCategory: 'goal' }, baseContext)
    expect(result.baseXP).toBe(100)
  })

  it('calculates base XP for goal_complete with epic category', () => {
    const result = calculateXP('goal_complete', { goalCategory: 'epic' }, baseContext)
    expect(result.baseXP).toBe(300)
  })

  it('calculates base XP for goal_complete with objective category', () => {
    const result = calculateXP('goal_complete', { goalCategory: 'objective' }, baseContext)
    expect(result.baseXP).toBe(500)
  })

  it('applies streak multiplier from metadata.streakDays', () => {
    const result = calculateXP('habit_log', { streakDays: 7 }, baseContext)
    // baseXP: 5 + 50 milestone = 55, streak multiplier: 2.0
    expect(result.streakMultiplier).toBe(2.0)
    expect(result.totalXP).toBe(Math.round(55 * 2.0)) // 110
  })

  it('applies combo multiplier for 3+ session action types', () => {
    const ctx = {
      ...baseContext,
      sessionActionTypes: new Set(['task_complete', 'habit_log', 'journal_entry']),
    }
    const result = calculateXP('health_log', {}, ctx)
    // health_log is 4th type, size becomes 4 -> combo
    expect(result.comboMultiplier).toBe(1.5)
  })

  it('applies mega combo multiplier for 5+ session action types', () => {
    const ctx = {
      ...baseContext,
      sessionActionTypes: new Set(['task_complete', 'habit_log', 'journal_entry', 'health_log', 'financial_entry']),
    }
    const result = calculateXP('schedule_event', {}, ctx)
    // schedule_event makes it 6 types
    expect(result.comboMultiplier).toBe(2.0)
  })

  it('applies first-of-day bonus (+25 XP)', () => {
    const result = calculateXP('task_complete', { priority: 'medium' }, {
      ...baseContext,
      isFirstOfDay: true,
    })
    expect(result.firstOfDayBonus).toBe(25)
    expect(result.totalXP).toBe(20 + 25) // base + first of day
  })

  it('applies early bird bonus (5-7am)', () => {
    const result = calculateXP('task_complete', { priority: 'medium' }, {
      ...baseContext,
      hourOfDay: 6,
    })
    expect(result.earlyBirdBonus).toBe(10)
    expect(result.totalXP).toBe(20 + 10)
  })

  it('does not apply early bird bonus outside 5-7am', () => {
    const result = calculateXP('task_complete', { priority: 'medium' }, {
      ...baseContext,
      hourOfDay: 8,
    })
    expect(result.earlyBirdBonus).toBe(0)
  })

  it('applies night owl bonus (11pm-3am)', () => {
    const result = calculateXP('task_complete', { priority: 'medium' }, {
      ...baseContext,
      hourOfDay: 23,
    })
    expect(result.totalXP).toBe(20 + 15) // base + night owl
  })

  it('applies dawn warrior bonus (3-5am)', () => {
    const result = calculateXP('task_complete', { priority: 'medium' }, {
      ...baseContext,
      hourOfDay: 4,
    })
    expect(result.totalXP).toBe(20 + 20) // base + dawn warrior
  })

  it('calculates daily reward with exact XP from metadata', () => {
    const result = calculateXP('daily_reward', { dailyRewardXP: 50 }, baseContext)
    expect(result.baseXP).toBe(50)
  })

  it('calculates junction practice with tier scaling', () => {
    const result = calculateXP('junction_practice', { tier: 3 }, baseContext)
    expect(result.baseXP).toBe(20)
  })

  it('uses default junction XP for unknown tier', () => {
    const result = calculateXP('junction_practice', { tier: 99 }, baseContext)
    expect(result.baseXP).toBe(10)
  })

  it('combines streak multiplier, combo multiplier, and bonuses', () => {
    const ctx = {
      isFirstOfDay: true,
      hourOfDay: 6,
      sessionActionTypes: new Set(['task_complete', 'habit_log', 'journal_entry']),
    }
    const result = calculateXP('task_complete', { priority: 'high', streakDays: 7 }, ctx)
    // baseXP: 35 (high priority), streak: 2.0, combo: 1.5 (4 types)
    // firstOfDay: +25, earlyBird: +10
    const expected = Math.round(35 * 2.0 * 1.5) + 25 + 10
    expect(result.totalXP).toBe(expected) // 140
  })

  it('gives XP for journal_entry', () => {
    const result = calculateXP('journal_entry', {}, baseContext)
    expect(result.baseXP).toBe(15)
  })

  it('gives XP for page_visit', () => {
    const result = calculateXP('page_visit', {}, baseContext)
    expect(result.baseXP).toBe(1)
  })

  it('gives XP for ai_message', () => {
    const result = calculateXP('ai_message', {}, baseContext)
    expect(result.baseXP).toBe(2)
  })

  it('breakdown contains explanation strings', () => {
    const result = calculateXP('task_complete', { priority: 'urgent' }, {
      ...baseContext,
      isFirstOfDay: true,
      hourOfDay: 6,
    })
    expect(result.breakdown.length).toBeGreaterThan(0)
    expect(result.breakdown.some(b => b.includes('urgent'))).toBe(true)
    expect(result.breakdown.some(b => b.includes('First action'))).toBe(true)
    expect(result.breakdown.some(b => b.includes('Early Bird'))).toBe(true)
  })
})

// ── Level system (from levels.ts, tested via xp-engine context) ─

describe('Level progression system', () => {
  it('xpForLevel returns 0 for level 1', () => {
    expect(xpForLevel(1)).toBe(0)
  })

  it('xpForLevel returns level^2 * 100 for level > 1', () => {
    expect(xpForLevel(2)).toBe(400)
    expect(xpForLevel(5)).toBe(2500)
    expect(xpForLevel(10)).toBe(10000)
    expect(xpForLevel(50)).toBe(250000)
  })

  it('getLevelFromXP returns correct level for given XP', () => {
    expect(getLevelFromXP(0)).toBe(1)
    expect(getLevelFromXP(400)).toBe(2)
    expect(getLevelFromXP(2500)).toBe(5)
    expect(getLevelFromXP(10000)).toBe(10)
  })

  it('getLevelFromXP handles partial XP between levels', () => {
    // Level 2 requires 400 XP, level 3 requires 900 XP
    expect(getLevelFromXP(500)).toBe(2) // 400 <= 500 < 900
    expect(getLevelFromXP(899)).toBe(2)
    expect(getLevelFromXP(900)).toBe(3)
  })

  it('getLevelFromXP caps at 99', () => {
    expect(getLevelFromXP(999999999)).toBe(99)
  })

  it('getLevelProgress returns 0-1 progress within current level', () => {
    // Level 2: 400-899, so at 650 XP: (650-400)/(900-400) = 250/500 = 0.5
    const progress = getLevelProgress(650)
    expect(progress).toBeGreaterThanOrEqual(0)
    expect(progress).toBeLessThanOrEqual(1)
  })

  it('getLevelProgress returns 1 at max level (99)', () => {
    const xpFor99 = xpForLevel(99)
    expect(getLevelProgress(xpFor99)).toBe(1)
  })

  it('getLevelProgress returns 0 at start of a level', () => {
    const xpFor5 = xpForLevel(5)
    expect(getLevelProgress(xpFor5)).toBeCloseTo(0, 1)
  })
})