/**
 * Schedule Optimizer — AI-powered schedule analysis
 * 
 * Takes gaps, goals, habits, and events to generate:
 * - Smart slot fill suggestions
 * - Goal-time balance analysis
 * - Conflict detection
 * - Natural language recommendations
 * 
 * Uses LLM proxy for intelligent suggestions, with local fallback
 * for basic gap detection (free tier).
 */

import { callLLMJson } from '../llm-proxy';
import { logger } from '../../utils/logger';

// ── Types ──

export interface TimeGap {
  startMin: number;     // minutes from midnight
  endMin: number;
  durationMin: number;
  label: string;        // "9:00 AM – 11:00 AM (2h)"
  startTime: string;    // ISO string
  endTime: string;      // ISO string
}

export interface ScheduleConflict {
  eventA: { id: string; title: string; start: string; end: string };
  eventB: { id: string; title: string; start: string; end: string };
  overlapMinutes: number;
}

export interface BalanceInsight {
  goalTitle: string;
  goalId: string;
  targetHoursWeek: number;  // desired
  actualHoursWeek: number;  // reality
  percentMet: number;       // 0-100
  icon: string;
  color: string;
}

export interface OptimizerSuggestion {
  id: string;
  type: 'fill_gap' | 'habit_slot' | 'task_slot' | 'balance_fix' | 'general';
  title: string;
  description: string;
  startTime: string;      // ISO
  endTime: string;        // ISO
  eventType: string;      // from schedule-events types
  scheduleLayer: string;
  priority: number;       // 1-5
  sourceGoalId?: string;
  sourceHabitId?: string;
  sourceTaskId?: string;
  icon: string;
}

export interface OptimizerResult {
  gaps: TimeGap[];
  conflicts: ScheduleConflict[];
  balanceInsights: BalanceInsight[];
  suggestions: OptimizerSuggestion[];
  summary: string;
  analyzedAt: string;     // ISO timestamp
}

// ── Input types for the AI ──

interface OptimizerInput {
  date: string;                // YYYY-MM-DD
  events: { id: string; title: string; start_time: string; end_time: string; event_type: string; schedule_layer?: string }[];
  weekEvents: { title: string; start_time: string; end_time: string; event_type: string }[];
  goals: { id: string; title: string; category: string; priority: string; icon?: string; color?: string; domain?: string }[];
  habits: { id: string; title: string; icon?: string; completedToday: boolean }[];
  tasks: { id: string; title: string; priority: string; dueDate?: string; goalId?: string }[];
  gaps: TimeGap[];
  conflicts: ScheduleConflict[];
  sacredBlockMinutes: number[];  // minutes reserved by sacred schedule
  rituals: { id: string; title: string; emoji: string; type: string; time: string; endTime?: string; days: number[]; enabled: boolean }[];
}

// ── Local gap/conflict detection (works without AI) ──

export function detectGaps(
  events: { start_time: string; end_time: string }[],
  dateStr: string,
  wakeStartHour: number = 6,
  wakeEndHour: number = 22,
  sacredBlockMins: { startMin: number; endMin: number }[] = []
): TimeGap[] {
  const gaps: TimeGap[] = [];
  const wakeStartMin = wakeStartHour * 60;
  const wakeEndMin = wakeEndHour * 60;

  // Merge all occupied slots (events + sacred blocks)
  const occupied: { startMin: number; endMin: number }[] = [];

  for (const ev of events) {
    if (!ev.start_time || !ev.end_time) continue;
    const s = new Date(ev.start_time);
    const e = new Date(ev.end_time);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) continue;
    const evDate = s.toISOString().split('T')[0];
    if (evDate !== dateStr) continue;
    occupied.push({
      startMin: s.getHours() * 60 + s.getMinutes(),
      endMin: e.getHours() * 60 + e.getMinutes(),
    });
  }

  // Add sacred blocks
  for (const sb of sacredBlockMins) {
    occupied.push(sb);
  }

  // Sort by start time
  occupied.sort((a, b) => a.startMin - b.startMin);

  // Merge overlapping slots
  const merged: { startMin: number; endMin: number }[] = [];
  for (const slot of occupied) {
    if (merged.length === 0 || merged[merged.length - 1].endMin < slot.startMin) {
      merged.push({ ...slot });
    } else {
      merged[merged.length - 1].endMin = Math.max(merged[merged.length - 1].endMin, slot.endMin);
    }
  }

  // Find gaps between merged slots within waking hours
  let cursor = wakeStartMin;

  for (const slot of merged) {
    const gapStart = Math.max(cursor, wakeStartMin);
    const gapEnd = Math.min(slot.startMin, wakeEndMin);
    if (gapEnd - gapStart >= 30) { // Minimum 30 min gap
      gaps.push(buildGap(gapStart, gapEnd, dateStr));
    }
    cursor = Math.max(cursor, slot.endMin);
  }

  // Check gap after last event until wake end
  if (cursor < wakeEndMin) {
    const gapStart = Math.max(cursor, wakeStartMin);
    if (wakeEndMin - gapStart >= 30) {
      gaps.push(buildGap(gapStart, wakeEndMin, dateStr));
    }
  }

  return gaps;
}

function buildGap(startMin: number, endMin: number, dateStr: string): TimeGap {
  const durationMin = endMin - startMin;
  const startH = Math.floor(startMin / 60);
  const startM = startMin % 60;
  const endH = Math.floor(endMin / 60);
  const endM = endMin % 60;

  const fmtTime = (h: number, m: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const durationStr = durationMin >= 60
    ? `${Math.floor(durationMin / 60)}h${durationMin % 60 ? ` ${durationMin % 60}m` : ''}`
    : `${durationMin}m`;

  const startISO = `${dateStr}T${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00`;
  const endISO = `${dateStr}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;

  return {
    startMin,
    endMin,
    durationMin,
    label: `${fmtTime(startH, startM)} – ${fmtTime(endH, endM)} (${durationStr})`,
    startTime: startISO,
    endTime: endISO,
  };
}

export function detectConflicts(
  events: { id: string; title: string; start_time: string; end_time: string }[]
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const sorted = [...events].sort((a, b) =>
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      const aStart = new Date(a.start_time).getTime();
      const aEnd = new Date(a.end_time).getTime();
      const bStart = new Date(b.start_time).getTime();
      const bEnd = new Date(b.end_time).getTime();

      if (aEnd > bStart && aStart < bEnd) {
        const overlapStart = Math.max(aStart, bStart);
        const overlapEnd = Math.min(aEnd, bEnd);
        const overlapMinutes = Math.round((overlapEnd - overlapStart) / 60000);

        if (overlapMinutes >= 5) { // Ignore < 5min overlaps
          conflicts.push({
            eventA: { id: a.id, title: a.title, start: a.start_time, end: a.end_time },
            eventB: { id: b.id, title: b.title, start: b.start_time, end: b.end_time },
            overlapMinutes,
          });
        }
      }
    }
  }

  return conflicts;
}

// ── AI-powered analysis ──

export async function runAIOptimization(input: OptimizerInput): Promise<OptimizerResult> {
  const prompt = buildOptimizerPrompt(input);

  try {
    const aiResult = await callLLMJson<{
      suggestions: {
        type: string;
        title: string;
        description: string;
        start_time: string;
        end_time: string;
        event_type: string;
        schedule_layer?: string;
        priority: number;
        icon: string;
        source_goal_id?: string;
        source_habit_id?: string;
        source_task_id?: string;
      }[];
      balance_insights: {
        goal_title: string;
        goal_id: string;
        target_hours_week: number;
        actual_hours_week: number;
        icon: string;
        color: string;
      }[];
      summary: string;
    }>(prompt, { timeoutMs: 25000 });

    const suggestions: OptimizerSuggestion[] = (aiResult.suggestions || []).map((s, i) => ({
      id: `ai-sug-${Date.now()}-${i}`,
      type: (s.type || 'general') as OptimizerSuggestion['type'],
      title: s.title || 'Suggested event',
      description: s.description || '',
      startTime: s.start_time || input.gaps[0]?.startTime || '',
      endTime: s.end_time || input.gaps[0]?.endTime || '',
      eventType: s.event_type || 'general',
      scheduleLayer: s.schedule_layer || 'primary',
      priority: s.priority || 3,
      sourceGoalId: s.source_goal_id,
      sourceHabitId: s.source_habit_id,
      sourceTaskId: s.source_task_id,
      icon: s.icon || '✨',
    }));

    const balanceInsights: BalanceInsight[] = (aiResult.balance_insights || []).map(b => ({
      goalTitle: b.goal_title,
      goalId: b.goal_id,
      targetHoursWeek: b.target_hours_week || 5,
      actualHoursWeek: b.actual_hours_week || 0,
      percentMet: b.target_hours_week > 0
        ? Math.round((b.actual_hours_week / b.target_hours_week) * 100)
        : 0,
      icon: b.icon || '🎯',
      color: b.color || '#64748B',
    }));

    return {
      gaps: input.gaps,
      conflicts: input.conflicts,
      balanceInsights,
      suggestions,
      summary: aiResult.summary || 'Analysis complete.',
      analyzedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.warn('[ScheduleOptimizer] AI analysis failed, using local fallback:', err);
    return buildLocalFallback(input);
  }
}

// ── Local fallback (no AI, basic suggestions) ──

function buildLocalFallback(input: OptimizerInput): OptimizerResult {
  const suggestions: OptimizerSuggestion[] = [];

  // Suggest incomplete habits for gaps
  const incompleteHabits = input.habits.filter(h => !h.completedToday);
  let habIdx = 0;

  for (const gap of input.gaps) {
    if (gap.durationMin < 30) continue;

    // If there's an incomplete habit, suggest it
    if (habIdx < incompleteHabits.length) {
      const habit = incompleteHabits[habIdx];
      const slotEnd = new Date(new Date(gap.startTime).getTime() + 30 * 60000).toISOString();
      suggestions.push({
        id: `local-${Date.now()}-habit-${habIdx}`,
        type: 'habit_slot',
        title: habit.title,
        description: `You haven't done "${habit.title}" today — this gap is a great time!`,
        startTime: gap.startTime,
        endTime: gap.durationMin > 60 ? slotEnd : gap.endTime,
        eventType: 'personal',
        scheduleLayer: 'primary',
        priority: 2,
        sourceHabitId: habit.id,
        icon: habit.icon || '🔄',
      });
      habIdx++;
      continue;
    }

    // Suggest overdue/high-priority tasks
    const urgentTask = input.tasks.find(t =>
      t.priority === 'high' || t.priority === 'critical' || t.priority === 'urgent'
    );
    if (urgentTask) {
      suggestions.push({
        id: `local-${Date.now()}-task-${urgentTask.id}`,
        type: 'task_slot',
        title: urgentTask.title,
        description: `Priority ${urgentTask.priority} task — use this free slot to tackle it.`,
        startTime: gap.startTime,
        endTime: gap.endTime,
        eventType: 'work',
        scheduleLayer: 'primary',
        priority: 1,
        sourceTaskId: urgentTask.id,
        icon: '📋',
      });
      continue;
    }

    // Generic fill suggestion (only if no ritual/task filled it)
    if (gap.durationMin >= 60) {
      suggestions.push({
        id: `local-${Date.now()}-gap-${gap.startMin}`,
        type: 'fill_gap',
        title: 'Free time available',
        description: `You have ${gap.label} free. Consider study, exercise, or a personal project.`,
        startTime: gap.startTime,
        endTime: gap.endTime,
        eventType: 'general',
        scheduleLayer: 'primary',
        priority: 4,
        icon: '⏰',
      });
    }
  }

  // Suggest today's rituals for matching gaps
  const todayDow = new Date(input.date).getDay();
  const todayRituals = (input.rituals || []).filter(r => r.enabled && r.days.includes(todayDow));
  for (const ritual of todayRituals) {
    // Check if any gap overlaps with ritual time
    const [rH, rM] = (ritual.time || '09:00').split(':').map(Number);
    const ritualStartMin = rH * 60 + rM;
    const matchingGap = input.gaps.find(g => g.startMin <= ritualStartMin && g.endMin > ritualStartMin);
    if (matchingGap && suggestions.length < 5) {
      const ritualDuration = ritual.endTime
        ? (() => { const [eH, eM] = ritual.endTime!.split(':').map(Number); return (eH * 60 + eM) - ritualStartMin; })()
        : 30;
      const endMin = ritualStartMin + ritualDuration;
      const startISO = `${input.date}T${String(rH).padStart(2, '0')}:${String(rM).padStart(2, '0')}:00`;
      const endISO = `${input.date}T${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}:00`;
      suggestions.push({
        id: `local-${Date.now()}-ritual-${ritual.id}`,
        type: 'habit_slot',
        title: `${ritual.emoji} ${ritual.title}`,
        description: `Your "${ritual.title}" ritual is scheduled for this time.`,
        startTime: startISO,
        endTime: endISO,
        eventType: ritual.type === 'workout' ? 'exercise' : ritual.type === 'meal' ? 'meal' : ritual.type === 'sleep' ? 'sleep' : ritual.type === 'meditation' ? 'meditation' : 'personal',
        scheduleLayer: 'primary',
        priority: 1,
        icon: ritual.emoji,
      });
    }
  }

  // Basic balance: count hours per goal domain this week
  const domainHours: Record<string, number> = {};
  for (const ev of input.weekEvents) {
    const dur = (new Date(ev.end_time).getTime() - new Date(ev.start_time).getTime()) / 3600000;
    const type = ev.event_type || 'general';
    domainHours[type] = (domainHours[type] || 0) + dur;
  }

  const balanceInsights: BalanceInsight[] = input.goals.slice(0, 5).map(g => {
    const domain = g.domain || g.category || 'general';
    const typeMap: Record<string, string> = {
      'Health & Fitness': 'exercise',
      'Education / Learning': 'education',
      'Career / Business': 'work',
      'Finances': 'financial',
      'Spirituality': 'prayer',
    };
    const eventType = typeMap[domain] || 'general';
    const actual = domainHours[eventType] || 0;
    const target = 5; // Default 5h/week per goal

    return {
      goalTitle: g.title,
      goalId: g.id,
      targetHoursWeek: target,
      actualHoursWeek: Math.round(actual * 10) / 10,
      percentMet: target > 0 ? Math.round((actual / target) * 100) : 0,
      icon: g.icon || '🎯',
      color: g.color || '#64748B',
    };
  });

  const totalFree = input.gaps.reduce((s, g) => s + g.durationMin, 0);
  const freeH = Math.round(totalFree / 60 * 10) / 10;

  return {
    gaps: input.gaps,
    conflicts: input.conflicts,
    balanceInsights,
    suggestions: suggestions.slice(0, 5),
    summary: `You have ${freeH}h of free time today across ${input.gaps.length} gap${input.gaps.length !== 1 ? 's' : ''}. ${input.conflicts.length > 0 ? `⚠️ ${input.conflicts.length} conflict${input.conflicts.length !== 1 ? 's' : ''} detected.` : '✅ No conflicts.'} ${incompleteHabits.length > 0 ? `${incompleteHabits.length} habit${incompleteHabits.length !== 1 ? 's' : ''} still to complete.` : ''}`,
    analyzedAt: new Date().toISOString(),
  };
}

// ── Prompt builder ──

function buildOptimizerPrompt(input: OptimizerInput): string {
  const gapLines = input.gaps.map(g => `  • ${g.label}`).join('\n') || '  (no gaps)';
  const eventLines = input.events.map(e =>
    `  • ${e.title} (${new Date(e.start_time).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })} – ${new Date(e.end_time).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}, ${e.event_type})`
  ).join('\n') || '  (no events today)';
  const goalLines = input.goals.map(g =>
    `  • ${g.icon || '🎯'} ${g.title} [${g.category || g.domain || 'general'}] (priority: ${g.priority || 'medium'})`
  ).join('\n') || '  (no goals)';
  const habitLines = input.habits.map(h =>
    `  • ${h.icon || '🔄'} ${h.title} — ${h.completedToday ? '✅ done' : '⏳ not done'}`
  ).join('\n') || '  (no habits)';
  const taskLines = input.tasks.slice(0, 10).map(t =>
    `  • [${t.priority}] ${t.title}${t.dueDate ? ` (due: ${t.dueDate})` : ''}`
  ).join('\n') || '  (no pending tasks)';
  const conflictLines = input.conflicts.length > 0
    ? input.conflicts.map(c =>
      `  • "${c.eventA.title}" overlaps "${c.eventB.title}" by ${c.overlapMinutes}min`
    ).join('\n')
    : '  None';

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayDow = new Date(input.date).getDay();
  const ritualLines = (input.rituals || [])
    .filter(r => r.enabled)
    .map(r => {
      const daysStr = r.days.map(d => dayNames[d]).join('/');
      const todayActive = r.days.includes(todayDow) ? '(TODAY)' : '';
      const timeRange = r.endTime ? `${r.time}–${r.endTime}` : r.time;
      return `  • ${r.emoji} ${r.title} (${timeRange}, ${daysStr}) ${todayActive}`;
    }).join('\n') || '  (no rituals defined)';

  return `You are the LifeOS Schedule Optimizer. Analyze this schedule and return JSON.

## TODAY: ${input.date}

## TODAY'S EVENTS:
${eventLines}

## FREE GAPS:
${gapLines}

## CONFLICTS:
${conflictLines}

## ACTIVE GOALS:
${goalLines}

## HABITS (today):
${habitLines}

## ACTIVE RITUALS (recurring patterns):
${ritualLines}

## PENDING TASKS:
${taskLines}

## WEEK EVENT TYPES (hours):
${(() => {
  const hours: Record<string, number> = {};
  for (const ev of input.weekEvents) {
    const dur = (new Date(ev.end_time).getTime() - new Date(ev.start_time).getTime()) / 3600000;
    hours[ev.event_type || 'general'] = (hours[ev.event_type || 'general'] || 0) + dur;
  }
  return Object.entries(hours).map(([k, v]) => `  ${k}: ${v.toFixed(1)}h`).join('\n') || '  (no data)';
})()}

## INSTRUCTIONS:
1. For each free gap, suggest what to fill it with based on goals, habits, and tasks
2. Prioritize: incomplete habits > urgent tasks > goal-aligned activities > general productivity
3. Respect sacred schedule blocks (already excluded from gaps)
4. For balance insights, estimate target hours per goal domain (5h/week default) vs actual
5. Be specific with times — suggestions must fit within the gap
6. Consider rituals as recurring commitments — if a ritual is scheduled for today, prioritize protecting that time slot. If a gap overlaps with a ritual's time, suggest the ritual activity for that slot.

Return JSON:
{
  "suggestions": [
    {
      "type": "fill_gap" | "habit_slot" | "task_slot" | "balance_fix" | "general",
      "title": "Event title",
      "description": "Why this is suggested",
      "start_time": "ISO 8601",
      "end_time": "ISO 8601",
      "event_type": "work|education|exercise|meal|sleep|social|travel|personal|health|financial|general|prayer|meditation",
      "schedule_layer": "primary|operations|sacred",
      "priority": 1-5,
      "icon": "emoji",
      "source_goal_id": "goal UUID if relevant",
      "source_habit_id": "habit UUID if relevant",
      "source_task_id": "task UUID if relevant"
    }
  ],
  "balance_insights": [
    {
      "goal_title": "Goal name",
      "goal_id": "UUID",
      "target_hours_week": 5,
      "actual_hours_week": 2.5,
      "icon": "emoji",
      "color": "#hex"
    }
  ],
  "summary": "Brief natural language summary of the day's schedule health"
}

Keep it to 3-5 suggestions max. Be practical and specific.`;
}
