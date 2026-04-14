/**
 * TCS Growth Plan Seeder
 *
 * Seeds the 90-day growth plan as Goals + Tasks into LifeOS.
 * Creates a parent goal with 3 sub-goals (months) and tasks under each.
 * Idempotent — checks if the plan already exists before seeding.
 */

import { supabase } from './data-access';
import { genId } from '../utils/date';

// ─── Plan Data ──────────────────────────────────────────────────

interface MilestoneTask {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

interface MonthMilestone {
  title: string;
  subtitle: string;
  tasks: MilestoneTask[];
}

const GROWTH_PLAN: MonthMilestone[] = [
  {
    title: 'Month 1 — Stabilize & Systemize',
    subtitle: 'Build the operational foundation',
    tasks: [
      {
        title: 'Set up proper invoicing system',
        description: 'Implement a reliable invoicing workflow with templates, tracking, and follow-up reminders for all TCS clients.',
        priority: 'high',
      },
      {
        title: 'Start vehicle logbook (ATO compliance)',
        description: 'Begin maintaining a compliant vehicle logbook for ATO tax deduction purposes. Record all business-related trips with dates, km, and purpose.',
        priority: 'high',
      },
      {
        title: 'Verify public liability insurance',
        description: 'Review and confirm current public liability insurance coverage is adequate for all TCS venues and contract requirements.',
        priority: 'urgent',
      },
      {
        title: 'Document SOPs per venue',
        description: 'Create standardized operating procedures for each venue covering cleaning tasks, access, special requirements, and quality checklist.',
        priority: 'medium',
      },
      {
        title: 'Set health boundary: minimum 6 hours sleep',
        description: 'Establish and enforce a hard boundary on work hours to ensure a minimum of 6 hours sleep nightly. Track and review weekly.',
        priority: 'high',
      },
    ],
  },
  {
    title: 'Month 2 — Grow',
    subtitle: 'Expand revenue and strengthen client base',
    tasks: [
      {
        title: 'Prospect for 1 new cleaning contract (daytime, western Melbourne)',
        description: 'Research and approach businesses in western Melbourne for a daytime cleaning contract. Target: 1 signed contract.',
        priority: 'high',
      },
      {
        title: 'Raise rates 10% (CPI adjustment) on Jaga Jaga and Sonder',
        description: 'Apply CPI-based rate increase of 10% to Jaga Jaga and Sonder contracts. Prepare rate change letters and communicate professionally.',
        priority: 'medium',
      },
      {
        title: 'Build referral system (1 free clean for successful referral)',
        description: 'Design and implement a referral program offering 1 free clean for every successful client referral. Create marketing material and tracking system.',
        priority: 'medium',
      },
    ],
  },
  {
    title: 'Month 3 — Scale Preparation',
    subtitle: 'Prepare infrastructure for growth',
    tasks: [
      {
        title: 'Draft employment contract template + onboarding checklist',
        description: 'Prepare a standard employment contract template and onboarding checklist for future TCS hires. Ensure compliance with Fair Work requirements.',
        priority: 'high',
      },
      {
        title: 'Calculate per-job profitability after all expenses',
        description: 'Analyse each venue contract to determine true profitability after fuel, supplies, time, insurance, and overhead costs. Build a profitability spreadsheet.',
        priority: 'high',
      },
      {
        title: 'Optimize Google Business Profile for "commercial cleaning Melbourne"',
        description: 'Update Google Business Profile with targeted keywords, photos, service areas, and collect client reviews to improve local search ranking.',
        priority: 'medium',
      },
      {
        title: 'Map hiring timeline for overnight shift transition',
        description: 'Plan the hiring roadmap to transition overnight cleaning shifts from owner-operator to employee. Include recruitment timeline, training period, and handover schedule.',
        priority: 'high',
      },
    ],
  },
];

// ─── Seeder ─────────────────────────────────────────────────────

/**
 * Seeds the TCS 90-Day Growth Plan as goals + tasks.
 * Idempotent — if the parent goal already exists, does nothing.
 */
export async function seedTCSGrowthPlan(userId: string): Promise<void> {
  // Check if plan already exists
  const { data: existing } = await supabase
    .from('goals')
    .select('id')
    .eq('user_id', userId)
    .eq('title', 'TCS 90-Day Growth Plan')
    .eq('is_deleted', false)
    .limit(1);

  if (existing && existing.length > 0) {
    // Plan already seeded — don't duplicate
    return;
  }

  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + 90);
  const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

  // Create parent goal
  const parentId = genId();
  const { error: parentError } = await supabase.from('goals').insert({
    id: parentId,
    user_id: userId,
    title: 'TCS 90-Day Growth Plan',
    description: 'Structured 90-day growth plan: Stabilize (Month 1), Grow (Month 2), Scale Prep (Month 3)',
    status: 'active',
    domain: 'financial',
    category: 'growth-plan',
    parent_goal_id: null,
    target_date: targetDateStr,
    is_deleted: false,
    created_at: now.toISOString(),
  });

  if (parentError) {
    console.error('[tcs-growth-seed] Failed to create parent goal:', parentError);
    return;
  }

  // Create sub-goals and tasks for each month
  for (let mi = 0; mi < GROWTH_PLAN.length; mi++) {
    const month = GROWTH_PLAN[mi];
    const monthNumber = mi + 1;

    // Sub-goal target date: monthNumber * 30 days from now
    const monthTargetDate = new Date(now);
    monthTargetDate.setDate(monthTargetDate.getDate() + monthNumber * 30);
    const monthTargetStr = monthTargetDate.toISOString().split('T')[0];

    const subGoalId = genId();
    const { error: subError } = await supabase.from('goals').insert({
      id: subGoalId,
      user_id: userId,
      title: month.title,
      description: month.subtitle,
      status: 'active',
      domain: 'financial',
      category: 'growth-milestone',
      parent_goal_id: parentId,
      target_date: monthTargetStr,
      is_deleted: false,
      created_at: now.toISOString(),
    });

    if (subError) {
      console.error(`[tcs-growth-seed] Failed to create Month ${monthNumber} sub-goal:`, subError);
      continue;
    }

    // Create tasks under this sub-goal
    const tasks = month.tasks.map((task, ti) => ({
      id: genId(),
      user_id: userId,
      goal_id: subGoalId,
      title: task.title,
      description: task.description,
      status: 'todo' as const,
      priority: task.priority,
      is_deleted: false,
      created_at: now.toISOString(),
    }));

    const { error: tasksError } = await supabase.from('tasks').insert(tasks);

    if (tasksError) {
      console.error(`[tcs-growth-seed] Failed to insert tasks for Month ${monthNumber}:`, tasksError);
    }
  }
}