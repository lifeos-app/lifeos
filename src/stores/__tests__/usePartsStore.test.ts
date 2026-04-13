import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock all heavy dependencies
vi.mock('../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../../lib/offline', () => ({ isOnline: () => true }))
vi.mock('../../components/Toast', () => ({ showToast: vi.fn() }))
vi.mock('../../lib/local-db', () => ({
  localGetAll: vi.fn().mockResolvedValue([]),
  localInsert: vi.fn().mockImplementation((_table: string, data: any) =>
    Promise.resolve({ id: data.id || 'generated-id', ...data })
  ),
  localUpdate: vi.fn().mockResolvedValue({}),
  localDelete: vi.fn().mockResolvedValue({}),
  getLocalUserId: () => 'test-user',
  getEffectiveUserId: () => 'test-user',
}))
vi.mock('../../lib/sync-engine', () => ({
  syncNow: vi.fn().mockResolvedValue(undefined),
  waitForInitialSync: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../lib/local-api', () => ({
  localApiFetch: vi.fn().mockResolvedValue(null),
}))
vi.mock('../useUserStore', () => ({
  useUserStore: { getState: () => ({ getSessionCached: () => Promise.resolve({ data: { session: null } }) }) },
}))
vi.mock('../../utils/logger', () => ({ logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('../../utils/date', () => ({
  genId: () => 'test-id-' + Math.random().toString(36).slice(2, 8),
  localDateStr: () => '2026-04-13',
}))

import { usePartsStore, type PartItem } from '../usePartsStore'

function makePart(overrides: Partial<PartItem> = {}): PartItem {
  return {
    id: 'part-' + Math.random().toString(36).slice(2, 8),
    user_id: 'test-user',
    name: 'Test Part',
    description: null,
    category: 'Electronics',
    quantity: 10,
    unit_price: 5.99,
    location: 'Bin A1',
    supplier: 'DigiKey',
    sku: 'SKU-123',
    condition: 'new',
    notes: null,
    tags: ['urgent'],
    custom_fields: {},
    image_url: null,
    created_at: '2026-04-13T00:00:00Z',
    updated_at: '2026-04-13T00:00:00Z',
    is_deleted: 0,
    sync_status: 'synced',
    ...overrides,
  }
}

describe('usePartsStore', () => {
  beforeEach(() => {
    usePartsStore.setState({
      items: [],
      loading: false,
      lastFetched: null,
    })
  })

  it('has correct initial state', () => {
    const state = usePartsStore.getState()
    expect(state.items).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.lastFetched).toBeNull()
  })

  it('store exports are importable', async () => {
    const mod = await import('../usePartsStore')
    expect(mod.usePartsStore).toBeDefined()
    expect(typeof mod.usePartsStore.getState).toBe('function')
  })

  it('addItem adds a part to the items array', async () => {
    const { addItem } = usePartsStore.getState()
    const result = await addItem({
      name: 'Resistor 10k',
      category: 'Electronics',
      quantity: 100,
      unit_price: 0.05,
    })

    expect(result).not.toBeNull()
    expect(result!.name).toBe('Resistor 10k')
    expect(result!.category).toBe('Electronics')
    expect(result!.quantity).toBe(100)
    expect(result!.unit_price).toBe(0.05)

    // Items array should contain the new part
    const state = usePartsStore.getState()
    expect(state.items).toHaveLength(1)
    expect(state.items[0].name).toBe('Resistor 10k')
  })

  it('addItem uses default values for missing fields', async () => {
    const { addItem } = usePartsStore.getState()
    const result = await addItem({ name: 'Bare Minimum' })

    expect(result).not.toBeNull()
    expect(result!.name).toBe('Bare Minimum')
    expect(result!.category).toBeNull()
    expect(result!.quantity).toBe(0)
    expect(result!.unit_price).toBe(0)
    expect(result!.condition).toBe('new')
    expect(result!.tags).toEqual([])
    expect(result!.custom_fields).toEqual({})
  })

  it('updateItem modifies an existing item', async () => {
    // Pre-populate state
    const part = makePart({ id: 'part-1', name: 'Old Name', quantity: 5 })
    usePartsStore.setState({ items: [part] })

    const { updateItem } = usePartsStore.getState()
    await updateItem('part-1', { name: 'New Name', quantity: 20 })

    const state = usePartsStore.getState()
    expect(state.items).toHaveLength(1)
    expect(state.items[0].name).toBe('New Name')
    expect(state.items[0].quantity).toBe(20)
    // Unchanged fields preserved
    expect(state.items[0].category).toBe('Electronics')
  })

  it('updateItem does not affect other items', async () => {
    const part1 = makePart({ id: 'part-1', name: 'Part 1' })
    const part2 = makePart({ id: 'part-2', name: 'Part 2' })
    usePartsStore.setState({ items: [part1, part2] })

    const { updateItem } = usePartsStore.getState()
    await updateItem('part-1', { name: 'Updated Part 1' })

    const state = usePartsStore.getState()
    expect(state.items[0].name).toBe('Updated Part 1')
    expect(state.items[1].name).toBe('Part 2')
  })

  it('deleteItem removes an item from the array', async () => {
    const part1 = makePart({ id: 'part-1', name: 'Keep Me' })
    const part2 = makePart({ id: 'part-2', name: 'Delete Me' })
    usePartsStore.setState({ items: [part1, part2] })

    const { deleteItem } = usePartsStore.getState()
    await deleteItem('part-2')

    const state = usePartsStore.getState()
    expect(state.items).toHaveLength(1)
    expect(state.items[0].id).toBe('part-1')
    expect(state.items[0].name).toBe('Keep Me')
  })

  it('bulkInsert adds multiple items', async () => {
    usePartsStore.setState({ items: [] })

    const { bulkInsert } = usePartsStore.getState()
    const count = await bulkInsert([
      { name: 'Part A', quantity: 5, unit_price: 1.00 },
      { name: 'Part B', quantity: 10, unit_price: 2.50 },
      { name: 'Part C', quantity: 3, unit_price: 10.00 },
    ])

    expect(count).toBe(3)
    const state = usePartsStore.getState()
    expect(state.items).toHaveLength(3)
  })

  it('invalidate clears lastFetched', () => {
    usePartsStore.setState({ lastFetched: Date.now() })
    const { invalidate } = usePartsStore.getState()
    invalidate()
    expect(usePartsStore.getState().lastFetched).toBeNull()
  })

  it('bulkInsert handles string quantity/price conversion', async () => {
    const { bulkInsert } = usePartsStore.getState()
    const count = await bulkInsert([
      { name: 'String Qty', quantity: '25' as any, unit_price: '3.50' as any },
    ])

    expect(count).toBe(1)
    const state = usePartsStore.getState()
    // The store should parse string values to numbers
    expect(typeof state.items[0].quantity).toBe('number')
    expect(typeof state.items[0].unit_price).toBe('number')
  })
})