# TCS Daily Operations in LifeOS — The Right Architecture

> Authored by Hermes. Approved for execution.

## The Tension

Claude (Oriaksum) says:
- LifeOS should NOT directly access TCS Supabase — that's a security boundary
- TribeWizard IS the CRM. LifeOS is the personal lens on top
- Federation event model: LifeOS emits events → Paperclip evaluates → TribeWizard operationalizes

Tewedros says:
- He wants daily checkins in LifeOS
- He wants km/mileage tracking RIGHT NOW (was using Google Sheets, badly)
- He wants the growth plan tracked in LifeOS
- He's not using TribeWizard daily — he's using LifeOS
- TribeWizard is LIVE at crm.teddyscleaning.com.au but it's the SaaS product, not his personal dashboard

## The Resolution

BOTH are right. Here's why:

1. **TribeWizard is the CRM for TCS as a business** — managing clients, quotes, invoices, employees, pipeline
2. **LifeOS is Tewedros's personal operating system** — his daily dashboard, his habits, his checkins, his km logging, his XP
3. **The security boundary matters at SCALE.** Right now TCS has 1 employee (Tewedros) and 2 clients. He IS the business. Direct Supabase access is fine for a sole trader dashboard.
4. **When TCS hires, TribeWizard takes over the business ops.** LifeOS reads from TribeWizard's API for business metrics, but personal stuff (km, health, habits, checkins) stays local.

### Phase 1 (NOW — sole trader): Direct Supabase access
- LifeOS writes km, income, expenses directly to `expenses`/`income`/`schedule_events` tables
- These are Tewedros's PERSONAL records for ATO, not business CRM data
- The TCS adapter already reads from a separate TCS Supabase for_jobs — this is fine
- The growth plan goals live in LifeOS's goals table — this is personal development, not business CRM

### Phase 2 (when hiring): Federation event bridge
- LifeOS emits events → Paperclip → TribeWizard
- Business operations move to TribeWizard
- LifeOS becomes read-only mirror + personal tracking
- The adapter architecture already supports this (TribeWizardAdapter exists in lifeos-w1)

## What We're Building NOW (Phase 1)

### 1. Daily Checkin Flow
**Problem:** Tewedros needs a morning/evening ritual to stay on track with the growth plan.

**Solution:** A DailyCheckin component that appears on the Dashboard:
- Morning: What's the plan today? Shows scheduled jobs from schedule store, km estimate, expected income
- Evening: Did you complete? Auto-fills from JobCompleteButton data. Asks: km logged? jobs done? how do you feel?
- Writes to `journal_entries` table (already exists in LifeOS)
- Tags: `tcs-checkin` for easy retrieval
- Streak counter — consecutive days checked in = XP bonus

### 2. KM Logger → Schedule Integration
**Problem:** KM logging exists but it's manual. Tewedros forgets to log.

**Solution:** Auto-suggest km when schedule events are present:
- When there are TCS work events today, KMLogger shows "Tonight's route: 134km" with a ONE-TAP "Log Full Route" button
- After job completion, auto-prompt: "Log 134km for tonight's run?"
- Integration: TCSTodayCard already knows tonight's jobs → wire it to KMLogger

### 3. Growth Plan → Task Board Integration
**Problem:** Growth plan exists as seeded goals but there's no daily way to work through the tasks.

**Solution:** Wire growth plan tasks into the Schedule page's task board:
- Tasks from `tasks` table where `goal_id` points to TCS growth goals
- Show in the Schedule page's existing TodoBoard/Kanban
- Completing a task in the schedule = completing a growth plan milestone
- XP rewards for growth plan task completion

### 4. Mileage Dashboard Widget
**Problem:** Need a quick way to see weekly/monthly km totals on the dashboard.

**Solution:** A compact TCSDrivingWidget for the Dashboard:
- This week: X km, $Y deduction
- This month: X km, $Y deduction  
- Comparison: "You're 15% behind last month's pace"
- ATO FY total running tally

### 5. Income Reality Check
**Problem:** Projected vs actual income visibility is poor.

**Solution:** Wire InvoiceTracker data into Dashboard:
- Expected this month from Jaga Jaga + Sonder (based on schedule frequency × rate)
- Actual income logged (from income table where source = 'TCS Cleaning')
- Delta: +$200 or -$150
- Color coding: green (on track), orange (behind), red (critical)

## Architecture Decisions

1. **All data goes to LifeOS's own Supabase** — the `expenses`, `income`, `schedule_events`, `goals`, `tasks`, `journal_entries` tables. These are personal records.
2. **TCS Supabase (separate project)** read-only for jobs/venues — the TCS adapter handles this.
3. **No TribeWizard dependency in Phase 1.** TribeWizard is the future CRM. Today, the sole trader needs a working daily dashboard.
4. **Existing stores are the API.** `useFinanceStore` for km/expenses/income, `useScheduleStore` for tasks/events, `useGoalsStore` for growth plan, `useHabitsStore` for checkin streaks, `useJournalStore` for checkin entries.

## Files to Create/Modify

### New Components
1. `src/components/tcs/DailyCheckin.tsx` + `.css` — morning/evening checkin flow
2. `src/components/tcs/TCSDrivingWidget.tsx` + `.css` — dashboard km/deduction widget

### Modified Components
3. `src/components/tcs/KMLogger.tsx` — add auto-suggest from schedule events
4. `src/components/tcs/TCSTodayCard.tsx` — wire completion → KMLogger auto-prompt
5. `src/pages/Dashboard.tsx` — add DailyCheckin + TCSDrivingWidget

### New Integration
6. `src/components/tcs/TCSGrowthOverview.tsx` — connect tasks to schedule store task board
7. `src/pages/Schedule.tsx` — show TCS growth tasks in task board (if TodoBoard exists)

## Execution Order

1. DailyCheckin (most impact — keeps Tewedros engaged daily)
2. TCSDrivingWidget (dashboard visibility of km)
3. KMLogger auto-suggest (reduces friction)
4. Growth plan task board integration (makes growth plan actionable)

Build after each component. Commit after each. No big bang.