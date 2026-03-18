// LifeOS System Bus — React Context & Hooks
//
// Wraps the SystemBus singleton in React context so components can:
// - Connect/disconnect systems
// - Access aggregated data (schedule, finance, tasks, gamification)
// - React to refresh ticks and real-time updates

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import { systemBus } from './bus'
import { TCSAdapter } from './adapters/tcs'
import type { TCSConfig } from './adapters/tcs'
import { logger } from '../../utils/logger';
import type {
  LifeOSSystem,
  DateRange,
  ScheduleEvent,
  FinanceSummary,
  Transaction,
  PlayerStats,
  SystemTask,
  SystemConfig,
  SystemPage,
  SystemWidget,
} from './types'

// ── System Registry (maps saved IDs → factory functions) ──────────────────
const SYSTEM_FACTORIES: Record<string, () => LifeOSSystem> = {
  tcs: () => new TCSAdapter(),
}

// ── Refresh Interval ───────────────────────────────────────────────────────
const REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

// ── Context Shape ──────────────────────────────────────────────────────────
interface SystemBusContextValue {
  /** The singleton SystemBus instance */
  bus: typeof systemBus
  /** All currently connected systems */
  systems: LifeOSSystem[]
  /** True during a global refresh */
  refreshing: boolean
  /** Monotonically incrementing tick — hooks can watch this to re-fetch */
  refreshTick: number
  /** Manually trigger a full data refresh */
  refresh: () => Promise<void>
  /** Connect a new system; saves config to localStorage */
  connectSystem: (systemId: string, config: SystemConfig) => Promise<void>
  /** Disconnect a system; removes config from localStorage */
  disconnectSystem: (systemId: string) => Promise<void>
  /** All pages from connected systems */
  systemPages: SystemPage[]
  /** All widgets from connected systems */
  systemWidgets: SystemWidget[]
  /** Check if a specific system is connected */
  isSystemConnected: (systemId: string) => boolean
}

const SystemBusContext = createContext<SystemBusContextValue | null>(null)

// ── Provider ───────────────────────────────────────────────────────────────
export function SystemBusProvider({ children }: { children: ReactNode }) {
  const [systems, setSystems] = useState<LifeOSSystem[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [systemPages, setSystemPages] = useState<SystemPage[]>([])
  const [systemWidgets, setSystemWidgets] = useState<SystemWidget[]>([])
  const initDone = useRef(false)

  // Sync systems list from bus
  const syncSystems = useCallback(() => {
    const currentSystems = systemBus.getSystems()
    setSystems(currentSystems)
    setSystemPages(systemBus.getAllPages())
    setSystemWidgets(systemBus.getAllWidgets())
  }, [])

  // Load saved connections on first mount
  useEffect(() => {
    if (initDone.current) return
    initDone.current = true

    const ids = systemBus.getSavedSystemIds()
    const promises = ids.map(async id => {
      const factory = SYSTEM_FACTORIES[id]
      if (!factory) return
      const config = systemBus.loadConfig(id)
      if (!config) return
      try {
        const system = factory()
        await systemBus.register(system)
        await system.connect(config as SystemConfig)
      } catch (err) {
        logger.warn(`[SystemBus] Auto-reconnect failed for ${id}:`, err)
        await systemBus.unregister(id)
      }
    })

    Promise.all(promises).then(syncSystems).catch(e => logger.warn('[SystemBus] Init failed:', e))
  }, [syncSystems])

  // Subscribe to connect/disconnect events
  useEffect(() => {
    const offConnect = systemBus.on('system-connected', () => syncSystems())
    const offDisconnect = systemBus.on('system-disconnected', () => syncSystems())
    return () => {
      offConnect()
      offDisconnect()
    }
  }, [syncSystems])

  // Auto-refresh every 5 minutes
  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      setRefreshTick(t => t + 1)
      systemBus.emit('refresh', undefined as unknown as void)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const id = setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [refresh])

  // Connect a new system
  const connectSystem = useCallback(
    async (systemId: string, config: SystemConfig) => {
      const factory = SYSTEM_FACTORIES[systemId]
      if (!factory) throw new Error(`Unknown system: ${systemId}`)

      // Disconnect existing if any
      if (systemBus.isConnected(systemId)) {
        await systemBus.unregister(systemId)
      }

      const system = factory()
      await systemBus.register(system, config)

      try {
        await system.connect(config)
        systemBus.saveConfig(systemId, config as unknown as Record<string, unknown>)
        syncSystems()
        setRefreshTick(t => t + 1)
      } catch (err) {
        await systemBus.unregister(systemId)
        syncSystems()
        throw err
      }
    },
    [syncSystems],
  )

  // Disconnect a system
  const disconnectSystem = useCallback(
    async (systemId: string) => {
      await systemBus.unregister(systemId)
      systemBus.removeConfig(systemId)
      syncSystems()
    },
    [syncSystems],
  )

  const isSystemConnected = useCallback(
    (systemId: string) => systemBus.isConnected(systemId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [systems],
  )

  return (
    <SystemBusContext.Provider
      value={{
        bus: systemBus,
        systems,
        refreshing,
        refreshTick,
        refresh,
        connectSystem,
        disconnectSystem,
        systemPages,
        systemWidgets,
        isSystemConnected,
      }}
    >
      {children}
    </SystemBusContext.Provider>
  )
}

// ── Core Hook ──────────────────────────────────────────────────────────────
export function useSystemBus(): SystemBusContextValue {
  const ctx = useContext(SystemBusContext)
  if (!ctx) throw new Error('useSystemBus must be used inside <SystemBusProvider>')
  return ctx
}

// ── Schedule Hook ──────────────────────────────────────────────────────────
interface UseScheduleResult {
  events: ScheduleEvent[]
  loading: boolean
  error: string | null
}

export function useSystemSchedule(range: DateRange): UseScheduleResult {
  const { refreshTick } = useSystemBus()
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    systemBus
      .getAllScheduleEvents(range)
      .then(setEvents)
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end, refreshTick])

  return { events, loading, error }
}

// ── Finance Hook ───────────────────────────────────────────────────────────
interface UseFinanceResult {
  summary: FinanceSummary | null
  loading: boolean
  error: string | null
}

export function useSystemFinance(range: DateRange): UseFinanceResult {
  const { refreshTick } = useSystemBus()
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    systemBus
      .getAggregatedFinance(range)
      .then(setSummary)
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end, refreshTick])

  return { summary, loading, error }
}

// ── Transactions Hook ──────────────────────────────────────────────────────
interface UseTransactionsResult {
  transactions: Transaction[]
  loading: boolean
  error: string | null
}

export function useSystemTransactions(range: DateRange): UseTransactionsResult {
  const { refreshTick } = useSystemBus()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    systemBus
      .getAllTransactions(range)
      .then(setTransactions)
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end, refreshTick])

  return { transactions, loading, error }
}

// ── Gamification Hook ──────────────────────────────────────────────────────
interface UseGamificationResult {
  stats: PlayerStats | null
  loading: boolean
  error: string | null
}

export function useSystemGamification(): UseGamificationResult {
  const { refreshTick } = useSystemBus()
  const [stats, setStats] = useState<PlayerStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    systemBus
      .getGamificationStats()
      .then(setStats)
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [refreshTick])

  return { stats, loading, error }
}

// ── Tasks Hook ─────────────────────────────────────────────────────────────
interface UseTasksResult {
  tasks: SystemTask[]
  loading: boolean
  error: string | null
}

export function useSystemTasks(): UseTasksResult {
  const { refreshTick } = useSystemBus()
  const [tasks, setTasks] = useState<SystemTask[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    systemBus
      .getAllTasks()
      .then(setTasks)
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [refreshTick])

  return { tasks, loading, error }
}

// Re-export TCSConfig for convenience
export type { TCSConfig }
