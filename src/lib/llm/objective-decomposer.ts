/**
 * NLP Objective Decomposer — WS1
 *
 * Takes natural language input and generates a full goal hierarchy:
 * Objective > Epics > Goals > Tasks
 *
 * Uses LLM (via llm-proxy) with structured JSON output.
 * Falls back to a skeleton hierarchy if LLM is unavailable.
 */

import { callLLMJson } from '../llm-proxy';
import { logger } from '../../utils/logger';

// ── Types ──

export interface DecomposedTask {
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedMinutes: number;
  suggestedWeek: number;
  dependsOnIndex?: number;
  domain?: string;
}

export interface DecomposedGoal {
  title: string;
  description: string;
  icon?: string;
  targetDate: string | null;
  tasks: DecomposedTask[];
}

export interface DecomposedEpic {
  title: string;
  description: string;
  icon?: string;
  goals: DecomposedGoal[];
}

export interface DecomposedHierarchy {
  objective: {
    title: string;
    description: string;
    icon?: string;
    targetDate: string | null;
    domain: string;
  };
  epics: DecomposedEpic[];
}

// ── Limits ──

const MAX_EPICS = 4;
const MAX_GOALS_PER_EPIC = 5;
const MAX_TASKS_PER_GOAL = 7;

// ── Main Export ──

export async function decomposeObjective(
  input: string,
  existingObjectives: string[],
  currentDate: string,
): Promise<DecomposedHierarchy> {
  try {
    const existingCtx = existingObjectives.length > 0
      ? `\nThe user already has these objectives (avoid duplicating): ${existingObjectives.join(', ')}`
      : '';

    const prompt = `You are a strategic planning assistant. The user wants to achieve something. Break it down into a structured hierarchy.

User's vision: "${input}"
Today's date: ${currentDate}${existingCtx}

Generate a complete plan as a JSON object with this exact structure:
{
  "objective": {
    "title": "Clear, concise objective title",
    "description": "1-2 sentence description of the overall objective",
    "icon": "single emoji",
    "targetDate": "YYYY-MM-DD or null if open-ended",
    "domain": "one of: work, education, health, financial, personal, creative"
  },
  "epics": [
    {
      "title": "Epic title (major phase/pillar)",
      "description": "Brief description",
      "icon": "single emoji",
      "goals": [
        {
          "title": "Specific goal",
          "description": "Brief description",
          "icon": "single emoji",
          "targetDate": "YYYY-MM-DD or null",
          "tasks": [
            {
              "title": "Actionable task (doable in one session)",
              "priority": "high",
              "estimatedMinutes": 60,
              "suggestedWeek": 1,
              "dependsOnIndex": null,
              "domain": "work"
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- Max 4 epics, max 5 goals per epic, max 7 tasks per goal
- Tasks should be concrete and completable in a single session (15-180 minutes)
- suggestedWeek is a week offset from now (1 = this week, 2 = next week, etc., up to 52)
- CRITICAL: Spread tasks across the FULL timeline of the objective. A 6-month goal should have tasks spread across weeks 1-26, not crammed into weeks 1-4. Use the target date to determine the span. Only 1-2 tasks per week is ideal — space them out generously.
- dependsOnIndex is the 0-based index of another task in the same goal that must be done first (null if none)
- Priority: critical (blocking), high (important), medium (normal), low (nice-to-have)
- domain: work, education, health, financial, personal, creative
- Set realistic target dates based on scope (small goals: 2-4 weeks, medium: 1-3 months, large: 3-12 months)

Return ONLY the JSON object, no explanation.`;

    const raw = await callLLMJson<any>(prompt, { timeoutMs: 25000 });
    return validateAndSanitize(raw, input);
  } catch (err) {
    logger.warn('[objective-decomposer] LLM failed, using fallback:', err);
    return buildFallbackHierarchy(input, currentDate);
  }
}

// ── Validation ──

function validateAndSanitize(raw: any, originalInput: string): DecomposedHierarchy {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid response: not an object');
  }

  const obj = raw.objective;
  if (!obj || !obj.title) {
    throw new Error('Invalid response: missing objective');
  }

  const validDomains = ['work', 'education', 'health', 'financial', 'personal', 'creative'];
  const validPriorities = ['low', 'medium', 'high', 'urgent', 'critical'];

  const objective = {
    title: String(obj.title).trim().slice(0, 200),
    description: String(obj.description || '').trim().slice(0, 500),
    icon: sanitizeIcon(obj.icon),
    targetDate: sanitizeDate(obj.targetDate),
    domain: validDomains.includes(obj.domain) ? obj.domain : 'personal',
  };

  const epics: DecomposedEpic[] = [];
  const rawEpics = Array.isArray(raw.epics) ? raw.epics.slice(0, MAX_EPICS) : [];

  for (const re of rawEpics) {
    if (!re || !re.title) continue;

    const goals: DecomposedGoal[] = [];
    const rawGoals = Array.isArray(re.goals) ? re.goals.slice(0, MAX_GOALS_PER_EPIC) : [];

    for (const rg of rawGoals) {
      if (!rg || !rg.title) continue;

      const tasks: DecomposedTask[] = [];
      const rawTasks = Array.isArray(rg.tasks) ? rg.tasks.slice(0, MAX_TASKS_PER_GOAL) : [];

      for (const rt of rawTasks) {
        if (!rt || !rt.title) continue;

        const priority = validPriorities.includes(rt.priority) ? rt.priority : 'medium';
        tasks.push({
          title: String(rt.title).trim().slice(0, 200),
          priority: priority === 'critical' ? 'urgent' : priority as DecomposedTask['priority'],
          estimatedMinutes: Math.max(15, Math.min(480, parseInt(rt.estimatedMinutes) || 60)),
          suggestedWeek: Math.max(1, Math.min(52, parseInt(rt.suggestedWeek) || 1)),
          dependsOnIndex: typeof rt.dependsOnIndex === 'number' && rt.dependsOnIndex >= 0 && rt.dependsOnIndex < rawTasks.indexOf(rt)
            ? rt.dependsOnIndex : undefined,
          domain: validDomains.includes(rt.domain) ? rt.domain : objective.domain,
        });
      }

      goals.push({
        title: String(rg.title).trim().slice(0, 200),
        description: String(rg.description || '').trim().slice(0, 500),
        icon: sanitizeIcon(rg.icon),
        targetDate: sanitizeDate(rg.targetDate),
        tasks,
      });
    }

    epics.push({
      title: String(re.title).trim().slice(0, 200),
      description: String(re.description || '').trim().slice(0, 500),
      icon: sanitizeIcon(re.icon),
      goals,
    });
  }

  if (epics.length === 0) {
    throw new Error('No valid epics generated');
  }

  return { objective, epics };
}

function sanitizeIcon(icon: any): string {
  if (!icon || typeof icon !== 'string') return '🎯';
  // Take first emoji character (handles multi-codepoint emoji)
  const match = String(icon).match(/\p{Extended_Pictographic}/u);
  return match ? match[0] : '🎯';
}

function sanitizeDate(date: any): string | null {
  if (!date || date === 'null') return null;
  const str = String(date).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return null;
}

// ── Fallback ──

function buildFallbackHierarchy(input: string, currentDate: string): DecomposedHierarchy {
  const targetDate = new Date(currentDate);
  targetDate.setMonth(targetDate.getMonth() + 3);
  const target = targetDate.toISOString().split('T')[0];

  return {
    objective: {
      title: input.slice(0, 200),
      description: `Achieve: ${input}`,
      icon: '🎯',
      targetDate: target,
      domain: 'personal',
    },
    epics: [
      {
        title: 'Planning & Research',
        description: 'Lay the groundwork',
        icon: '📋',
        goals: [
          {
            title: `Research: ${input.slice(0, 100)}`,
            description: 'Gather information and create a plan',
            icon: '🔍',
            targetDate: null,
            tasks: [
              { title: 'Research requirements and best practices', priority: 'high', estimatedMinutes: 60, suggestedWeek: 1, domain: 'personal' },
              { title: 'Create detailed action plan', priority: 'high', estimatedMinutes: 45, suggestedWeek: 1, dependsOnIndex: 0, domain: 'personal' },
              { title: 'Identify resources and tools needed', priority: 'medium', estimatedMinutes: 30, suggestedWeek: 2, domain: 'personal' },
            ],
          },
        ],
      },
      {
        title: 'Execution',
        description: 'Do the work',
        icon: '🚀',
        goals: [
          {
            title: `Execute: ${input.slice(0, 100)}`,
            description: 'Take action on the plan',
            icon: '⚡',
            targetDate: target,
            tasks: [
              { title: 'Complete first milestone', priority: 'high', estimatedMinutes: 90, suggestedWeek: 2, domain: 'personal' },
              { title: 'Review progress and adjust', priority: 'medium', estimatedMinutes: 30, suggestedWeek: 3, dependsOnIndex: 0, domain: 'personal' },
              { title: 'Complete remaining milestones', priority: 'medium', estimatedMinutes: 120, suggestedWeek: 4, dependsOnIndex: 1, domain: 'personal' },
            ],
          },
        ],
      },
    ],
  };
}

// ── Helpers ──

/** Count total items in a hierarchy */
export function countHierarchyItems(h: DecomposedHierarchy, excludedPaths?: Set<string>): { goals: number; tasks: number } {
  let goals = 0;
  let tasks = 0;

  for (let ei = 0; ei < h.epics.length; ei++) {
    const epicPath = `epic-${ei}`;
    if (excludedPaths?.has(epicPath)) continue;

    for (let gi = 0; gi < h.epics[ei].goals.length; gi++) {
      const goalPath = `${epicPath}.goal-${gi}`;
      if (excludedPaths?.has(goalPath)) continue;
      goals++;

      for (let ti = 0; ti < h.epics[ei].goals[gi].tasks.length; ti++) {
        const taskPath = `${goalPath}.task-${ti}`;
        if (excludedPaths?.has(taskPath)) continue;
        tasks++;
      }
    }
  }

  // +1 for each epic, +1 for objective
  goals += h.epics.filter((_, i) => !excludedPaths?.has(`epic-${i}`)).length + 1;

  return { goals, tasks };
}
