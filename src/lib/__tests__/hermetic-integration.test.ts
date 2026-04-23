import { describe, it, expect, vi } from 'vitest'
import {
  SEVEN_PRINCIPLES,
  DOMAIN_PRINCIPLE,
  getDailyPrinciple,
  getDomainPrinciple,
  getHermeticQuote,
  getDailyAffirmation,
  getHermeticFooter,
  HERMETIC_BLESSING,
  type HermeticPrinciple,
} from '../hermetic-integration'

// ── Canonical Kybalion order ──────────────────────────────────
const CANONICAL_ORDER = [
  'MENTALISM',
  'CORRESPONDENCE',
  'VIBRATION',
  'POLARITY',
  'RHYTHM',
  'CAUSE & EFFECT',
  'GENDER',
] as const

// ── Required fields on every principle ─────────────────────────
const REQUIRED_FIELDS: (keyof HermeticPrinciple)[] = [
  'name',
  'axiom',
  'quote',
  'attribution',
  'correspondences',
  'lifeOSDomain',
  'dailyAffirmation',
  'color',
]

// Helper: check hex color
function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color)
}

// ══════════════════════════════════════════════════════════════
// SEVEN_PRINCIPLES
// ══════════════════════════════════════════════════════════════

describe('SEVEN_PRINCIPLES', () => {
  it('has exactly 7 entries', () => {
    expect(SEVEN_PRINCIPLES).toHaveLength(7)
  })

  it('follows canonical Kybalion order', () => {
    const names = SEVEN_PRINCIPLES.map(p => p.name)
    expect(names).toEqual([...CANONICAL_ORDER])
  })

  it('contains all required fields on every principle', () => {
    for (const principle of SEVEN_PRINCIPLES) {
      for (const field of REQUIRED_FIELDS) {
        expect(principle[field]).toBeDefined()
        expect(typeof principle[field]).toBe('string')
        expect(principle[field].length).toBeGreaterThan(0)
      }
    }
  })

  it('has no duplicate names', () => {
    const names = SEVEN_PRINCIPLES.map(p => p.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('has no duplicate axioms', () => {
    const axioms = SEVEN_PRINCIPLES.map(p => p.axiom)
    expect(new Set(axioms).size).toBe(axioms.length)
  })

  it('has no duplicate quotes', () => {
    const quotes = SEVEN_PRINCIPLES.map(p => p.quote)
    expect(new Set(quotes).size).toBe(quotes.length)
  })

  it('has no duplicate colors', () => {
    const colors = SEVEN_PRINCIPLES.map(p => p.color)
    expect(new Set(colors).size).toBe(colors.length)
  })

  it('has valid hex colors for every principle', () => {
    for (const principle of SEVEN_PRINCIPLES) {
      expect(isValidHexColor(principle.color)).toBe(true)
    }
  })

  it('has non-empty correspondences for every principle', () => {
    for (const principle of SEVEN_PRINCIPLES) {
      expect(principle.correspondences.length).toBeGreaterThan(0)
    }
  })

  it('has non-empty lifeOSDomain for every principle', () => {
    for (const principle of SEVEN_PRINCIPLES) {
      expect(principle.lifeOSDomain.length).toBeGreaterThan(0)
    }
  })

  it('has non-empty dailyAffirmation for every principle', () => {
    for (const principle of SEVEN_PRINCIPLES) {
      expect(principle.dailyAffirmation.length).toBeGreaterThan(0)
    }
  })

  it('has non-empty attribution for every principle', () => {
    for (const principle of SEVEN_PRINCIPLES) {
      expect(principle.attribution.length).toBeGreaterThan(0)
    }
  })
})

// ══════════════════════════════════════════════════════════════
// DOMAIN_PRINCIPLE
// ══════════════════════════════════════════════════════════════

describe('DOMAIN_PRINCIPLE', () => {
  const validIndices = [0, 1, 2, 3, 4, 5, 6]

  it('maps every domain to a valid principle index (0-6)', () => {
    for (const [domain, idx] of Object.entries(DOMAIN_PRINCIPLE)) {
      expect(validIndices).toContain(idx)
    }
  })

  it('maps all expected app domains', () => {
    const expectedDomains = [
      'dashboard',
      'oracle',
      'ai',
      'habits',
      'health',
      'schedule',
      'finance',
      'goals',
      'realm',
      'garden',
      'social',
      'journal',
    ]
    for (const domain of expectedDomains) {
      expect(DOMAIN_PRINCIPLE).toHaveProperty(domain)
    }
  })

  it('maps domain indices to the correct principle name', () => {
    expect(SEVEN_PRINCIPLES[DOMAIN_PRINCIPLE.dashboard].name).toBe('CORRESPONDENCE')
    expect(SEVEN_PRINCIPLES[DOMAIN_PRINCIPLE.oracle].name).toBe('MENTALISM')
    expect(SEVEN_PRINCIPLES[DOMAIN_PRINCIPLE.ai].name).toBe('MENTALISM')
    expect(SEVEN_PRINCIPLES[DOMAIN_PRINCIPLE.habits].name).toBe('VIBRATION')
    expect(SEVEN_PRINCIPLES[DOMAIN_PRINCIPLE.health].name).toBe('POLARITY')
    expect(SEVEN_PRINCIPLES[DOMAIN_PRINCIPLE.schedule].name).toBe('RHYTHM')
    expect(SEVEN_PRINCIPLES[DOMAIN_PRINCIPLE.finance].name).toBe('CAUSE & EFFECT')
    expect(SEVEN_PRINCIPLES[DOMAIN_PRINCIPLE.goals].name).toBe('CAUSE & EFFECT')
    expect(SEVEN_PRINCIPLES[DOMAIN_PRINCIPLE.realm].name).toBe('GENDER')
    expect(SEVEN_PRINCIPLES[DOMAIN_PRINCIPLE.garden].name).toBe('GENDER')
    expect(SEVEN_PRINCIPLES[DOMAIN_PRINCIPLE.social].name).toBe('CORRESPONDENCE')
    expect(SEVEN_PRINCIPLES[DOMAIN_PRINCIPLE.journal].name).toBe('MENTALISM')
  })
})

// ══════════════════════════════════════════════════════════════
// getDailyPrinciple
// ══════════════════════════════════════════════════════════════

describe('getDailyPrinciple', () => {
  it('returns a principle from the SEVEN_PRINCIPLES list', () => {
    const result = getDailyPrinciple()
    expect(SEVEN_PRINCIPLES).toContainEqual(result)
  })

  it('returns different principles for different days', () => {
    const principles = new Set<string>()
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      // Use vi.setSystemTime to mock the system clock
      vi.setSystemTime(new Date(2025, 0, 1 + dayOffset))
      const p = getDailyPrinciple()
      principles.add(p.name)
    }
    vi.useRealTimers()

    // 7 different days should yield at least 2 different principles
    expect(principles.size).toBeGreaterThanOrEqual(2)
  })

  it('rotates through all 7 principles over a week', () => {
    const principles = new Set<string>()
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      vi.setSystemTime(new Date(2025, 0, 1 + dayOffset))
      const p = getDailyPrinciple()
      principles.add(p.name)
    }
    vi.useRealTimers()

    expect(principles.size).toBe(7)
  })
})

// ══════════════════════════════════════════════════════════════
// getDomainPrinciple
// ══════════════════════════════════════════════════════════════

describe('getDomainPrinciple', () => {
  it('returns the correct principle for known domains', () => {
    expect(getDomainPrinciple('dashboard').name).toBe('CORRESPONDENCE')
    expect(getDomainPrinciple('oracle').name).toBe('MENTALISM')
    expect(getDomainPrinciple('habits').name).toBe('VIBRATION')
    expect(getDomainPrinciple('health').name).toBe('POLARITY')
    expect(getDomainPrinciple('schedule').name).toBe('RHYTHM')
    expect(getDomainPrinciple('finance').name).toBe('CAUSE & EFFECT')
    expect(getDomainPrinciple('realm').name).toBe('GENDER')
  })

  it('defaults to CORRESPONDENCE (index 1) for unknown domains', () => {
    const result = getDomainPrinciple('unknown-domain-xyz')
    expect(result.name).toBe('CORRESPONDENCE')
  })

  it('is case-insensitive for domain lookup', () => {
    expect(getDomainPrinciple('Dashboard').name).toBe('CORRESPONDENCE')
    expect(getDomainPrinciple('DASHBOARD').name).toBe('CORRESPONDENCE')
    expect(getDomainPrinciple('sChEdUlE').name).toBe('RHYTHM')
  })
})

// ══════════════════════════════════════════════════════════════
// getHermeticQuote
// ══════════════════════════════════════════════════════════════

describe('getHermeticQuote', () => {
  it('returns an object with quote, attribution, and color', () => {
    const result = getHermeticQuote('habits')
    expect(result).toHaveProperty('quote')
    expect(result).toHaveProperty('attribution')
    expect(result).toHaveProperty('color')
    expect(typeof result.quote).toBe('string')
    expect(typeof result.attribution).toBe('string')
    expect(typeof result.color).toBe('string')
  })

  it('returns the axiom as quote for a known domain', () => {
    const result = getHermeticQuote('habits')
    // habits maps to VIBRATION, whose axiom is "Nothing Rests; Everything Moves"
    expect(result.quote).toBe('Nothing Rests; Everything Moves')
  })

  it('returns the principle name as attribution', () => {
    const result = getHermeticQuote('health')
    // health maps to POLARITY
    expect(result.attribution).toBe('POLARITY')
  })

  it('returns the correct hex color', () => {
    const result = getHermeticQuote('health')
    // POLARITY color is '#FACC15'
    expect(result.color).toBe('#FACC15')
    expect(isValidHexColor(result.color)).toBe(true)
  })

  it('defaults to CORRESPONDENCE for unknown domain', () => {
    const result = getHermeticQuote('nonexistent')
    expect(result.attribution).toBe('CORRESPONDENCE')
  })
})

// ══════════════════════════════════════════════════════════════
// getDailyAffirmation
// ══════════════════════════════════════════════════════════════

describe('getDailyAffirmation', () => {
  it('returns an object with text, principle, and color', () => {
    const result = getDailyAffirmation()
    expect(result).toHaveProperty('text')
    expect(result).toHaveProperty('principle')
    expect(result).toHaveProperty('color')
    expect(typeof result.text).toBe('string')
    expect(typeof result.principle).toBe('string')
    expect(typeof result.color).toBe('string')
  })

  it('returns text matching the daily principle affirmation', () => {
    const result = getDailyAffirmation()
    const daily = getDailyPrinciple()
    expect(result.text).toBe(daily.dailyAffirmation)
    expect(result.principle).toBe(daily.name)
    expect(result.color).toBe(daily.color)
  })

  it('returns a valid hex color', () => {
    const result = getDailyAffirmation()
    expect(isValidHexColor(result.color)).toBe(true)
  })

  it('returns a non-empty affirmation text', () => {
    const result = getDailyAffirmation()
    expect(result.text.length).toBeGreaterThan(0)
  })
})

// ══════════════════════════════════════════════════════════════
// getHermeticFooter
// ══════════════════════════════════════════════════════════════

describe('getHermeticFooter', () => {
  it('returns an object with quote, principle, and color', () => {
    const result = getHermeticFooter('schedule')
    expect(result).toHaveProperty('quote')
    expect(result).toHaveProperty('principle')
    expect(result).toHaveProperty('color')
    expect(typeof result.quote).toBe('string')
    expect(typeof result.principle).toBe('string')
    expect(typeof result.color).toBe('string')
  })

  it('returns the principle name', () => {
    const result = getHermeticFooter('schedule')
    expect(result.principle).toBe('RHYTHM')
  })

  it('returns the principle color', () => {
    const result = getHermeticFooter('schedule')
    expect(result.color).toBe('#F97316')
  })

  it('alternates between axiom and lifeOSDomain based on day of month', () => {
    // Even date → axiom; Odd date → lifeOSDomain
    // We test by checking the quote is one of the two possible values
    const result = getHermeticFooter('habits')
    const principle = getDomainPrinciple('habits')
    expect([principle.axiom, principle.lifeOSDomain]).toContain(result.quote)
  })

  it('defaults to CORRESPONDENCE for unknown domain', () => {
    const result = getHermeticFooter('nonexistent')
    expect(result.principle).toBe('CORRESPONDENCE')
  })
})

// ══════════════════════════════════════════════════════════════
// HERMETIC_BLESSING
// ══════════════════════════════════════════════════════════════

describe('HERMETIC_BLESSING', () => {
  it('has an invocation string', () => {
    expect(typeof HERMETIC_BLESSING.invocation).toBe('string')
    expect(HERMETIC_BLESSING.invocation.length).toBeGreaterThan(0)
  })

  it('has a sevenFold string containing all 7 principles', () => {
    expect(typeof HERMETIC_BLESSING.sevenFold).toBe('string')
    for (const principle of SEVEN_PRINCIPLES) {
      expect(HERMETIC_BLESSING.sevenFold).toContain(principle.name)
      expect(HERMETIC_BLESSING.sevenFold).toContain(principle.axiom)
    }
  })

  it('has a closing string', () => {
    expect(typeof HERMETIC_BLESSING.closing).toBe('string')
    expect(HERMETIC_BLESSING.closing.length).toBeGreaterThan(0)
  })

  it('closing contains hermetic phrases', () => {
    expect(HERMETIC_BLESSING.closing).toContain('As above')
    expect(HERMETIC_BLESSING.closing).toContain('so below')
  })
})