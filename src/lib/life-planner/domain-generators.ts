/**
 * Domain Generators — Extensible content generators for life domains
 *
 * Each domain has a generator that produces ScheduleableItems.
 * Currently scaffolded for: exercise, nutrition, education, maintenance.
 * Actual LLM prompts and domain logic will be added in future prompts.
 */

import type { DecomposedHierarchy } from '../llm/objective-decomposer';
import type { LifeDomain, ScheduleableItem } from './types';
import { logger } from '../../utils/logger';

type DomainGenerator = (hierarchy: DecomposedHierarchy) => Promise<ScheduleableItem[]>;

const DOMAIN_GENERATORS: Partial<Record<LifeDomain, DomainGenerator>> = {
  exercise: generateExerciseSchedule,
  nutrition: generateMealPlan,
  education: generateStudySchedule,
  maintenance: generateMaintenanceSchedule,
};

/**
 * Generate domain-specific scheduleable content based on detected domains.
 * If no domains are specified, auto-detects from the hierarchy.
 */
export async function generateDomainContent(
  hierarchy: DecomposedHierarchy,
  requestedDomains: LifeDomain[],
): Promise<ScheduleableItem[]> {
  // Auto-detect domains from hierarchy if none specified
  const domains = requestedDomains.length > 0
    ? requestedDomains
    : detectDomains(hierarchy);

  const items: ScheduleableItem[] = [];

  for (const domain of domains) {
    const generator = DOMAIN_GENERATORS[domain];
    if (!generator) continue;

    try {
      const generated = await generator(hierarchy);
      items.push(...generated);
      logger.log(`[domain-generators] Generated ${generated.length} ${domain} items`);
    } catch (e) {
      logger.warn(`[domain-generators] ${domain} generation failed:`, e);
    }
  }

  return items;
}

/** Detect relevant domains from the hierarchy's content */
function detectDomains(hierarchy: DecomposedHierarchy): LifeDomain[] {
  const domains: LifeDomain[] = [];
  const text = [
    hierarchy.objective.title,
    hierarchy.objective.description,
    ...hierarchy.epics.flatMap(e => [
      e.title,
      ...e.goals.flatMap(g => [g.title, ...g.tasks.map(t => t.title)]),
    ]),
  ].join(' ').toLowerCase();

  if (/exercis|workout|gym|run|lift|cardio|strength|fitness|marathon/.test(text)) {
    domains.push('exercise');
  }
  if (/diet|meal|nutrition|eat|food|protein|calorie|weight loss/.test(text)) {
    domains.push('nutrition');
  }
  if (/study|learn|course|exam|read|practice|certification|language/.test(text)) {
    domains.push('education');
  }
  if (/maintain|service|repair|clean|inspect|car|house|plumb/.test(text)) {
    domains.push('maintenance');
  }

  return domains;
}

// ── Domain Generators (scaffolded — LLM integration in future prompts) ──

async function generateExerciseSchedule(hierarchy: DecomposedHierarchy): Promise<ScheduleableItem[]> {
  // Future: import { generateAIWorkout } from '../llm/workout-ai' and adapt output
  // For now, generate sensible defaults based on hierarchy domain

  const items: ScheduleableItem[] = [];
  const objectiveDomain = hierarchy.objective.domain;

  // Only generate if the objective is fitness-related
  if (!objectiveDomain || !['exercise', 'health'].includes(objectiveDomain)) {
    return items;
  }

  // Default 3-day/week routine
  const workoutDays = [1, 3, 5]; // Mon, Wed, Fri
  items.push({
    id: `exercise-routine-${Date.now()}`,
    title: 'Workout Session',
    domain: 'exercise',
    durationMinutes: 45,
    priority: 'medium',
    preferredTimeOfDay: 'morning',
    recurrence: {
      frequency: 'weekly',
      daysOfWeek: workoutDays,
    },
  });

  return items;
}

async function generateMealPlan(_hierarchy: DecomposedHierarchy): Promise<ScheduleableItem[]> {
  // Future: LLM generates personalized meal plans
  // Scaffold: 3 daily meals at standard times
  return [
    {
      id: `meal-breakfast-${Date.now()}`,
      title: 'Breakfast',
      domain: 'nutrition',
      durationMinutes: 30,
      priority: 'medium',
      preferredTimeOfDay: 'morning',
      recurrence: { frequency: 'daily' },
    },
    {
      id: `meal-lunch-${Date.now()}`,
      title: 'Lunch',
      domain: 'nutrition',
      durationMinutes: 30,
      priority: 'medium',
      preferredTimeOfDay: 'afternoon',
      recurrence: { frequency: 'daily' },
    },
    {
      id: `meal-dinner-${Date.now()}`,
      title: 'Dinner',
      domain: 'nutrition',
      durationMinutes: 30,
      priority: 'medium',
      preferredTimeOfDay: 'evening',
      recurrence: { frequency: 'daily' },
    },
  ];
}

async function generateStudySchedule(hierarchy: DecomposedHierarchy): Promise<ScheduleableItem[]> {
  // Future: spaced repetition, progressive difficulty
  // Scaffold: daily study block aligned with objective timeline

  const items: ScheduleableItem[] = [];
  const objectiveDomain = hierarchy.objective.domain;

  if (!objectiveDomain || objectiveDomain !== 'education') {
    return items;
  }

  items.push({
    id: `study-daily-${Date.now()}`,
    title: `Study: ${hierarchy.objective.title}`,
    domain: 'education',
    durationMinutes: 60,
    priority: 'high',
    preferredTimeOfDay: 'morning',
    recurrence: {
      frequency: 'daily',
      daysOfWeek: [1, 2, 3, 4, 5], // Weekdays
    },
  });

  return items;
}

async function generateMaintenanceSchedule(_hierarchy: DecomposedHierarchy): Promise<ScheduleableItem[]> {
  // Future: based on user's assets/vehicles/property from inventory
  // Scaffold: empty — maintenance items are too personal to generate without context
  return [];
}
