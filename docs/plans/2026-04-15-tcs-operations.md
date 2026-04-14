# TCS Operations in LifeOS — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make LifeOS the operating system that runs Teddy's Cleaning Systems — km logging, job scheduling, income tracking, vehicle logbook, and the 90-day growth plan all in one place.

**Architecture:** Extend existing LifeOS infrastructure (Finances Work tab, Schedule page, Journal, system bus) with TCS-specific components. No new pages — embed TCS operations INTO existing pages. The TCS adapter already bridges Supabase data. We add the UI layer.

**Tech Stack:** React + TypeScript, Zustand stores, Supabase (LifeOS + TCS), existing CSS design system (glass cards, gradient buttons, Orbitron/Poppins fonts)

---

## What Exists Already

- **TCS Adapter** (`src/lib/systems/adapters/tcs.ts`) — reads jobs/venues from TCS Supabase, maps to ScheduleEvent/FinanceSummary/SystemTask
- **Finances > Work tab** — shows businesses, clients, projected income, equipment
- **Schedule page** — full calendar with work events, creates schedule_events table entries
- **Journal** — free-form journaling with mood/energy/tags
- **Finance types** — `ExpenseEntry` already has `km_driven`, `odometer_reading`, `is_travel` fields!
- **Business & Client** types — already modelled in database
- **Achievement/gamification** system — XP, achievements, quest engine

## What's Missing (This Plan)

1. **One-tap KM Logger** — a quick component to log km per cleaning run
2. **TCS Today Widget** — at-a-glance dashboard for the day's jobs + km
3. **Vehicle Logbook** — auto-calculated ATO deduction ($0.85/km)
4. **Job Completion Flow** — mark job done, auto-create income entry
5. **Invoice Status Tracker** — who's paid, who hasn't, per client
6. **TCS Growth Plan** — 90-day milestones as Goals with progress

---

### Task 1: Create TCS KM Logger Component

**Objective:** A quick-tap component that logs km driven for a cleaning run. Shows on Finances > Work tab and as a Dashboard widget.

**Files:**
- Create: `src/components/tcs/KMLogger.tsx`
- Create: `src/components/tcs/KMLogger.css`
- Modify: `src/components/finances/WorkTab.tsx` — embed KMLogger

**Step 1: Create KMLogger component**

```tsx
// src/components/tcs/KMLogger.tsx
import React, { useState } from 'react';
import { Car, Plus, Check, History } from 'lucide-react';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { useUserStore } from '../../stores/useUserStore';
import { genId, todayStr, fmtCurrency } from '../../utils/date';
import './KMLogger.css';

const ROUTE_KM = 134; // Rockbank → Jaga Jaga → Sonder → Rockbank
const ATO_RATE = 0.85; // $0.85/km 2025-2026
const QUICK_VALUES = [134, 67, 50, 30]; // Full run, half, short errands

export function KMLogger() {
  const user = useUserStore(s => s.user);
  const addExpense = useFinanceStore(s => s.addExpense);
  const [customKm, setCustomKm] = useState('');
  const [lastLogged, setLastLogged] = useState<string | null>(null);

  function logKm(km: number) {
    const deduction = km * ATO_RATE;
    addExpense({
      id: genId(),
      user_id: user?.id ?? '',
      title: `Vehicle: ${km}km cleaning run`,
      amount: deduction,
      date: todayStr(),
      category: 'vehicle',
      km_driven: km,
      is_travel: true,
      notes: `${km}km @ $${ATO_RATE}/km = $${deduction.toFixed(2)} deduction`,
    });
    setLastLogged(`${km}km — $${deduction.toFixed(2)}`);
    setTimeout(() => setLastLogged(null), 3000);
  }

  function handleCustom() {
    const km = parseInt(customKm, 10);
    if (km > 0) { logKm(km); setCustomKm(''); }
  }

  return (
    <div className="tcs-km-logger">
      <div className="tcs-km-header">
        <Car size={16} />
        <span>Log KM</span>
        <span className="tcs-km-rate">@ ${ATO_RATE}/km</span>
      </div>
      <div className="tcs-km-quick">
        {QUICK_VALUES.map(km => (
          <button
            key={km}
            className="tcs-km-btn"
            onClick={() => logKm(km)}
            title={`${km}km = $${(km * ATO_RATE).toFixed(2)}`}
          >
            <Plus size={12} /> {km}km
            <span className="tcs-km-deduction">${(km * ATO_RATE).toFixed(0)}</span>
          </button>
        ))}
      </div>
      <div className="tcs-km-custom">
        <input
          type="number"
          value={customKm}
          onChange={e => setCustomKm(e.target.value)}
          placeholder="Custom km..."
          className="tcs-km-input"
          onKeyDown={e => e.key === 'Enter' && handleCustom()}
        />
        <button className="tcs-km-log-btn" onClick={handleCustom}>
          <Check size={14} /> Log
        </button>
      </div>
      {lastLogged && (
        <div className="tcs-km-confirmed">
          <Check size={14} /> {lastLogged}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Create KMLogger CSS (glass card style, matches existing design system)**

```css
/* src/components/tcs/KMLogger.css */
.tcs-km-logger {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 16px;
  backdrop-filter: blur(12px);
}
.tcs-km-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-family: 'Orbitron', monospace;
  font-size: 13px;
  color: #ccc;
}
.tcs-km-rate {
  margin-left: auto;
  font-size: 11px;
  color: #888;
  font-family: 'Poppins', sans-serif;
}
.tcs-km-quick {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.tcs-km-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  background: linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.05));
  border: 1px solid rgba(0,212,255,0.2);
  border-radius: 8px;
  color: #00D4FF;
  font-size: 13px;
  font-family: 'Orbitron', monospace;
  cursor: pointer;
  transition: all 0.2s;
}
.tcs-km-btn:hover {
  background: linear-gradient(135deg, rgba(0,212,255,0.25), rgba(0,212,255,0.1));
  border-color: rgba(0,212,255,0.4);
  transform: scale(1.05);
}
.tcs-km-btn:active {
  transform: scale(0.95);
}
.tcs-km-deduction {
  font-size: 10px;
  color: #39FF14;
  font-family: 'Poppins', sans-serif;
}
.tcs-km-custom {
  display: flex;
  gap: 8px;
}
.tcs-km-input {
  flex: 1;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px;
  padding: 8px 12px;
  color: #fff;
  font-size: 14px;
  font-family: 'Poppins', sans-serif;
  outline: none;
}
.tcs-km-input:focus {
  border-color: rgba(0,212,255,0.4);
}
.tcs-km-log-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #39FF14, #00D4FF);
  border: none;
  border-radius: 8px;
  color: #000;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.tcs-km-log-btn:hover { transform: scale(1.05); }
.tcs-km-log-btn:active { transform: scale(0.95); }
.tcs-km-confirmed {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #39FF14;
  font-size: 13px;
  animation: fadeIn 0.3s ease;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
```

**Step 3: Add KMLogger to WorkTab**

In `src/components/finances/WorkTab.tsx`, add import and render the component at the top of the return, before the projected income card:

```tsx
import { KMLogger } from '../tcs/KMLogger';

// Inside the return, before projected income:
<KMLogger />
```

**Step 4: Verify build**

```bash
cd /mnt/data/tmp/lifeos && npx vite build 2>&1 | tail -5
```

**Step 5: Commit**

```bash
git add src/components/tcs/ src/components/finances/WorkTab.tsx
git commit -m "feat(tcs): add KM Logger component — one-tap km logging with ATO deduction"
```

---

### Task 2: Create TCS Today Card (Dashboard Widget)

**Objective:** A compact at-a-glance card for the Dashboard showing tonight's jobs, km to drive, and expected income.

**Files:**
- Create: `src/components/tcs/TCSTodayCard.tsx`
- Create: `src/components/tcs/TCSTodayCard.css`
- Modify: `src/pages/Dashboard.tsx` — add TCS Today Card

**Step 1: Create TCSTodayCard component**

```tsx
// src/components/tcs/TCSTodayCard.tsx
import React, { useMemo } from 'react';
import { Briefcase, Car, DollarSign, Clock, CheckCircle2, MapPin } from 'lucide-react';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { todayStr, fmtCurrency } from '../../utils/date';
import './TCSTodayCard.css';

const TCS_VENUES = [
  { name: 'Jaga Jaga', rate: 150, suburb: 'Greensborough' },
  { name: 'Sonder', rate: 162.50, suburb: 'Bentleigh' },
];
const ROUTE_KM = 134;
const ATO_RATE = 0.85;

export function TCSTodayCard() {
  const today = todayStr();
  const events = useScheduleStore(s => s.getEventsForDate(today));
  const tasks = useScheduleStore(s => s.getTasksForDate(today));
  const expenses = useFinanceStore(s => s.expenses);

  const tcsEvents = useMemo(() => 
    events.filter(e => e.event_type === 'work' || e.title?.includes('Cleaning')),
    [events]
  );

  const todayKm = useMemo(() =>
    expenses.filter(e => e.date === today && e.is_travel && e.km_driven)
      .reduce((sum, e) => sum + (e.km_driven || 0), 0),
    [expenses, today]
  );

  const todayIncome = useMemo(() =>
    tcsEvents.filter(e => e.status === 'completed').length * 156, // avg rate
    [tcsEvents]
  );

  const completedJobs = tcsEvents.filter(e => e.status === 'completed').length;
  const totalJobs = TCS_VENUES.length;
  const deductionToday = todayKm * ATO_RATE;

  return (
    <div className="tcs-today-card">
      <div className="tcs-today-header">
        <Briefcase size={16} />
        <span>Tonight's Run</span>
        <span className="tcs-today-date">{today}</span>
      </div>
      <div className="tcs-today-jobs">
        {TCS_VENUES.map((v, i) => (
          <div key={v.name} className={`tcs-today-job ${completedJobs > i ? 'done' : ''}`}>
            <span className="tcs-job-indicator">
              {completedJobs > i ? <CheckCircle2 size={14} /> : <Clock size={14} />}
            </span>
            <span className="tcs-job-name">{v.name}</span>
            <span className="tcs-job-sub">{v.suburb}</span>
            <span className="tcs-job-rate">${v.rate.toFixed(0)}</span>
          </div>
        ))}
      </div>
      <div className="tcs-today-stats">
        <div className="tcs-stat">
          <Car size={14} />
          <span>{todayKm || ROUTE_KM}km</span>
          <span className="tcs-stat-label">km</span>
        </div>
        <div className="tcs-stat">
          <DollarSign size={14} />
          <span>${deductionToday.toFixed(0)}</span>
          <span className="tcs-stat-label">deduction</span>
        </div>
        <div className="tcs-stat">
          <DollarSign size={14} />
          <span>${(completedJobs * 156).toFixed(0) || '312'}</span>
          <span className="tcs-stat-label">income</span>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create TCSTodayCard CSS (glass card, consistent with design system)**

```css
.tcs-today-card {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(0,212,255,0.2);
  border-radius: 12px;
  padding: 16px;
  backdrop-filter: blur(12px);
}
.tcs-today-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-family: 'Orbitron', monospace;
  font-size: 13px;
  color: #00D4FF;
}
.tcs-today-date {
  margin-left: auto;
  font-size: 11px;
  color: #888;
  font-family: 'Poppins', sans-serif;
}
.tcs-today-jobs {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.tcs-today-job {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255,255,255,0.03);
  border-radius: 8px;
  font-size: 13px;
  transition: all 0.3s;
}
.tcs-today-job.done {
  opacity: 0.5;
  text-decoration: line-through;
}
.tcs-today-job.done .tcs-job-indicator { color: #39FF14; }
.tcs-job-indicator { color: #F97316; }
.tcs-job-name { flex: 1; font-weight: 600; color: #fff; }
.tcs-job-sub { color: #888; font-size: 11px; }
.tcs-job-rate { color: #39FF14; font-family: 'Orbitron', monospace; font-size: 12px; }
.tcs-today-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.tcs-stat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-family: 'Orbitron', monospace;
  color: #fff;
}
.tcs-stat-label {
  font-size: 10px;
  color: #888;
  font-family: 'Poppins', sans-serif;
}
```

**Step 3: Add to Dashboard**

In `src/pages/Dashboard.tsx`, import and render the TCS Today Card in the dashboard widget area.

**Step 4: Verify build, commit**

```bash
npx vite build 2>&1 | tail -5
git add src/components/tcs/ src/pages/Dashboard.tsx
git commit -m "feat(tcs): add TCS Today Card dashboard widget"
```

---

### Task 3: Create Vehicle Logbook Component

**Objective:** A logbook view showing all km-driven entries with running totals, monthly deduction summary, and ATO compliance.

**Files:**
- Create: `src/components/tcs/VehicleLogbook.tsx`
- Create: `src/components/tcs/VehicleLogbook.css`
- Modify: `src/components/finances/WorkTab.tsx` — add logbook section

**Step 1: Create VehicleLogbook component**

```tsx
// src/components/tcs/VehicleLogbook.tsx
import React, { useMemo } from 'react';
import { Car, TrendingUp, Calendar, FileText } from 'lucide-react';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { todayStr, thisMonth } from '../../utils/date';
import './VehicleLogbook.css';

const ATO_RATE = 0.85;

export function VehicleLogbook() {
  const expenses = useFinanceStore(s => s.expenses);
  const currentMonth = thisMonth();

  const travelEntries = useMemo(() =>
    expenses
      .filter(e => e.is_travel && e.km_driven)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [expenses]
  );

  const monthEntries = useMemo(() =>
    travelEntries.filter(e => e.date.startsWith(currentMonth)),
    [travelEntries, currentMonth]
  );

  const monthKm = monthEntries.reduce((s, e) => s + (e.km_driven || 0), 0);
  const monthDeduction = monthKm * ATO_RATE;
  const totalKm = travelEntries.reduce((s, e) => s + (e.km_driven || 0), 0);

  return (
    <div className="tcs-logbook">
      <div className="tcs-logbook-header">
        <Car size={16} />
        <span>Vehicle Logbook</span>
        <FileText size={12} className="tcs-ato-badge" title="ATO compliant" />
      </div>
      <div className="tcs-logbook-summary">
        <div className="tcs-logbook-stat">
          <Calendar size={12} />
          <span className="tcs-logbook-val">{monthKm}</span>
          <span className="tcs-logbook-label">km this month</span>
        </div>
        <div className="tcs-logbook-stat">
          <TrendingUp size={12} />
          <span className="tcs-logbook-val">${monthDeduction.toFixed(0)}</span>
          <span className="tcs-logbook-label">deduction</span>
        </div>
        <div className="tcs-logbook-stat">
          <Car size={12} />
          <span className="tcs-logbook-val">{totalKm}</span>
          <span className="tcs-logbook-label">total km logged</span>
        </div>
      </div>
      <div className="tcs-logbook-entries">
        {monthEntries.slice(0, 10).map(e => (
          <div key={e.id} className="tcs-logbook-entry">
            <span className="tcs-lb-date">{e.date}</span>
            <span className="tcs-lb-km">{e.km_driven}km</span>
            <span className="tcs-lb-deduction">${((e.km_driven || 0) * ATO_RATE).toFixed(2)}</span>
          </div>
        ))}
        {monthEntries.length === 0 && (
          <div className="tcs-lb-empty">No km logged this month. Use the KM Logger above.</div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Create VehicleLogbook CSS, add to WorkTab, verify build, commit**

Same pattern — glass card styling, import in WorkTab, build check, commit with `feat(tcs): add Vehicle Logbook with ATO deduction tracking`.

---

### Task 4: Create TCS Constants & Config File

**Objective:** A single source of truth for TCS business data that components reference.

**Files:**
- Create: `src/lib/tcs-config.ts`

```typescript
// src/lib/tcs-config.ts
// Single source of truth for Teddy's Cleaning Systems operational data.
// All TCS components import from here.

export const TCS_CONFIG = {
  name: "Teddy's Cleaning Systems",
  abn: '', // Fill when known
  website: 'teddyscleaning.com.au',

  // ATO rates
  atoKmRate: 0.85, // 2025-2026 cents per km
  gstThreshold: 75000, // GST registration threshold

  // Route
  homeBase: 'Rockbank',
  routeKm: 134, // Rockbank → Jaga Jaga → Sonder → Rockbank

  // Venues
  venues: [
    {
      id: 'jaga-jaga',
      name: 'Jaga Jaga',
      suburb: 'Greensborough',
      rate: 150,
      frequency: '3x/week',
      schedule: ['Monday 6:00-9:00', 'Thursday 1:30-3:30', 'Friday 1:30-3:30'],
      cleansPerMonth: 12,
      monthlyEstimate: 1800,
    },
    {
      id: 'sonder',
      name: 'Sonder',
      suburb: 'Bentleigh',
      rate: 162.50,
      frequency: '4x/week',
      schedule: ['Thu/Fri 3:30-5:30', 'Sat/Sun 3:00-5:00'],
      cleansPerMonth: 16,
      monthlyEstimate: 2600,
    },
  ],

  // Revenue targets
  monthlyCleaningTarget: 5500, // 90-day goal
  monthlyCombinedTarget: 8000,

  // Quick km presets
  kmPresets: [
    { label: 'Full Run', km: 134 },
    { label: 'Half Run', km: 67 },
    { label: 'Short Errand', km: 30 },
    { label: 'Local', km: 15 },
  ],
} as const;

export type TCSVenue = typeof TCS_CONFIG.venues[number];
```

**Step 5: Commit**

```bash
git add src/lib/tcs-config.ts
git commit -m "feat(tcs): add TCS config — single source of truth for venues, rates, routes"
```

---

### Task 5: Create Job Completion Flow

**Objective:** Mark a job as completed in the schedule and auto-create the income entry in finances.

**Files:**
- Create: `src/components/tcs/JobCompleteButton.tsx`
- Modify: `src/components/schedule/UnifiedTimeline.tsx` — add completion button to work events

**Step 1: Create JobCompleteButton**

```tsx
// src/components/tcs/JobCompleteButton.tsx
import React, { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { useUserStore } from '../../stores/useUserStore';
import { useGamificationContext } from '../../lib/gamification/context';
import { genId, todayStr } from '../../utils/date';
import { TCS_CONFIG } from '../../lib/tcs-config';

interface Props {
  eventId: string;
  venueName: string;
  currentStatus: string;
  onCompleted?: () => void;
}

export function JobCompleteButton({ eventId, venueName, currentStatus, onCompleted }: Props) {
  const [loading, setLoading] = useState(false);
  const updateEvent = useScheduleStore(s => s.changeTaskStatus);
  const addIncome = useFinanceStore(s => s.addIncome);
  const user = useUserStore(s => s.user);
  const { awardXP } = useGamificationContext();

  const venue = TCS_CONFIG.venues.find(v => venueName.includes(v.name));
  const rate = venue?.rate ?? 150;

  async function handleComplete() {
    setLoading(true);
    try {
      // Mark schedule event as completed
      await useScheduleStore.getState().changeTaskStatus(eventId, 'completed');

      // Auto-create income entry
      await useFinanceStore.getState().addIncome({
        id: genId(),
        user_id: user?.id ?? '',
        title: `Cleaning — ${venueName}`,
        amount: rate,
        date: todayStr(),
        category: 'cleaning',
        notes: `Auto-logged from job completion`,
      });

      // Award XP for completing a job
      awardXP?.(50, 'job_complete', `Completed cleaning at ${venueName}`);

      onCompleted?.();
    } finally {
      setLoading(false);
    }
  }

  if (currentStatus === 'completed') {
    return <CheckCircle2 size={16} style={{ color: '#39FF14' }} title="Job completed" />;
  }

  return (
    <button
      className="tcs-job-complete-btn"
      onClick={handleComplete}
      disabled={loading}
      title={`Mark done — $${rate}`}
    >
      {loading ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
      <span>Done</span>
      <span className="tcs-job-rate">${rate}</span>
    </button>
  );
}
```

**Step 2: Add to schedule event cards, verify build, commit**

```bash
git add src/components/tcs/JobCompleteButton.tsx
git commit -m "feat(tcs): add Job Completion flow — mark done + auto-income + XP"
```

---

### Task 6: Create Invoice Status Tracker

**Objective:** Track which clients have paid and which invoices are outstanding.

**Files:**
- Create: `src/components/tcs/InvoiceTracker.tsx`
- Create: `src/components/tcs/InvoiceTracker.css`
- Modify: `src/components/finances/WorkTab.tsx` — add tracker

The InvoiceTracker reads income entries per client per month, compares against expected revenue (venue rate x cleans per month), and highlights gaps (unpaid invoices).

---

### Task 7: Create TCS Growth Plan as Goals

**Objective:** Seed the 90-day growth plan from the TCS PLAN.md as LifeOS Goal objects with tasks, so Oriaksum can check progress from the webapp.

**Files:**
- Create: `src/lib/tcs-growth-seed.ts` — goal/task tree data structure
- Create: `src/components/tcs/TCSGrowthOverview.tsx` — shows milestone progress

The 90-day plan from the TCS business doc becomes:
- **Goal: "TCS 90-Day Growth Plan"** (domain: financial, target_date: +90 days)
  - Task: "Set up proper invoicing" (Month 1)
  - Task: "Start vehicle logbook" (Month 1)
  - Task: "Verify public liability insurance" (Month 1)
  - Task: "Document SOPs per venue" (Month 1)
  - Task: "Prospect for 1 new contract" (Month 2)
  - Task: "Raise rates 10% (CPI adjustment)" (Month 2)
  - Task: "Build referral system" (Month 2)
  - Task: "Draft employment contract template" (Month 3)
  - Task: "Calculate per-job profitability" (Month 3)
  - Task: "Optimize Google Business Profile" (Month 3)
  - Task: "Map hiring timeline for overnight exit" (Month 3)

---

### Task 8: Create TCS Barrel Export & Final Integration

**Objective:** Clean exports, verify all components work together, final build.

**Files:**
- Create: `src/components/tcs/index.ts`
- Verify: Build passes clean
- Verify: All TCS components render in WorkTab

```typescript
// src/components/tcs/index.ts
export { KMLogger } from './KMLogger';
export { TCSTodayCard } from './TCSTodayCard';
export { VehicleLogbook } from './VehicleLogbook';
export { JobCompleteButton } from './JobCompleteButton';
export { InvoiceTracker } from './InvoiceTracker';
export { TCSGrowthOverview } from './TCSGrowthOverview';
```

Final commit: `feat(tcs): complete TCS Operations suite — km, logbook, jobs, invoices, growth plan`

---

## Execution Notes

- Build after EVERY task. Zero tolerance for type errors.
- Each task is independent — can be parallelized via subagent-driven-development.
- TCS config (`src/lib/tcs-config.ts`) should be created FIRST as other components depend on it.
- The ExpenseEntry type already has `km_driven`, `odometer_reading`, `is_travel` fields — we USE them, not create new ones.
- No emoji in UI per DESIGN-RULES.md. Use lucide icons only.
- File size limit: 200-400 lines. Split before exceeding 600.
- Respect the Jetson's constraints — no heavy deps, no new npm packages for this.