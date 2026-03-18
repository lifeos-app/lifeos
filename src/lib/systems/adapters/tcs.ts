// TCS Adapter — Example Cleaning Business → LifeOS System Bus
//
// Design principle: Transparent bridge. RLS does the security.
//   - An admin sees all jobs. An employee sees their assigned jobs.
//   - The adapter passes through whatever Supabase returns — no filtering here.
//   - persistSession: false keeps TCS auth out of LifeOS's localStorage slot.

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '../../../utils/logger';
import type {
  LifeOSSystem,
  SystemConfig,
  SystemManifest,
  SystemStatus,
  DateRange,
  ScheduleEvent,
  FinanceSummary,
  Transaction,
  ExpenseItem,
  PlayerStats,
  XPEvent,
  Achievement,
  LeaderEntry,
  SystemTask,
  TaskFilter,
  ScheduleProvider,
  FinanceProvider,
  GamificationProvider,
  TaskProvider,
} from '../types'

// ── TCS Connection Constants (from environment) ───────────────────────────
const TCS_SUPABASE_URL = import.meta.env.VITE_TCS_SUPABASE_URL || ''
const TCS_ANON_KEY = import.meta.env.VITE_TCS_SUPABASE_ANON_KEY || ''

/** Extended config for TCS — adds email/password for initial auth */
export interface TCSConfig extends SystemConfig {
  email: string
  password: string
}

// ── Status Color Map ───────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending: '#F97316',     // orange
  scheduled: '#F97316',   // orange
  confirmed: '#00D4FF',   // cyan
  in_progress: '#3B82F6', // blue
  started: '#3B82F6',     // blue
  active: '#3B82F6',      // blue
  completed: '#39FF14',   // green
  done: '#39FF14',        // green
  invoiced: '#10B981',    // emerald
  cancelled: '#F43F5E',   // red
  no_show: '#F43F5E',     // red
}

// ── Raw DB Row Types ───────────────────────────────────────────────────────
interface RawVenue {
  id?: string | null
  name: string | null
  address?: string | null
  suburb?: string | null
  city?: string | null
  state?: string | null
  postcode?: string | null
}

interface RawJob {
  id: string
  user_id: string
  venue_id?: string | null
  scheduled_date: string
  start_time?: string | null
  end_time?: string | null
  duration?: number | null
  status?: string | null
  amount?: number | null
  total_amount?: number | null
  notes?: string | null
  created_at?: string | null
  venues?: RawVenue | null
}


interface RawEmployeeDetail {
  user_id: string
  display_name?: string | null
  level?: number | null
  xp?: number | null
  xp_to_next_level?: number | null
  title?: string | null
  stats?: Record<string, number> | null
  achievements?: RawAchievement[] | null
  xp_log?: RawXPEvent[] | null
  jobs_completed?: number | null
  on_time_rate?: number | null
  quality_score?: number | null
}

interface RawAchievement {
  id?: string | null
  name?: string | null
  description?: string | null
  icon?: string | null
  unlocked_at?: string | null
  progress?: number | null
}

interface RawXPEvent {
  id?: string | null
  amount?: number | null
  source?: string | null
  description?: string | null
  timestamp?: string | null
}


interface RawEquipment {
  id: string
  name?: string | null
  purchase_price?: number | null
  purchase_date?: string | null
  category?: string | null
  status?: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────
function toDatetimeISO(date: string, time: string | null | undefined): string {
  if (!time) return `${date}T00:00:00`
  const t = time.length === 5 ? `${time}:00` : time
  return `${date}T${t}`
}

function durationMins(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): number | undefined {
  if (!startTime || !endTime) return undefined
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  if ([sh, sm, eh, em].some(isNaN)) return undefined
  let mins = eh * 60 + em - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60 // handle overnight
  return mins > 0 ? mins : undefined
}


function venueFullTitle(venues: RawVenue | null | undefined): string {
  if (!venues?.name) return 'Cleaning Job'
  const parts = [venues.address, venues.suburb, venues.city].filter(Boolean)
  return parts.length ? `${venues.name} — ${parts.join(', ')}` : venues.name
}

function venueAddressStr(venues: RawVenue | null | undefined): string | undefined {
  if (!venues) return undefined
  const parts = [venues.address, venues.suburb, venues.city, venues.state, venues.postcode].filter(Boolean)
  return parts.length ? parts.join(', ') : undefined
}

function jobStatusToTaskStatus(
  status: string | null | undefined,
): SystemTask['status'] {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'done':
    case 'invoiced':
      return 'completed'
    case 'in_progress':
    case 'started':
    case 'active':
      return 'in_progress'
    default:
      return 'pending'
  }
}

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getStatusColor(status: string | null | undefined): string {
  if (!status) return '#F97316'
  return STATUS_COLORS[status.toLowerCase()] ?? '#F97316'
}

function getWeekRange(): DateRange {
  const now = new Date()
  const dow = now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((dow + 6) % 7))
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return {
    start: todayStr(mon),
    end: todayStr(sun),
  }
}

function getMonthRange(): DateRange {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    start: todayStr(start),
    end: todayStr(end),
  }
}

function todayStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── TCS Schedule Provider ──────────────────────────────────────────────────
class TCSScheduleProvider implements ScheduleProvider {
  private readonly db: SupabaseClient;
  constructor(db: SupabaseClient, _userId: string) {
    this.db = db;
  }

  async getEvents(range: DateRange): Promise<ScheduleEvent[]> {
    const { data, error } = await this.db
      .from('jobs')
      .select(
        'id, user_id, venue_id, scheduled_date, start_time, end_time, duration, status, amount, total_amount, notes, venues(id, name, address, suburb, city, state, postcode)',
      )
      .gte('scheduled_date', range.start)
      .lte('scheduled_date', range.end)
      .order('scheduled_date', { ascending: true })
      .order('start_time', { ascending: true })

    if (error) {
      logger.warn('[TCS] Schedule query error:', error.message)
      return []
    }

    return ((data ?? []) as unknown as RawJob[]).map(job => this._toEvent(job))
  }

  subscribe(callback: (events: ScheduleEvent[]) => void): () => void {
    const channel = this.db
      .channel('tcs-jobs-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        async () => {
          // Re-fetch today's events on any change
          const today = todayLocal()
          const events = await this.getEvents({ start: today, end: today })
          callback(events)
        },
      )
      .subscribe()

    return () => {
      this.db.removeChannel(channel)
    }
  }

  private _toEvent(job: RawJob): ScheduleEvent {
    const start = toDatetimeISO(job.scheduled_date, job.start_time)
    const end = job.end_time
      ? toDatetimeISO(job.scheduled_date, job.end_time)
      : undefined
    const duration = job.duration ?? durationMins(job.start_time, job.end_time)
    const title = `🧹 ${venueFullTitle(job.venues)}`
    const statusColor = getStatusColor(job.status)
    const address = venueAddressStr(job.venues)

    return {
      id: `tcs-job-${job.id}`,
      title,
      start,
      end,
      duration,
      category: 'work',
      color: statusColor,
      icon: '🧹',
      location: address,
      description: job.notes ?? undefined,
      metadata: {
        source: 'tcs',
        jobId: job.id,
        venueId: job.venue_id ?? undefined,
        venueName: job.venues?.name ?? undefined,
        venueAddress: address,
        status: job.status ?? 'pending',
        amount: job.total_amount ?? job.amount ?? undefined,
        notes: job.notes ?? undefined,
      },
    }
  }
}

// ── TCS Finance Provider ───────────────────────────────────────────────────
class TCSFinanceProvider implements FinanceProvider {
  private readonly db: SupabaseClient;
  constructor(db: SupabaseClient, _userId: string) {
    this.db = db;
  }

  async getSummary(range: DateRange): Promise<FinanceSummary> {
    const { data, error } = await this.db
      .from('jobs')
      .select('id, amount, total_amount, status')
      .gte('scheduled_date', range.start)
      .lte('scheduled_date', range.end)

    if (error) {
      logger.warn('[TCS] Finance summary error:', error.message)
      return { revenue: 0, expenses: 0, netIncome: 0, currency: 'AUD', jobCount: 0 }
    }

    const rows = (data ?? []) as Array<{
      amount: number | null
      total_amount: number | null
      status: string | null
    }>

    const billable = rows.filter(
      r => !r.status || ['completed', 'done', 'invoiced'].includes(r.status.toLowerCase()),
    )

    const revenue = billable.reduce(
      (sum, r) => sum + (r.total_amount ?? r.amount ?? 0),
      0,
    )

    // Try to fetch expenses from equipment purchases
    let expenses = 0
    try {
      const { data: eqData } = await this.db
        .from('equipment')
        .select('purchase_price, purchase_date')
        .gte('purchase_date', range.start)
        .lte('purchase_date', range.end)

      if (eqData) {
        expenses = (eqData as RawEquipment[]).reduce(
          (sum, e) => sum + (e.purchase_price ?? 0),
          0,
        )
      }
    } catch { /* equipment table may not exist */ }

    return {
      revenue,
      expenses,
      netIncome: revenue - expenses,
      currency: 'AUD',
      jobCount: billable.length,
    }
  }

  async getTransactions(range: DateRange): Promise<Transaction[]> {
    const transactions: Transaction[] = []

    // Income from jobs
    const { data: jobData, error: jobError } = await this.db
      .from('jobs')
      .select(
        'id, scheduled_date, amount, total_amount, status, notes, venues(name, address, suburb)',
      )
      .gte('scheduled_date', range.start)
      .lte('scheduled_date', range.end)
      .order('scheduled_date', { ascending: false })

    if (!jobError && jobData) {
      type JobRow = {
        id: string
        scheduled_date: string
        amount: number | null
        total_amount: number | null
        status: string | null
        notes: string | null
        venues: { name: string | null; address?: string | null; suburb?: string | null } | null
      }

      const incomeRows = (jobData as unknown as JobRow[]).filter(
        j => !j.status || ['completed', 'done', 'invoiced'].includes(j.status.toLowerCase()),
      )

      for (const j of incomeRows) {
        const venueName = j.venues?.name
        const title = venueName ? `🧹 ${venueName}` : '🧹 Cleaning job'
        const addrParts = [j.venues?.address, j.venues?.suburb].filter(Boolean)
        transactions.push({
          id: `tcs-income-${j.id}`,
          type: 'income',
          amount: j.total_amount ?? j.amount ?? 0,
          title,
          category: 'cleaning',
          date: j.scheduled_date,
          currency: 'AUD',
          metadata: {
            source: 'tcs',
            jobId: j.id,
            venueName: venueName ?? undefined,
            venueAddress: addrParts.length ? addrParts.join(', ') : undefined,
            notes: j.notes ?? undefined,
          },
        })
      }
    }

    // Expenses from equipment
    try {
      const { data: eqData } = await this.db
        .from('equipment')
        .select('id, name, purchase_price, purchase_date, category')
        .gte('purchase_date', range.start)
        .lte('purchase_date', range.end)
        .order('purchase_date', { ascending: false })

      if (eqData) {
        for (const eq of eqData as RawEquipment[]) {
          if (!eq.purchase_price) continue
          transactions.push({
            id: `tcs-expense-${eq.id}`,
            type: 'expense',
            amount: eq.purchase_price,
            title: `🔧 ${eq.name ?? 'Equipment'}`,
            category: eq.category ?? 'equipment',
            date: eq.purchase_date ?? range.start,
            currency: 'AUD',
            metadata: {
              source: 'tcs',
              equipmentId: eq.id,
            },
          })
        }
      }
    } catch { /* equipment table may not exist */ }

    // Sort newest first
    transactions.sort((a, b) => b.date.localeCompare(a.date))
    return transactions
  }

  async getRevenue(range: DateRange): Promise<number> {
    const summary = await this.getSummary(range)
    return summary.revenue
  }

  async getExpenses(range: DateRange): Promise<ExpenseItem[]> {
    const items: ExpenseItem[] = []
    try {
      const { data: eqData } = await this.db
        .from('equipment')
        .select('id, name, purchase_price, purchase_date, category')
        .gte('purchase_date', range.start)
        .lte('purchase_date', range.end)

      if (eqData) {
        for (const eq of eqData as RawEquipment[]) {
          if (!eq.purchase_price) continue
          items.push({
            id: `tcs-eq-${eq.id}`,
            amount: eq.purchase_price,
            title: eq.name ?? 'Equipment',
            category: eq.category ?? 'equipment',
            date: eq.purchase_date ?? range.start,
          })
        }
      }
    } catch { /* equipment table may not exist */ }
    return items
  }

  // Convenience methods for widgets
  async getWeeklyRevenue(): Promise<{ total: number; daily: { date: string; amount: number }[] }> {
    const range = getWeekRange()
    const { data, error } = await this.db
      .from('jobs')
      .select('scheduled_date, amount, total_amount, status')
      .gte('scheduled_date', range.start)
      .lte('scheduled_date', range.end)

    if (error || !data) return { total: 0, daily: [] }

    const rows = (data as Array<{
      scheduled_date: string
      amount: number | null
      total_amount: number | null
      status: string | null
    }>).filter(
      r => !r.status || ['completed', 'done', 'invoiced'].includes(r.status.toLowerCase()),
    )

    // Build daily breakdown
    const dailyMap = new Map<string, number>()
    for (const r of rows) {
      const cur = dailyMap.get(r.scheduled_date) ?? 0
      dailyMap.set(r.scheduled_date, cur + (r.total_amount ?? r.amount ?? 0))
    }

    // Fill in all 7 days
    const daily: { date: string; amount: number }[] = []
    const start = new Date(range.start + 'T12:00:00')
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const ds = todayStr(d)
      daily.push({ date: ds, amount: dailyMap.get(ds) ?? 0 })
    }

    const total = rows.reduce((s, r) => s + (r.total_amount ?? r.amount ?? 0), 0)
    return { total, daily }
  }

  async getMonthlyRevenue(): Promise<number> {
    const range = getMonthRange()
    const summary = await this.getSummary(range)
    return summary.revenue
  }

  async getLastWeekRevenue(): Promise<number> {
    const now = new Date()
    const dow = now.getDay()
    const lastMon = new Date(now)
    lastMon.setDate(now.getDate() - ((dow + 6) % 7) - 7)
    const lastSun = new Date(lastMon)
    lastSun.setDate(lastMon.getDate() + 6)
    const summary = await this.getSummary({
      start: todayStr(lastMon),
      end: todayStr(lastSun),
    })
    return summary.revenue
  }
}

// ── TCS Gamification Provider ──────────────────────────────────────────────
class TCSGamificationProvider implements GamificationProvider {
  private readonly db: SupabaseClient;
  private readonly userId: string;
  constructor(db: SupabaseClient, _userId: string) {
    this.db = db;
    this.userId = _userId;
  }

  async getPlayerStats(): Promise<PlayerStats> {
    const { data, error } = await this.db
      .from('employee_details')
      .select('user_id, display_name, level, xp, xp_to_next_level, title, stats, jobs_completed, on_time_rate, quality_score')
      .eq('user_id', this.userId)
      .maybeSingle()

    if (error) logger.warn('[TCS] Gamification query error:', error.message)

    const row = data as RawEmployeeDetail | null
    return {
      level: row?.level ?? 1,
      xp: row?.xp ?? 0,
      xpToNextLevel: row?.xp_to_next_level ?? 100,
      title: row?.title ?? 'Rookie',
      stats: {
        ...(row?.stats ?? {}),
        jobsCompleted: row?.jobs_completed ?? 0,
        onTimeRate: row?.on_time_rate ?? 0,
        qualityScore: row?.quality_score ?? 0,
      },
    }
  }

  async getRecentXP(limit = 10): Promise<XPEvent[]> {
    const { data, error } = await this.db
      .from('employee_details')
      .select('xp_log')
      .eq('user_id', this.userId)
      .maybeSingle()

    if (error || !data) return []

    const row = data as { xp_log?: RawXPEvent[] | null }
    const log = row.xp_log ?? []

    return log.slice(0, limit).map((e, i) => ({
      id: e.id ?? `xp-${i}`,
      amount: e.amount ?? 0,
      source: e.source ?? 'tcs',
      description: e.description ?? 'XP earned',
      timestamp: e.timestamp ?? new Date().toISOString(),
    }))
  }

  async getAchievements(): Promise<Achievement[]> {
    const { data, error } = await this.db
      .from('employee_details')
      .select('achievements')
      .eq('user_id', this.userId)
      .maybeSingle()

    if (error || !data) return []

    const row = data as { achievements?: RawAchievement[] | null }
    const raw = row.achievements ?? []

    return raw.map((a, i) => ({
      id: a.id ?? `ach-${i}`,
      name: a.name ?? 'Achievement',
      description: a.description ?? '',
      icon: a.icon ?? '🏆',
      unlockedAt: a.unlocked_at ?? undefined,
      progress: a.progress ?? undefined,
    }))
  }

  async getLeaderboard(metric: string, limit = 10): Promise<LeaderEntry[]> {
    const { data, error } = await this.db
      .from('employee_details')
      .select('user_id, display_name, jobs_completed, on_time_rate, quality_score, level, xp')
      .order(metric === 'xp' ? 'xp' : metric === 'level' ? 'level' : 'jobs_completed', { ascending: false })
      .limit(limit)

    if (error || !data) return []

    return (data as RawEmployeeDetail[]).map((row, i) => ({
      rank: i + 1,
      userId: row.user_id,
      displayName: row.display_name ?? `Employee ${i + 1}`,
      value: metric === 'xp' ? (row.xp ?? 0) :
             metric === 'level' ? (row.level ?? 1) :
             (row.jobs_completed ?? 0),
      metric,
    }))
  }
}

// ── TCS Task Provider ──────────────────────────────────────────────────────
class TCSTaskProvider implements TaskProvider {
  private readonly db: SupabaseClient;
  constructor(db: SupabaseClient, _userId: string) {
    this.db = db;
  }

  async getTodayTasks(): Promise<SystemTask[]> {
    const today = todayLocal()

    const { data, error } = await this.db
      .from('jobs')
      .select(
        'id, scheduled_date, start_time, end_time, status, notes, venues(name, address, suburb, city)',
      )
      .eq('scheduled_date', today)
      .order('start_time', { ascending: true })

    if (error) {
      logger.warn('[TCS] Tasks query error:', error.message)
      return []
    }

    type JobRow = {
      id: string
      start_time: string | null
      end_time: string | null
      status: string | null
      notes: string | null
      venues: { name: string | null; address?: string | null; suburb?: string | null; city?: string | null } | null
    }

    return ((data ?? []) as unknown as JobRow[]).map(j => {
      const venueName = j.venues?.name
      const addrParts = [j.venues?.address, j.venues?.suburb, j.venues?.city].filter(Boolean)
      const venueAddr = addrParts.length ? addrParts.join(', ') : undefined
      const title = venueName
        ? `🧹 ${venueName}`
        : '🧹 Cleaning job'

      return {
        id: `tcs-task-${j.id}`,
        title,
        status: jobStatusToTaskStatus(j.status),
        dueTime: j.start_time ?? undefined,
        endTime: j.end_time ?? undefined,
        priority: 'normal' as const,
        category: 'cleaning',
        notes: j.notes ?? undefined,
        metadata: {
          source: 'tcs',
          jobId: j.id,
          venueName: venueName ?? undefined,
          venueAddress: venueAddr,
          status: j.status ?? 'pending',
        },
      }
    })
  }

  async getTasks(filter?: TaskFilter): Promise<SystemTask[]> {
    let query = this.db
      .from('jobs')
      .select(
        'id, scheduled_date, start_time, end_time, status, notes, venues(name, address, suburb, city)',
      )
      .order('scheduled_date', { ascending: false })
      .order('start_time', { ascending: true })

    if (filter?.dateRange) {
      query = query.gte('scheduled_date', filter.dateRange.start).lte('scheduled_date', filter.dateRange.end)
    }

    if (filter?.limit) {
      query = query.limit(filter.limit)
    }

    const { data, error } = await query
    if (error) {
      logger.warn('[TCS] Tasks filter query error:', error.message)
      return []
    }

    type JobRow = {
      id: string
      scheduled_date: string
      start_time: string | null
      end_time: string | null
      status: string | null
      notes: string | null
      venues: { name: string | null; address?: string | null; suburb?: string | null; city?: string | null } | null
    }

    let tasks = ((data ?? []) as unknown as JobRow[]).map(j => ({
      id: `tcs-task-${j.id}`,
      title: j.venues?.name ? `🧹 ${j.venues.name}` : '🧹 Cleaning job',
      status: jobStatusToTaskStatus(j.status),
      dueTime: j.start_time ?? undefined,
      endTime: j.end_time ?? undefined,
      priority: 'normal' as const,
      category: 'cleaning',
      notes: j.notes ?? undefined,
      metadata: {
        source: 'tcs',
        jobId: j.id,
        scheduledDate: j.scheduled_date,
        venueName: j.venues?.name ?? undefined,
        status: j.status ?? 'pending',
      },
    }))

    // Apply status filter
    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
      tasks = tasks.filter(t => statuses.includes(t.status))
    }

    return tasks
  }

  async getTaskCount(): Promise<{ total: number; completed: number }> {
    const today = todayLocal()

    const { data, error } = await this.db
      .from('jobs')
      .select('status')
      .eq('scheduled_date', today)

    if (error || !data) return { total: 0, completed: 0 }

    const rows = data as Array<{ status: string | null }>
    const completed = rows.filter(
      r => r.status && ['completed', 'done', 'invoiced'].includes(r.status.toLowerCase()),
    ).length

    return { total: rows.length, completed }
  }

  async completeTask(taskId: string): Promise<void> {
    // Extract the original job ID from our prefixed task ID
    const jobId = taskId.replace('tcs-task-', '')
    const { error } = await this.db
      .from('jobs')
      .update({ status: 'completed' })
      .eq('id', jobId)

    if (error) {
      logger.warn('[TCS] Complete task error:', error.message)
      throw new Error(`Failed to complete task: ${error.message}`)
    }
  }
}

// ── TCS Adapter (Main System Implementation) ───────────────────────────────
export class TCSAdapter implements LifeOSSystem {
  readonly id = 'tcs'
  readonly name = "Example Cleaning Business"
  readonly icon = '🧹'
  readonly version = '1.0.0'

  private db: SupabaseClient | null = null
  private userId: string | null = null
  private enabledProviders = {
    schedule: true,
    finance: true,
    gamification: true,
    tasks: true,
  }
  private _status: SystemStatus = { connected: false, lastSync: null }

  manifest: SystemManifest = {
    provides: {},
    widgets: [
      { id: 'tcs-today', title: "Today's Jobs", label: "Today's Jobs", size: 'medium', component: 'TCSTodayWidget', systemId: 'tcs' },
      { id: 'tcs-revenue', title: 'Revenue', label: 'Revenue', size: 'medium', component: 'TCSRevenueWidget', systemId: 'tcs' },
    ],
    pages: [
      { path: '/work', label: 'Work', icon: '🧹' },
      { path: '/work/schedule', label: 'Job Schedule', icon: '📅' },
    ],
  }

  /** Get the raw Supabase client (for widgets that need direct queries) */
  getClient(): SupabaseClient | null {
    return this.db
  }

  /** Get the authenticated user ID */
  getUserId(): string | null {
    return this.userId
  }

  /** Get the finance provider directly (for revenue widgets) */
  getFinanceProvider(): TCSFinanceProvider | null {
    if (!this.db || !this.userId) return null
    return new TCSFinanceProvider(this.db, this.userId)
  }

  async connect(config: SystemConfig): Promise<void> {
    const tcsConfig = config as TCSConfig

    if (!tcsConfig.email || !tcsConfig.password) {
      throw new Error('TCS adapter requires email and password')
    }

    if (tcsConfig.enabledProviders) {
      this.enabledProviders = {
        schedule: tcsConfig.enabledProviders.schedule ?? true,
        finance: tcsConfig.enabledProviders.finance ?? true,
        gamification: tcsConfig.enabledProviders.gamification ?? true,
        tasks: tcsConfig.enabledProviders.tasks ?? true,
      }
    }

    this.db = createClient(TCS_SUPABASE_URL, TCS_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
      },
    })

    const { data: authData, error: authError } = await this.db.auth.signInWithPassword({
      email: tcsConfig.email,
      password: tcsConfig.password,
    })

    if (authError || !authData.user) {
      this.db = null
      this._status = {
        connected: false,
        lastSync: null,
        error: authError?.message ?? 'Authentication failed',
      }
      throw new Error(authError?.message ?? 'TCS authentication failed')
    }

    this.userId = authData.user.id
    this._status = { connected: true, lastSync: new Date() }
    this._buildManifest()
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      await this.db.auth.signOut()
      this.db = null
    }
    this.userId = null
    this.manifest = { provides: {} }
    this._status = { connected: false, lastSync: null }
  }

  async status(): Promise<SystemStatus> {
    if (!this.db || !this.userId) return this._status

    try {
      const { error } = await this.db.from('jobs').select('id').limit(1)
      if (error?.code === 'PGRST301' || error?.message?.includes('JWT')) {
        this._status = {
          connected: false,
          lastSync: this._status.lastSync,
          error: 'Session expired — please reconnect',
        }
      } else {
        this._status = { connected: true, lastSync: new Date() }
      }
    } catch {
      this._status = {
        connected: false,
        lastSync: this._status.lastSync,
        error: 'Connection check failed',
      }
    }
    return this._status
  }

  private _buildManifest(): void {
    if (!this.db || !this.userId) return

    const db = this.db
    const uid = this.userId
    const provides: SystemManifest['provides'] = {}

    if (this.enabledProviders.schedule) provides.schedule = new TCSScheduleProvider(db, uid)
    if (this.enabledProviders.finance)  provides.finance  = new TCSFinanceProvider(db, uid)
    if (this.enabledProviders.gamification) provides.gamification = new TCSGamificationProvider(db, uid)
    if (this.enabledProviders.tasks)    provides.tasks    = new TCSTaskProvider(db, uid)

    this.manifest = {
      provides,
      widgets: [
        { id: 'tcs-today', title: "Today's Jobs", label: "Today's Jobs", size: 'medium', component: 'TCSTodayWidget', systemId: 'tcs' },
        { id: 'tcs-revenue', title: 'Revenue', label: 'Revenue', size: 'medium', component: 'TCSRevenueWidget', systemId: 'tcs' },
      ],
      pages: [
        { path: '/work', label: 'Work', icon: '🧹' },
        { path: '/work/schedule', label: 'Job Schedule', icon: '📅' },
      ],
    }
  }
}
