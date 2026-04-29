/**
 * crdt-engine.ts — Full CRDT Engine for Deterministic Conflict Resolution
 *
 * Implements Conflict-Free Replicated Data Types (CRDTs) so that concurrent
 * edits from multiple devices always converge to the same state regardless
 * of merge order. This replaces the previous Last-Writer-Wins (LWW) approach
 * with type-aware merge semantics:
 *
 *   GCounter  — grow-only counters (XP, stats that only increase)
 *   LWWRegister — last-writer-wins single values (with node_id tiebreaker)
 *   ORSet — observed-remove sets (tags, categories)
 *   RGA — replicated growable arrays (ordered lists: journal entries, tasks)
 *
 * Usage:
 *   const engine = CRDTEngine.getInstance();
 *   const doc = engine.createDocument('task-1', 'tasks', { title: 'Hello', xp: 10 });
 *   const merged = engine.mergeDocument(localDoc, remoteDoc);
 *   const plain = engine.toPlain(merged);
 */

// ── Node Identity ─────────────────────────────────────────────

export type NodeId = string;

const NODE_ID_KEY = 'lifeos:crdt_node_id';
let _cachedNodeId: NodeId | null = null;

/**
 * Get or create a stable node identifier for this device/user.
 * Based on user_id + random device fingerprint so it is:
 *   - Unique per device (even for same user)
 *   - Stable across page reloads (persisted in localStorage)
 *   - Deterministic once created
 */
export function getNodeId(): NodeId {
  if (_cachedNodeId) return _cachedNodeId;

  try {
    const stored = localStorage.getItem(NODE_ID_KEY);
    if (stored) {
      _cachedNodeId = stored;
      return _cachedNodeId;
    }
  } catch { /* localStorage unavailable */ }

  // Generate: userId prefix (if available) + random device fingerprint
  let userPrefix = 'local';
  try {
    const ref = (import.meta.env.VITE_SUPABASE_URL || '').match(/\/\/([^.]+)\./)?.[1] || 'app';
    const stored = localStorage.getItem(`sb-${ref}-auth-token`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.user?.id) userPrefix = parsed.user.id.slice(0, 8);
    }
  } catch { /* ignore */ }

  const fingerprint = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

  _cachedNodeId = `${userPrefix}-${fingerprint}`;
  try {
    localStorage.setItem(NODE_ID_KEY, _cachedNodeId);
  } catch { /* localStorage unavailable */ }

  return _cachedNodeId;
}

// ── Vector Clock ──────────────────────────────────────────────

export interface VectorClock {
  [nodeId: string]: number;
}

function cloneClock(clock: VectorClock): VectorClock {
  return { ...clock };
}

/** Increment the counter for a given node. */
function incrementClock(clock: VectorClock, nodeId: NodeId): VectorClock {
  const next = cloneClock(clock);
  next[nodeId] = (next[nodeId] || 0) + 1;
  return next;
}

/** Merge two vector clocks by taking the component-wise maximum. */
function mergeClocks(a: VectorClock, b: VectorClock): VectorClock {
  const result = cloneClock(a);
  for (const [node, counter] of Object.entries(b)) {
    result[node] = Math.max(result[node] || 0, counter);
  }
  return result;
}

/**
 * Compare two vector clocks:
 *   - "before"  — a is strictly before b (a happened-before b)
 *   - "after"   — a is strictly after b
 *   - "concurrent" — neither is strictly before the other
 */
type ClockOrdering = 'before' | 'after' | 'concurrent';

function compareClocks(a: VectorClock, b: VectorClock): ClockOrdering {
  let aBeforeB = false;
  let bBeforeA = false;

  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of allKeys) {
    const va = a[key] || 0;
    const vb = b[key] || 0;
    if (va < vb) aBeforeB = true;
    if (va > vb) bBeforeA = true;
  }

  if (aBeforeB && !bBeforeA) return 'before';
  if (bBeforeA && !aBeforeB) return 'after';
  return 'concurrent';
}

// ── GCounter (Grow-Only Counter) ──────────────────────────────

/**
 * GCounter: each node maintains its own counter.
 * Merge = take the maximum per node.
 * Value = sum of all node counters.
 *
 * Ideal for monotonically increasing values like XP, streak counts, etc.
 */
export interface GCounterState {
  type: 'gcounter';
  counts: Record<NodeId, number>;
  clock: VectorClock;
}

function mergeGCounter(a: GCounterState, b: GCounterState): GCounterState {
  const counts: Record<NodeId, number> = { ...a.counts };
  for (const [node, val] of Object.entries(b.counts)) {
    counts[node] = Math.max(counts[node] || 0, val);
  }
  return {
    type: 'gcounter',
    counts,
    clock: mergeClocks(a.clock, b.clock),
  };
}

function gcounterValue(state: GCounterState): number {
  let sum = 0;
  for (const val of Object.values(state.counts)) {
    sum += val;
  }
  return sum;
}

/** Increment the counter for the given node by delta (default 1). */
function incrementGCounter(state: GCounterState, nodeId: NodeId, delta: number = 1): GCounterState {
  const counts = { ...state.counts };
  counts[nodeId] = (counts[nodeId] || 0) + delta;
  return {
    type: 'gcounter',
    counts,
    clock: incrementClock(state.clock, nodeId),
  };
}

// ── LWWRegister (Last-Writer-Wins Register) ───────────────────

/**
 * LWWRegister: stores a single value annotated with (timestamp, nodeId).
 * Latest timestamp wins; on tie, lexicographically larger nodeId wins.
 * This provides a total order that is deterministic across all replicas.
 */
export interface LWWRegisterState<T = unknown> {
  type: 'lww';
  value: T;
  timestamp: number;
  nodeId: NodeId;
  clock: VectorClock;
}

function mergeLWWRegister<T>(a: LWWRegisterState<T>, b: LWWRegisterState<T>): LWWRegisterState<T> {
  // Total order: higher timestamp wins, ties broken by nodeId
  if (a.timestamp > b.timestamp) return { ...a, clock: mergeClocks(a.clock, b.clock) };
  if (b.timestamp > a.timestamp) return { ...b, clock: mergeClocks(a.clock, b.clock) };
  // Tie: higher nodeId wins (deterministic, consistent across all replicas)
  if (a.nodeId >= b.nodeId) return { ...a, clock: mergeClocks(a.clock, b.clock) };
  return { ...b, clock: mergeClocks(a.clock, b.clock) };
}

function lwwValue<T>(state: LWWRegisterState<T>): T {
  return state.value;
}

// ── ORSet (Observed-Remove Set) ───────────────────────────────

/**
 * ORSet: items can be added and removed. Each operation is tagged with a
 * unique "dot" (nodeId, counter). Removes only affect adds that have been
 * observed (delivered) at the removing replica — hence "observed-remove".
 *
 * Merge rule: union of adds minus union of observed removes.
 * An element is in the set if it has at least one add dot not covered by
 * the remove set.
 */
export interface ORSetState<T = unknown> {
  type: 'orset';
  /** element → set of dots that added it */
  adds: Record<string, Set<string>>;
  /** set of dots that have been removed (observed) */
  removes: Set<string>;
  /** element → original value (for deserialization), keyed by string(element) */
  values: Record<string, T>;
  clock: VectorClock;
}

/** Serialize a Set<string> to a JSON-compatible string[]. */
function serializeDots(set: Set<string>): string[] {
  return [...set];
}

/** Deserialize string[] back to Set<string>. */
function deserializeDots(arr: string[]): Set<string> {
  return new Set(arr);
}

/** Convert an element to a stable string key. */
function elementKey(element: unknown): string {
  if (typeof element === 'string') return element;
  return JSON.stringify(element);
}

function mergeORSet<T>(a: ORSetState<T>, b: ORSetState<T>): ORSetState<T> {
  const adds: Record<string, Set<string>> = {};
  const values: Record<string, T> = {};

  // Merge adds: union of add dots per element
  const allElements = new Set([...Object.keys(a.adds), ...Object.keys(b.adds)]);
  for (const elem of allElements) {
    const aDots = a.adds[elem] || new Set<string>();
    const bDots = b.adds[elem] || new Set<string>();
    adds[elem] = new Set([...aDots, ...bDots]);

    // Preserve value from whichever side has it
    if (a.values[elem] !== undefined) values[elem] = a.values[elem];
    else if (b.values[elem] !== undefined) values[elem] = b.values[elem];
  }

  // Merge removes: union of observed removes
  const removes = new Set([...a.removes, ...b.removes]);

  return {
    type: 'orset',
    adds,
    removes,
    values,
    clock: mergeClocks(a.clock, b.clock),
  };
}

function orSetValues<T>(state: ORSetState<T>): T[] {
  const result: T[] = [];
  for (const [elem, dots] of Object.entries(state.adds)) {
    // Element is present if any of its add dots survived removal
    const alive = [...dots].some(d => !state.removes.has(d));
    if (alive && state.values[elem] !== undefined) {
      result.push(state.values[elem]);
    }
  }
  return result;
}

/** Add an element to the ORSet. */
function addToORSet<T>(state: ORSetState<T>, element: T, nodeId: NodeId, clock: VectorClock): ORSetState<T> {
  const key = elementKey(element);
  const dot = `${nodeId}:${(clock[nodeId] || 0) + 1}`;
  const adds = { ...state.adds };
  adds[key] = new Set([...(adds[key] || []), dot]);
  const values = { ...state.values, [key]: element };
  return {
    type: 'orset',
    adds,
    removes: new Set([...state.removes]),
    values,
    clock: incrementClock(clock, nodeId),
  };
}

/** Remove an element from the ORSet (observed-remove). */
function removeFromORSet<T>(state: ORSetState<T>, element: T, nodeId: NodeId): ORSetState<T> {
  const key = elementKey(element);
  const dots = state.adds[key] || new Set<string>();
  // Remove observes all current add dots for this element
  const removes = new Set([...state.removes, ...dots]);
  return {
    type: 'orset',
    adds: { ...state.adds },
    removes,
    values: { ...state.values },
    clock: incrementClock(state.clock, nodeId),
  };
}

// ── RGA (Replicated Growable Array) ───────────────────────────

/**
 * RGA: ordered list with insert and delete operations.
 * Each element gets a unique id (timestamp + nodeId) so concurrent
 * inserts at the same position are ordered deterministically.
 * Deletions use tombstones rather than physical removal.
 */
export interface RGAItem<T = unknown> {
  /** Unique id: `${timestamp}:${nodeId}` — determines concurrent ordering */
  id: string;
  /** Content (null means tombstone) */
  value: T | null;
  /** ID of the item this was inserted after (for ordering) */
  afterId: string | null;
  /** Whether this item has been deleted (tombstone) */
  deleted: boolean;
  timestamp: number;
  nodeId: NodeId;
}

export interface RGAState<T = unknown> {
  type: 'rga';
  items: RGAItem<T>[];
  clock: VectorClock;
}

function rgaItemId(timestamp: number, nodeId: NodeId): string {
  return `${timestamp}:${nodeId}`;
}

/** Compare two RGA item ids: (timestamp, nodeId) ordering.
 *  Higher timestamp = later. On tie, higher nodeId = later (deterministic). */
function compareRGAIds(aId: string, bId: string): number {
  const [aTs, aNode] = aId.split(':');
  const [bTs, bNode] = bId.split(':');
  const tsDiff = Number(aTs) - Number(bTs);
  if (tsDiff !== 0) return tsDiff;
  return aNode < bNode ? -1 : aNode > bNode ? 1 : 0;
}

function mergeRGA<T>(a: RGAState<T>, b: RGAState<T>): RGAState<T> {
  // Collect all items by id, deduplicating
  const itemMap = new Map<string, RGAItem<T>>();

  for (const item of a.items) {
    itemMap.set(item.id, item);
  }
  for (const item of b.items) {
    const existing = itemMap.get(item.id);
    if (existing) {
      // If either is deleted, result is deleted
      if (item.deleted || existing.deleted) {
        itemMap.set(item.id, { ...existing, deleted: true, value: null });
      }
      // Otherwise keep existing (they should be the same)
    } else {
      itemMap.set(item.id, item);
    }
  }

  // Sort items: by position (afterId references), breaking ties by id
  // Reconstruct the list by iterating items in insertion order
  const allItems = [...itemMap.values()];

  // Topological sort based on afterId:
  // - Items with afterId=null go first (root items)
  // - Items with afterId=X go right after item X
  // - For concurrent inserts after the same item, order by item id (timestamp + nodeId)
  const sorted = topologicalSortRGA(allItems);

  return {
    type: 'rga',
    items: sorted,
    clock: mergeClocks(a.clock, b.clock),
  };
}

function topologicalSortRGA<T>(items: RGAItem<T[]>): RGAItem<T>[] {
  // Group items by their afterId
  const childrenByAfter = new Map<string | null, RGAItem<T>[]>();
  for (const item of items) {
    const key = item.afterId;
    if (!childrenByAfter.has(key)) childrenByAfter.set(key, []);
    childrenByAfter.get(key)!.push(item);
  }

  // Sort children within each group by item id (deterministic concurrent ordering)
  for (const group of childrenByAfter.values()) {
    group.sort((a, b) => compareRGAIds(a.id, b.id));
  }

  // Build ordered list recursively
  const result: RGAItem<T>[] = [];

  function emitChildren(afterId: string | null) {
    const children = childrenByAfter.get(afterId) || [];
    for (const child of children) {
      result.push(child);
      emitChildren(child.id);
    }
  }

  emitChildren(null);
  return result;
}

/** Get the visible (non-deleted) values from an RGA. */
function rgaValues<T>(state: RGAState<T>): T[] {
  return state.items
    .filter(item => !item.deleted)
    .map(item => item.value as T);
}

// ── CRDT Value Union Type ─────────────────────────────────────

export type CRDTValue =
  | GCounterState
  | LWWRegisterState
  | ORSetState
  | RGAState;

// Type-reduced versions for serialization (Sets → arrays)
type SerializableGCounter = Omit<GCounterState, 'clock'> & { clock: VectorClock };
type SerializableLWW<T> = Omit<LWWRegisterState<T>, 'clock'> & { clock: VectorClock };
type SerializableORSet<T> = Omit<ORSetState<T>, 'adds' | 'removes' | 'clock'> & {
  adds: Record<string, string[]>;
  removes: string[];
  clock: VectorClock;
};
type SerializableRGA<T> = Omit<RGAState<T>, 'clock'> & { clock: VectorClock };
type SerializableCRDTValue =
  | SerializableGCounter
  | SerializableLWW
  | SerializableORSet
  | SerializableRGA;

// ── CRDT Document ────────────────────────────────────────────

export interface CRDTDocument {
  id: string;
  type: string;
  fields: Record<string, CRDTValue>;
  clock: VectorClock;
}

// ── Field Type Strategy ───────────────────────────────────────

/**
 * Configuration that maps field names to CRDT types.
 * This determines how each field is wrapped and merged.
 * Users can extend this per table type.
 */
export type CRDTFieldStrategy = 'gcounter' | 'lww' | 'orset' | 'rga';

/**
 * Default field type inference based on value type and field name heuristics.
 * Override with registerFieldType() for custom behavior.
 */
const DEFAULT_FIELD_STRATEGIES: Record<string, CRDTFieldStrategy> = {
  // Monotonically increasing counters
  total_xp: 'gcounter',
  xp_amount: 'gcounter',
  level: 'lww',
  streak_current: 'gcounter',
  streak_best: 'gcounter',
  progress: 'lww',

  // Collections
  tags: 'orset',
  key_results: 'orset',
  resources: 'orset',
  stats: 'lww', // JSON object, use LWW

  // Ordered lists
  exercises: 'rga',
  sort_order: 'lww',
};

let _fieldStrategies: Record<string, CRDTFieldStrategy> = { ...DEFAULT_FIELD_STRATEGIES };

/** Register a custom CRDT strategy for a specific field name. */
export function registerFieldStrategy(field: string, strategy: CRDTFieldStrategy): void {
  _fieldStrategies[field] = strategy;
}

/** Get the CRDT strategy for a field, falling back to value-based inference. */
function inferStrategy(field: string, value: unknown): CRDTFieldStrategy {
  // Check explicit registration first
  if (_fieldStrategies[field]) return _fieldStrategies[field];

  // Heuristic: arrays of strings look like tags → ORSet
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === 'string') return 'orset';
    return 'rga';
  }

  // Numbers named like counters
  if (typeof value === 'number' && (field.includes('xp') || field.includes('count') || field.includes('streak'))) {
    return 'gcounter';
  }

  // Everything else → LWW
  return 'lww';
}

// ── Timestamp ─────────────────────────────────────────────────

/** Get current timestamp in milliseconds (hybrid logical clock style). */
function nowMs(): number {
  return Date.now();
}

// ── CRDT Engine ──────────────────────────────────────────────

export class CRDTEngine {
  private static _instance: CRDTEngine | null = null;
  private _nodeId: NodeId;

  private constructor() {
    this._nodeId = getNodeId();
  }

  /** Get the singleton CRDTEngine instance. */
  static getInstance(): CRDTEngine {
    if (!CRDTEngine._instance) {
      CRDTEngine._instance = new CRDTEngine();
    }
    return CRDTEngine._instance;
  }

  /** Get the current node ID. */
  get nodeId(): NodeId {
    return this._nodeId;
  }

  // ── Document Creation ──────────────────────────────────────

  /**
   * Create a CRDT document from plain data.
   * Each field is wrapped in the appropriate CRDT type based on
   * registered strategies or value-type heuristics.
   */
  createDocument(id: string, type: string, data: Record<string, unknown>): CRDTDocument {
    const fields: Record<string, CRDTValue> = {};
    let clock: VectorClock = {};

    for (const [field, value] of Object.entries(data)) {
      if (value === undefined || value === null) continue;

      const strategy = inferStrategy(field, value);
      clock = incrementClock(clock, this._nodeId);

      switch (strategy) {
        case 'gcounter':
          fields[field] = this.wrapGCounter(value as number, clock);
          break;
        case 'orset':
          fields[field] = this.wrapORSet(value as unknown[], clock);
          break;
        case 'rga':
          fields[field] = this.wrapRGA(value as unknown[], clock);
          break;
        case 'lww':
        default:
          fields[field] = this.wrapLWW(value, clock);
          break;
      }
    }

    return { id, type, fields, clock };
  }

  // ── Merge ───────────────────────────────────────────────────

  /**
   * Merge two CRDT documents using CRDT merge rules per field.
   * The result is deterministic: merge(a, b) produces the same
   * result regardless of argument order.
   *
   * If a field exists in one document but not the other, it is
   * preserved in the result (no data loss).
   */
  mergeDocument(local: CRDTDocument, remote: CRDTDocument): CRDTDocument {
    const mergedFields: Record<string, CRDTValue> = {};
    const allFieldNames = new Set([
      ...Object.keys(local.fields),
      ...Object.keys(remote.fields),
    ]);

    for (const field of allFieldNames) {
      const localField = local.fields[field];
      const remoteField = remote.fields[field];

      if (localField && !remoteField) {
        mergedFields[field] = localField;
        continue;
      }
      if (!localField && remoteField) {
        mergedFields[field] = remoteField;
        continue;
      }

      // Both exist — merge by type
      if (localField.type !== remoteField.type) {
        // Type mismatch — fall back to LWW using the one with higher clock
        const ordering = compareClocks(localField.clock, remoteField.clock);
        mergedFields[field] = ordering === 'before' ? remoteField : localField;
        continue;
      }

      switch (localField.type) {
        case 'gcounter':
          mergedFields[field] = mergeGCounter(
            localField as GCounterState,
            remoteField as GCounterState
          );
          break;
        case 'lww':
          mergedFields[field] = mergeLWWRegister(
            localField as LWWRegisterState,
            remoteField as LWWRegisterState
          );
          break;
        case 'orset':
          mergedFields[field] = mergeORSet(
            localField as ORSetState,
            remoteField as ORSetState
          );
          break;
        case 'rga':
          mergedFields[field] = mergeRGA(
            localField as RGAState,
            remoteField as RGAState
          );
          break;
        default:
          mergedFields[field] = mergeLWWRegister(
            localField as LWWRegisterState,
            remoteField as LWWRegisterState
          );
      }
    }

    return {
      id: local.id || remote.id,
      type: local.type || remote.type,
      fields: mergedFields,
      clock: mergeClocks(local.clock, remote.clock),
    };
  }

  /**
   * Merge multiple CRDT documents (left-fold: deterministic due to
   * commutative and associative merge rules).
   */
  mergeAll(documents: CRDTDocument[]): CRDTDocument {
    if (documents.length === 0) {
      throw new Error('Cannot merge zero documents');
    }
    return documents.reduce((acc, doc) => this.mergeDocument(acc, doc));
  }

  // ── Plain ↔ CRDT Conversion ─────────────────────────────────

  /**
   * Extract plain values from a CRDT document.
   * Reverses createDocument / fromPlain.
   */
  toPlain(doc: CRDTDocument): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [field, crdtValue] of Object.entries(doc.fields)) {
      result[field] = this.unwrapValue(crdtValue);
    }
    return result;
  }

  /**
   * Wrap plain data into a CRDT document.
   * Alias for createDocument (kept for API symmetry with toPlain).
   */
  fromPlain(id: string, type: string, data: Record<string, unknown>): CRDTDocument {
    return this.createDocument(id, type, data);
  }

  // ── Resolve Conflict ────────────────────────────────────────

  /**
   * Resolve a conflict between local and remote records using CRDT merge.
   * Returns the merged plain data that should be stored.
   *
   * Falls back to LWW if CRDT state is missing (backward compatibility).
   */
  resolveConflict(
    localData: Record<string, unknown>,
    remoteData: Record<string, unknown>,
    tableName: string,
    recordId: string,
    localCRDT?: CRDTDocument | null,
    remoteCRDT?: CRDTDocument | null
  ): Record<string, unknown> {
    // Backward compatibility: if no CRDT state, fall back to LWW
    if (!localCRDT && !remoteCRDT) {
      return this.lwwFallback(localData, remoteData);
    }

    // If only one side has CRDT state, create the other from plain data
    const localDoc = localCRDT || this.fromPlain(recordId, tableName, localData);
    const remoteDoc = remoteCRDT || this.fromPlain(recordId, tableName, remoteData);

    const merged = this.mergeDocument(localDoc, remoteDoc);
    return this.toPlain(merged);
  }

  // ── Serialization ──────────────────────────────────────────

  /**
   * Serialize a CRDTDocument to a JSON-compatible object.
   * Converts Set instances to arrays for storage in IndexedDB.
   */
  serialize(doc: CRDTDocument): Record<string, unknown> {
    const serializedFields: Record<string, unknown> = {};

    for (const [field, value] of Object.entries(doc.fields)) {
      serializedFields[field] = this.serializeCRDTValue(value);
    }

    return {
      __crdt__: true,
      id: doc.id,
      type: doc.type,
      fields: serializedFields,
      clock: doc.clock,
    };
  }

  /**
   * Deserialize a stored object back to a CRDTDocument.
   * Returns null if the object is not a valid CRDT document.
   */
  deserialize(data: Record<string, unknown>): CRDTDocument | null {
    if (!data || !data.__crdt__) return null;

    try {
      const fields: Record<string, CRDTValue> = {};
      const rawFields = data.fields as Record<string, unknown>;

      for (const [field, raw] of Object.entries(rawFields || {})) {
        const deserialized = this.deserializeCRDTValue(raw as Record<string, unknown>);
        if (deserialized) fields[field] = deserialized;
      }

      return {
        id: data.id as string,
        type: data.type as string,
        fields,
        clock: (data.clock as VectorClock) || {},
      };
    } catch {
      return null;
    }
  }

  // ── Private Helpers ─────────────────────────────────────────

  private wrapGCounter(value: number, clock: VectorClock): GCounterState {
    const counts: Record<NodeId, number> = {};
    counts[this._nodeId] = value;
    return { type: 'gcounter', counts, clock: cloneClock(clock) };
  }

  private wrapLWW(value: unknown, clock: VectorClock): LWWRegisterState {
    return {
      type: 'lww',
      value,
      timestamp: nowMs(),
      nodeId: this._nodeId,
      clock: cloneClock(clock),
    };
  }

  private wrapORSet(elements: unknown[], clock: VectorClock): ORSetState {
    const adds: Record<string, Set<string>> = {};
    const values: Record<string, unknown> = {};
    const counter = (clock[this._nodeId] || 0) + 1;

    for (let i = 0; i < elements.length; i++) {
      const elem = elements[i];
      const key = elementKey(elem);
      const dot = `${this._nodeId}:${counter + i}`;
      if (!adds[key]) adds[key] = new Set<string>();
      adds[key].add(dot);
      values[key] = elem;
    }

    return {
      type: 'orset',
      adds,
      removes: new Set<string>(),
      values,
      clock: cloneClock(clock),
    };
  }

  private wrapRGA(elements: unknown[], clock: VectorClock): RGAState {
    const items: RGAItem[] = [];
    let prevId: string | null = null;
    let nodeCounter = (clock[this._nodeId] || 0) + 1;

    for (const elem of elements) {
      const ts = nowMs() + nodeCounter; // Ensure unique timestamps within same ms
      const id = rgaItemId(ts, this._nodeId);
      items.push({
        id,
        value: elem,
        afterId: prevId,
        deleted: false,
        timestamp: ts,
        nodeId: this._nodeId,
      });
      prevId = id;
      nodeCounter++;
    }

    return {
      type: 'rga',
      items,
      clock: cloneClock(clock),
    };
  }

  private unwrapValue(crdt: CRDTValue): unknown {
    switch (crdt.type) {
      case 'gcounter':
        return gcounterValue(crdt as GCounterState);
      case 'lww':
        return lwwValue(crdt as LWWRegisterState);
      case 'orset':
        return orSetValues(crdt as ORSetState);
      case 'rga':
        return rgaValues(crdt as RGAState);
      default:
        return (crdt as LWWRegisterState).value;
    }
  }

  /**
   * LWW fallback: compare updated_at timestamps and return the newer one.
   * Ties broken by comparing full record (deterministic via JSON.stringify).
   */
  private lwwFallback(
    local: Record<string, unknown>,
    remote: Record<string, unknown>
  ): Record<string, unknown> {
    const localTs = new Date(local.updated_at as string || 0).getTime() || 0;
    const remoteTs = new Date(remote.updated_at as string || 0).getTime() || 0;

    if (remoteTs > localTs) return { ...remote };
    if (localTs > remoteTs) return { ...local };
    // Same timestamp — deterministic tiebreaker: JSON string comparison
    const localStr = JSON.stringify(local);
    const remoteStr = JSON.stringify(remote);
    return localStr >= remoteStr ? { ...local } : { ...remote };
  }

  private serializeCRDTValue(value: CRDTValue): SerializableCRDTValue {
    switch (value.type) {
      case 'gcounter':
        return { type: 'gcounter', counts: { ...(value as GCounterState).counts }, clock: (value as GCounterState).clock };
      case 'lww':
        return { type: 'lww', value: (value as LWWRegisterState).value, timestamp: (value as LWWRegisterState).timestamp, nodeId: (value as LWWRegisterState).nodeId, clock: (value as LWWRegisterState).clock };
      case 'orset': {
        const orset = value as ORSetState;
        const addsSerialized: Record<string, string[]> = {};
        for (const [key, dots] of Object.entries(orset.adds)) {
          addsSerialized[key] = serializeDots(dots);
        }
        return {
          type: 'orset',
          adds: addsSerialized,
          removes: serializeDots(orset.removes),
          values: { ...orset.values },
          clock: orset.clock,
        };
      }
      case 'rga':
        return { type: 'rga', items: [...(value as RGAState).items], clock: (value as RGAState).clock };
      default:
        return value as unknown as SerializableCRDTValue;
    }
  }

  private deserializeCRDTValue(raw: Record<string, unknown>): CRDTValue | null {
    if (!raw || !raw.type) return null;

    switch (raw.type) {
      case 'gcounter':
        return {
          type: 'gcounter',
          counts: (raw.counts || {}) as Record<NodeId, number>,
          clock: (raw.clock || {}) as VectorClock,
        };
      case 'lww':
        return {
          type: 'lww',
          value: raw.value,
          timestamp: raw.timestamp as number || 0,
          nodeId: raw.nodeId as NodeId || '',
          clock: (raw.clock || {}) as VectorClock,
        };
      case 'orset': {
        const adds: Record<string, Set<string>> = {};
        const rawAdds = (raw.adds || {}) as Record<string, string[]>;
        for (const [key, dots] of Object.entries(rawAdds)) {
          adds[key] = deserializeDots(dots);
        }
        return {
          type: 'orset',
          adds,
          removes: deserializeDots((raw.removes || []) as string[]),
          values: (raw.values || {}) as Record<string, unknown>,
          clock: (raw.clock || {}) as VectorClock,
        };
      }
      case 'rga':
        return {
          type: 'rga',
          items: (raw.items || []) as RGAItem[],
          clock: (raw.clock || {}) as VectorClock,
        };
      default:
        return null;
    }
  }

  // ── Mutation Helpers (for local edits) ──────────────────────

  /**
   * Update a single field in a CRDT document.
   * Returns a new document with the field updated (immutable).
   */
  updateField(doc: CRDTDocument, field: string, value: unknown): CRDTDocument {
    const fields = { ...doc.fields };
    const clock = incrementClock(doc.clock, this._nodeId);

    const strategy = inferStrategy(field, value);
    switch (strategy) {
      case 'gcounter':
        fields[field] = this.wrapGCounter(value as number, clock);
        break;
      case 'orset':
        fields[field] = this.wrapORSet(value as unknown[], clock);
        break;
      case 'rga':
        fields[field] = this.wrapRGA(value as unknown[], clock);
        break;
      case 'lww':
      default:
        fields[field] = this.wrapLWW(value, clock);
        break;
    }

    return { ...doc, fields, clock };
  }

  /**
   * Increment a GCounter field by delta.
   * If the field doesn't exist, creates it with the delta value.
   */
  incrementCounter(doc: CRDTDocument, field: string, delta: number = 1): CRDTDocument {
    const fields = { ...doc.fields };
    const clock = incrementClock(doc.clock, this._nodeId);
    const existing = fields[field] as GCounterState | undefined;

    if (existing && existing.type === 'gcounter') {
      fields[field] = incrementGCounter(existing, this._nodeId, delta);
    } else {
      fields[field] = this.wrapGCounter(delta, clock);
    }

    return { ...doc, fields, clock };
  }

  /**
   * Add an element to an ORSet field.
   * Creates the field if it doesn't exist.
   */
  addElement(doc: CRDTDocument, field: string, element: unknown): CRDTDocument {
    const fields = { ...doc.fields };
    const existing = fields[field] as ORSetState | undefined;

    if (existing && existing.type === 'orset') {
      fields[field] = addToORSet(existing, element, this._nodeId, existing.clock);
    } else {
      fields[field] = this.wrapORSet([element], incrementClock(doc.clock, this._nodeId));
    }

    return { ...doc, fields, clock: incrementClock(doc.clock, this._nodeId) };
  }

  /**
   * Remove an element from an ORSet field.
   */
  removeElement(doc: CRDTDocument, field: string, element: unknown): CRDTDocument {
    const fields = { ...doc.fields };
    const existing = fields[field] as ORSetState | undefined;

    if (existing && existing.type === 'orset') {
      fields[field] = removeFromORSet(existing, element, this._nodeId);
      return { ...doc, fields, clock: incrementClock(doc.clock, this._nodeId) };
    }

    // Field doesn't exist or isn't an ORSet — nothing to remove
    return doc;
  }
}

// ── Convenience Exports ────────────────────────────────────────

/**
 * Create a CRDT document from plain data (convenience function).
 */
export function createCRDTDocument(id: string, type: string, data: Record<string, unknown>): CRDTDocument {
  return CRDTEngine.getInstance().createDocument(id, type, data);
}

/**
 * Merge two CRDT documents (convenience function).
 */
export function mergeCRDTDocuments(local: CRDTDocument, remote: CRDTDocument): CRDTDocument {
  return CRDTEngine.getInstance().mergeDocument(local, remote);
}

/**
 * Resolve a conflict using CRDT merge (convenience function).
 */
export function resolveConflictCRDT(
  localData: Record<string, unknown>,
  remoteData: Record<string, unknown>,
  tableName: string,
  recordId: string,
  localCRDT?: CRDTDocument | null,
  remoteCRDT?: CRDTDocument | null
): Record<string, unknown> {
  return CRDTEngine.getInstance().resolveConflict(localData, remoteData, tableName, recordId, localCRDT, remoteCRDT);
}

/**
 * Extract plain values from a CRDT document (convenience function).
 */
export function crdtToPlain(doc: CRDTDocument): Record<string, unknown> {
  return CRDTEngine.getInstance().toPlain(doc);
}

/**
 * Wrap plain data into a CRDT document (convenience function).
 */
export function plainToCRDT(id: string, type: string, data: Record<string, unknown>): CRDTDocument {
  return CRDTEngine.getInstance().fromPlain(id, type, data);
}