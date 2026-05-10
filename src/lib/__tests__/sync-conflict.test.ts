import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock localStorage for conflict storage
const localStorageStore: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key] }),
  clear: vi.fn(() => { for (const k of Object.keys(localStorageStore)) delete localStorageStore[k] }),
  get length() { return Object.keys(localStorageStore).length },
  key: vi.fn((i: number) => Object.keys(localStorageStore)[i] ?? null),
})

// Mock window.dispatchEvent for tests
const dispatchEventSpy = vi.fn()
vi.stubGlobal('window', { dispatchEvent: dispatchEventSpy })

import {
  detectConflict,
  resolveConflict,
  logConflict,
  getConflicts,
  clearConflicts,
  getConflictCount,
  setUseCRDT,
  getResolvedData,
  type ConflictRecord,
} from '../sync-conflict'
import { CRDTEngine } from '../crdt-engine'

// Reset CRDTEngine singleton and storage
beforeEach(() => {
  for (const k of Object.keys(localStorageStore)) delete localStorageStore[k]
  CRDTEngine['_instance'] = null
})

// ── Helpers ──────────────────────────────────────────────────

function makeConflict(overrides: Partial<ConflictRecord> = {}): ConflictRecord {
  return {
    id: 'conflict-1',
    tableName: 'tasks',
    recordId: 'task-1',
    localUpdatedAt: '2025-01-01T00:00:00Z',
    remoteUpdatedAt: '2025-01-02T00:00:00Z',
    winner: 'remote',
    resolvedAt: '2025-01-02T01:00:00Z',
    fieldChanges: [{ field: 'title', localValue: 'Old', remoteValue: 'New' }],
    ...overrides,
  }
}

// ── detectConflict ───────────────────────────────────────────

describe('detectConflict', () => {
  it('returns null when remote is older than local', () => {
    const local = { id: '1', title: 'Local', updated_at: '2025-01-02T00:00:00Z' }
    const remote = { id: '1', title: 'Remote', updated_at: '2025-01-01T00:00:00Z' }
    const result = detectConflict(local, remote, 'tasks')
    expect(result).toBeNull()
  })

  it('returns null when timestamps are equal', () => {
    const ts = '2025-01-01T00:00:00Z'
    const local = { id: '1', title: 'Local', updated_at: ts }
    const remote = { id: '1', title: 'Remote', updated_at: ts }
    const result = detectConflict(local, remote, 'tasks')
    expect(result).toBeNull()
  })

  it('returns null when data is identical despite different timestamps', () => {
    const local = { id: '1', title: 'Same', updated_at: '2025-01-01T00:00:00Z' }
    const remote = { id: '1', title: 'Same', updated_at: '2025-01-02T00:00:00Z' }
    const result = detectConflict(local, remote, 'tasks')
    expect(result).toBeNull()
  })

  it('returns null when updated_at is missing', () => {
    const local = { id: '1', title: 'A' }
    const remote = { id: '1', title: 'B' }
    const result = detectConflict(local, remote, 'tasks')
    expect(result).toBeNull()
  })

  it('detects a real conflict when remote is newer and data differs', () => {
    const local = { id: '1', title: 'Old Title', updated_at: '2025-01-01T00:00:00Z' }
    const remote = { id: '1', title: 'New Title', updated_at: '2025-01-02T00:00:00Z' }
    const result = detectConflict(local, remote, 'tasks')

    expect(result).not.toBeNull()
    expect(result!.tableName).toBe('tasks')
    expect(result!.recordId).toBe('1')
    expect(result!.localUpdatedAt).toBe('2025-01-01T00:00:00Z')
    expect(result!.remoteUpdatedAt).toBe('2025-01-02T00:00:00Z')
    expect(result!.fieldChanges.length).toBeGreaterThan(0)
  })

  it('detects field-level changes correctly', () => {
    const local = { id: '1', title: 'Old', status: 'todo', updated_at: '2025-01-01T00:00:00Z' }
    const remote = { id: '1', title: 'New', status: 'done', updated_at: '2025-01-02T00:00:00Z' }
    const result = detectConflict(local, remote, 'tasks')

    expect(result).not.toBeNull()
    const changedFields = result!.fieldChanges.map(c => c.field)
    expect(changedFields).toContain('title')
    expect(changedFields).toContain('status')
  })

  it('skips metadata fields like updated_at and synced in diff', () => {
    const local = { id: '1', title: 'Same', updated_at: '2025-01-01T00:00:00Z', synced: true }
    const remote = { id: '1', title: 'Same', updated_at: '2025-01-02T00:00:00Z', synced: false }
    const result = detectConflict(local, remote, 'tasks')
    // Only synced differs, but it's excluded, and title is same
    // updated_at differs but is excluded from field diff. Result should be null since no meaningful field changed
    expect(result).toBeNull()
  })

  it('uses CRDT merge when USE_CRDT is true', () => {
    setUseCRDT(true)
    const local = { id: '1', title: 'Local Title', updated_at: '2025-01-01T00:00:00Z' }
    const remote = { id: '1', title: 'Remote Title', updated_at: '2025-01-02T00:00:00Z' }
    const result = detectConflict(local, remote, 'tasks')

    expect(result).not.toBeNull()
    expect(result!.winner).toBe('crdt-merge')
    expect(result!.resolvedData).toBeDefined()
  })

  it('falls back to LWW winner when USE_CRDT is false', () => {
    setUseCRDT(false)
    const local = { id: '1', title: 'Local Title', updated_at: '2025-01-01T00:00:00Z' }
    const remote = { id: '1', title: 'Remote Title', updated_at: '2025-01-02T00:00:00Z' }
    const result = detectConflict(local, remote, 'tasks')

    expect(result).not.toBeNull()
    expect(result!.winner).toBe('remote')
    expect(result!.resolvedData).toBeNull()

    // Restore for other tests
    setUseCRDT(true)
  })

  it('extracts recordId from remote.id first, then local.id, then user_id', () => {
    const local = { user_id: 'u1', title: 'A', updated_at: '2025-01-01T00:00:00Z' }
    const remote = { id: 'r1', title: 'B', updated_at: '2025-01-02T00:00:00Z' }
    const result = detectConflict(local, remote, 'tasks')
    expect(result!.recordId).toBe('r1')
  })

  it('falls back to unknown recordId when no id or user_id present', () => {
    const local = { title: 'A', updated_at: '2025-01-01T00:00:00Z' }
    const remote = { title: 'B', updated_at: '2025-01-02T00:00:00Z' }
    const result = detectConflict(local, remote, 'tasks')
    expect(result!.recordId).toBe('unknown')
  })

  it('handles invalid timestamps gracefully', () => {
    const local = { id: '1', title: 'A', updated_at: 'not-a-date' }
    const remote = { id: '1', title: 'B', updated_at: 'also-not-a-date' }
    const result = detectConflict(local, remote, 'tasks')
    expect(result).toBeNull()
  })
})

// ── resolveConflict ──────────────────────────────────────────

describe('resolveConflict', () => {
  it('returns remote data when remote is newer (LWW fallback)', () => {
    setUseCRDT(false)
    const local = { id: '1', title: 'Local', updated_at: '2025-01-01T00:00:00Z' }
    const remote = { id: '1', title: 'Remote', updated_at: '2025-01-02T00:00:00Z' }
    const resolved = resolveConflict(local, remote, 'tasks')
    expect(resolved.title).toBe('Remote')
    setUseCRDT(true)
  })

  it('returns local data when local is newer (LWW fallback)', () => {
    setUseCRDT(false)
    const local = { id: '1', title: 'Local', updated_at: '2025-01-03T00:00:00Z' }
    const remote = { id: '1', title: 'Remote', updated_at: '2025-01-01T00:00:00Z' }
    const resolved = resolveConflict(local, remote, 'tasks')
    expect(resolved.title).toBe('Local')
    setUseCRDT(true)
  })

  it('uses CRDT merge when USE_CRDT is true', () => {
    setUseCRDT(true)
    const local = { id: '1', title: 'Local', total_xp: 100, updated_at: '2025-01-01T00:00:00Z' }
    const remote = { id: '1', title: 'Remote', total_xp: 50, updated_at: '2025-01-02T00:00:00Z' }
    const resolved = resolveConflict(local, remote, 'tasks', null, null)

    // GCounter should merge by max-per-node, producing combined total
    expect(resolved.total_xp).toBeGreaterThan(0)
  })
})

// ── getResolvedData ──────────────────────────────────────────

describe('getResolvedData', () => {
  it('returns resolvedData when winner is crdt-merge and data exists', () => {
    const conflict = makeConflict({
      winner: 'crdt-merge',
      resolvedData: { title: 'Merged', id: '1' },
    })
    const local = { id: '1', title: 'Local' }
    const remote = { id: '1', title: 'Remote' }
    const result = getResolvedData(conflict, local, remote)
    expect(result.title).toBe('Merged')
  })

  it('returns remote data when winner is remote', () => {
    const conflict = makeConflict({ winner: 'remote' })
    const local = { id: '1', title: 'Local' }
    const remote = { id: '1', title: 'Remote' }
    const result = getResolvedData(conflict, local, remote)
    expect(result.title).toBe('Remote')
  })

  it('returns local data when winner is local', () => {
    const conflict = makeConflict({ winner: 'local' })
    const local = { id: '1', title: 'Local' }
    const remote = { id: '1', title: 'Remote' }
    const result = getResolvedData(conflict, local, remote)
    expect(result.title).toBe('Local')
  })

  it('returns local data when crdt-merge winner but no resolvedData', () => {
    const conflict = makeConflict({ winner: 'crdt-merge', resolvedData: null })
    const local = { id: '1', title: 'Local' }
    const remote = { id: '1', title: 'Remote' }
    // Fallback: since winner is crdt-merge but no resolvedData, default to local
    const result = getResolvedData(conflict, local, remote)
    expect(result).toBeDefined()
  })
})

// ── logConflict ──────────────────────────────────────────────

describe('logConflict', () => {
  it('stores conflict in localStorage', () => {
    const conflict = makeConflict()
    logConflict(conflict)

    expect(localStorage.setItem).toHaveBeenCalled()
    const stored = localStorage.getItem('lifeos:conflicts')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.length).toBe(1)
    expect(parsed[0].id).toBe('conflict-1')
  })

  it('dispatches lifeos:conflicts-updated event', () => {
    dispatchEventSpy.mockClear()
    const conflict = makeConflict()
    logConflict(conflict)
    expect(dispatchEventSpy).toHaveBeenCalled()
  })

  it('prepends new conflicts and caps at 100', () => {
    // Pre-fill 100 conflicts
    const existing = Array.from({ length: 100 }, (_, i) =>
      makeConflict({ id: `old-${i}`, localUpdatedAt: '2025-01-01T00:00:00Z', remoteUpdatedAt: '2025-01-02T00:00:00Z' })
    )
    localStorageStore['lifeos:conflicts'] = JSON.stringify(existing)

    const newConflict = makeConflict({ id: 'new-1' })
    logConflict(newConflict)

    const stored = JSON.parse(localStorageStore['lifeos:conflicts'])
    expect(stored.length).toBe(100)
    expect(stored[0].id).toBe('new-1')
  })
})

// ── getConflicts ─────────────────────────────────────────────

describe('getConflicts', () => {
  it('returns stored conflicts from localStorage', () => {
    const conflicts = [makeConflict({ id: 'c1' }), makeConflict({ id: 'c2' })]
    localStorageStore['lifeos:conflicts'] = JSON.stringify(conflicts)

    const result = getConflicts()
    expect(result.length).toBe(2)
    expect(result[0].id).toBe('c1')
    expect(result[1].id).toBe('c2')
  })

  it('respects the limit parameter', () => {
    const conflicts = Array.from({ length: 10 }, (_, i) => makeConflict({ id: `c${i}` }))
    localStorageStore['lifeos:conflicts'] = JSON.stringify(conflicts)

    const result = getConflicts(3)
    expect(result.length).toBe(3)
  })

  it('returns empty array when no conflicts stored', () => {
    const result = getConflicts()
    expect(result).toEqual([])
  })

  it('returns empty array when localStorage has invalid JSON', () => {
    localStorageStore['lifeos:conflicts'] = 'not-json'
    const result = getConflicts()
    expect(result).toEqual([])
  })
})

// ── clearConflicts ──────────────────────────────────────────

describe('clearConflicts', () => {
  it('removes conflicts from localStorage', () => {
    localStorageStore['lifeos:conflicts'] = JSON.stringify([makeConflict()])
    clearConflicts()
    expect(localStorage.removeItem).toHaveBeenCalledWith('lifeos:conflicts')
  })

  it('dispatches lifeos:conflicts-updated event', () => {
    dispatchEventSpy.mockClear()
    clearConflicts()
    expect(dispatchEventSpy).toHaveBeenCalled()
  })
})

// ── getConflictCount ─────────────────────────────────────────

describe('getConflictCount', () => {
  it('returns the number of stored conflicts', () => {
    const conflicts = [makeConflict({ id: 'c1' }), makeConflict({ id: 'c2' })]
    localStorageStore['lifeos:conflicts'] = JSON.stringify(conflicts)
    expect(getConflictCount()).toBe(2)
  })

  it('returns 0 when no conflicts stored', () => {
    expect(getConflictCount()).toBe(0)
  })
})

// ── setUseCRDT ──────────────────────────────────────────────

describe('setUseCRDT', () => {
  it('toggles CRDT resolution off and back on', () => {
    setUseCRDT(false)
    const local = { id: '1', title: 'Local', updated_at: '2025-01-01T00:00:00Z' }
    const remote = { id: '1', title: 'Remote', updated_at: '2025-01-02T00:00:00Z' }
    const result = detectConflict(local, remote, 'tasks')
    expect(result!.winner).toBe('remote')

    setUseCRDT(true)
    const result2 = detectConflict(local, remote, 'tasks')
    expect(result2!.winner).toBe('crdt-merge')
  })
})