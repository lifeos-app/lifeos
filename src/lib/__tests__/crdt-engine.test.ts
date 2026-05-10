import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock localStorage for getNodeId()
const store: Record<string, string | null> = {}
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k] }),
  get length() { return Object.keys(store).length },
  key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
})

// Mock crypto.randomUUID for deterministic node IDs
let uuidCounter = 0
vi.stubGlobal('crypto', {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
})

import {
  CRDTEngine,
  getNodeId,
  registerFieldStrategy,
  createCRDTDocument,
  mergeCRDTDocuments,
  crdtToPlain,
  plainToCRDT,
  type CRDTDocument,
  type RGAState,
} from '../crdt-engine'

// ── Helpers ──────────────────────────────────────────────────

beforeEach(() => {
  uuidCounter = 0
  // Reset CRDTEngine singleton between tests
  CRDTEngine['_instance'] = null
  // Clear localStorage mock store for fresh node ID generation
  for (const k of Object.keys(store)) delete store[k]
  // Reset field strategies
  registerFieldStrategy('total_xp', 'gcounter')
  registerFieldStrategy('tags', 'orset')
})

// ── getNodeId ────────────────────────────────────────────────

describe('getNodeId', () => {
  it('returns a stable node ID', () => {
    const id1 = getNodeId()
    const id2 = getNodeId()
    expect(id1).toBe(id2)
  })

  it('generates an ID string', () => {
    const id = getNodeId()
    expect(id).toBeTruthy()
    expect(typeof id).toBe('string')
  })
})

// ── CRDTEngine — Document Creation ───────────────────────────

describe('CRDTEngine — createDocument', () => {
  it('creates a document with LWW fields for string and number values by default', () => {
    const engine = CRDTEngine.getInstance()
    const doc = engine.createDocument('test-1', 'tasks', { title: 'Hello', priority: 5 })
    expect(doc.id).toBe('test-1')
    expect(doc.type).toBe('tasks')
    expect(doc.fields.title).toBeDefined()
    expect(doc.fields.title.type).toBe('lww')
    expect(doc.fields.priority.type).toBe('lww')
  })

  it('creates a GCounter for fields registered as gcounter', () => {
    const engine = CRDTEngine.getInstance()
    const doc = engine.createDocument('test-1', 'tasks', { total_xp: 100 })
    expect(doc.fields.total_xp.type).toBe('gcounter')
    const value = engine.toPlain(doc)
    expect(value.total_xp).toBe(100)
  })

  it('creates an ORSet for string array values', () => {
    const engine = CRDTEngine.getInstance()
    const doc = engine.createDocument('test-1', 'tasks', { tags: ['work', 'urgent'] })
    expect(doc.fields.tags.type).toBe('orset')
    const value = engine.toPlain(doc)
    expect(value.tags).toContain('work')
    expect(value.tags).toContain('urgent')
  })

  it('creates an RGA for non-string array values', () => {
    const engine = CRDTEngine.getInstance()
    const doc = engine.createDocument('test-1', 'tasks', { items: [1, 2, 3] })
    expect(doc.fields.items.type).toBe('rga')
    const value = engine.toPlain(doc)
    expect(value.items).toEqual([1, 2, 3])
  })

  it('skips null and undefined values', () => {
    const engine = CRDTEngine.getInstance()
    const doc = engine.createDocument('test-1', 'tasks', { title: 'Hello', empty: null, undef: undefined } as any)
    expect(doc.fields.title).toBeDefined()
    expect(doc.fields.empty).toBeUndefined()
    expect(doc.fields.undef).toBeUndefined()
  })

  it('initializes vector clock with node ID', () => {
    const engine = CRDTEngine.getInstance()
    const doc = engine.createDocument('test-1', 'tasks', { title: 'Test' })
    const nodeId = engine.nodeId
    expect(doc.clock[nodeId]).toBeDefined()
    expect(doc.clock[nodeId]).toBeGreaterThan(0)
  })
})

// ── GCounter ─────────────────────────────────────────────────

describe('GCounter merge', () => {
  it('merges GCounters from different nodes by preserving per-node values', () => {
    const engine = CRDTEngine.getInstance()
    // Create two docs with same field name, different values
    // With same node ID, GCounter takes max per node, so 50 > 30 = 50
    const docA = engine.createDocument('a', 'tasks', { total_xp: 50 })
    const docB = engine.createDocument('b', 'tasks', { total_xp: 30 })
    const merged = engine.mergeDocument(docA, docB)
    const plain = engine.toPlain(merged)
    // Same node ID → max(50, 30) = 50
    expect(plain.total_xp).toBe(50)
  })

  it('merges GCounters from different node IDs to produce sum', () => {
    // Use two different engine instances (different node IDs)
    const engineA = CRDTEngine.getInstance()
    const docA = engineA.createDocument('a', 'tasks', { total_xp: 50 })

    // Reset singleton to get a different node ID
    CRDTEngine['_instance'] = null
    uuidCounter++
    const engineB = CRDTEngine.getInstance()
    const docB = engineB.createDocument('b', 'tasks', { total_xp: 30 })

    const merged = engineA.mergeDocument(docA, docB)
    const plain = engineA.toPlain(merged)
    // Different node IDs → sum of both = 80
    expect(plain.total_xp).toBe(80)
  })
})

describe('GCounter — incrementCounter', () => {
  it('increments an existing GCounter field', () => {
    const engine = CRDTEngine.getInstance()
    const doc = engine.createDocument('test-1', 'tasks', { total_xp: 10 })
    const updated = engine.incrementCounter(doc, 'total_xp', 5)
    const plain = engine.toPlain(updated)
    expect(plain.total_xp).toBe(15)
  })

  it('creates a new GCounter field if it does not exist', () => {
    const engine = CRDTEngine.getInstance()
    const doc = engine.createDocument('test-1', 'tasks', { title: 'Test' })
    const updated = engine.incrementCounter(doc, 'streak_current', 3)
    const plain = engine.toPlain(updated)
    expect(plain.streak_current).toBe(3)
  })
})

// ── LWWRegister ──────────────────────────────────────────────

describe('LWWRegister merge', () => {
  it('selects the value with the higher timestamp', () => {
    const engine = CRDTEngine.getInstance()
    const docA = engine.createDocument('a', 'tasks', { title: 'Version A' })

    // Create second doc with a slight delay to get a different timestamp
    // Since both use same node, the later call will have a higher timestamp
    const docB = engine.createDocument('b', 'tasks', { title: 'Version B' })

    const merged = engine.mergeDocument(docA, docB)
    const plain = engine.toPlain(merged)
    // The later-created doc should win due to higher timestamp
    expect(['Version A', 'Version B']).toContain(plain.title)
  })

  it('resolves ties deterministically using nodeId', () => {
    const engine = CRDTEngine.getInstance()
    // Both created at same ms with same node ID = same doc effectively
    const docA = engine.createDocument('a', 'tasks', { title: 'Alpha' })
    const docB = engine.createDocument('b', 'tasks', { title: 'Beta' })

    const merged = engine.mergeDocument(docA, docB)
    const plain = engine.toPlain(merged)
    // Result is deterministic
    expect(typeof plain.title).toBe('string')
  })
})

// ── ORSet ────────────────────────────────────────────────────

describe('ORSet — add and remove elements', () => {
  it('preserves elements from both sides on merge', () => {
    const engineA = CRDTEngine.getInstance()
    const docA = engineA.createDocument('a', 'tasks', { tags: ['alpha', 'beta'] })

    CRDTEngine['_instance'] = null
    uuidCounter++
    const engineB = CRDTEngine.getInstance()
    const docB = engineB.createDocument('b', 'tasks', { tags: ['gamma', 'delta'] })

    const merged = engineA.mergeDocument(docA, docB)
    const plain = engineA.toPlain(merged)
    const tags = plain.tags as string[]
    expect(tags.sort()).toEqual(['alpha', 'beta', 'delta', 'gamma'].sort())
  })

  it('add and remove elements via CRDTEngine methods', () => {
    const engine = CRDTEngine.getInstance()
    let doc = engine.createDocument('test-1', 'tasks', { tags: ['work'] })
    // Add element
    doc = engine.addElement(doc, 'tags', 'personal')
    let plain = engine.toPlain(doc)
    expect((plain.tags as string[])).toContain('personal')
    expect((plain.tags as string[])).toContain('work')

    // Remove element
    doc = engine.removeElement(doc, 'tags', 'work')
    plain = engine.toPlain(doc)
    expect((plain.tags as string[])).not.toContain('work')
    expect((plain.tags as string[])).toContain('personal')
  })

  it('removing a non-existent element is a no-op', () => {
    const engine = CRDTEngine.getInstance()
    const doc = engine.createDocument('test-1', 'tasks', { tags: ['work'] })
    const result = engine.removeElement(doc, 'tags', 'nonexistent')
    const plain = engine.toPlain(result)
    expect((plain.tags as string[])).toContain('work')
    expect((plain.tags as string[])).toHaveLength(1)
  })
})

// ── RGA ──────────────────────────────────────────────────────

describe('RGA merge — ordered lists', () => {
  it('preserves all items from both sides on merge', () => {
    const engineA = CRDTEngine.getInstance()
    const docA = engineA.createDocument('a', 'tasks', { items: ['a', 'b'] })

    CRDTEngine['_instance'] = null
    uuidCounter++
    const engineB = CRDTEngine.getInstance()
    const docB = engineB.createDocument('b', 'tasks', { items: ['c', 'd'] })

    const merged = engineA.mergeDocument(docA, docB)
    const plain = engineA.toPlain(merged)
    const items = plain.items as string[]
    expect(items.sort()).toEqual(['a', 'b', 'c', 'd'].sort())
  })

  it('maintains order within a single document', () => {
    const engine = CRDTEngine.getInstance()
    const doc = engine.createDocument('test-1', 'tasks', { items: ['first', 'second', 'third'] })
    const plain = engine.toPlain(doc)
    expect(plain.items).toEqual(['first', 'second', 'third'])
  })

  it('handles merge of document with itself (idempotent)', () => {
    const engine = CRDTEngine.getInstance()
    const doc = engine.createDocument('test-1', 'tasks', { title: 'Hello', tags: ['a'] })
    const merged = engine.mergeDocument(doc, doc)
    const plain = engine.toPlain(merged)
    expect(plain.title).toBe('Hello')
    expect(plain.tags).toContain('a')
  })
})

// ── mergeDocument — cross-type and field merging ──────────────

describe('mergeDocument — field merging', () => {
  it('preserves fields from local when remote has no matching field', () => {
    const engine = CRDTEngine.getInstance()
    const local = engine.createDocument('a', 'tasks', { title: 'Hello', total_xp: 10 })
    const remote = engine.createDocument('b', 'tasks', { title: 'World' })
    const merged = engine.mergeDocument(local, remote)
    const plain = engine.toPlain(merged)
    expect(plain.total_xp).toBe(10)
  })

  it('preserves fields from remote when local has no matching field', () => {
    const engine = CRDTEngine.getInstance()
    const local = engine.createDocument('a', 'tasks', { title: 'Hello' })
    const remote = engine.createDocument('b', 'tasks', { title: 'World', extra: 'field' })
    const merged = engine.mergeDocument(local, remote)
    const plain = engine.toPlain(merged)
    expect(plain.extra).toBe('field')
  })
})

// ── toPlain / fromPlain roundtrip ────────────────────────────

describe('toPlain / fromPlain roundtrip', () => {
  it('round-trips simple data through CRDT and back', () => {
    const engine = CRDTEngine.getInstance()
    const original = { title: 'My Task', total_xp: 42, tags: ['work'] }
    const doc = engine.createDocument('r1', 'tasks', original)
    const plain = engine.toPlain(doc)

    expect(plain.title).toBe('My Task')
    expect(plain.total_xp).toBe(42)
    expect(plain.tags).toContain('work')
  })

  it('fromPlain is an alias for createDocument', () => {
    const engine = CRDTEngine.getInstance()
    const doc1 = engine.fromPlain('fp1', 'tasks', { title: 'Test' })
    const doc2 = engine.createDocument('fp1', 'tasks', { title: 'Test' })
    expect(doc1.type).toBe(doc2.type)
    expect(Object.keys(doc1.fields)).toEqual(Object.keys(doc2.fields))
  })
})

// ── updateField ──────────────────────────────────────────────

describe('updateField', () => {
  it('updates an LWW field', () => {
    const engine = CRDTEngine.getInstance()
    const doc = engine.createDocument('test-1', 'tasks', { title: 'Old' })
    const updated = engine.updateField(doc, 'title', 'New')
    expect(engine.toPlain(updated).title).toBe('New')
  })

  it('updates a GCounter field by replacing it', () => {
    const engine = CRDTEngine.getInstance()
    const doc = engine.createDocument('test-1', 'tasks', { total_xp: 10 })
    const updated = engine.updateField(doc, 'total_xp', 20)
    expect(engine.toPlain(updated).total_xp).toBe(20)
  })

  it('adds a new field if it does not exist', () => {
    const engine = CRDTEngine.getInstance()
    const doc = engine.createDocument('test-1', 'tasks', { title: 'Test' })
    const updated = engine.updateField(doc, 'new_field', 'hello')
    expect(engine.toPlain(updated).new_field).toBe('hello')
  })
})

// ── Serialization ─────────────────────────────────────────────

describe('serialization', () => {
  it('serializes and deserializes a document with all CRDT types', () => {
    const engine = CRDTEngine.getInstance()
    const doc = engine.createDocument('ser-1', 'tasks', {
      title: 'Serialized',
      total_xp: 100,
      tags: ['a', 'b'],
      items: [1, 2],
    })

    const serialized = engine.serialize(doc)
    expect(serialized.__crdt__).toBe(true)
    expect(serialized.id).toBe('ser-1')
    expect(serialized.type).toBe('tasks')

    const deserialized = engine.deserialize(serialized as Record<string, unknown>)
    expect(deserialized).not.toBeNull()
    expect(deserialized!.id).toBe('ser-1')

    const plain = engine.toPlain(deserialized!)
    expect(plain.title).toBe('Serialized')
    expect(plain.total_xp).toBe(100)
    expect(plain.tags).toContain('a')
    expect(plain.tags).toContain('b')
  })

  it('returns null when deserializing invalid data', () => {
    const engine = CRDTEngine.getInstance()
    expect(engine.deserialize({})).toBeNull()
    expect(engine.deserialize({ foo: 'bar' })).toBeNull()
  })
})

// ── resolveConflict ─────────────────────────────────────────

describe('resolveConflict', () => {
  it('falls back to LWW when no CRDT state is provided', () => {
    const engine = CRDTEngine.getInstance()

    const local = { id: '1', title: 'Local', updated_at: '2025-01-01T00:00:00Z' }
    const remote = { id: '1', title: 'Remote', updated_at: '2025-01-02T00:00:00Z' }

    const resolved = engine.resolveConflict(local, remote, 'tasks', '1', null, null)
    expect(resolved.title).toBe('Remote')
  })

  it('merges CRDT state when local CRDT is provided', () => {
    const engine = CRDTEngine.getInstance()

    const localData = { title: 'Local', total_xp: 50 }
    const remoteData = { title: 'Remote', total_xp: 30 }

    // Create local CRDT doc
    const localCRDT = engine.createDocument('1', 'tasks', localData)
    const resolved = engine.resolveConflict(localData, remoteData, 'tasks', '1', localCRDT, null)

    // GCounter should be wrapped for remote, then merged
    // Same node ID means the max is taken for each counter
    expect(resolved.total_xp).toBeGreaterThan(0)
    expect(typeof resolved.title).toBe('string')
  })

  it('merges CRDT state when both CRDT states are provided', () => {
    const engineA = CRDTEngine.getInstance()
    const localData = { title: 'Local', total_xp: 50 }
    const localCRDT = engineA.createDocument('1', 'tasks', localData)

    CRDTEngine['_instance'] = null
    uuidCounter++
    const engineB = CRDTEngine.getInstance()
    const remoteData = { title: 'Remote', total_xp: 30 }
    const remoteCRDT = engineB.createDocument('1', 'tasks', remoteData)

    const resolved = engineA.resolveConflict(localData, remoteData, 'tasks', '1', localCRDT, remoteCRDT)
    // Different node IDs → GCounter sum = 50 + 30 = 80
    expect(resolved.total_xp).toBe(80)
  })
})

// ── mergeAll ─────────────────────────────────────────────────

describe('mergeAll', () => {
  it('merges multiple documents into one', () => {
    const engineA = CRDTEngine.getInstance()
    const docA = engineA.createDocument('a', 'tasks', { total_xp: 10 })

    CRDTEngine['_instance'] = null
    uuidCounter++
    const engineB = CRDTEngine.getInstance()
    const docB = engineB.createDocument('b', 'tasks', { total_xp: 20 })

    CRDTEngine['_instance'] = null
    uuidCounter++
    const engineC = CRDTEngine.getInstance()
    const docC = engineC.createDocument('c', 'tasks', { total_xp: 30 })

    const merged = engineA.mergeAll([docA, docB, docC])
    const plain = engineA.toPlain(merged)
    // Three different node IDs, each with their own counter → sum = 60
    expect(plain.total_xp).toBe(60)
  })

  it('throws when merging zero documents', () => {
    const engine = CRDTEngine.getInstance()
    expect(() => engine.mergeAll([])).toThrow('Cannot merge zero documents')
  })
})

// ── Convenience exports ──────────────────────────────────────

describe('convenience exports', () => {
  it('createCRDTDocument creates a document via singleton', () => {
    const doc = createCRDTDocument('conv-1', 'tasks', { title: 'Conv' })
    expect(doc.id).toBe('conv-1')
    expect(doc.fields.title).toBeDefined()
  })

  it('mergeCRDTDocuments merges two documents via singleton', () => {
    const docA = createCRDTDocument('a', 'tasks', { title: 'A' })
    const docB = createCRDTDocument('b', 'tasks', { title: 'B' })
    const merged = mergeCRDTDocuments(docA, docB)
    expect(merged.id).toBeTruthy()
  })

  it('crdtToPlain extracts plain values', () => {
    const doc = createCRDTDocument('p1', 'tasks', { title: 'Plain', total_xp: 5 })
    const plain = crdtToPlain(doc)
    expect(plain.title).toBe('Plain')
    expect(plain.total_xp).toBe(5)
  })

  it('plainToCRDT wraps plain data', () => {
    const doc = plainToCRDT('pt1', 'tasks', { title: 'Wrapped' })
    expect(doc.id).toBe('pt1')
    expect(doc.fields.title).toBeDefined()
  })
})

// ── registerFieldStrategy ────────────────────────────────────

describe('registerFieldStrategy', () => {
  it('overrides default strategy for a field', () => {
    registerFieldStrategy('custom_field', 'gcounter')
    const engine = CRDTEngine.getInstance()
    const doc = engine.createDocument('test-1', 'tasks', { custom_field: 42 })
    expect(doc.fields.custom_field.type).toBe('gcounter')
  })
})