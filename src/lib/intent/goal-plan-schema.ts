/**
 * LifeOS Intent Engine — Goal Plan Prompt Schema
 *
 * The goal_plan action type schema and rules for the LLM system prompt.
 * Extracted to keep prompt-schemas.ts manageable.
 */

import type { IntentContext } from './types';

export function buildGoalPlanSchema(ctx: IntentContext): string {
  return `### type: "goal_plan"
USE THIS when the user describes something they want to ACHIEVE — a goal, ambition, project, or life change.
This creates a FULL HIERARCHY: objective (if needed) → epic → goals → tasks + habits.

**WHEN TO USE goal_plan:**
- "I want to get fit in 2 months" → goal_plan (NOT a single task or habit)
- "I want to learn electronics" → goal_plan
- "Help me save $5000 by December" → goal_plan
- "I want to read 20 books this year" → goal_plan
- "Get 8hr sleep 10 days in a row" → goal_plan (this is a goal with tracking, not just a habit)
- ANY multi-step ambition that needs structure → goal_plan

**INTAKE PHASE (REQUIRED before creating a goal_plan):**
Before outputting a goal_plan action, you MUST have ALL of:
1. Timeline / target date (when to achieve this?)
2. Weekly time commitment (how many hours/week?)
3. Budget (if relevant — ask "Does this have a budget?")

If ANY are missing: set actions to [] (empty), ask the questions in "reply",
set follow_up to summarize what you still need. On the next message when the
user answers, THEN create the full goal_plan.

**WHEN NOT TO USE goal_plan:**
- "Work out every Tue/Thu/Sat at 6am for a month" → **recurring_event** (NOT goal_plan). Repeated schedule slots = recurring_event.
- "Go for a run every day this week" → **recurring_event** with days [0,1,2,3,4,5,6] until end of week (NOT goal_plan, NOT 7 tasks).
- "Shopping every Sunday at 11am" → **recurring_event** (NOT goal_plan).
- "Go for a run" or "Do push-ups" → single task for today. Don't overthink it.
- "Add milk to grocery list" → grocery_add (simple action)
- "Remind me to call mum" → task (single action)
- "Log 7 hours sleep" → health_log (recording data)
- "Track my push-ups daily" → habit (single recurring action, NOT goal_plan)
- ANY simple repeated action for a short period → multiple tasks, NOT goal_plan

**HIERARCHY RULES (STRICT TREE — NO ORPHANS):**
1. The tree is: Objective → Epic → Goal → Task. EVERY level must have a parent. No orphan epics, no orphan goals.
2. Check EXISTING objectives first — if one matches the domain (e.g., "Health & Fitness"), use its ID as parent
3. If no matching objective exists, create one in the plan
4. Every plan MUST have: 1 objective (existing or new) → 1 epic → 1-3 goals → 2-5 tasks per goal
5. Tasks ONLY link to goals (the lowest goal level), NEVER to epics or objectives directly
6. Add habits when the goal involves recurring behaviour (exercise, sleep, reading, etc.)
7. Spread tasks across the timeline — don't bunch everything at the start
8. Be SPECIFIC with tasks — "Do 20 push-ups, 20 squats, 20 sit-ups" not "Exercise"
9. Only standalone tasks (type "task") can exist without a goal. goal_plan tasks are ALWAYS under a goal.

{
  "user_id": "${ctx.userId}",
  "intake": {
    "weekly_hours": "number (hours per week user committed)",
    "budget": "number|null",
    "target_date": "YYYY-MM-DD"
  },
  "objective": {
    "existing_id": "UUID of existing objective to nest under, or null to create new",
    "title": "string (e.g., 'Health & Fitness Excellence')",
    "domain": "Health & Fitness | Education / Learning | Career / Business | Finances | Relationships | Travel / Adventure | Spirituality | Home / Physical Environment",
    "icon": "emoji",
    "color": "#hex"
  },
  "epic": {
    "title": "string (e.g., 'Get Super Fit')",
    "description": "what success looks like",
    "target_date": "YYYY-MM-DD"
  },
  "goals": [
    {
      "title": "string (e.g., 'Build Daily Workout Routine')",
      "description": "string",
      "target_date": "YYYY-MM-DD",
      "priority": "high | medium | low",
      "tasks": [
        {
          "title": "string (SPECIFIC and ACTIONABLE)",
          "description": "string with details",
          "due_date": "YYYY-MM-DD",
          "priority": "high | medium | low",
          "estimated_minutes": number,
          "suggested_week": number // 1=this week, 2=next week, etc. Distribute tasks across weeks
        }
      ]
    }
  ],
  "habits": [
    {
      "title": "string",
      "description": "why this habit matters for the goal",
      "frequency": "daily | weekdays | weekly | 3x_week",
      "icon": "emoji",
      "category": "Health | Fitness | Learning | Finance | Mindfulness | Other"
    }
  ]
}

**GOAL NAMING — BE SPECIFIC, NOT GENERIC:**
- NEVER use generic template names like "Research Phase", "Build Phase", "Review Phase" for every goal
- Each goal title must be SPECIFIC to what the user wants to achieve
- BAD: "Research fitness", "Build fitness routine", "Review fitness progress" (generic template repeated for every plan)
- GOOD: "Master 5 compound lifts", "Hit 100 push-ups in one set", "Run 5km under 25 minutes"
- If the plan genuinely has research/build/review phases, name them specifically: "Research local gyms and compare prices", "Complete Couch-to-5K program", "Run a timed 5K and log results"
- The test: if you could swap the goal title into any other plan and it would still make sense, it's too generic. Rewrite it.

**TEMPORAL REASONING:**
- "2 months" from today (${ctx.today}) = calculate the actual date
- Break into phases: Week 1-2 (foundation), Week 3-4 (build), Week 5-6 (intensify), Week 7-8 (peak)
- First task should be within 3 days, others spread across the timeline
- Milestones at 25%, 50%, 75% of the way through

**CROSS-DOMAIN THINKING:**
- Fitness goal → also suggest: health tracking habits (weight, mood), meal/nutrition habits, sleep habits
- Financial goal → also suggest: expense tracking habit, budget review tasks
- Learning goal → also suggest: study schedule tasks, reading habits, practice tasks
- Think holistically: what else in the user's life supports this goal?`;
}