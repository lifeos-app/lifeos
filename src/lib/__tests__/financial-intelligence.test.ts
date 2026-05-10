import { describe, it, expect } from 'vitest'
import {
  generateFinancialInsights,
  getMonthlyBreakdown,
  projectMonthEnd,
  type FinancialInput,
  type FinancialInsight,
} from '../financial-intelligence'
import type { IncomeEntry, ExpenseEntry } from '../../types/database'

// ── Helpers ──────────────────────────────────────────────────

function makeIncome(overrides: Partial<IncomeEntry> = {}): IncomeEntry {
  return {
    id: 'inc-1',
    amount: 5000,
    date: '2025-04-15',
    description: 'Salary',
    source: 'employment',
    is_recurring: true,
    is_deleted: false,
    ...overrides,
  }
}

function makeExpense(overrides: Partial<ExpenseEntry> & { category?: string } = {}): ExpenseEntry {
  const { category, ...rest } = overrides as any
  return {
    id: 'exp-1',
    amount: 100,
    description: 'Test expense',
    date: '2025-04-10',
    is_deductible: false,
    is_deleted: false,
    category_id: null,
    ...rest,
    // Attach category as a loose property for the engine to read
    ...(category ? { category } : {}),
  } as ExpenseEntry & { category?: string }
}

// The financial-intelligence module reads (exp as Record<string, unknown>).category
// so we need to include category directly on the expense object

function monthStr(date: Date): string {
  return date.toISOString().slice(0, 7)
}

// ── detectSpendingAnomalies (via generateFinancialInsights) ──

describe('generateFinancialInsights — spending anomalies', () => {
  const now = new Date('2025-04-20T12:00:00Z')

  it('detects a spending anomaly when this month is 35%+ above average', () => {
    const expenses = [
      // Previous 3 months: $100/mo on food
      ...[1, 2, 3].flatMap(m => [
        makeExpense({ id: `e-prev${m}a`, amount: 50, date: `2025-0${m}-10`, category: 'food' }),
        makeExpense({ id: `e-prev${m}b`, amount: 50, date: `2025-0${m}-20`, category: 'food' }),
      ]),
      // This month: $500 on food (was ~$100 avg)
      makeExpense({ id: 'e-cur1', amount: 500, date: '2025-04-05', category: 'food' }),
    ]

    const input: FinancialInput = { income: [], expenses, now }
    const insights = generateFinancialInsights(input)
    const anomalies = insights.filter(i => i.type === 'spending_anomaly')
    expect(anomalies.length).toBeGreaterThan(0)
    expect(anomalies[0].data.category).toBe('food')
    expect(anomalies[0].severity).toBe('warning')
  })

  it('detects new spending category with no prior data', () => {
    const expenses = [
      makeExpense({ id: 'e-new1', amount: 200, date: '2025-04-05', category: 'gaming' }),
    ]
    const input: FinancialInput = { income: [], expenses, now }
    const insights = generateFinancialInsights(input)
    const anomalies = insights.filter(i => i.type === 'spending_anomaly')
    const newCat = anomalies.find(i => i.data.category === 'gaming')
    expect(newCat).toBeDefined()
    expect(newCat!.message).toContain('no previous data')
  })

  it('returns no anomaly when spending is within normal range', () => {
    const expenses = [
      // Consistent spending each month
      ...[1, 2, 3, 4].flatMap(m => [
        makeExpense({ id: `e${m}a`, amount: 100, date: `2025-0${m}-10`, category: 'food' }),
      ]),
    ]
    const input: FinancialInput = { income: [], expenses, now }
    const insights = generateFinancialInsights(input)
    const anomalies = insights.filter(i => i.type === 'spending_anomaly')
    // $100/mo every month = 0 deviation
    expect(anomalies.length).toBe(0)
  })

  it('detects a spending decrease (success anomaly)', () => {
    const expenses = [
      // Previous months: $500/mo on subscriptions
      ...[1, 2, 3].flatMap(m => [
        makeExpense({ id: `e-prev${m}`, amount: 500, date: `2025-0${m}-15`, category: 'subscriptions' }),
      ]),
      // This month: only $100 on subscriptions
      makeExpense({ id: 'e-cur1', amount: 100, date: '2025-04-15', category: 'subscriptions' }),
    ]
    const input: FinancialInput = { income: [], expenses, now }
    const insights = generateFinancialInsights(input)
    const anomalies = insights.filter(i => i.type === 'spending_anomaly' && i.data.category === 'subscriptions')
    expect(anomalies.length).toBe(1)
    expect(anomalies[0].severity).toBe('success')
  })
})

// ── forecastIncome (via generateFinancialInsights) ───────────

describe('generateFinancialInsights — income forecast', () => {
  const now = new Date('2025-04-20T12:00:00Z')

  it('produces an income forecast with enough months of data', () => {
    const income = [
      makeIncome({ id: 'i1', amount: 5000, date: '2025-01-15' }),
      makeIncome({ id: 'i2', amount: 5200, date: '2025-02-15' }),
      makeIncome({ id: 'i3', amount: 5400, date: '2025-03-15' }),
      makeIncome({ id: 'i4', amount: 5600, date: '2025-04-15' }),
    ]
    const input: FinancialInput = { income, expenses: [], now }
    const insights = generateFinancialInsights(input)
    const forecasts = insights.filter(i => i.type === 'income_forecast')
    expect(forecasts.length).toBe(1)
    expect(forecasts[0].data.predicted).toBeGreaterThan(0)
    expect(forecasts[0].data.confidence).toBeGreaterThanOrEqual(0.5)
  })

  it('skips income forecast with fewer than 2 months of data', () => {
    const income = [makeIncome({ id: 'i1', amount: 5000, date: '2025-04-15' })]
    const input: FinancialInput = { income, expenses: [], now }
    const insights = generateFinancialInsights(input)
    const forecasts = insights.filter(i => i.type === 'income_forecast')
    expect(forecasts.length).toBe(0)
  })
})

// ── findSavingsOpportunities (via generateFinancialInsights) ─

describe('generateFinancialInsights — savings opportunities', () => {
  const now = new Date('2025-04-20T12:00:00Z')

  it('identifies a savings opportunity when 10% of spending >= $50', () => {
    const expenses = [
      makeExpense({ id: 'e1', amount: 600, date: '2025-04-05', category: 'food' }),
    ]
    const input: FinancialInput = { income: [], expenses, now }
    const insights = generateFinancialInsights(input)
    const savings = insights.filter(i => i.type === 'savings_opportunity')
    // 10% of 600 = $60 >= $50 threshold
    expect(savings.length).toBe(1)
    expect(savings[0].data.monthly).toBe(600)
    expect(savings[0].data.savings10).toBe(60)
    expect(savings[0].data.annual).toBe(720)
  })

  it('skips categories where 10% savings would be less than $50', () => {
    const expenses = [
      makeExpense({ id: 'e1', amount: 400, date: '2025-04-05', category: 'small' }),
    ]
    const input: FinancialInput = { income: [], expenses, now }
    const insights = generateFinancialInsights(input)
    const savings = insights.filter(i => i.type === 'savings_opportunity' && i.data.category === 'small')
    // 10% of 400 = $40 < $50 threshold
    expect(savings.length).toBe(0)
  })

  it('returns at most 3 savings opportunities sorted by annual savings', () => {
    const expenses = [
      makeExpense({ id: 'e1', amount: 1500, date: '2025-04-01', category: 'rent' }),
      makeExpense({ id: 'e2', amount: 800, date: '2025-04-02', category: 'car' }),
      makeExpense({ id: 'e3', amount: 700, date: '2025-04-03', category: 'food' }),
      makeExpense({ id: 'e4', amount: 600, date: '2025-04-04', category: 'entertainment' }),
    ]
    const input: FinancialInput = { income: [], expenses, now }
    const insights = generateFinancialInsights(input)
    const savings = insights.filter(i => i.type === 'savings_opportunity')
    expect(savings.length).toBeLessThanOrEqual(3)
    // Should be sorted by annual savings descending
    for (let i = 1; i < savings.length; i++) {
      expect((savings[i - 1].data.annual as number) >= (savings[i].data.annual as number)).toBe(true)
    }
  })
})

// ── analyzeTrend (via generateFinancialInsights) ─────────────

describe('generateFinancialInsights — trend alert', () => {
  const now = new Date('2025-04-20T12:00:00Z')

  it('detects an improving trend when net position increases', () => {
    const income = [
      makeIncome({ id: 'i-last', amount: 4000, date: '2025-03-15' }),
      makeIncome({ id: 'i-this', amount: 6000, date: '2025-04-15' }),
    ]
    const expenses = [
      makeExpense({ id: 'e-last', amount: 3000, date: '2025-03-10', category: 'food' }),
      makeExpense({ id: 'e-this', amount: 2000, date: '2025-04-10', category: 'food' }),
    ]
    const input: FinancialInput = { income, expenses, now }
    const insights = generateFinancialInsights(input)
    const trends = insights.filter(i => i.type === 'trend_alert')
    expect(trends.length).toBe(1)
    expect(trends[0].data.direction).toBeUndefined() // direction not in data, but severity should be success
    expect((trends[0].data.change as number)).toBeGreaterThan(0)
  })

  it('detects a declining trend when net position decreases significantly', () => {
    const income = [
      makeIncome({ id: 'i-last', amount: 5000, date: '2025-03-15' }),
      makeIncome({ id: 'i-this', amount: 3000, date: '2025-04-15' }),
    ]
    const expenses = [
      makeExpense({ id: 'e-last', amount: 1000, date: '2025-03-10', category: 'food' }),
      makeExpense({ id: 'e-this', amount: 4000, date: '2025-04-10', category: 'food' }),
    ]
    const input: FinancialInput = { income, expenses, now }
    const insights = generateFinancialInsights(input)
    const trends = insights.filter(i => i.type === 'trend_alert')
    expect(trends.length).toBe(1)
    expect(trends[0].severity).toBe('warning')
  })

  it('ignores trivial trend changes under $50', () => {
    const income = [
      makeIncome({ id: 'i-last', amount: 5000, date: '2025-03-15' }),
      makeIncome({ id: 'i-this', amount: 5020, date: '2025-04-15' }),
    ]
    const expenses = [
      makeExpense({ id: 'e-last', amount: 3000, date: '2025-03-10', category: 'food' }),
      makeExpense({ id: 'e-this', amount: 3010, date: '2025-04-10', category: 'food' }),
    ]
    const input: FinancialInput = { income, expenses, now }
    const insights = generateFinancialInsights(input)
    const trends = insights.filter(i => i.type === 'trend_alert')
    expect(trends.length).toBe(0)
  })
})

// ── generateFinancialInsights — sorting and limits ───────────

describe('generateFinancialInsights — sorting and limits', () => {
  it('sorts insights by severity: warning first, then success, then info', () => {
    const now = new Date('2025-04-20T12:00:00Z')
    // Create spending anomaly (warning) and savings opportunity (info)
    const expenses = [
      // Anomaly: $500 on food this month, $100 avg prev
      ...[1, 2, 3].flatMap(m => [
        makeExpense({ id: `e-prev${m}`, amount: 100, date: `2025-0${m}-15`, category: 'food' }),
      ]),
      makeExpense({ id: 'e-cur1', amount: 500, date: '2025-04-05', category: 'food' }),
      // Savings: $600 on rent
      makeExpense({ id: 'e-cur2', amount: 600, date: '2025-04-06', category: 'rent' }),
    ]
    const input: FinancialInput = { income: [], expenses, now }
    const insights = generateFinancialInsights(input)

    // Warning insights (anomalies with upward deviation) come first
    if (insights.length >= 2) {
      const severities = insights.map(i => i.severity)
      const warningIdx = severities.indexOf('warning')
      const infoIdx = severities.indexOf('info')
      if (warningIdx >= 0 && infoIdx >= 0) {
        expect(warningIdx).toBeLessThan(infoIdx)
      }
    }
  })

  it('returns at most 8 insights', () => {
    const now = new Date('2025-04-20T12:00:00Z')
    const income = Array.from({ length: 6 }, (_, i) =>
      makeIncome({ id: `i${i}`, amount: 5000 + i * 100, date: `2025-0${i + 1}-15` })
    )
    // Create many anomaly categories with higher current spending
    const categories = ['food', 'entertainment', 'subscriptions', 'transport', 'rent']
    const expenses = [
      ...[1, 2, 3].flatMap(m =>
        categories.flatMap(cat =>
          [makeExpense({ id: `e${m}${cat}`, amount: 100, date: `2025-0${m}-10`, category: cat })]
        )
      ),
      // This month: much higher
      ...categories.flatMap(cat =>
        [makeExpense({ id: `ecur${cat}`, amount: 600, date: '2025-04-10', category: cat })]
      ),
    ]
    const input: FinancialInput = { income, expenses, now }
    const insights = generateFinancialInsights(input)
    expect(insights.length).toBeLessThanOrEqual(8)
  })

  it('returns empty array when no data provided', () => {
    const now = new Date('2025-04-20T12:00:00Z')
    const input: FinancialInput = { income: [], expenses: [], now }
    const insights = generateFinancialInsights(input)
    expect(insights).toEqual([])
  })
})

// ── getMonthlyBreakdown ──────────────────────────────────────

describe('getMonthlyBreakdown', () => {
  it('returns category breakdown with percentages', () => {
    const expenses = [
      makeExpense({ id: 'e1', amount: 600, date: '2025-04-05', category: 'food' }),
      makeExpense({ id: 'e2', amount: 400, date: '2025-04-10', category: 'transport' }),
    ]
    const result = getMonthlyBreakdown(expenses, '2025-04')
    expect(result.length).toBe(2)
    expect(result.find(r => r.category === 'food')!.amount).toBe(600)
    expect(result.find(r => r.category === 'food')!.percentage).toBe(60)
    expect(result.find(r => r.category === 'transport')!.percentage).toBe(40)
  })

  it('returns empty array when no expenses match the month', () => {
    const expenses = [
      makeExpense({ id: 'e1', amount: 100, date: '2025-03-05', category: 'food' }),
    ]
    const result = getMonthlyBreakdown(expenses, '2025-04')
    expect(result).toEqual([])
  })

  it('sorts categories by amount descending', () => {
    const expenses = [
      makeExpense({ id: 'e1', amount: 200, date: '2025-04-01', category: 'food' }),
      makeExpense({ id: 'e2', amount: 800, date: '2025-04-02', category: 'rent' }),
      makeExpense({ id: 'e3', amount: 300, date: '2025-04-03', category: 'transport' }),
    ]
    const result = getMonthlyBreakdown(expenses, '2025-04')
    expect(result[0].category).toBe('rent')
    expect(result[1].category).toBe('transport')
    expect(result[2].category).toBe('food')
  })

  it('uses uncategorised for expenses without a category', () => {
    const expenses = [
      { id: 'e1', amount: 100, date: '2025-04-05', description: 'Test', is_deductible: false, is_deleted: false },
    ]
    const result = getMonthlyBreakdown(expenses as ExpenseEntry[], '2025-04')
    expect(result.length).toBe(1)
    expect(result[0].category).toBe('uncategorised')
  })
})

// ── projectMonthEnd ──────────────────────────────────────────

describe('projectMonthEnd', () => {
  it('projects net position based on daily rates', () => {
    const now = new Date('2025-04-15T12:00:00Z') // Day 15 of 30-day month
    const income = [makeIncome({ id: 'i1', amount: 3000, date: '2025-04-01' })]
    const expenses = [makeExpense({ id: 'e1', amount: 1500, date: '2025-04-01', category: 'rent' })]
    const input: FinancialInput = { income, expenses, now }

    const projection = projectMonthEnd(input)
    expect(projection.daysRemaining).toBe(15) // April has 30 days, day 15 means 15 remaining
    expect(projection.projectedIncome).toBeGreaterThan(0)
    expect(projection.projectedExpenses).toBeGreaterThan(0)
    expect(projection.projectedNet).toBe(projection.projectedIncome - projection.projectedExpenses)
  })

  it('handles zero income or expenses', () => {
    const now = new Date('2025-04-15T12:00:00Z')
    const input: FinancialInput = { income: [], expenses: [], now }
    const projection = projectMonthEnd(input)
    expect(projection.projectedNet).toBe(0)
    expect(projection.projectedIncome).toBe(0)
    expect(projection.projectedExpenses).toBe(0)
  })
})