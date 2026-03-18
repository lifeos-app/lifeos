/**
 * Goal→Task Auto-Generation Engine
 * 
 * Uses LLM to suggest actionable tasks from a goal.
 * Includes fallback for when LLM is unavailable.
 */

import { callLLMJson } from './llm-proxy';
import { getErrorMessage } from '../utils/error';
import { logger } from '../utils/logger';

export interface GeneratedTask {
  title: string;
  priority: string;
  estimated_minutes: number;
  suggested_week?: number;
}

/**
 * Generate 3-5 actionable tasks from a goal using LLM.
 * Falls back to template-based decomposition if LLM fails.
 */
export async function generateTasksFromGoal(
  goalId: string,
  goalTitle: string,
  goalDescription: string | null
): Promise<GeneratedTask[]> {
  try {
    // Try LLM first
    const prompt = `You are a productivity assistant helping break down a goal into actionable tasks.

Goal: ${goalTitle}
${goalDescription ? `Description: ${goalDescription}` : ''}

Generate 3-5 specific, actionable tasks to achieve this goal. Each task should:
- Be concrete and doable in a single session
- Have a clear completion criteria
- Be ordered logically (first things first)

For each task, provide:
1. Title (clear, action-oriented)
2. Priority (critical/high/medium/low)
3. Estimated minutes (realistic time estimate)
4. Suggested week (1=this week, 2=next week, etc.) — distribute tasks across weeks

Return ONLY a JSON array in this exact format:
[
  { "title": "Research X", "priority": "high", "estimated_minutes": 60, "suggested_week": 1 },
  { "title": "Draft Y", "priority": "medium", "estimated_minutes": 90, "suggested_week": 2 }
]

No markdown, no explanation, just the JSON array.`;

    const tasks = await callLLMJson<GeneratedTask[]>(prompt, { timeoutMs: 15000 });
    
    // Validate structure
    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('Invalid response format');
    }
    
    // Normalize and validate each task
    return tasks.slice(0, 5).map((t: any) => ({
      title: String(t.title || '').trim(),
      priority: ['critical', 'high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium',
      estimated_minutes: Math.max(15, Math.min(480, parseInt(t.estimated_minutes) || 60)),
      suggested_week: t.suggested_week ? Math.max(1, Math.min(12, parseInt(t.suggested_week))) : undefined,
    })).filter(t => t.title.length > 0);

  } catch (err) {
    logger.warn('[goal-task-engine] LLM generation failed, using fallback:', getErrorMessage(err));
    return fallbackTaskGeneration(goalTitle, goalDescription);
  }
}

/**
 * Fallback: Simple template-based task decomposition
 */
function fallbackTaskGeneration(goalTitle: string, goalDescription: string | null): GeneratedTask[] {
  const tasks: GeneratedTask[] = [];
  
  // Extract keywords to make tasks more contextual
  const keywords = goalTitle.toLowerCase();
  
  // Research phase
  if (!keywords.includes('research') && !keywords.includes('study')) {
    tasks.push({
      title: `Research and plan: ${goalTitle}`,
      priority: 'high',
      estimated_minutes: 60,
    });
  }
  
  // Action phase - try to infer from common patterns
  if (keywords.includes('learn') || keywords.includes('study')) {
    tasks.push(
      { title: `Create study plan for ${goalTitle}`, priority: 'high', estimated_minutes: 45 },
      { title: `Complete first learning session`, priority: 'medium', estimated_minutes: 90 },
      { title: `Practice and review concepts`, priority: 'medium', estimated_minutes: 60 }
    );
  } else if (keywords.includes('build') || keywords.includes('create') || keywords.includes('develop')) {
    tasks.push(
      { title: `Design and outline ${goalTitle}`, priority: 'high', estimated_minutes: 60 },
      { title: `Build initial version`, priority: 'high', estimated_minutes: 120 },
      { title: `Test and refine`, priority: 'medium', estimated_minutes: 60 }
    );
  } else if (keywords.includes('write') || keywords.includes('document')) {
    tasks.push(
      { title: `Outline structure for ${goalTitle}`, priority: 'high', estimated_minutes: 45 },
      { title: `Write first draft`, priority: 'medium', estimated_minutes: 90 },
      { title: `Review and edit`, priority: 'medium', estimated_minutes: 60 }
    );
  } else {
    // Generic decomposition
    tasks.push(
      { title: `Break down ${goalTitle} into steps`, priority: 'high', estimated_minutes: 30 },
      { title: `Start first milestone`, priority: 'medium', estimated_minutes: 90 },
      { title: `Review progress and adjust plan`, priority: 'low', estimated_minutes: 30 }
    );
  }
  
  // Review/completion phase
  tasks.push({
    title: `Complete and verify ${goalTitle}`,
    priority: 'medium',
    estimated_minutes: 45,
  });
  
  return tasks.slice(0, 5);
}
