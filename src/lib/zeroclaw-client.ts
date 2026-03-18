/**
 * ZeroClaw Agent Client — v3 (LLM Proxy)
 *
 * Routes all LLM calls through the existing /api/llm-proxy.php proxy.
 * No separate ZeroClaw server — it's all client-side logic + the LLM proxy.
 */

import { callLLMProxy } from './llm-proxy';
import { buildUserContext, contextToPrompt, contextSubset, contextForPage } from './zeroclaw-context';
import { localDateStr } from '../utils/date';

// ─── Types (unchanged — all consumers depend on these shapes) ────

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AgentChatRequest {
  userId: string;
  message: string;
  context?: {
    currentPage?: string;
    selectedDate?: string;
    activeGoalId?: string;
    recentEvents?: string[];
  };
  conversationHistory?: AgentMessage[];
  stream?: boolean;
}

export interface AgentChatResponse {
  message: string;
  actions?: AgentAction[];
  memory?: { key: string; value: string }[];
  toolsUsed?: string[];
  thinking?: string;
  tokensUsed?: number;
}

export interface AgentAction {
  type: 'create_task' | 'complete_task' | 'create_event' | 'update_goal' | 'log_habit' | 'nudge' | 'navigate'
    | 'decompose_objective' | 'create_habit' | 'create_goal' | 'start_focus' | 'reschedule_overdue'
    | 'log_income' | 'log_expense' | 'log_activity' | 'log_mood' | 'log_health' | 'quick_journal';
  payload: Record<string, unknown>;
  label: string;
  requiresConfirm: boolean;
}

export interface AgentInsightRequest {
  userId: string;
  type: 'daily_brief' | 'goal_analysis' | 'habit_check' | 'schedule_optimize' | 'weekly_review' | 'bottleneck_scan';
}

export interface AgentInsight {
  type: string;
  title: string;
  summary: string;
  details: string;
  actions?: AgentAction[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  generatedAt: string;
}

// ─── System prompt ───────────────────────────────────────────────

const ZEROCLAW_SYSTEM_PROMPT = `You are ZeroClaw, a proactive AI life coach inside LifeOS — a personal productivity OS.

Personality: Direct, encouraging, strategic. No fluff. Speak like a coach who genuinely cares about the user's progress.

You help users with:
- Goal planning and progress check-ins
- Task prioritization and scheduling
- Habit tracking and streak building
- Time management and focus
- Weekly reviews and reflection

Guidelines:
- Keep responses concise (2-4 sentences for quick questions, more for planning)
- Be specific and actionable — say what to do, not just what to think about
- You have access to the user's real-time data below. Reference it naturally and specifically.
- Reference the user's actual data when available (goals, tasks, habits, streaks, health)
- Celebrate wins, but push for next steps
- If asked about something outside your scope, redirect to what you can help with
- You are speaking directly to the user in natural conversation. Begin your response immediately — no preambles, no formatting wrappers. Write naturally as if talking to them.

When the user asks you to take an action (scheduling, creating tasks/events/habits, logging, etc.), you MUST include an action hint on its own line at the END of your response. This is REQUIRED for the action to actually happen — without the [ACTION:...] line, nothing gets saved.

Format: [ACTION:type key="value" key2="value2"]

Available actions:
[ACTION:create_event title="Event title" startTime="2026-01-01T09:00:00+11:00" endTime="2026-01-01T10:00:00+11:00"]
[ACTION:create_task title="Task title" priority="medium"]
[ACTION:complete_task taskId="id"]
[ACTION:update_goal goalId="id" progress=0.5]
[ACTION:log_habit habitId="id" date="2026-01-01"]
[ACTION:navigate path="/goals"]
[ACTION:decompose_objective goal_id="GOAL_ID"]
[ACTION:create_habit name="Habit Name" frequency="daily" icon="💪"]
[ACTION:create_goal title="Goal Title" category="health" target_date="2026-06-01"]
[ACTION:start_focus task_id="TASK_ID" duration_minutes="25"]
[ACTION:reschedule_overdue]
[ACTION:log_income amount="150" source="Freelance work" date="2026-03-10"]
[ACTION:log_expense amount="80" category="fuel" description="Petrol" date="2026-03-10"]
[ACTION:log_activity activity="Deep cleaning" category="work" notes="Office building" date="2026-03-10"]
[ACTION:log_mood mood="good" notes="Productive day"]
[ACTION:log_health metric="energy" value="4"]
[ACTION:log_health metric="water" value="6"]
[ACTION:quick_journal entry="Had a breakthrough on the RPG system design" mood="great"]

Use these logging actions when the user wants to track:
- Income (log_income): Record income with amount, optional source and date
- Expenses (log_expense): Log spending with amount, category/description and date
- Activities (log_activity): Track what you did with category and notes
- Mood (log_mood): Record how you're feeling (great/good/neutral/bad/terrible/tired/stressed)
- Health metrics (log_health): Track energy (1-5), water glasses, sleep hours, stress (1-5), weight, exercise minutes
- Quick journal (quick_journal): Fast journal entry with optional mood

CRITICAL RULES:
- EVERY scheduling/creation request MUST have an [ACTION:...] line. No exceptions.
- Use ISO 8601 datetime with timezone for startTime/endTime (e.g., 2026-03-07T14:00:00+11:00)
- Even if you've created similar events before in this conversation, ALWAYS include the [ACTION:...] line for each new request.
- Do NOT use [Actions: ...] or any other format. ONLY [ACTION:type key="value"] works.
- If unsure whether the user wants an action, include it — they can decline.`;

// ─── Internal helpers ────────────────────────────────────────────

function buildMessages(request: AgentChatRequest, userContextStr?: string): { role: string; content: string }[] {
  const messages: { role: string; content: string }[] = [];

  // 1. System prompt
  messages.push({ role: 'system', content: ZEROCLAW_SYSTEM_PROMPT });

  // 2. Rich user context (from context engine)
  if (userContextStr) {
    messages.push({ role: 'system', content: 'User\'s current state:\n' + userContextStr });
  }

  // 3. Page-level context
  if (request.context) {
    const ctxParts: string[] = [];
    if (request.context.currentPage) ctxParts.push(`User is on: ${request.context.currentPage}`);
    if (request.context.selectedDate) ctxParts.push(`Selected date: ${request.context.selectedDate}`);
    if (request.context.activeGoalId) ctxParts.push(`Active goal ID: ${request.context.activeGoalId}`);
    if (request.context.recentEvents?.length) {
      ctxParts.push(`Recent events: ${request.context.recentEvents.join(', ')}`);
    }
    if (ctxParts.length > 0) {
      messages.push({ role: 'system', content: ctxParts.join('. ') });
    }
  }

  // 4. Conversation history
  if (request.conversationHistory?.length) {
    for (const msg of request.conversationHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // 5. Current user message
  messages.push({ role: 'user', content: request.message });
  return messages;
}

// ─── Health check ────────────────────────────────────────────────
// LLM proxy is always available (same server as the app).
export async function agentHealthCheck(): Promise<boolean> {
  return true;
}

// ─── Chat ────────────────────────────────────────────────────────
export async function agentChat(request: AgentChatRequest): Promise<AgentChatResponse> {
  let ctxStr: string | undefined;
  try {
    const ctx = await buildUserContext();
    ctxStr = contextForPage(ctx, request.context?.currentPage);
  } catch {
    // Context engine failed — proceed without it
  }

  // Add time-of-day awareness
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  const dayStr = now.toLocaleDateString('en-AU', { weekday: 'long' });
  const timeContext = `Current time: ${timeStr}, ${dayStr}`;
  ctxStr = timeContext + (ctxStr ? '\n' + ctxStr : '');
  const messages = buildMessages(request, ctxStr);
  const res = await callLLMProxy(messages, { timeoutMs: 25000 });
  // Strip JSON wrapper if LLM accidentally wraps response
  let text = res.content;
  try {
    if (text.trim().startsWith('{')) {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'object' && parsed !== null) {
        // Extract first string value from any key (response, status, message, reply, text, etc.)
        const val = Object.values(parsed).find(v => typeof v === 'string');
        if (val) text = val as string;
      }
    } else if (typeof text === 'string' && text.trim().startsWith('"')) {
      text = JSON.parse(text);
    }
  } catch { /* not JSON, use as-is */ }

  // Parse action hints from response
  let actions = parseActions(text);

  // ── Fallback: if LLM confirmed an action but didn't include [ACTION:...] ──
  // Detect "I've scheduled/added/created X" with no parsed actions
  if (actions.length === 0 && request.message) {
    const rescueAction = rescueActionFromContext(text, request.message, request.context?.currentPage);
    if (rescueAction) {
      actions = [rescueAction];
    }
  }

  // Remove action lines from displayed text
  const cleanText = text
    .replace(/\[ACTION:[^\]]+\]\s*/g, '')
    .replace(/\[Actions?:[^\]]*\]\s*/g, '') // Also strip the fake [Actions: ...] decoration
    .trim();

  return {
    message: cleanText,
    actions,
    toolsUsed: [],
    thinking: undefined,
    tokensUsed: (res.usage?.input_tokens || 0) + (res.usage?.output_tokens || 0) || undefined,
  };
}

// ─── Streaming chat (non-streaming fallback via proxy) ───────────
// The LLM proxy doesn't support streaming. We call agentChat() then
// deliver the full response through onChunk + onDone.
export function agentChatStream(
  request: AgentChatRequest,
  onChunk: (text: string) => void,
  onDone: (response: AgentChatResponse) => void,
  onError: (error: Error) => void,
): AbortController {
  const controller = new AbortController();

  agentChat(request)
    .then(response => {
      if (controller.signal.aborted) return;
      onChunk(response.message);
      onDone(response);
    })
    .catch(err => {
      if (!controller.signal.aborted) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    });

  return controller;
}

// ─── Insights ────────────────────────────────────────────────────
export async function agentInsight(request: AgentInsightRequest): Promise<AgentInsight> {
  const insightPrompts: Record<string, string> = {
    daily_brief: 'Give me a brief daily overview. What should I focus on today?',
    goal_analysis: 'Analyze my goals. What\'s on track and what needs attention?',
    habit_check: 'How are my habits doing? Any streaks or areas needing work?',
    schedule_optimize: 'How can I optimize my schedule today?',
    weekly_review: 'Give me a weekly review summary.',
    bottleneck_scan: 'What are the biggest bottlenecks in my productivity right now?',
  };

  const prompt = insightPrompts[request.type] || 'Give me a productivity insight.';

  try {
    // Build tailored context for this insight type
    let insightContext: string | undefined;
    try {
      const ctx = await buildUserContext();
      insightContext = contextSubset(ctx, request.type);
    } catch {
      // Context unavailable — proceed without
    }

    const messages = buildMessages(
      { userId: request.userId, message: prompt },
      insightContext,
    );
    const res = await callLLMProxy(messages, { timeoutMs: 25000 });
    const chatResponse = { message: res.content };

    return {
      type: request.type,
      title: request.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      summary: chatResponse.message.slice(0, 200),
      details: chatResponse.message,
      actions: [],
      priority: 'medium',
      generatedAt: new Date().toISOString(),
    };
  } catch {
    throw new Error('Insight generation unavailable');
  }
}

// ─── Nudges — powered by contextual state aggregation ────────────
export async function agentNudges(userId: string): Promise<AgentInsight[]> {
  const { generateContextualNudges } = await import('./zeroclaw-nudges');
  const nudges = await generateContextualNudges(userId);
  return nudges.map(n => ({
    type: n.type,
    title: n.title,
    summary: n.summary,
    details: n.details,
    actions: n.actions,
    priority: n.priority,
    generatedAt: n.generatedAt,
  }));
}

// ─── Rescue: construct action when LLM confirms but forgets [ACTION:...] ─────

function rescueActionFromContext(
  llmResponse: string,
  userMessage: string,
  currentPage?: string,
): AgentAction | null {
  // Only rescue if the LLM's response implies it did something
  const confirmPatterns = /(?:scheduled|added|created|logged|I've .+(?:schedule|event|task|habit))/i;
  if (!confirmPatterns.test(llmResponse)) return null;

  // Try to parse a schedule event from the user's original message
  // Pattern: "[activity] from [time] until/to [time] [today/tomorrow]"
  const eventMatch = userMessage.match(
    /^(.+?)\s+from\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+(?:until|to|till)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(today|tomorrow)?/i
  );

  if (eventMatch) {
    const title = eventMatch[1].trim();
    const startRaw = eventMatch[2].trim();
    const endRaw = eventMatch[3].trim();
    const dayRef = (eventMatch[4] || 'today').toLowerCase();

    const baseDate = new Date();
    if (dayRef === 'tomorrow') baseDate.setDate(baseDate.getDate() + 1);
    const dateStr = baseDate.toISOString().split('T')[0]; // YYYY-MM-DD

    const startTime = parseTimeToISO(startRaw, dateStr);
    const endTime = parseTimeToISO(endRaw, dateStr);

    // If end time is before start time, it's the next day (e.g., 11pm to 1am)
    if (startTime && endTime) {
      return {
        type: 'create_event',
        payload: { title, startTime, endTime },
        label: `Create event: ${title}`,
        requiresConfirm: false, // LLM already confirmed
      };
    }
  }

  return null;
}

/** Convert "2am", "14:30", "4:30pm" etc. to ISO string */
function parseTimeToISO(timeStr: string, dateStr: string): string | null {
  try {
    let hours = 0;
    let minutes = 0;
    const lower = timeStr.toLowerCase().trim();

    const match12 = lower.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
    const match24 = lower.match(/^(\d{1,2})(?::(\d{2}))?$/);

    if (match12) {
      hours = parseInt(match12[1]);
      minutes = match12[2] ? parseInt(match12[2]) : 0;
      if (match12[3] === 'pm' && hours < 12) hours += 12;
      if (match12[3] === 'am' && hours === 12) hours = 0;
    } else if (match24) {
      hours = parseInt(match24[1]);
      minutes = match24[2] ? parseInt(match24[2]) : 0;
    } else {
      return null;
    }

    // Build ISO string with local timezone offset
    const d = new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
    const offset = -d.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const offH = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
    const offM = String(Math.abs(offset) % 60).padStart(2, '0');
    return `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00${sign}${offH}:${offM}`;
  } catch {
    return null;
  }
}

// ─── Action parsing ──────────────────────────────────────────────

function parseActions(text: string): AgentAction[] {
  const actions: AgentAction[] = [];
  const regex = /\[ACTION:(\w+)\s+([^\]]+)\]/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const type = match[1] as AgentAction['type'];
    const paramsStr = match[2];

    // Parse key="value" and key=number pairs
    const payload: Record<string, unknown> = {};
    const paramRegex = /(\w+)=(?:"([^"]*)"|([\d.]+))/g;
    let paramMatch;
    while ((paramMatch = paramRegex.exec(paramsStr)) !== null) {
      const key = paramMatch[1];
      const strVal = paramMatch[2];
      const numVal = paramMatch[3];
      payload[key] = strVal !== undefined ? strVal : parseFloat(numVal);
    }

    const validTypes = ['create_task', 'complete_task', 'create_event', 'update_goal', 'log_habit', 'nudge', 'navigate', 'decompose_objective', 'create_habit', 'create_goal', 'start_focus', 'reschedule_overdue', 'log_income', 'log_expense', 'log_activity', 'log_mood', 'log_health', 'quick_journal'];
    if (validTypes.includes(type)) {
      actions.push({
        type,
        payload,
        label: generateActionLabel(type, payload),
        requiresConfirm: type !== 'navigate' && type !== 'nudge',
      });
    }
  }

  return actions;
}

function generateActionLabel(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case 'create_task': return `Create task: ${payload.title || 'New task'}`;
    case 'complete_task': return 'Mark task as done';
    case 'create_event': return `Create event: ${payload.title || 'New event'}`;
    case 'update_goal': return 'Update goal progress';
    case 'log_habit': return 'Log habit';
    case 'navigate': return `Go to ${payload.path || 'page'}`;
    case 'nudge': return String(payload.message || 'Reminder');
    case 'decompose_objective': return `Break down: ${payload.goal_id}`;
    case 'create_habit': return `Create habit: ${payload.name}`;
    case 'create_goal': return `Create goal: ${payload.title}`;
    case 'start_focus': return `Start focus: ${payload.duration_minutes}min`;
    case 'reschedule_overdue': return 'Reschedule overdue items';
    case 'log_income': return `💰 Log income: $${payload.amount}${payload.source ? ' from ' + payload.source : ''}`;
    case 'log_expense': return `💸 Log expense: $${payload.amount} — ${payload.description || payload.category}`;
    case 'log_activity': return `📌 Log activity: ${payload.activity}`;
    case 'log_mood': {
      const moodEmojis: Record<string, string> = { great: '😄', good: '😊', neutral: '😐', okay: '😐', bad: '😞', terrible: '😢', tired: '😴', stressed: '😰' };
      const mood = String(payload.mood || 'neutral');
      const emoji = moodEmojis[mood] || '😐';
      return `${emoji} Log mood: ${mood}`;
    }
    case 'log_health': return `💪 Log health: ${payload.metric} = ${payload.value}`;
    case 'quick_journal': return `📓 Quick journal entry`;
    default: return type;
  }
}

// ─── Action execution ────────────────────────────────────────────
export async function agentExecuteAction(userId: string, action: AgentAction): Promise<{ success: boolean; message: string }> {
  try {
    switch (action.type) {
      case 'create_task': {
        const { useScheduleStore } = await import('../stores/useScheduleStore');
        const title = String(action.payload.title || 'New task');
        const priority = String(action.payload.priority || 'medium');
        const result = await useScheduleStore.getState().createTask(userId, title, priority);
        if (result) {
          window.dispatchEvent(new Event('lifeos-refresh'));
          return { success: true, message: `Task "${title}" created.` };
        }
        return { success: false, message: 'Failed to create task.' };
      }

      case 'complete_task': {
        const { useScheduleStore } = await import('../stores/useScheduleStore');
        const taskId = String(action.payload.taskId || '');
        if (!taskId) return { success: false, message: 'No task ID provided.' };
        await useScheduleStore.getState().changeTaskStatus(taskId, 'done');
        window.dispatchEvent(new Event('lifeos-refresh'));
        return { success: true, message: 'Task marked as done.' };
      }

      case 'create_event': {
        const { createScheduleEvent } = await import('./schedule-events');
        const { supabase } = await import('./supabase');
        const title = String(action.payload.title || 'New event');
        const startTime = String(action.payload.startTime || new Date().toISOString());
        const endTime = String(action.payload.endTime || new Date(Date.now() + 3600000).toISOString());
        await createScheduleEvent(supabase, { userId, title, startTime, endTime });
        window.dispatchEvent(new Event('lifeos-refresh'));
        return { success: true, message: `Event "${title}" created.` };
      }

      case 'update_goal': {
        const { useGoalsStore } = await import('../stores/useGoalsStore');
        const goalId = String(action.payload.goalId || '');
        if (!goalId) return { success: false, message: 'No goal ID provided.' };
        const updates: Record<string, unknown> = {};
        if (action.payload.progress !== undefined) updates.progress = Number(action.payload.progress);
        if (action.payload.status) updates.status = action.payload.status;
        await useGoalsStore.getState().updateGoal(goalId, updates as any);
        window.dispatchEvent(new Event('lifeos-refresh'));
        return { success: true, message: 'Goal updated.' };
      }

      case 'log_habit': {
        const { useHabitsStore } = await import('../stores/useHabitsStore');
        const habitId = String(action.payload.habitId || '');
        const date = String(action.payload.date || new Date().toISOString().slice(0, 10));
        if (!habitId) return { success: false, message: 'No habit ID provided.' };
        await useHabitsStore.getState().toggleHabit(habitId, date);
        window.dispatchEvent(new Event('lifeos-refresh'));
        return { success: true, message: 'Habit logged.' };
      }

      case 'navigate': {
        const path = String(action.payload.path || '/');
        window.dispatchEvent(new CustomEvent('lifeos-navigate', { detail: { path } }));
        return { success: true, message: `Navigating to ${path}.` };
      }

      case 'nudge': {
        const msg = String(action.payload.message || 'Reminder from ZeroClaw');
        // Dynamic import to avoid circular dependency
        const { showToast } = await import('../components/Toast');
        showToast(msg, 'info');
        return { success: true, message: msg };
      }

      case 'decompose_objective': {
        const { decomposeObjective } = await import('./llm/objective-decomposer');
        const { useGoalsStore } = await import('../stores/useGoalsStore');
        const goalId = String(action.payload.goal_id || '');
        if (!goalId) return { success: false, message: 'No goal ID provided.' };
        const goal = useGoalsStore.getState().goals.find(g => g.id === goalId);
        if (!goal) return { success: false, message: 'Goal not found.' };
        const existingTitles = useGoalsStore.getState().goals.map(g => g.title);
        const result = await decomposeObjective(goal.title, existingTitles, localDateStr());
        await useGoalsStore.getState().createGoalBatch(result);
        window.dispatchEvent(new Event('lifeos-refresh'));
        return { success: true, message: `Decomposed "${goal.title}" into sub-goals.` };
      }

      case 'create_habit': {
        const { useHabitsStore } = await import('../stores/useHabitsStore');
        const name = String(action.payload.name || 'New habit');
        const frequency = String(action.payload.frequency || 'daily');
        const icon = String(action.payload.icon || '✅');
        await useHabitsStore.getState().createHabit(userId, { title: name, frequency, icon });
        window.dispatchEvent(new Event('lifeos-refresh'));
        return { success: true, message: `Habit "${name}" created.` };
      }

      case 'create_goal': {
        const { useGoalsStore } = await import('../stores/useGoalsStore');
        const title = String(action.payload.title || 'New goal');
        const category = String(action.payload.category || 'goal');
        const target_date = action.payload.target_date ? String(action.payload.target_date) : undefined;
        await useGoalsStore.getState().createGoal({ user_id: userId, title, category, target_date, status: 'active' });
        window.dispatchEvent(new Event('lifeos-refresh'));
        return { success: true, message: `Goal "${title}" created.` };
      }

      case 'start_focus': {
        const { useLiveActivityStore } = await import('../stores/useLiveActivityStore');
        const { useScheduleStore } = await import('../stores/useScheduleStore');
        const taskId = String(action.payload.task_id || '');
        const task = taskId ? useScheduleStore.getState().tasks.find(t => t.id === taskId) : null;
        const taskTitle = task?.title || 'Focus session';
        useLiveActivityStore.getState().startActivity(taskTitle, 'focus');
        return { success: true, message: `Started focus session: "${taskTitle}".` };
      }

      case 'reschedule_overdue': {
        const { getAIRescheduleSuggestions } = await import('./llm/reschedule');
        const { useScheduleStore } = await import('../stores/useScheduleStore');
        const today = localDateStr();
        const overdue = useScheduleStore.getState().tasks.filter(
          t => t.due_date && t.due_date < today && t.status !== 'done' && !t.is_deleted
        );
        if (overdue.length === 0) return { success: true, message: 'No overdue tasks to reschedule.' };
        const suggestions = await getAIRescheduleSuggestions(userId, overdue, []);
        const summary = suggestions.map((s: any) => `• ${s.title} → ${s.suggested_date}`).join('\n');
        return { success: true, message: `Reschedule suggestions:\n${summary}\n\nPlease confirm before applying.` };
      }

      case 'log_income': {
        const { supabase } = await import('./supabase');
        const { localInsert } = await import('./local-db');
        const amount = Number(action.payload.amount);
        const source = String(action.payload.source || '');
        const date = String(action.payload.date || new Date().toISOString().split('T')[0]);
        const entry = {
          user_id: userId,
          amount,
          date,
          description: source || 'Income',
          source,
          is_recurring: false,
          is_deleted: false
        };
        const { data, error } = await supabase.from('income').insert(entry).select().single();
        if (error) return { success: false, message: `Failed to log income: ${error.message}` };
        if (data) await localInsert('income', { ...data, synced: true });
        window.dispatchEvent(new Event('lifeos-refresh'));
        return { success: true, message: `Logged income: $${amount}${source ? ' from ' + source : ''}` };
      }

      case 'log_expense': {
        const { supabase } = await import('./supabase');
        const { localInsert } = await import('./local-db');
        const amount = Number(action.payload.amount);
        const description = String(action.payload.description || action.payload.category || 'Expense');
        const date = String(action.payload.date || new Date().toISOString().split('T')[0]);
        const entry = {
          user_id: userId,
          amount,
          date,
          description,
          category_id: null,
          is_deductible: false,
          is_deleted: false
        };
        const { data, error } = await supabase.from('expenses').insert(entry).select().single();
        if (error) return { success: false, message: `Failed to log expense: ${error.message}` };
        if (data) await localInsert('expenses', { ...data, synced: true });
        window.dispatchEvent(new Event('lifeos-refresh'));
        return { success: true, message: `Logged expense: $${amount} — ${description}` };
      }

      case 'log_activity': {
        const { createScheduleEvent } = await import('./schedule-events');
        const { supabase } = await import('./supabase');
        const activity = String(action.payload.activity || '');
        const category = String(action.payload.category || 'general');
        const notes = String(action.payload.notes || '');
        const date = String(action.payload.date || new Date().toISOString().split('T')[0]);
        await createScheduleEvent(supabase, {
          userId,
          title: activity,
          startTime: `${date}T12:00:00`,
          endTime: `${date}T13:00:00`,
          notes: `[${category}] ${notes}`
        });
        window.dispatchEvent(new Event('lifeos-refresh'));
        return { success: true, message: `Logged activity: ${activity}` };
      }

      case 'log_mood': {
        const { supabase } = await import('./supabase');
        const { localDateStr } = await import('../utils/date');
        const mood = String(action.payload.mood || 'neutral');
        const moodMap: Record<string, number> = {
          great: 5,
          good: 4,
          neutral: 3,
          okay: 3,
          bad: 2,
          terrible: 1,
          tired: 2,
          stressed: 2
        };
        const moodScore = moodMap[mood] || 3;
        const today = localDateStr();
        const { error } = await supabase.from('health_metrics').upsert(
          {
            user_id: userId,
            date: today,
            mood_score: moodScore,
            notes: action.payload.notes || undefined
          },
          { onConflict: 'user_id,date' }
        );
        if (error) return { success: false, message: `Failed to log mood: ${error.message}` };
        window.dispatchEvent(new Event('lifeos-refresh'));
        return { success: true, message: `Logged mood: ${mood}` };
      }

      case 'log_health': {
        const { supabase } = await import('./supabase');
        const { localDateStr } = await import('../utils/date');
        const metric = String(action.payload.metric || '');
        const value = Number(action.payload.value || 0);
        const metricMap: Record<string, string> = {
          energy: 'energy_score',
          water: 'water_glasses',
          sleep: 'sleep_hours',
          stress: 'stress_score',
          weight: 'weight_kg',
          exercise: 'exercise_minutes',
          mood: 'mood_score'
        };
        const column = metricMap[metric];
        if (!column) return { success: false, message: `Unknown health metric: ${metric}` };
        const today = localDateStr();
        const { error } = await supabase.from('health_metrics').upsert(
          {
            user_id: userId,
            date: today,
            [column]: value
          },
          { onConflict: 'user_id,date' }
        );
        if (error) return { success: false, message: `Failed to log health: ${error.message}` };
        window.dispatchEvent(new Event('lifeos-refresh'));
        return { success: true, message: `Logged ${metric}: ${value}` };
      }

      case 'quick_journal': {
        const { supabase } = await import('./supabase');
        const { localInsert } = await import('./local-db');
        const { localDateStr } = await import('../utils/date');
        const entry = String(action.payload.entry || '');
        const mood = String(action.payload.mood || '');
        const moodMap: Record<string, number> = {
          great: 5,
          good: 4,
          neutral: 3,
          okay: 3,
          bad: 2,
          terrible: 1,
          tired: 2,
          stressed: 2
        };
        const moodScore = mood ? (moodMap[mood] || null) : null;
        const today = localDateStr();
        const journalEntry = {
          user_id: userId,
          date: today,
          title: 'Quick Journal',
          content: entry,
          mood: moodScore,
          energy: null,
          tags: '',
          is_deleted: false
        };
        const { data, error } = await supabase.from('journal_entries').insert(journalEntry).select().single();
        if (error) return { success: false, message: `Failed to save journal: ${error.message}` };
        if (data) await localInsert('journal_entries', { ...data, synced: true });
        window.dispatchEvent(new Event('lifeos-refresh'));
        return { success: true, message: 'Journal entry saved.' };
      }

      default:
        return { success: false, message: `Unknown action type: ${action.type}` };
    }
  } catch (err) {
    return { success: false, message: `Action failed: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}
