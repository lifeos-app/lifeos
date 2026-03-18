// LifeOS System Bus — Core Type Definitions
// The universal language every System speaks to LifeOS.
// Every business has schedules, money, goals, tasks, and people.
// LifeOS is the universal translator.

// ── Date & Time ────────────────────────────────────────────────────────────
export interface DateRange {
  start: string // ISO date (YYYY-MM-DD)
  end: string   // ISO date (YYYY-MM-DD)
}

// ── Core System Interface ──────────────────────────────────────────────────
export interface LifeOSSystem {
  /** Unique identifier, e.g. 'tcs', 'fitness-pro' */
  id: string
  /** Human-readable name */
  name: string
  /** Emoji or icon path */
  icon: string
  /** Semver version string */
  version: string
  /** Declares what the system provides */
  manifest: SystemManifest
  /** Authenticate and initialize connection */
  connect(config: SystemConfig): Promise<void>
  /** Tear down connection, release resources */
  disconnect(): Promise<void>
  /** Health check — is the system still reachable? */
  status(): Promise<SystemStatus>
}

// ── System Manifest ────────────────────────────────────────────────────────
export interface SystemManifest {
  /** What LifeOS domains this system provides data for */
  provides: SystemProviders
  /** Custom pages injected into the sidebar */
  pages?: SystemPage[]
  /** Dashboard widgets */
  widgets?: SystemWidget[]
  /** Settings panels */
  settings?: SystemSettings[]
}

export interface SystemProviders {
  schedule?: ScheduleProvider
  finance?: FinanceProvider
  goals?: GoalProvider
  tasks?: TaskProvider
  health?: HealthProvider
  gamification?: GamificationProvider
}

// ── System Config ──────────────────────────────────────────────────────────
export interface SystemConfig {
  /** Supabase project URL (if system uses its own Supabase) */
  supabaseUrl?: string
  /** Supabase anon key */
  supabaseAnonKey?: string
  /** API endpoint (if system is a standalone API) */
  apiUrl?: string
  /** API key */
  apiKey?: string
  /** Map LifeOS user → external system user */
  externalUserId?: string
  /** Which providers to enable */
  enabledProviders?: {
    schedule?: boolean
    finance?: boolean
    gamification?: boolean
    tasks?: boolean
    goals?: boolean
    health?: boolean
  }
  /** System-specific configuration */
  options?: Record<string, unknown>
}

// ── System Registration & Status ───────────────────────────────────────────
export interface SystemRegistration {
  system: LifeOSSystem
  config: SystemConfig
  connectedAt: Date
}

export interface SystemStatus {
  connected: boolean
  lastSync: Date | null
  error?: string
}

// ── Provider Interfaces ────────────────────────────────────────────────────

// Schedule Provider
export interface ScheduleProvider {
  getEvents(range: DateRange): Promise<ScheduleEvent[]>
  subscribe?(callback: (events: ScheduleEvent[]) => void): () => void
}

export interface ScheduleEvent {
  id: string
  title: string
  start: string        // ISO datetime
  end?: string         // ISO datetime
  duration?: number    // minutes
  allDay?: boolean
  category: 'work' | 'personal' | 'health' | 'education' | 'social'
  color?: string
  icon?: string
  location?: string
  description?: string
  metadata?: Record<string, unknown>
}

// Finance Provider
export interface FinanceProvider {
  getSummary(range: DateRange): Promise<FinanceSummary>
  getTransactions(range: DateRange): Promise<Transaction[]>
  getRevenue?(range: DateRange): Promise<number>
  getExpenses?(range: DateRange): Promise<ExpenseItem[]>
}

export interface FinanceSummary {
  revenue: number
  expenses: number
  netIncome: number
  currency: string
  jobCount?: number
  periodLabel?: string
}

export interface Transaction {
  id: string
  type: 'income' | 'expense' | 'transfer'
  amount: number
  title: string
  category: string
  date: string         // ISO date
  currency?: string
  description?: string
  metadata?: Record<string, unknown>
}

export interface ExpenseItem {
  id: string
  amount: number
  title: string
  category: string
  date: string
  vendor?: string
  recurring?: boolean
  metadata?: Record<string, unknown>
}

// Goal Provider
export interface GoalProvider {
  getGoals(filter?: GoalFilter): Promise<SystemGoal[]>
  updateGoalProgress?(goalId: string, progress: number): Promise<void>
}

export interface GoalFilter {
  status?: 'active' | 'completed' | 'paused'
  category?: string
}

export interface SystemGoal {
  id: string
  title: string
  description?: string
  targetValue: number
  currentValue: number
  unit?: string
  category?: string
  deadline?: string
  status: 'active' | 'completed' | 'paused'
  metadata?: Record<string, unknown>
}

// Task Provider
export interface TaskProvider {
  getTodayTasks(): Promise<SystemTask[]>
  getTasks?(filter?: TaskFilter): Promise<SystemTask[]>
  getTaskCount(): Promise<{ total: number; completed: number }>
  completeTask?(taskId: string): Promise<void>
}

export interface TaskFilter {
  status?: SystemTask['status'] | SystemTask['status'][]
  priority?: SystemTask['priority'] | SystemTask['priority'][]
  category?: string
  dateRange?: DateRange
  limit?: number
}

export interface SystemTask {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'completed'
  dueTime?: string
  endTime?: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  category?: string
  notes?: string
  assignee?: string
  metadata?: Record<string, unknown>
}

// Health Provider
export interface HealthProvider {
  getHealthMetrics(range: DateRange): Promise<HealthMetric[]>
  getWorkHours?(range: DateRange): Promise<number>
}

export interface HealthMetric {
  id: string
  type: 'sleep' | 'exercise' | 'stress' | 'steps' | 'heartRate' | 'custom'
  value: number
  unit: string
  date: string
  metadata?: Record<string, unknown>
}

// Gamification Provider
export interface GamificationProvider {
  getPlayerStats(): Promise<PlayerStats>
  getRecentXP?(limit?: number): Promise<XPEvent[]>
  getAchievements(): Promise<Achievement[]>
  getLeaderboard?(metric: string, limit?: number): Promise<LeaderEntry[]>
}

export interface PlayerStats {
  level: number
  xp: number
  xpToNextLevel: number
  title: string
  stats: Record<string, number>
  achievements?: string[]
}

export interface XPEvent {
  id: string
  amount: number
  source: string
  description: string
  timestamp: string
}

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  unlockedAt?: string
  progress?: number // 0–1 for incomplete
}

export interface LeaderEntry {
  rank: number
  userId: string
  displayName: string
  avatar?: string
  value: number
  metric: string
}

// ── UI Extension Types ─────────────────────────────────────────────────────

export interface SystemPage {
  path: string
  label: string
  icon: string
  /** Optional component name (for lazy loading) */
  component?: string
}

export interface SystemWidget {
  id: string
  title?: string
  label: string
  size: 'small' | 'medium' | 'large'
  /** Component name to render */
  component: string
  /** System that provides this widget */
  systemId?: string
}

export interface SystemSettings {
  key: string
  label: string
  description?: string
  type: 'toggle' | 'select' | 'text' | 'number'
  options?: { value: string; label: string }[]
  default: unknown
}

// ── Legacy Aliases (backward compat) ───────────────────────────────────────
export type FinanceTransaction = Transaction
export type SystemSetting = SystemSettings
