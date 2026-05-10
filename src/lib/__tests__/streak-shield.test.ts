import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock localStorage with a simple in-memory store ─────────────

const store: Record<string, string | null> = {}

const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k] }),
  get length() { return Object.keys(store).length },
  key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
}

// Override globalThis.localStorage so the module uses our mock
vi.stubGlobal('localStorage', localStorageMock)

import {
  getShieldInfo,
  useShield,
  hasShieldAvailableForHabit,
  checkAndEarnShields,
  getAvailableShieldCount,
  resetShieldState,
  MAX_SHIELDS,
} from '../streak-shield'

// ── Reset state between tests ─────────────────────────────────

beforeEach(() => {
  // Clear the in-memory store and mock call history
  for (const k of Object.keys(store)) delete store[k]
  localStorageMock.getItem.mockClear()
  localStorageMock.setItem.mockClear()
  localStorageMock.removeItem.mockClear()
})

// ── getShieldInfo ─────────────────────────────────────────────

describe('getShieldInfo', () => {
  it('returns zero shields when no state is stored', () => {
    const info = getShieldInfo()
    expect(info.availableShields).toBe(0)
    expect(info.maxShields).toBe(MAX_SHIELDS)
    expect(info.canUse).toBe(false)
    expect(info.usesThisWeek).toEqual([])
  })

  it('returns correct shield count from storage', () => {
    store['lifeos_streak_shields'] = '2'
    const info = getShieldInfo()
    expect(info.availableShields).toBe(2)
    expect(info.canUse).toBe(true)
  })

  it('caps shield count at MAX_SHIELDS', () => {
    store['lifeos_streak_shields'] = '10'
    const info = getShieldInfo()
    expect(info.availableShields).toBe(MAX_SHIELDS)
  })

  it('returns uses from this week only', () => {
    const today = new Date().toISOString().split('T')[0]
    store['lifeos_streak_shields'] = '1'
    store['lifeos_streak_shield_uses'] = JSON.stringify([
      { date: today, habitId: 'habit-1' },
    ])

    const info = getShieldInfo()
    expect(info.usesThisWeek.length).toBeGreaterThanOrEqual(1)
  })
})

// ── useShield ────────────────────────────────────────────────

describe('useShield', () => {
  it('returns false when no shields available', () => {
    store['lifeos_streak_shields'] = '0'
    const result = useShield('habit-1', '2025-04-10')
    expect(result).toBe(false)
  })

  it('successfully uses a shield and decrements count', () => {
    store['lifeos_streak_shields'] = '2'
    const result = useShield('habit-1', '2025-04-10')
    expect(result).toBe(true)
    // The module should have stored '1' (2-1)
    expect(store['lifeos_streak_shields']).toBe('1')
  })

  it('returns false when shield already used for same habit and date', () => {
    store['lifeos_streak_shields'] = '2'
    store['lifeos_streak_shield_uses'] = JSON.stringify([
      { date: '2025-04-10', habitId: 'habit-1' },
    ])

    const result = useShield('habit-1', '2025-04-10')
    expect(result).toBe(false)
  })

  it('allows using shield for different habit on same date', () => {
    store['lifeos_streak_shields'] = '2'
    store['lifeos_streak_shield_uses'] = JSON.stringify([
      { date: '2025-04-10', habitId: 'habit-1' },
    ])

    const result = useShield('habit-2', '2025-04-10')
    expect(result).toBe(true)
  })

  it('allows using shield for same habit on different date', () => {
    store['lifeos_streak_shields'] = '2'
    store['lifeos_streak_shield_uses'] = JSON.stringify([
      { date: '2025-04-09', habitId: 'habit-1' },
    ])

    const result = useShield('habit-1', '2025-04-10')
    expect(result).toBe(true)
  })

  it('stores the use record after using a shield', () => {
    store['lifeos_streak_shields'] = '1'
    useShield('habit-1', '2025-04-10')

    const storedUses = JSON.parse(store['lifeos_streak_shield_uses'] || '[]')
    expect(storedUses.some((u: any) => u.habitId === 'habit-1' && u.date === '2025-04-10')).toBe(true)
  })

  it('prunes old uses when storing new ones', () => {
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 20)
    const oldDateStr = oldDate.toISOString().split('T')[0]

    store['lifeos_streak_shields'] = '2'
    store['lifeos_streak_shield_uses'] = JSON.stringify([
      { date: oldDateStr, habitId: 'habit-old' },
    ])

    useShield('habit-1', new Date().toISOString().split('T')[0])

    const storedUses = JSON.parse(store['lifeos_streak_shield_uses'] || '[]')
    expect(storedUses.some((u: any) => u.habitId === 'habit-old')).toBe(false)
    expect(storedUses.some((u: any) => u.habitId === 'habit-1')).toBe(true)
  })
})

// ── hasShieldAvailableForHabit ────────────────────────────────

describe('hasShieldAvailableForHabit', () => {
  it('returns true when a shield was used for the habit on the date', () => {
    store['lifeos_streak_shield_uses'] = JSON.stringify([
      { date: '2025-04-10', habitId: 'habit-1' },
    ])

    expect(hasShieldAvailableForHabit('habit-1', '2025-04-10')).toBe(true)
  })

  it('returns false when no shield was used', () => {
    expect(hasShieldAvailableForHabit('habit-1', '2025-04-10')).toBe(false)
  })

  it('returns false for different habit on same date', () => {
    store['lifeos_streak_shield_uses'] = JSON.stringify([
      { date: '2025-04-10', habitId: 'habit-1' },
    ])

    expect(hasShieldAvailableForHabit('habit-2', '2025-04-10')).toBe(false)
  })

  it('returns false for same habit on different date', () => {
    store['lifeos_streak_shield_uses'] = JSON.stringify([
      { date: '2025-04-10', habitId: 'habit-1' },
    ])

    expect(hasShieldAvailableForHabit('habit-1', '2025-04-11')).toBe(false)
  })
})

// ── checkAndEarnShields ──────────────────────────────────────

describe('checkAndEarnShields', () => {
  it('returns 0 when streak is below threshold (7 days)', () => {
    expect(checkAndEarnShields(3)).toBe(0)
    expect(checkAndEarnShields(6)).toBe(0)
  })

  it('earns a shield when streak is 7+ and no shield earned this week', () => {
    store['lifeos_streak_shields'] = '0'
    const result = checkAndEarnShields(7)
    expect(result).toBe(1)
    expect(store['lifeos_streak_shields']).toBe('1')
  })

  it('stores the last-earned date when earning a shield', () => {
    store['lifeos_streak_shields'] = '0'
    checkAndEarnShields(7)

    const today = new Date().toISOString().split('T')[0]
    expect(store['lifeos_streak_shield_last_earned']).toBe(today)
  })

  it('does not earn a second shield within the same week', () => {
    store['lifeos_streak_shields'] = '1'
    const today = new Date().toISOString().split('T')[0]
    store['lifeos_streak_shield_last_earned'] = today

    const result = checkAndEarnShields(8)
    expect(result).toBe(0)
  })

  it('earns a shield after 7 days since last earned', () => {
    const daysAgo8 = new Date()
    daysAgo8.setDate(daysAgo8.getDate() - 8)
    const daysAgo8Str = daysAgo8.toISOString().split('T')[0]

    store['lifeos_streak_shields'] = '1'
    store['lifeos_streak_shield_last_earned'] = daysAgo8Str

    const result = checkAndEarnShields(14)
    expect(result).toBe(1)
  })

  it('does not earn when already at MAX_SHIELDS', () => {
    store['lifeos_streak_shields'] = String(MAX_SHIELDS)

    const result = checkAndEarnShields(21)
    expect(result).toBe(0)
  })

  it('can earn up to MAX_SHIELDS over multiple weeks', () => {
    store['lifeos_streak_shields'] = String(MAX_SHIELDS - 1)
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 8)
    store['lifeos_streak_shield_last_earned'] = oldDate.toISOString().split('T')[0]

    const result = checkAndEarnShields(35)
    expect(result).toBe(1)
    expect(Number(store['lifeos_streak_shields'])).toBe(MAX_SHIELDS)
  })
})

// ── getAvailableShieldCount ───────────────────────────────────

describe('getAvailableShieldCount', () => {
  it('returns 0 when no shields stored', () => {
    expect(getAvailableShieldCount()).toBe(0)
  })

  it('returns stored shield count', () => {
    store['lifeos_streak_shields'] = '2'
    expect(getAvailableShieldCount()).toBe(2)
  })
})

// ── resetShieldState ──────────────────────────────────────────

describe('resetShieldState', () => {
  it('clears all shield data from localStorage', () => {
    store['lifeos_streak_shields'] = '3'
    store['lifeos_streak_shield_last_earned'] = '2025-04-01'
    store['lifeos_streak_shield_uses'] = '[]'

    resetShieldState()

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('lifeos_streak_shields')
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('lifeos_streak_shield_last_earned')
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('lifeos_streak_shield_uses')
  })
})

// ── Edge Cases ────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles localStorage errors gracefully in getShieldInfo', () => {
    localStorageMock.getItem.mockImplementationOnce(() => { throw new Error('localStorage unavailable') })
    const info = getShieldInfo()
    expect(info.availableShields).toBe(0)
  })

  it('handles invalid shield count in localStorage by capping to MAX_SHIELDS', () => {
    store['lifeos_streak_shields'] = '999'
    const info = getShieldInfo()
    expect(info.availableShields).toBe(MAX_SHIELDS)
    expect(info.canUse).toBe(true)
  })

  it('useShield returns false when shield count is NaN in storage', () => {
    store['lifeos_streak_shields'] = 'not-a-number'
    const result = useShield('habit-1', '2025-04-10')
    // parseInt('not-a-number', 10) = NaN, NaN <= 0 is false in JS
    // But the module uses Math.min(parseInt, MAX_SHIELDS), and NaN comparisons
    // Result depends on implementation: NaN <= 0 is false, so no shields available
    expect(result).toBe(false)
  })
})

// ── Integration: earn then use shields ────────────────────────

describe('integration: earn then use shields', () => {
  it('earns a shield after 7-day streak, then uses it', () => {
    // Start fresh
    resetShieldState()

    // Earn first shield
    const earned = checkAndEarnShields(7)
    expect(earned).toBe(1)

    // Check available
    let info = getShieldInfo()
    expect(info.availableShields).toBe(1)
    expect(info.canUse).toBe(true)

    // Use the shield
    const today = new Date().toISOString().split('T')[0]
    const used = useShield('habit-meditate', today)
    expect(used).toBe(true)

    // After using, shields should be 0
    info = getShieldInfo()
    expect(info.availableShields).toBe(0)
    expect(info.canUse).toBe(false)
  })
})