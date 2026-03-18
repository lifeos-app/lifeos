/**
 * materialize.ts — Deterministic Materialisation Pipeline v5
 * 
 * CORE MODEL: Tasks ARE the schedule. No separate events for goals.
 * Tasks have due_date + due_time and recur weekly for 12 weeks.
 * The Schedule tab shows tasks for each day.
 * 
 * KEY CHANGES (v5):
 * - Source tagging: all materialised records tagged with `source` field
 * - Cleanup only deletes source-tagged records (preserves user-created data)
 * - NO duplicate goals: each user goal → ONE epic with tasks directly under it
 * - No more 4 generic "phase goals" per epic — tasks have progressive due dates
 * - Tasks distributed across goals with clear week-by-week progression
 * - Workout sessions remain as schedule_events (linked to templates).
 */

import { supabase } from './supabase';
import { logger } from '../utils/logger';

// ═══════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════

interface MaterializeResult {
  objectivesCreated: number;
  epicsCreated: number;
  goalsCreated: number;
  tasksCreated: number;
  habitsCreated: number;
  eventsCreated: number;
  errors: string[];
}

const SOURCE_FOUNDATION = 'onboarding_foundation';
const SOURCE_HEALTH = 'onboarding_health';
const SOURCE_FINANCE = 'onboarding_finance';

// Whether the 'source' column exists (checked at runtime)
let sourceColumnAvailable: boolean | null = null;
async function hasSourceColumn(): Promise<boolean> {
  if (sourceColumnAvailable !== null) return sourceColumnAvailable;
  const { error } = await supabase.from('goals').select('source').limit(0);
  sourceColumnAvailable = !error;
  if (import.meta.env.DEV) {
    logger.log(`[materialize] source column available: ${sourceColumnAvailable}`);
  }
  return sourceColumnAvailable;
}

const COLORS = ['#00D4FF', '#7C5CFC', '#FF6B6B', '#FFD93D', '#4ECB71', '#F97316'];
const DAY_MS = 86400000;
const WEEKS = 12;

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function addDays(d: Date, n: number): string {
  return new Date(d.getTime() + n * DAY_MS).toISOString().split('T')[0];
}
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function getIcon(domain: string): string {
  const map: Record<string, string> = {
    'Health & Fitness': 'dumbbell', 'Career / Business': 'briefcase', 'Finances': 'wallet',
    'Relationships': 'heart', 'Education / Learning': 'book-open', 'Travel / Adventure': 'plane',
    'Spirituality': 'hand-heart', 'Home / Physical Environment': 'home', 'Personal': 'star',
  };
  return map[domain] || 'target';
}
function getNextDayOfWeek(from: Date, dayOfWeek: number, weeksAhead: number): Date {
  const d = new Date(from);
  const currentDay = d.getDay();
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil <= 0) daysUntil += 7;
  d.setDate(d.getDate() + daysUntil + (weeksAhead * 7));
  d.setHours(0, 0, 0, 0);
  return d;
}
function fmtTime(h: number, m = 0): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Create 12 weeks of recurring weekly tasks under a goal.
 * Each task has due_date + due_time so it shows on the schedule.
 */
async function createWeeklyTasks(
  userId: string, goalId: string, title: string,
  dayOfWeek: number, hour: number, durationMin: number,
  src: Record<string, string>, result: MaterializeResult
): Promise<void> {
  const today = new Date();
  const rows: any[] = [];
  for (let week = 0; week < WEEKS; week++) {
    const date = getNextDayOfWeek(today, dayOfWeek, week);
    if (date <= today) continue;
    rows.push({
      user_id: userId,
      title,
      description: `Weekly focus session — review progress, take action`,
      status: 'todo',
      priority: 'medium',
      due_date: fmtDate(date),
      due_time: fmtTime(hour),
      estimated_minutes: durationMin,
      goal_id: goalId,
      sort_order: week,
      is_deleted: false,
      sync_status: 'synced',
      ...src,
    });
  }
  // Batch insert
  if (rows.length > 0) {
    const { error, data } = await supabase.from('tasks').insert(rows).select('id');
    if (!error && data) result.tasksCreated += data.length;
    else if (error) result.errors.push(`Weekly tasks batch: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// CLEANUP — Only deletes source-tagged records from onboarding
// ═══════════════════════════════════════════════════════════════

/**
 * Clean records by source tag (if available) or by domain (fallback).
 * Safely handles the case where the 'source' column doesn't exist yet.
 */
async function cleanBySource(userId: string, source: string, domain?: string): Promise<void> {
  const hasSource = await hasSourceColumn();
  if (import.meta.env.DEV) {
    logger.log(`[materialize] Cleaning ${source} (source_col=${hasSource}, domain=${domain})`);
  }

  if (hasSource) {
    // Use source-based cleanup (precise)
    const { error: tErr, count: tc } = await supabase
      .from('tasks').delete({ count: 'exact' })
      .eq('user_id', userId).eq('source', source);
    if (import.meta.env.DEV) {
      logger.log(`[clean] tasks: deleted ${tc ?? '?'}${tErr ? ` ERROR: ${tErr.message}` : ''}`);
    }

    for (const cat of ['goal', 'epic', 'objective']) {
      const { error, count } = await supabase
        .from('goals').delete({ count: 'exact' })
        .eq('user_id', userId).eq('source', source).eq('category', cat);
      if (import.meta.env.DEV) {
        logger.log(`[clean] goals(${cat}): deleted ${count ?? '?'}${error ? ` ERROR: ${error.message}` : ''}`);
      }
    }

    const { error: hErr, count: hc } = await supabase
      .from('habits').delete({ count: 'exact' })
      .eq('user_id', userId).eq('source', source);
    if (import.meta.env.DEV) {
      logger.log(`[clean] habits: deleted ${hc ?? '?'}${hErr ? ` ERROR: ${hErr.message}` : ''}`);
    }
  } else if (domain) {
    // Fallback: clean by domain (materialiser always sets domain; user-created often don't)
    // This is less precise but works without the source column
    await cleanByDomain(userId, domain);
  } else {
    // Foundation cleanup fallback: clean goals/tasks that have domain set (materialised)
    // but skip goals with custom IDs (pre-seeded o1-, e2-, g- prefixes)
    await cleanMaterialisedFoundation(userId);
  }
}

/**
 * Fallback cleanup by domain — removes all goals in a domain and their tasks.
 */
async function cleanByDomain(userId: string, domain: string): Promise<void> {
  const { data: domainGoals } = await supabase
    .from('goals').select('id,category')
    .eq('user_id', userId).eq('domain', domain);
  
  if (domainGoals?.length) {
    const ids = domainGoals.map(g => g.id);
    const { count: tc } = await supabase.from('tasks').delete({ count: 'exact' })
      .eq('user_id', userId).in('goal_id', ids);
    for (const cat of ['goal', 'epic', 'objective']) {
      const catIds = domainGoals.filter(g => g.category === cat).map(g => g.id);
      if (catIds.length) {
        await supabase.from('goals').delete().eq('user_id', userId).in('id', catIds);
      }
    }
    logger.log(`[cleanByDomain] ${domain}: removed ${domainGoals.length} goals, ${tc} tasks`);
  }
}

/**
 * Foundation cleanup fallback — removes materialised goals (those with domain set)
 * that DON'T look pre-seeded (no custom ID prefixes).
 */
async function cleanMaterialisedFoundation(userId: string): Promise<void> {
  logger.log('[materialize] Cleaning materialised foundation records (fallback)...');
  
  const { data: allGoals } = await supabase
    .from('goals').select('id,title,category,domain')
    .eq('user_id', userId)
    .not('domain', 'is', null);
  
  if (!allGoals?.length) return;
  
  // Skip goals that are clearly pre-seeded (custom string IDs) or Health/Finance domain
  const materialised = allGoals.filter(g => {
    // UUID format = materialised by code; custom IDs like o1-xxx, e2-xxx, g-xxx = pre-seeded
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(g.id);
    const isHealthOrFinance = g.domain === 'Health & Fitness' || g.domain === 'Finances';
    return isUUID && !isHealthOrFinance; // Only clean foundation-domain materialised goals
  });
  
  if (materialised.length) {
    const ids = materialised.map(g => g.id);
    const { count: tc } = await supabase.from('tasks').delete({ count: 'exact' })
      .eq('user_id', userId).in('goal_id', ids);
    for (const cat of ['goal', 'epic', 'objective']) {
      const catIds = materialised.filter(g => g.category === cat).map(g => g.id);
      if (catIds.length) {
        await supabase.from('goals').delete().eq('user_id', userId).in('id', catIds);
      }
    }
    logger.log(`[cleanFoundation] Removed ${materialised.length} materialised goals, ${tc} tasks`);
  }
}

async function cleanHealthRecords(userId: string): Promise<void> {
  await cleanBySource(userId, SOURCE_HEALTH, 'Health & Fitness');
  // Also clean workout templates and schedule events from health
  const { count: ec } = await supabase.from('schedule_events').delete({ count: 'exact' })
    .eq('user_id', userId).eq('day_type', 'health');
  const { count: wc } = await supabase.from('workout_templates').delete({ count: 'exact' })
    .eq('user_id', userId);
  logger.log(`[cleanHealth] events: ${ec}, templates: ${wc}`);
}

async function cleanFinanceRecords(userId: string): Promise<void> {
  await cleanBySource(userId, SOURCE_FINANCE, 'Finances');
}

/**
 * Returns { source: 'xxx' } if the source column exists, or {} if not.
 * Call once per function, then spread into every insert.
 */
async function sourceTag(source: string): Promise<Record<string, string>> {
  const hasSource = await hasSourceColumn();
  return hasSource ? { source } : {};
}

// ═══════════════════════════════════════════════════════════════
// PHASE 1: FOUNDATION
// ═══════════════════════════════════════════════════════════════

interface FoundationData {
  name?: string; coreValues?: string[]; strengths?: string[];
  purpose?: string; purposeAnswers?: string[];
  focusAreas?: string[]; goals?: string[];
  goalDetails?: Array<{
    title: string; type?: 'short' | 'medium' | 'long';
    description?: string; category?: string;
    actions?: string[]; milestones?: string[];
  }>;
  goodHabits?: string[];
  morningRoutine?: Array<{ activity: string; time?: string }>;
  eveningRoutine?: Array<{ activity: string; time?: string }>;
  pastWins?: string; pastLessons?: string;
}

export async function materializeFoundation(
  userId: string, data: FoundationData, opts?: { cleanFirst?: boolean }
): Promise<MaterializeResult> {
  logger.log('[materializeFoundation v5] Input:', JSON.stringify({
    userId, name: data.name, focusAreas: data.focusAreas,
    goals: data.goals, goalDetailsCount: data.goalDetails?.length,
    goalDetailTitles: data.goalDetails?.map(g => g.title),
    goodHabits: data.goodHabits,
  }, null, 2));

  const result: MaterializeResult = {
    objectivesCreated: 0, epicsCreated: 0, goalsCreated: 0,
    tasksCreated: 0, habitsCreated: 0, eventsCreated: 0, errors: [],
  };
  const today = new Date();

  if (opts?.cleanFirst) {
    await cleanBySource(userId, SOURCE_FOUNDATION);
  }

  const src = await sourceTag(SOURCE_FOUNDATION);

  // ─── Build the goal list ───
  const rawGoals = (data.goalDetails?.length ? data.goalDetails :
    (data.goals || []).map(g => ({
      title: g, type: 'medium' as const, description: '', category: '', actions: [] as string[], milestones: [] as string[]
    })))
    .filter(g => g.title?.trim());

  // Deduplicate goals by normalised title
  const seenTitles = new Set<string>();
  const uniqueGoals = rawGoals.filter(g => {
    const key = g.title.trim().toLowerCase();
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });

  // ─── Focus Areas → Objectives ───
  const focusAreas = (data.focusAreas || []).slice(0, 4);
  const effectiveAreas = focusAreas.length > 0 ? focusAreas :
    uniqueGoals.length > 0 ? [...new Set(uniqueGoals.map(g => g.category || 'Personal').filter(Boolean))].slice(0, 3) :
    ['Personal Growth'];

  // Assign each goal to a focus area
  const areaGoals: Record<string, typeof uniqueGoals> = {};
  for (const area of effectiveAreas) areaGoals[area] = [];

  for (const goal of uniqueGoals) {
    const cat = (goal.category || '').toLowerCase();
    let matched = false;
    for (const area of effectiveAreas) {
      const areaLower = area.toLowerCase();
      if (cat.includes(areaLower.split(' ')[0]) || areaLower.includes(cat.split(' ')[0])) {
        areaGoals[area].push(goal);
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Assign to the area with fewest goals
      const smallest = effectiveAreas.reduce((a, b) =>
        (areaGoals[a]?.length || 0) <= (areaGoals[b]?.length || 0) ? a : b);
      areaGoals[smallest].push(goal);
    }
  }

  // Fill empty areas with one default goal
  for (const area of effectiveAreas) {
    if (!areaGoals[area]?.length) {
      areaGoals[area] = [{
        title: `Improve ${area}`, type: 'medium', description: '', category: area,
        actions: ['Research best practices', 'Set measurable targets', 'Take first step'], milestones: []
      }];
    }
  }

  // Weekday assignment for recurring weekly focus sessions
  const weekdays = [1, 2, 3, 4, 5]; // Mon-Fri
  let globalGoalIdx = 0;

  for (let objIdx = 0; objIdx < effectiveAreas.length; objIdx++) {
    const area = effectiveAreas[objIdx];
    const goals = areaGoals[area] || [];
    const color = COLORS[objIdx % COLORS.length];

    // ─── Create ONE Objective per focus area ───
    const { data: objective, error: objErr } = await supabase.from('goals').insert({
      user_id: userId,
      title: `${area}`,
      description: data.purpose ? `Purpose: ${data.purpose}` : `Focus area: ${area.toLowerCase()}`,
      category: 'objective', domain: area, status: 'active',
      sort_order: objIdx, priority: objIdx < 2 ? 'high' : 'medium',
      color, icon: getIcon(area), parent_goal_id: null,
      ...src,
    }).select('id').single();
    if (objErr || !objective) { result.errors.push(`Obj: ${objErr?.message}`); continue; }
    result.objectivesCreated++;

    // ─── Create ONE Epic per user goal (under the objective) ───
    for (let gIdx = 0; gIdx < Math.min(goals.length, 3); gIdx++) {
      const gd = goals[gIdx];
      const spanDays = gd.type === 'short' ? 60 : gd.type === 'long' ? 365 : 180;

      const { data: epic, error: epicErr } = await supabase.from('goals').insert({
        user_id: userId,
        title: gd.title,
        description: gd.description || `Working towards: ${gd.title}`,
        category: 'epic', domain: area, status: 'active',
        target_date: addDays(today, spanDays),
        parent_goal_id: objective.id,
        sort_order: gIdx, priority: gIdx === 0 ? 'high' : 'medium',
        color, icon: 'zap',
        ...src,
      }).select('id').single();
      if (epicErr || !epic) { result.errors.push(`Epic: ${epicErr?.message}`); continue; }
      result.epicsCreated++;

      // ─── Build goals from user input (actions + milestones become goals) ───
      // Each goal is a genuine decomposition of the epic — not a generic phase
      const actions = (gd.actions || []).filter(a => a?.trim());
      const milestones = (gd.milestones || []).filter(m => m?.trim());

      interface SubGoal {
        title: string;
        desc: string;
        targetWeek: number;
        priority: string;
        tasks: Array<{ title: string; week: number; priority: string }>;
      }

      const subGoals: SubGoal[] = [];

      if (actions.length > 0 || milestones.length > 0) {
        // ─── User provided specifics: each action/milestone becomes its own goal ───
        for (let aIdx = 0; aIdx < actions.length; aIdx++) {
          subGoals.push({
            title: actions[aIdx],
            desc: `Action step for: ${gd.title}`,
            targetWeek: (aIdx + 1) * 3, // 3 weeks per action
            priority: aIdx === 0 ? 'high' : 'medium',
            tasks: [
              { title: `Plan: ${actions[aIdx]}`, week: aIdx * 3 + 1, priority: 'high' },
              { title: `Execute: ${actions[aIdx]}`, week: aIdx * 3 + 2, priority: 'high' },
              { title: `Review: ${actions[aIdx]}`, week: aIdx * 3 + 3, priority: 'medium' },
            ],
          });
        }
        for (let mIdx = 0; mIdx < milestones.length; mIdx++) {
          const weekStart = (actions.length * 3) + (mIdx * 2) + 1;
          subGoals.push({
            title: milestones[mIdx],
            desc: `Milestone for: ${gd.title}`,
            targetWeek: weekStart + 2,
            priority: 'medium',
            tasks: [
              { title: `Prepare: ${milestones[mIdx]}`, week: weekStart, priority: 'medium' },
              { title: `Complete: ${milestones[mIdx]}`, week: weekStart + 2, priority: 'high' },
            ],
          });
        }
      } else {
        // ─── No user input: create 3 distinct progression goals ───
        subGoals.push(
          {
            title: `Research & plan: ${gd.title}`,
            desc: `Understand the landscape and create a clear plan`,
            targetWeek: 3, priority: 'high',
            tasks: [
              { title: `Research best approaches for: ${gd.title}`, week: 1, priority: 'high' },
              { title: `Identify resources & tools needed`, week: 2, priority: 'high' },
              { title: `Create action plan with milestones`, week: 3, priority: 'high' },
            ],
          },
          {
            title: `Build & execute: ${gd.title}`,
            desc: `Take consistent action and build momentum`,
            targetWeek: 8, priority: 'high',
            tasks: [
              { title: `Take first concrete step`, week: 4, priority: 'high' },
              { title: `Build routine around ${gd.title}`, week: 5, priority: 'medium' },
              { title: `Midpoint check — what's working?`, week: 6, priority: 'medium' },
              { title: `Double down on what works`, week: 7, priority: 'medium' },
            ],
          },
          {
            title: `Review & optimise: ${gd.title}`,
            desc: `Measure results and refine the approach`,
            targetWeek: 12, priority: 'medium',
            tasks: [
              { title: `Measure progress vs. original plan`, week: 9, priority: 'medium' },
              { title: `Identify bottlenecks & fix`, week: 10, priority: 'medium' },
              { title: `Set next quarter targets`, week: 12, priority: 'high' },
            ],
          },
        );
      }

      // ─── Create goals + tasks in DB ───
      for (let sgIdx = 0; sgIdx < subGoals.length; sgIdx++) {
        const sg = subGoals[sgIdx];
        const { data: goal, error: goalErr } = await supabase.from('goals').insert({
          user_id: userId,
          title: sg.title,
          description: sg.desc,
          category: 'goal', domain: area, status: 'active',
          target_date: addDays(today, Math.min(sg.targetWeek * 7, spanDays)),
          parent_goal_id: epic.id,
          sort_order: sgIdx, priority: sg.priority,
          color, icon: 'flag',
          ...src,
        }).select('id').single();
        if (goalErr || !goal) { result.errors.push(`Goal: ${goalErr?.message}`); continue; }
        result.goalsCreated++;

        // Tasks under this goal
        const taskRows = sg.tasks.map((t, i) => ({
          user_id: userId,
          title: t.title,
          description: `Part of: ${sg.title}`,
          status: 'todo',
          priority: t.priority,
          due_date: addDays(today, t.week * 7),
          due_time: fmtTime(10),
          estimated_minutes: 30,
          goal_id: goal.id,
          sort_order: i,
          is_deleted: false,
          sync_status: 'synced',
          ...src,
        }));
        if (taskRows.length > 0) {
          const { error, data: inserted } = await supabase.from('tasks').insert(taskRows).select('id');
          if (!error && inserted) result.tasksCreated += inserted.length;
          else if (error) result.errors.push(`Goal tasks: ${error.message}`);
        }
      }

      // ─── Weekly recurring focus session → spread across goals ───
      const day = weekdays[globalGoalIdx % weekdays.length];
      globalGoalIdx++;
      // Link weekly tasks to the first goal (the primary active one)
      const firstGoalId = subGoals.length > 0 ?
        (await supabase.from('goals').select('id').eq('user_id', userId).eq('parent_goal_id', epic.id).order('sort_order').limit(1)).data?.[0]?.id || epic.id
        : epic.id;
      await createWeeklyTasks(
        userId, firstGoalId, gd.title,
        day, 19, 60, src, result
      );
    }
  }

  // ─── Habits ───
  const habitSet = new Set<string>();
  const habitsToCreate: { title: string; desc: string; icon: string }[] = [];
  for (const h of (data.goodHabits || [])) {
    if (!h?.trim() || habitSet.has(h.toLowerCase())) continue;
    habitSet.add(h.toLowerCase());
    habitsToCreate.push({ title: capitalize(h), desc: 'Your existing habit', icon: getHabitIcon(h) });
  }
  for (const r of (data.morningRoutine || [])) {
    if (!r?.activity?.trim() || habitSet.has(r.activity.toLowerCase())) continue;
    habitSet.add(r.activity.toLowerCase());
    habitsToCreate.push({ title: capitalize(r.activity), desc: `Morning${r.time ? ` at ${r.time}` : ''}`, icon: getHabitIcon(r.activity) });
  }
  for (const r of (data.eveningRoutine || [])) {
    if (!r?.activity?.trim() || habitSet.has(r.activity.toLowerCase())) continue;
    habitSet.add(r.activity.toLowerCase());
    habitsToCreate.push({ title: capitalize(r.activity), desc: `Evening${r.time ? ` at ${r.time}` : ''}`, icon: getHabitIcon(r.activity) });
  }
  if (!habitSet.has('morning review')) habitsToCreate.push({ title: 'Morning Review', desc: 'Plan your day', icon: 'sun' });
  if (!habitSet.has('evening reflection')) habitsToCreate.push({ title: 'Evening Reflection', desc: 'Review accomplishments', icon: 'moon' });

  const { data: existH } = await supabase.from('habits').select('title').eq('user_id', userId);
  const existHT = new Set((existH || []).map(h => h.title.toLowerCase()));
  for (const h of habitsToCreate) {
    if (existHT.has(h.title.toLowerCase())) continue;
    const { error } = await supabase.from('habits').insert({
      user_id: userId, title: h.title, description: h.desc, frequency: 'daily',
      target_count: 1, icon: h.icon, color: COLORS[result.habitsCreated % COLORS.length],
      is_active: true, streak_current: 0, streak_best: 0,
      ...src,
    });
    if (!error) result.habitsCreated++;
  }

  logger.log('[materializeFoundation v5] Result:', result);
  return result;
}

// ═══════════════════════════════════════════════════════════════
// PHASE 2: HEALTH
// ═══════════════════════════════════════════════════════════════

interface HealthData {
  fitnessLevel?: string; fitnessGoals?: string[]; exerciseTypes?: string[];
  exerciseFrequency?: string; injuries?: string[];
  dietType?: string; dietGoals?: string[];
  waterIntake?: string; sleepHours?: string; sleepIssues?: string[];
  bedtime?: string; wakeTime?: string;
  stressLevel?: string; stressManagement?: string[];
  mentalHealthGoals?: string[]; meditationExperience?: string;
  bodyGoals?: string[]; currentWeight?: string; targetWeight?: string;
  supplements?: string[];
}

export async function materializeHealth(
  userId: string, data: HealthData, _opts?: { cleanFirst?: boolean }
): Promise<MaterializeResult> {
  logger.log('[materializeHealth v5] Input:', JSON.stringify({
    fitnessLevel: data.fitnessLevel, exerciseTypes: data.exerciseTypes,
    exerciseFrequency: data.exerciseFrequency, dietType: data.dietType,
    sleepHours: data.sleepHours, stressLevel: data.stressLevel,
    waterIntake: data.waterIntake, meditationExperience: data.meditationExperience,
  }, null, 2));

  const result: MaterializeResult = {
    objectivesCreated: 0, epicsCreated: 0, goalsCreated: 0,
    tasksCreated: 0, habitsCreated: 0, eventsCreated: 0, errors: [],
  };
  const today = new Date();
  const color = '#4ECB71';

  await cleanHealthRecords(userId);
  const src = await sourceTag(SOURCE_HEALTH);

  // ─── Health Objective ───
  const { data: healthObj, error: objErr } = await supabase.from('goals').insert({
    user_id: userId, title: 'Peak Health & Wellness',
    description: 'Fitness, nutrition, sleep, and mental wellness',
    category: 'objective', domain: 'Health & Fitness', status: 'active',
    sort_order: 100, priority: 'high', color, icon: 'heart', parent_goal_id: null,
    ...src,
  }).select('id').single();
  if (objErr || !healthObj) { result.errors.push(`Obj: ${objErr?.message}`); return result; }
  result.objectivesCreated++;

  // ─── Build health epics with milestone tasks directly under them ───
  type HealthEpic = {
    title: string; icon: string; desc: string;
    weeklyDay: number; weeklyHour: number; weeklyTitle: string; durationMin: number;
    tasks: Array<{ title: string; week: number; priority: string }>;
  };
  const epics: HealthEpic[] = [];

  // FITNESS
  if (data.fitnessGoals?.length || data.bodyGoals?.length || data.exerciseTypes?.length) {
    epics.push({
      title: 'Fitness & Body', icon: 'dumbbell',
      desc: `Goals: ${[...(data.fitnessGoals || []), ...(data.bodyGoals || [])].join(', ')}. Level: ${data.fitnessLevel || 'intermediate'}.`,
      weeklyDay: 6, weeklyHour: 8, weeklyTitle: 'Fitness Check-in', durationMin: 30,
      tasks: [
        { title: 'Set baseline measurements (weight, photos)', week: 1, priority: 'high' },
        { title: `Build ${data.exerciseFrequency || '3x/week'} workout habit`, week: 3, priority: 'high' },
        { title: 'Month 1 progress review — adjust intensity', week: 4, priority: 'medium' },
        { title: 'Month 2 reassess goals & programming', week: 8, priority: 'medium' },
      ],
    });
  }

  // NUTRITION
  if (data.dietType || data.dietGoals?.length) {
    const isVeg = (data.dietType || '').toLowerCase().includes('veg');
    const nutritionTasks = [
      { title: 'Track meals for 3 days — baseline awareness', week: 1, priority: 'high' },
    ];
    if (isVeg) {
      nutritionTasks.push(
        { title: 'Research plant protein sources (lentils, tofu, tempeh)', week: 2, priority: 'high' },
        { title: 'Look into B12 + iron supplements', week: 3, priority: 'medium' },
      );
    } else {
      nutritionTasks.push(
        { title: 'Calculate daily protein target', week: 2, priority: 'high' },
      );
    }
    nutritionTasks.push(
      { title: 'Build 5 go-to healthy meal rotation', week: 4, priority: 'medium' },
      { title: 'Month 2 nutrition review — habits sticking?', week: 8, priority: 'medium' },
    );
    epics.push({
      title: 'Nutrition', icon: 'salad',
      desc: `Diet: ${data.dietType || 'balanced'}. ${isVeg ? 'Plant-based — protein, B12, iron focus.' : ''}`,
      weeklyDay: 0, weeklyHour: 17, weeklyTitle: 'Meal Plan & Prep', durationMin: 45,
      tasks: nutritionTasks,
    });
  }

  // SLEEP
  if (data.sleepHours || data.sleepIssues?.length || data.bedtime) {
    epics.push({
      title: 'Sleep Quality', icon: 'moon',
      desc: `Current: ${data.sleepHours || '?'}h. Target: 7-8h. ${data.sleepIssues?.join(', ') || ''}`,
      weeklyDay: 0, weeklyHour: 20, weeklyTitle: 'Sleep Review', durationMin: 15,
      tasks: [
        { title: `Set consistent bedtime${data.bedtime ? ` (current: ${data.bedtime})` : ''}`, week: 1, priority: 'high' },
        { title: 'Create wind-down routine (no screens 30min)', week: 2, priority: 'high' },
        { title: 'Track sleep quality for 2 weeks', week: 3, priority: 'medium' },
        { title: 'Review and optimise sleep strategy', week: 6, priority: 'medium' },
      ],
    });
  }

  // MENTAL
  if (data.stressLevel || data.mentalHealthGoals?.length || data.meditationExperience) {
    epics.push({
      title: 'Mental Wellness', icon: 'brain',
      desc: `Stress: ${data.stressLevel || 'moderate'}. ${data.stressManagement?.length ? data.stressManagement.join(', ') : ''}`,
      weeklyDay: 3, weeklyHour: 19, weeklyTitle: 'Mental Wellness Check-in', durationMin: 20,
      tasks: [
        { title: 'Identify top 3 stress triggers', week: 1, priority: 'high' },
        { title: data.meditationExperience === 'none' || !data.meditationExperience
            ? 'Start 5-min guided meditation' : 'Deepen meditation (+5 min)', week: 2, priority: 'high' },
        { title: 'Schedule weekly stress-relief activity', week: 3, priority: 'medium' },
        { title: 'Month 2 assessment — stress level 1-10', week: 8, priority: 'medium' },
      ],
    });
  }

  // ─── Create epics + tasks directly under each epic (NO intermediate goal layer) ───
  for (let eIdx = 0; eIdx < epics.length; eIdx++) {
    const ep = epics[eIdx];
    const { data: epic, error: epicErr } = await supabase.from('goals').insert({
      user_id: userId, title: ep.title, description: ep.desc,
      category: 'epic', domain: 'Health & Fitness', status: 'active',
      target_date: addDays(today, 90), parent_goal_id: healthObj.id,
      sort_order: eIdx, priority: eIdx < 2 ? 'high' : 'medium', color, icon: ep.icon,
      ...src,
    }).select('id').single();
    if (epicErr || !epic) { result.errors.push(`Epic: ${epicErr?.message}`); continue; }
    result.epicsCreated++;

    // Milestone tasks — directly under the epic
    const rows = ep.tasks.map((t, i) => ({
      user_id: userId,
      title: t.title,
      description: `${ep.title} milestone`,
      status: 'todo',
      priority: t.priority,
      due_date: addDays(today, t.week * 7),
      due_time: fmtTime(10),
      estimated_minutes: 30,
      goal_id: epic.id,
      sort_order: i,
      is_deleted: false,
      sync_status: 'synced',
      ...src,
    }));
    if (rows.length > 0) {
      const { error, data: inserted } = await supabase.from('tasks').insert(rows).select('id');
      if (!error && inserted) result.tasksCreated += inserted.length;
      else if (error) result.errors.push(`Health tasks: ${error.message}`);
    }

    // Weekly recurring tasks for this health area
    await createWeeklyTasks(userId, epic.id, ep.weeklyTitle, ep.weeklyDay, ep.weeklyHour, ep.durationMin, src, result);
  }

  // ─── Workout Schedule (stays as events — linked to templates) ───
  if (data.exerciseTypes?.length) {
    const daysPerWeek = parseExerciseFrequency(data.exerciseFrequency || '3x/week');
    const assignments = assignWorkoutDays(data.exerciseTypes.slice(0, 4), daysPerWeek);
    for (const a of assignments) {
      const { data: tmpl } = await supabase.from('workout_templates').insert({
        user_id: userId, name: a.type,
        description: `${a.type} — ${data.fitnessLevel || 'intermediate'} (onboarding)`,
        estimated_duration_min: 45, day_of_week: a.days,
        preferred_time: '06:00', is_active: true,
      }).select('id').single();
      if (!tmpl) continue;
      const eventRows: any[] = [];
      for (let week = 0; week < WEEKS; week++) {
        for (const dow of a.days) {
          const d = getNextDayOfWeek(today, dow, week);
          if (d <= today) continue;
          const start = new Date(d); start.setHours(6, 0, 0, 0);
          const end = new Date(start.getTime() + 45 * 60000);
          eventRows.push({
            user_id: userId, title: `${a.type}`,
            description: `[workout:${tmpl.id}] ${data.fitnessLevel || 'intermediate'}`,
            start_time: start.toISOString(), end_time: end.toISOString(),
            all_day: false, color: '#39FF14', day_type: 'health',
            is_deleted: false, sync_status: 'synced',
          });
        }
      }
      if (eventRows.length) {
        const { error, data: inserted } = await supabase.from('schedule_events').insert(eventRows).select('id');
        if (!error && inserted) result.eventsCreated += inserted.length;
      }
    }
  }

  // ─── Health Habits ───
  const hh: Array<{ title: string; desc: string; icon: string }> = [];
  const isVeg = (data.dietType || '').toLowerCase().includes('veg');
  if (data.waterIntake) hh.push({ title: 'Drink Water', desc: `Target: 2.5-3L (current: ${data.waterIntake})`, icon: 'droplets' });
  if (data.sleepHours) hh.push({ title: 'Sleep on Schedule', desc: `${data.sleepHours}+ hours${data.bedtime ? `. Bed: ${data.bedtime}` : ''}`, icon: 'moon' });
  if (data.exerciseTypes?.[0]) hh.push({ title: `${data.exerciseTypes[0]} Session`, desc: data.exerciseFrequency || 'Regular', icon: 'dumbbell' });
  if (data.meditationExperience && data.meditationExperience !== 'none') hh.push({ title: 'Meditate', desc: '10 min mindfulness', icon: 'flower-2' });
  if (data.dietType) hh.push({ title: isVeg ? 'Hit Protein Target' : 'Healthy Eating', desc: isVeg ? 'Plant protein daily' : 'Balanced meals', icon: 'salad' });
  if (isVeg && (!data.supplements?.length)) hh.push({ title: 'Take Supplements', desc: 'B12, iron, omega-3', icon: 'pill' });

  const { data: existHab } = await supabase.from('habits').select('title').eq('user_id', userId);
  const existHabT = new Set((existHab || []).map(h => h.title.toLowerCase()));
  for (const h of hh) {
    if (existHabT.has(h.title.toLowerCase())) continue;
    const { error } = await supabase.from('habits').insert({
      user_id: userId, title: h.title, description: h.desc, frequency: 'daily',
      target_count: 1, icon: h.icon, color, is_active: true, streak_current: 0, streak_best: 0,
      ...src,
    });
    if (!error) result.habitsCreated++;
  }

  if (data.currentWeight) {
    const w = parseFloat((data.currentWeight || '').replace(/[^0-9.]/g, ''));
    if (!isNaN(w)) await supabase.from('health_metrics').upsert({
      user_id: userId, date: today.toISOString().split('T')[0], weight_kg: w, water_glasses: 0
    }, { onConflict: 'user_id,date' });
  }

  // ─── Save health profile to user_profiles for Health page ───
  const { data: profile } = await supabase.from('user_profiles').select('preferences').eq('user_id', userId).single();
  const prefs = (profile?.preferences || {}) as Record<string, any>;
  await supabase.from('user_profiles').upsert({
    user_id: userId,
    preferences: {
      ...prefs,
      health_profile: {
        fitness_level: data.fitnessLevel, fitness_goals: data.fitnessGoals,
        exercise_types: data.exerciseTypes, exercise_frequency: data.exerciseFrequency,
        diet_type: data.dietType, diet_goals: data.dietGoals,
        water_intake: data.waterIntake, sleep_hours: data.sleepHours,
        sleep_issues: data.sleepIssues, bedtime: data.bedtime, wake_time: data.wakeTime,
        stress_level: data.stressLevel, stress_management: data.stressManagement,
        mental_health_goals: data.mentalHealthGoals, meditation_experience: data.meditationExperience,
        body_goals: data.bodyGoals, current_weight: data.currentWeight,
        target_weight: data.targetWeight, supplements: data.supplements,
        injuries: data.injuries,
      },
      health_onboarding_percent: 100,
    },
  }, { onConflict: 'user_id' });

  logger.log('[materializeHealth v5] Result:', result);
  return result;
}

// ═══════════════════════════════════════════════════════════════
// PHASE 3: FINANCE
// ═══════════════════════════════════════════════════════════════

interface FinanceData {
  employmentType?: string; incomeRange?: string; incomeSources?: string[];
  businessName?: string; businessType?: string; businessRevenue?: string;
  fixedExpenses?: Array<{ name: string; amount: string; frequency: string }>;
  subscriptions?: Array<{ name: string; amount: string }>;
  debtTypes?: string[]; debtTotal?: string;
  savingsGoals?: string[]; savingsRate?: string;
  budgetingMethod?: string; financialGoals?: string[];
  financialStress?: string; taxSituation?: string; emergencyFund?: string;
}

export async function materializeFinance(
  userId: string, data: FinanceData, _opts?: { cleanFirst?: boolean }
): Promise<MaterializeResult> {
  logger.log('[materializeFinance v5] Input:', JSON.stringify({
    employmentType: data.employmentType, businessName: data.businessName,
    fixedExpenses: data.fixedExpenses?.length, financialGoals: data.financialGoals,
  }, null, 2));

  const result: MaterializeResult = {
    objectivesCreated: 0, epicsCreated: 0, goalsCreated: 0,
    tasksCreated: 0, habitsCreated: 0, eventsCreated: 0, errors: [],
  };
  const today = new Date();
  const color = '#FFD93D';

  await cleanFinanceRecords(userId);
  const src = await sourceTag(SOURCE_FINANCE);

  const { data: finObj, error: objErr } = await supabase.from('goals').insert({
    user_id: userId, title: 'Financial Mastery',
    description: `${data.employmentType || 'Self-employed'}. ${data.businessName ? `Business: ${data.businessName}.` : ''}`,
    category: 'objective', domain: 'Finances', status: 'active',
    sort_order: 200, priority: 'high', color, icon: 'wallet', parent_goal_id: null,
    ...src,
  }).select('id').single();
  if (objErr || !finObj) { result.errors.push(`Obj: ${objErr?.message}`); return result; }
  result.objectivesCreated++;

  // ─── Build finance epics with tasks directly under them ───
  type FinEpic = {
    title: string; icon: string; desc: string;
    weeklyDay: number; weeklyHour: number; weeklyTitle: string; durationMin: number;
    tasks: Array<{ title: string; week: number; priority: string }>;
  };
  const epics: FinEpic[] = [];

  if (data.savingsGoals?.length || data.emergencyFund) {
    epics.push({ title: 'Build Savings', icon: 'wallet',
      desc: `${data.savingsGoals?.join(', ') || 'Emergency fund'}. Rate: ${data.savingsRate || 'TBD'}`,
      weeklyDay: 5, weeklyHour: 19, weeklyTitle: 'Savings Review', durationMin: 15,
      tasks: [
        { title: 'Set up dedicated savings account', week: 1, priority: 'high' },
        { title: 'Calculate monthly savings target', week: 2, priority: 'high' },
        { title: 'Set up automatic transfer', week: 3, priority: 'medium' },
        { title: 'Month 1 savings review', week: 4, priority: 'medium' },
        { title: 'Quarter 1 savings assessment', week: 12, priority: 'medium' },
      ],
    });
  }
  if (data.debtTypes?.length && data.debtTypes[0] !== 'none') {
    epics.push({ title: 'Debt Reduction', icon: 'bar-chart-3',
      desc: `Types: ${data.debtTypes.join(', ')}. Total: ${data.debtTotal || 'unknown'}`,
      weeklyDay: 5, weeklyHour: 20, weeklyTitle: 'Debt Progress', durationMin: 15,
      tasks: [
        { title: 'List all debts with amounts + interest rates', week: 1, priority: 'high' },
        { title: 'Choose strategy (avalanche vs snowball)', week: 2, priority: 'high' },
        { title: 'Find one expense to redirect to debt', week: 3, priority: 'medium' },
        { title: 'Month 1 — check balances', week: 4, priority: 'medium' },
      ],
    });
  }
  if (data.businessName || data.employmentType === 'business-owner' || data.employmentType === 'self-employed') {
    epics.push({ title: `Grow ${data.businessName || 'Business'}`, icon: 'briefcase',
      desc: `Revenue: ${data.businessRevenue || 'unknown'}`,
      weeklyDay: 0, weeklyHour: 17, weeklyTitle: `${data.businessName || 'Business'} Review`, durationMin: 30,
      tasks: [
        { title: 'Calculate actual profit margin', week: 1, priority: 'high' },
        { title: 'Identify top 3 growth opportunities', week: 2, priority: 'high' },
        { title: 'Set revenue target for next quarter', week: 3, priority: 'medium' },
        { title: 'Review expenses for waste', week: 4, priority: 'medium' },
        { title: 'Quarter review — revenue vs target', week: 12, priority: 'medium' },
      ],
    });
  }
  if (data.fixedExpenses?.length || data.budgetingMethod) {
    epics.push({ title: 'Budget & Track', icon: 'clipboard-list',
      desc: `Method: ${data.budgetingMethod || 'starting fresh'}`,
      weeklyDay: 0, weeklyHour: 19, weeklyTitle: 'Budget Review', durationMin: 20,
      tasks: [
        { title: 'Log expenses for 1 week', week: 1, priority: 'high' },
        { title: 'Categorise: essential vs discretionary', week: 2, priority: 'high' },
        { title: 'Set budget limits per category', week: 3, priority: 'medium' },
        { title: 'Month 1 — staying within budget?', week: 4, priority: 'medium' },
      ],
    });
  }
  // Additional financial goals (deduped against existing epics)
  for (const fg of (data.financialGoals || [])) {
    if (!fg?.trim() || epics.some(e => e.title.toLowerCase().includes(fg.toLowerCase().split(' ')[0]))) continue;
    epics.push({ title: fg, icon: 'target', desc: 'Financial goal',
      weeklyDay: 6, weeklyHour: 10, weeklyTitle: `${fg}`, durationMin: 30,
      tasks: [
        { title: `Research: ${fg}`, week: 1, priority: 'high' },
        { title: `Plan first step: ${fg}`, week: 2, priority: 'high' },
        { title: `Month 1 review: ${fg}`, week: 4, priority: 'medium' },
        { title: `Month 2 progress: ${fg}`, week: 8, priority: 'medium' },
      ],
    });
  }

  for (let eIdx = 0; eIdx < Math.min(epics.length, 5); eIdx++) {
    const ep = epics[eIdx];
    const { data: epic, error: epicErr } = await supabase.from('goals').insert({
      user_id: userId, title: ep.title, description: ep.desc,
      category: 'epic', domain: 'Finances', status: 'active',
      target_date: addDays(today, 90), parent_goal_id: finObj.id,
      sort_order: eIdx, priority: eIdx < 2 ? 'high' : 'medium', color, icon: ep.icon,
      ...src,
    }).select('id').single();
    if (epicErr || !epic) { result.errors.push(`Epic: ${epicErr?.message}`); continue; }
    result.epicsCreated++;

    // Tasks directly under the epic
    const rows = ep.tasks.map((t, i) => ({
      user_id: userId,
      title: t.title,
      description: `${ep.title} milestone`,
      status: 'todo',
      priority: t.priority,
      due_date: addDays(today, t.week * 7),
      due_time: fmtTime(10),
      estimated_minutes: 30,
      goal_id: epic.id,
      sort_order: i,
      is_deleted: false,
      sync_status: 'synced',
      ...src,
    }));
    if (rows.length > 0) {
      const { error, data: inserted } = await supabase.from('tasks').insert(rows).select('id');
      if (!error && inserted) result.tasksCreated += inserted.length;
      else if (error) result.errors.push(`Finance tasks: ${error.message}`);
    }

    // Weekly recurring tasks
    await createWeeklyTasks(userId, epic.id, ep.weeklyTitle, ep.weeklyDay, ep.weeklyHour, ep.durationMin, src, result);
  }

  // Recurring transactions (graceful)
  try {
    if (data.fixedExpenses?.length) {
      const { data: ex, error: chk } = await supabase.from('recurring_transactions').select('description').eq('user_id', userId);
      if (!chk && ex !== null) {
        const names = new Set(ex.map((r: any) => r.description?.toLowerCase()));
        for (const e of data.fixedExpenses) {
          if (names.has(e.name?.toLowerCase())) continue;
          const amt = parseFloat((e.amount || '').replace(/[^0-9.]/g, ''));
          if (!isNaN(amt)) await supabase.from('recurring_transactions').insert({
            user_id: userId, description: e.name, amount: -Math.abs(amt),
            category: 'Bills', frequency: mapFreq(e.frequency),
            next_date: nextBillDate(e.frequency), is_active: true,
          });
        }
      }
    }
  } catch { /* table may not exist */ }

  // Finance habits
  const fh = [
    { title: 'Track Expenses', desc: 'Log every expense', icon: 'bar-chart-3', freq: 'daily' },
    { title: 'Financial Check-in', desc: 'Weekly review', icon: 'wallet', freq: 'weekly' },
  ];
  const { data: existFH } = await supabase.from('habits').select('title').eq('user_id', userId);
  const existFHT = new Set((existFH || []).map(h => h.title.toLowerCase()));
  for (const h of fh) {
    if (existFHT.has(h.title.toLowerCase())) continue;
    const { error } = await supabase.from('habits').insert({
      user_id: userId, title: h.title, description: h.desc, frequency: h.freq,
      target_count: 1, icon: h.icon, color, is_active: true, streak_current: 0, streak_best: 0,
      ...src,
    });
    if (!error) result.habitsCreated++;
  }

  // Save finance profile for Finance page
  const { data: profile } = await supabase.from('user_profiles').select('preferences').eq('user_id', userId).single();
  const prefs = (profile?.preferences || {}) as Record<string, any>;
  await supabase.from('user_profiles').upsert({
    user_id: userId,
    preferences: {
      ...prefs,
      finance_profile: {
        employment_type: data.employmentType, income_range: data.incomeRange,
        income_sources: data.incomeSources, business_name: data.businessName,
        business_type: data.businessType, business_revenue: data.businessRevenue,
        fixed_expenses: data.fixedExpenses, subscriptions: data.subscriptions,
        debt_types: data.debtTypes, debt_total: data.debtTotal,
        savings_goals: data.savingsGoals, savings_rate: data.savingsRate,
        budgeting_method: data.budgetingMethod, financial_goals: data.financialGoals,
        financial_stress: data.financialStress, tax_situation: data.taxSituation,
        emergency_fund: data.emergencyFund,
      },
      finance_onboarding_percent: 100,
    },
  }, { onConflict: 'user_id' });

  logger.log('[materializeFinance v5] Result:', result);
  return result;
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

function getHabitIcon(t: string): string {
  const l = t.toLowerCase();
  if (l.includes('read')) return 'book-open';
  if (l.includes('exercise') || l.includes('workout') || l.includes('gym')) return 'dumbbell';
  if (l.includes('meditat')) return 'flower-2';
  if (l.includes('journal') || l.includes('write')) return 'notebook-pen';
  if (l.includes('water')) return 'droplets';
  if (l.includes('pray') || l.includes('bible') || l.includes('gratitude')) return 'hand-heart';
  if (l.includes('walk') || l.includes('run') || l.includes('dog')) return 'footprints';
  if (l.includes('study') || l.includes('learn')) return 'graduation-cap';
  if (l.includes('stretch') || l.includes('yoga')) return 'stretch-horizontal';
  if (l.includes('sleep')) return 'moon';
  if (l.includes('plan') || l.includes('review')) return 'clipboard-list';
  if (l.includes('clean')) return 'sparkles';
  if (l.includes('code') || l.includes('build')) return 'monitor';
  if (l.includes('affirm')) return 'sparkles';
  return 'circle-dot';
}
function parseExerciseFrequency(f: string): number { const m = f.match(/(\d+)/); return m ? Math.min(parseInt(m[1]), 6) : 3; }
function assignWorkoutDays(types: string[], total: number): Array<{ type: string; days: number[] }> {
  const wd = [1,2,3,4,5,6,0]; const r: Array<{ type: string; days: number[] }> = []; let di = 0;
  for (const t of types) { const n = Math.max(1, Math.floor(total / types.length)); const d: number[] = [];
    for (let i = 0; i < n && di < total; i++) { d.push(wd[di % 7]); di++; } r.push({ type: t, days: d }); } return r;
}
function mapFreq(f: string): string { const l = (f||'').toLowerCase(); if (l.includes('week')) return 'weekly'; if (l.includes('fortnight')) return 'fortnightly'; if (l.includes('year')) return 'yearly'; return 'monthly'; }
function nextBillDate(f: string): string { const d = new Date(); const l = (f||'').toLowerCase(); if (l.includes('week')) d.setDate(d.getDate()+7); else d.setMonth(d.getMonth()+1); return d.toISOString().split('T')[0]; }

// ═══════════════════════════════════════════════════════════════
// ROBUST AI OUTPUT PARSER — Handles malformed JSON, structured text, etc.
// ═══════════════════════════════════════════════════════════════

/**
 * Attempts to parse AI output into FoundationData using multiple strategies:
 * 1. Direct JSON parse
 * 2. Extract JSON from markdown code blocks  
 * 3. Parse structured text (key: value format)
 * 4. Key extraction from freeform text
 * 5. Fallback to sensible defaults
 */
export function parseAIOutput(rawOutput: string): FoundationData {
  if (!rawOutput || typeof rawOutput !== 'string') {
    logger.warn('[parseAIOutput] Empty or invalid input, using defaults');
    return getDefaultFoundationData();
  }

  // Strategy 1: Direct JSON parse
  try {
    const parsed = JSON.parse(rawOutput);
    if (typeof parsed === 'object' && parsed !== null) {
      logger.log('[parseAIOutput] Strategy 1: Direct JSON parse succeeded');
      return normalizeFoundationData(parsed);
    }
  } catch { /* continue */ }

  // Strategy 2: Extract JSON from markdown code blocks
  const jsonBlockMatch = rawOutput.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1].trim());
      if (typeof parsed === 'object') {
        logger.log('[parseAIOutput] Strategy 2: JSON from code block succeeded');
        return normalizeFoundationData(parsed);
      }
    } catch { /* continue */ }
  }

  // Strategy 3: Find any JSON object in the text
  const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed === 'object') {
        logger.log('[parseAIOutput] Strategy 3: Extracted JSON object succeeded');
        return normalizeFoundationData(parsed);
      }
    } catch { /* continue */ }
  }

  // Strategy 4: Parse structured text (key-value extraction)
  logger.log('[parseAIOutput] Strategy 4: Extracting from structured text');
  return extractFromText(rawOutput);
}

/**
 * Normalize whatever object shape the AI returned into FoundationData
 */
function normalizeFoundationData(obj: any): FoundationData {
  return {
    name: obj.name || obj.user_name || obj.display_name || undefined,
    coreValues: extractArray(obj.coreValues || obj.core_values || obj.values),
    strengths: extractArray(obj.strengths || obj.skills),
    purpose: obj.purpose || obj.life_purpose || obj.vision || undefined,
    focusAreas: extractArray(obj.focusAreas || obj.focus_areas || obj.areas || obj.domains),
    goals: extractArray(obj.goals?.map?.((g: any) => typeof g === 'string' ? g : g.title) || obj.goal_titles),
    goalDetails: (obj.goalDetails || obj.goal_details || obj.goals || [])
      .filter((g: any) => g && typeof g === 'object' && g.title)
      .map((g: any) => ({
        title: g.title,
        type: g.type || g.timeframe || 'medium',
        description: g.description || g.desc || '',
        category: g.category || g.domain || '',
        actions: extractArray(g.actions || g.action_steps || g.steps),
        milestones: extractArray(g.milestones || g.checkpoints),
      })),
    goodHabits: extractArray(obj.goodHabits || obj.good_habits || obj.habits || obj.existing_habits),
    morningRoutine: (obj.morningRoutine || obj.morning_routine || [])
      .filter((r: any) => r && (typeof r === 'string' || r.activity))
      .map((r: any) => typeof r === 'string' ? { activity: r } : r),
    eveningRoutine: (obj.eveningRoutine || obj.evening_routine || [])
      .filter((r: any) => r && (typeof r === 'string' || r.activity))
      .map((r: any) => typeof r === 'string' ? { activity: r } : r),
  };
}

function extractArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(v => typeof v === 'string' && v.trim());
  if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

/**
 * Last resort: extract meaningful data from freeform text
 */
function extractFromText(text: string): FoundationData {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const goals: string[] = [];
  const habits: string[] = [];
  const focusAreas: string[] = [];
  let purpose = '';

  for (const line of lines) {
    const lower = line.toLowerCase();
    // Look for goal-like statements
    if (lower.includes('goal') || lower.includes('want to') || lower.includes('achieve') || lower.includes('improve')) {
      const cleaned = line.replace(/^[-*•\d.]+\s*/, '').replace(/^(goal|my goal|i want to|i'd like to)[:.]?\s*/i, '');
      if (cleaned.length > 5 && cleaned.length < 200) goals.push(cleaned);
    }
    // Look for habit-like statements
    if (lower.includes('habit') || lower.includes('daily') || lower.includes('every day') || lower.includes('routine')) {
      const cleaned = line.replace(/^[-*•\d.]+\s*/, '');
      if (cleaned.length > 3 && cleaned.length < 100) habits.push(cleaned);
    }
    // Look for focus areas
    if (lower.includes('focus') || lower.includes('area') || lower.includes('domain') || lower.includes('priority')) {
      const cleaned = line.replace(/^[-*•\d.]+\s*/, '').replace(/^(focus|area|domain|priority)[:.]?\s*/i, '');
      if (cleaned.length > 3 && cleaned.length < 80) focusAreas.push(cleaned);
    }
    // Look for purpose
    if (lower.includes('purpose') || lower.includes('vision') || lower.includes('mission')) {
      const cleaned = line.replace(/^[-*•\d.]+\s*/, '').replace(/^(purpose|vision|mission)[:.]?\s*/i, '');
      if (cleaned.length > 10) purpose = cleaned;
    }
  }

  // If we got nothing useful, create from whatever text we have
  if (goals.length === 0) {
    // Split text into sentences and use the most goal-like ones
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    for (const s of sentences.slice(0, 5)) {
      const cleaned = s.trim().replace(/^[-*•\d.]+\s*/, '');
      if (cleaned.length > 10 && cleaned.length < 150) goals.push(cleaned);
    }
  }

  return {
    purpose: purpose || undefined,
    focusAreas: focusAreas.length > 0 ? focusAreas.slice(0, 4) : undefined,
    goals: goals.slice(0, 6),
    goalDetails: goals.slice(0, 6).map(g => ({
      title: g, type: 'medium' as const, description: '', category: '', actions: [], milestones: []
    })),
    goodHabits: habits.length > 0 ? habits.slice(0, 5) : ['Morning review', 'Evening reflection'],
  };
}

function getDefaultFoundationData(): FoundationData {
  return {
    focusAreas: ['Personal Growth', 'Career', 'Health'],
    goals: ['Build better habits', 'Advance career goals', 'Improve health and fitness'],
    goalDetails: [
      { title: 'Build better habits', type: 'short', description: 'Establish daily routines', category: 'Personal Growth', actions: ['Pick 3 habits', 'Track daily', 'Review weekly'], milestones: [] },
      { title: 'Advance career goals', type: 'medium', description: 'Professional development', category: 'Career', actions: ['Set clear targets', 'Skill development', 'Network building'], milestones: [] },
      { title: 'Improve health and fitness', type: 'medium', description: 'Physical wellbeing', category: 'Health', actions: ['Exercise routine', 'Better nutrition', 'Sleep schedule'], milestones: [] },
    ],
    goodHabits: ['Morning review', 'Exercise', 'Reading', 'Evening reflection'],
    morningRoutine: [{ activity: 'Plan your day' }],
    eveningRoutine: [{ activity: 'Review accomplishments' }],
  };
}

/**
 * High-level entry point: Parse AI output → Materialize everything
 * Called by the onboarding flow after the AI conversation completes.
 * 
 * This is the "bulletproof" wrapper that ALWAYS produces results,
 * even if the AI returned garbage.
 */
export async function materializeLifeSystem(
  userId: string,
  aiOutput: string | Record<string, any>,
  opts?: { cleanFirst?: boolean }
): Promise<MaterializeResult> {
  logger.log('[materializeLifeSystem] Starting...');

  let data: FoundationData;

  if (typeof aiOutput === 'string') {
    data = parseAIOutput(aiOutput);
  } else if (typeof aiOutput === 'object' && aiOutput !== null) {
    data = normalizeFoundationData(aiOutput);
  } else {
    logger.warn('[materializeLifeSystem] Invalid AI output, using defaults');
    data = getDefaultFoundationData();
  }

  // Validate we have something useful
  const hasGoals = (data.goalDetails?.length ?? 0) > 0 || (data.goals?.length ?? 0) > 0;
  if (!hasGoals) {
    logger.warn('[materializeLifeSystem] No goals extracted, adding defaults');
    const defaults = getDefaultFoundationData();
    data.goalDetails = defaults.goalDetails;
    data.goals = defaults.goals;
    data.focusAreas = data.focusAreas?.length ? data.focusAreas : defaults.focusAreas;
  }

  logger.log('[materializeLifeSystem] Parsed data:', {
    focusAreas: data.focusAreas,
    goalCount: data.goalDetails?.length || data.goals?.length,
    habitCount: data.goodHabits?.length,
  });

  return materializeFoundation(userId, data, opts);
}
