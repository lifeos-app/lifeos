// LifeOS System Bus — Singleton Aggregator & Event Emitter
//
// The System Bus is the glue between LifeOS and external Systems.
// It aggregates data from all connected systems, emits events,
// and persists connection state across sessions.

import { logger } from '../../utils/logger';
import type {
  LifeOSSystem,
  SystemConfig,
  SystemRegistration,
  DateRange,
  ScheduleEvent,
  FinanceSummary,
  Transaction,
  PlayerStats,
  SystemTask,
  TaskFilter,
  SystemPage,
  SystemWidget,
} from './types'

// ── Storage ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'lifeos_system_bus_v1'

/** Encode a string to base64 (UTF-8 safe). Real encryption in a future pass. */
function encode(str: string): string {
  return btoa(encodeURIComponent(str))
}

/** Decode a base64 string back to UTF-8. */
function decode(str: string): string {
  try {
    return decodeURIComponent(atob(str))
  } catch {
    return ''
  }
}

type StoredEntry = { id: string; data: string }

// ── Event Map ──────────────────────────────────────────────────────────────
export type BusEventMap = {
  'schedule': ScheduleEvent[]
  'finance': FinanceSummary
  'transactions': Transaction[]
  'gamification': PlayerStats
  'tasks': SystemTask[]
  'system-connected': string
  'system-disconnected': string
  'system-error': { systemId: string; error: string }
  'refresh': void
}

export type BusEventKey = keyof BusEventMap
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyListener = (data: any) => void

// ── SystemBus Class ────────────────────────────────────────────────────────
class SystemBus {
  private static _instance: SystemBus | undefined
  private systems = new Map<string, LifeOSSystem>()
  private registrations = new Map<string, SystemRegistration>()
  private listeners = new Map<BusEventKey, Set<AnyListener>>()

  private constructor() {}

  static getInstance(): SystemBus {
    SystemBus._instance ??= new SystemBus()
    return SystemBus._instance
  }

  // ── Event Emitter ──────────────────────────────────────────────────────

  on<K extends BusEventKey>(
    event: K,
    listener: (data: BusEventMap[K]) => void,
  ): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(listener as AnyListener)
    return () => this.off(event, listener)
  }

  off<K extends BusEventKey>(
    event: K,
    listener: (data: BusEventMap[K]) => void,
  ): void {
    this.listeners.get(event)?.delete(listener as AnyListener)
  }

  emit<K extends BusEventKey>(event: K, data: BusEventMap[K]): void {
    this.listeners.get(event)?.forEach(l => {
      try { l(data) } catch (err) { logger.warn(`[SystemBus] Listener error on ${event}:`, err) }
    })
  }

  // ── System Registry ────────────────────────────────────────────────────

  async register(system: LifeOSSystem, config?: SystemConfig): Promise<void> {
    this.systems.set(system.id, system)
    if (config) {
      this.registrations.set(system.id, {
        system,
        config,
        connectedAt: new Date(),
      })
    }
    this.emit('system-connected', system.id)
  }

  async unregister(systemId: string): Promise<void> {
    const system = this.systems.get(systemId)
    if (system) {
      try { await system.disconnect() } catch { /* best effort */ }
    }
    this.systems.delete(systemId)
    this.registrations.delete(systemId)
    this.emit('system-disconnected', systemId)
  }

  getSystem(id: string): LifeOSSystem | undefined {
    return this.systems.get(id)
  }

  getSystems(): LifeOSSystem[] {
    return Array.from(this.systems.values())
  }

  getAllRegistrations(): SystemRegistration[] {
    return Array.from(this.registrations.values())
  }

  isConnected(id: string): boolean {
    return this.systems.has(id)
  }

  // ── Aggregation: Schedule ──────────────────────────────────────────────

  async getAllScheduleEvents(range: DateRange): Promise<ScheduleEvent[]> {
    const all: ScheduleEvent[] = []
    for (const sys of this.systems.values()) {
      const provider = sys.manifest.provides.schedule
      if (!provider) continue
      try {
        const events = await provider.getEvents(range)
        // Tag each event with its source system
        all.push(...events.map(e => ({
          ...e,
          metadata: { ...e.metadata, _systemId: sys.id, _systemName: sys.name, _systemIcon: sys.icon },
        })))
      } catch (err) {
        logger.warn(`[SystemBus] Schedule fetch failed for ${sys.id}:`, err)
        this.emit('system-error', { systemId: sys.id, error: `Schedule: ${err}` })
      }
    }
    all.sort((a, b) => a.start.localeCompare(b.start))
    this.emit('schedule', all)
    return all
  }

  // ── Aggregation: Finance ───────────────────────────────────────────────

  async getAggregatedFinance(range: DateRange): Promise<FinanceSummary> {
    const summary: FinanceSummary = {
      revenue: 0,
      expenses: 0,
      netIncome: 0,
      currency: 'AUD',
      jobCount: 0,
    }
    for (const sys of this.systems.values()) {
      const provider = sys.manifest.provides.finance
      if (!provider) continue
      try {
        const s = await provider.getSummary(range)
        summary.revenue += s.revenue
        summary.expenses += s.expenses
        summary.netIncome += s.netIncome
        summary.jobCount = (summary.jobCount ?? 0) + (s.jobCount ?? 0)
        summary.currency = s.currency
      } catch (err) {
        logger.warn(`[SystemBus] Finance fetch failed for ${sys.id}:`, err)
        this.emit('system-error', { systemId: sys.id, error: `Finance: ${err}` })
      }
    }
    this.emit('finance', summary)
    return summary
  }

  async getAllTransactions(range: DateRange): Promise<Transaction[]> {
    const all: Transaction[] = []
    for (const sys of this.systems.values()) {
      const provider = sys.manifest.provides.finance
      if (!provider) continue
      try {
        const txns = await provider.getTransactions(range)
        all.push(...txns.map(t => ({
          ...t,
          metadata: { ...t.metadata, _systemId: sys.id, _systemName: sys.name },
        })))
      } catch (err) {
        logger.warn(`[SystemBus] Transactions fetch failed for ${sys.id}:`, err)
      }
    }
    all.sort((a, b) => b.date.localeCompare(a.date)) // newest first
    this.emit('transactions', all)
    return all
  }

  async getTotalRevenue(range: DateRange): Promise<number> {
    let total = 0
    for (const sys of this.systems.values()) {
      const provider = sys.manifest.provides.finance
      if (!provider?.getRevenue) continue
      try {
        total += await provider.getRevenue(range)
      } catch (err) {
        logger.warn(`[SystemBus] Revenue fetch failed for ${sys.id}:`, err)
      }
    }
    return total
  }

  async getTotalExpenses(range: DateRange): Promise<number> {
    let total = 0
    for (const sys of this.systems.values()) {
      const provider = sys.manifest.provides.finance
      if (!provider?.getExpenses) continue
      try {
        const items = await provider.getExpenses(range)
        total += items.reduce((sum, item) => sum + item.amount, 0)
      } catch (err) {
        logger.warn(`[SystemBus] Expenses fetch failed for ${sys.id}:`, err)
      }
    }
    return total
  }

  // ── Aggregation: Tasks ─────────────────────────────────────────────────

  async getAllTasks(filter?: TaskFilter): Promise<SystemTask[]> {
    const all: SystemTask[] = []
    for (const sys of this.systems.values()) {
      const provider = sys.manifest.provides.tasks
      if (!provider) continue
      try {
        let tasks: SystemTask[]
        if (filter && provider.getTasks) {
          tasks = await provider.getTasks(filter)
        } else {
          tasks = await provider.getTodayTasks()
        }
        all.push(...tasks.map(t => ({
          ...t,
          metadata: { ...t.metadata, _systemId: sys.id, _systemName: sys.name },
        })))
      } catch (err) {
        logger.warn(`[SystemBus] Tasks fetch failed for ${sys.id}:`, err)
      }
    }
    this.emit('tasks', all)
    return all
  }

  async getAggregatedTasks(): Promise<SystemTask[]> {
    return this.getAllTasks()
  }

  // ── Aggregation: Gamification ──────────────────────────────────────────

  async getGamificationStats(): Promise<PlayerStats | null> {
    for (const sys of this.systems.values()) {
      const provider = sys.manifest.provides.gamification
      if (!provider) continue
      try {
        const stats = await provider.getPlayerStats()
        this.emit('gamification', stats)
        return stats
      } catch (err) {
        logger.warn(`[SystemBus] Gamification fetch failed for ${sys.id}:`, err)
      }
    }
    return null
  }

  // ── Aggregation: Pages & Widgets ───────────────────────────────────────

  getAllPages(): SystemPage[] {
    const pages: SystemPage[] = []
    for (const sys of this.systems.values()) {
      const systemPages = sys.manifest.pages
      if (!systemPages) continue
      pages.push(...systemPages)
    }
    return pages
  }

  getAllWidgets(): SystemWidget[] {
    const widgets: SystemWidget[] = []
    for (const sys of this.systems.values()) {
      const systemWidgets = sys.manifest.widgets
      if (!systemWidgets) continue
      widgets.push(...systemWidgets.map(w => ({ ...w, systemId: sys.id })))
    }
    return widgets
  }

  // ── Persistence ────────────────────────────────────────────────────────

  saveConfig(systemId: string, config: Record<string, unknown>): void {
    const all = this._loadAll()
    const entry: StoredEntry = { id: systemId, data: encode(JSON.stringify(config)) }
    const idx = all.findIndex(e => e.id === systemId)
    if (idx >= 0) all[idx] = entry
    else all.push(entry)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)) } catch { /* Safari private */ }
  }

  loadConfig(systemId: string): Record<string, unknown> | null {
    const entry = this._loadAll().find(e => e.id === systemId)
    if (!entry) return null
    const json = decode(entry.data)
    if (!json) return null
    try {
      return JSON.parse(json) as Record<string, unknown>
    } catch {
      return null
    }
  }

  removeConfig(systemId: string): void {
    const filtered = this._loadAll().filter(e => e.id !== systemId)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered)) } catch { /* Safari private */ }
  }

  getSavedSystemIds(): string[] {
    return this._loadAll().map(e => e.id)
  }

  private _loadAll(): StoredEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      return JSON.parse(raw) as StoredEntry[]
    } catch {
      return []
    }
  }
}

// ── Exports ────────────────────────────────────────────────────────────────
export const systemBus = SystemBus.getInstance()
export type { SystemBus }
