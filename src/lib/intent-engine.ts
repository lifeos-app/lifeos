/**
 * LifeOS Intent Engine
 * 
 * Translates natural language into structured actions against the LifeOS database.
 * Provider-agnostic — the system prompt defines the schema, any LLM can execute it.
 */

import { supabase } from './supabase';
import { useUserStore } from '../stores/useUserStore';
import { useScheduleStore } from '../stores/useScheduleStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useFinanceStore } from '../stores/useFinanceStore';
import { useHealthStore } from '../stores/useHealthStore';
import { getErrorMessage } from '../utils/error';
import { createScheduleEvent } from './schedule-events';
import { scheduleObjectiveTasks } from './smart-scheduler';
import { schedulePreloadedTasks } from './life-planner';
import { quickClassify, validateIntentResult } from './llm/response-patterns';
import { syncNowImmediate } from './sync-engine';
import { logger } from '../utils/logger';

// ─── Types ───────────────────────────────────────────────────────

export interface IntentAction {
  type: 'task' | 'expense' | 'income' | 'bill' | 'event' | 'habit' | 'habit_log' | 'goal' | 'navigate' | 'info'
    | 'update_task' | 'delete_task' | 'update_event' | 'delete_event' | 'update_expense' | 'delete_expense'
    | 'search'
    | 'grocery_add' | 'grocery_remove' | 'grocery_clear' | 'grocery_check'
    | 'health_log' | 'meal_log' | 'meditation_log' | 'gratitude' | 'journal'
    | 'log_workout' | 'body_marker'
    | 'goal_plan'
    | 'schedule_shift' | 'reschedule_tasks' | 'update_schedule_preferences'
    | 'business' | 'create_client'
    | 'recurring_event'
    | 'orchestrator_tool';
  data: Record<string, unknown>;
  summary: string;       // Human-readable description of what will happen
  confidence: number;    // 0-1
}

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  used: number;
  resetAt: number;      // Unix timestamp
  resetIn: number;      // Seconds until reset
}

export interface IntentResult {
  actions: IntentAction[];
  reply: string;          // Conversational response to the user
  needs_confirmation: boolean;
  follow_up?: string;     // Optional follow-up question
  rateLimit?: RateLimitInfo;
}

export interface IntentContext {
  userId: string;
  userName: string;       // display name
  today: string;          // YYYY-MM-DD
  tomorrow: string;       // YYYY-MM-DD
  currentTime: string;    // HH:MM (24h)
  utcOffset: string;      // e.g. "+11:00"
  timezone: string;
  categories: { id: string; name: string; icon: string; scope: string }[];
  businesses: { id: string; name: string; type: string; icon: string }[];
  topGoals: { id: string; title: string; category: string }[];
  goalTree: { id: string; title: string; category: string; domain: string | null; parent_goal_id: string | null; target_date: string | null; status: string }[];
  recentTasks: { id: string; title: string; status: string; due_date: string | null; priority: string }[];
  recentEvents: { id: string; title: string; start_time: string; location: string | null }[];
  recentExpenses: { id: string; description: string; amount: number; date: string; category_id: string | null }[];
  activeGroceryLists: { id: string; name: string; store: string | null; item_count: number }[];
  todayHealth: { mood_score: number | null; energy_score: number | null; sleep_hours: number | null; water_glasses: number | null; weight_kg: number | null } | null;
  habits: { id: string; title: string; streak_current: number | null }[];
  financialSummary?: string; // pre-formatted financial snapshot
  habitSuggestions?: string[]; // suggested habits to mention when relevant
}

// ─── System Prompt Builder ───────────────────────────────────────

export function buildSystemPrompt(ctx: IntentContext): string {
  return `You are LifeOS — a personal AI assistant built into the LifeOS life management app.
You're friendly, concise, and genuinely helpful. You have a personality — you're not a robot.

## YOUR IDENTITY
- You are LifeOS, the user's personal assistant
- You're powered by Google Gemini (you can say this if asked)
- You live inside the LifeOS app at app.runlifeos.com
- You can manage tasks, groceries, health, finances, schedule, habits, journal, and more
- You can also just CHAT — not everything needs a database action

## GAMIFICATION SYSTEM (XP & LEVELS)
LifeOS has a built-in XP system. Users earn XP for actions:
- Complete a task: 10-50 XP (depends on priority: low=10, medium=20, high=35, urgent=50)
- Log a habit: 5 XP base (multiplied by streak bonus)
- Complete a goal: 200 XP (goal), 350 XP (epic), 500 XP (objective)
- Journal entry: 15 XP
- Health log: 10 XP
- Financial entry: 10 XP
- Schedule event: 5 XP
- AI message: 2 XP

**Multipliers (stack):**
- Streak: 3 days=1.5×, 7 days=2×, 30 days=3×, 100 days=5×
- Combo: 3+ different action types in 2 hours = 1.5×
- Early Bird: Action before 7am = +10 XP bonus
- First of Day: First action each day = +5 XP bonus

**Level progression:** level² × 100 total XP. Level 2 = 400 XP, Level 5 = 2500 XP, Level 10 = 10000 XP.
**Level titles:** 1=Awakened → 2=Initiate → 3=Seeker → 4=Acolyte → 5=Apprentice → 10=Journeyman → 13=Explorer → 20=Adept → 25=Master → 30=Champion → 40=Knight → 50=Sage → 60=Titan → 70=Grandmaster → 75=Legend → 80=Celestial → 85=Demigod → 90=Voidwalker → 99=Transcendent

When users ask about XP, leveling, or their rank — give SPECIFIC info from this system. Tell them exactly how much XP actions give and what their next level requires. Don't be vague.

## CONVERSATION RULES
- If someone says "hi", "how are you", "what's up" → just chat back naturally. Use type "info". Be warm, brief, human.
- If someone asks about you (what model, who made you, what can you do) → answer honestly and naturally. Use type "info".
- If someone vents, shares feelings, or just wants to talk → be a good listener. Use type "info". Don't try to log it as a journal entry unless they ask.
- If someone asks a question (weather, advice, general knowledge) → answer it. Use type "info".
- **ANALYSIS/REVIEW REQUESTS** → If someone says "analyse my tasks", "review my spending", "how am I doing", "show my progress" → use type "info" and provide a thoughtful analysis in your reply using the context data below. Do NOT navigate anywhere. Do NOT create any actions. Just analyse and respond.
- ONLY create database actions when the user is clearly asking you to DO something (add, log, schedule, track, remove, etc.)
- When in doubt between "just chatting" and "wants an action" → just chat. Don't force actions.
- **NEVER use "navigate" for analysis requests.** Navigate is ONLY for "go to", "open", "show me the page", "take me to".

## AI BRAIN TOOLS (Orchestrator)
You have access to powerful AI analysis tools that can deep-dive into the user's data.
When the user asks about these specific topics, use the "orchestrator_tool" action type to invoke the right tool.

### Available tools:
- **analyze_goals** — Analyze all active goals, find neglected ones, suggest next actions
  Triggers: "how are my goals", "goal progress", "which goals need attention", "am I on track"
- **weekly_insights** — Generate comprehensive weekly review with stats and AI narrative
  Triggers: "how was my week", "weekly review", "weekly insights", "what did I accomplish"
- **meal_suggestions** — Personalized meal suggestions based on nutrition and health data
  Triggers: "what should I eat", "meal suggestions", "food ideas", "what to cook"
- **generate_workout** — Create a personalized workout plan
  Triggers: "give me a workout", "workout plan", "exercise routine", "what should I train"
  Optional params: { goal: "lose_weight|build_muscle|stay_fit|flexibility|endurance", workoutType: "cardio|strength|hiit|mixed|flexibility", durationMin: number }
- **optimize_schedule** — Analyze schedule gaps, conflicts, suggest time usage
  Triggers: "optimize my schedule", "schedule suggestions", "what should I do today", "fill my gaps"
- **morning_brief** — Full morning briefing with schedule, quests, streaks, finances
  Triggers: "good morning", "morning brief", "what's my day", "start my day"
- **reschedule_overdue** — Find overdue tasks and suggest new dates
  Triggers: "reschedule overdue", "overdue tasks", "what did I miss", "catch up"
- **check_balance** — Check life balance across 6 domains (Physical, Mental, Spiritual, Financial, Social, Creative)
  Triggers: "am I balanced", "life balance", "where should I focus", "balance check", "what am I neglecting"

### How to use orchestrator tools:
When the user's message matches a tool trigger, include an action with type "orchestrator_tool":
{ "type": "orchestrator_tool", "data": { "tool": "tool_name", "params": {} }, "summary": "Running analysis...", "confidence": 0.95 }

Your reply should be a brief acknowledgment like "Let me analyze that for you..." — the tool results will be displayed as rich cards.
Only use ONE orchestrator tool per message. Don't combine with other action types (except "info").

## ACTION CLASSIFICATION
Your secondary job is to interpret action requests and convert them into structured database actions.
Only do this when the user clearly wants something created, logged, updated, or deleted.

## CURRENT CONTEXT
- User's name: ${ctx.userName || 'there'} (use their name naturally in conversation)
- Today: ${ctx.today} (${new Date(ctx.today + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long' })})
- Current time: ${ctx.currentTime} (${ctx.timezone})
- Timezone: ${ctx.timezone}
- UTC offset: ${ctx.utcOffset}
- User ID: ${ctx.userId}

**CRITICAL TIME RULES:**
- The current local time is ${ctx.currentTime}. Use this to determine if "today" times are in the past or future.
- ALL datetime values (start_time, end_time) MUST include the timezone offset. Use "${ctx.utcOffset}" for ${ctx.timezone}.
- Example: "7:30pm today" → "${ctx.today}T19:30:00${ctx.utcOffset}"
- Example: "12am tonight" → if current time is evening, this means midnight TONIGHT = start of tomorrow → "${ctx.tomorrow}T00:00:00${ctx.utcOffset}"
- NEVER output bare UTC datetimes (no "Z" suffix). Always use the user's offset.
- "today" means ${ctx.today}. "tonight" means this evening/night of ${ctx.today}. "tomorrow" means ${ctx.tomorrow}.

## AVAILABLE EXPENSE CATEGORIES (use EXACT full id — must be complete UUID)
${ctx.categories.map(c => `- "${c.name}" (id: "${c.id}", scope: ${c.scope})`).join('\n')}

## BUSINESSES
${ctx.businesses.map(b => `- "${b.name}" (id: "${b.id}", type: ${b.type}, icon: ${b.icon})`).join('\n')}

## GOAL HIERARCHY (Objective → Epic → Goal)
LifeOS uses a 4-level hierarchy: **Objective** (life area) → **Epic** (big mission) → **Goal** (specific target) → **Tasks** (action steps).
Habits sit alongside goals as recurring behaviours.

### Existing tree:
${(() => {
  const objectives = ctx.goalTree.filter(g => !g.parent_goal_id || g.category === 'objective');
  const children = ctx.goalTree.filter(g => g.parent_goal_id);
  return objectives.map(obj => {
    const epics = children.filter(c => c.parent_goal_id === obj.id);
    const epicLines = epics.map(epic => {
      const goals = children.filter(c => c.parent_goal_id === epic.id);
      const goalLines = goals.map(g => `      - Goal: "${g.title}" (id: "${g.id}", target: ${g.target_date || 'none'})`).join('\n');
      return `    - Epic: "${epic.title}" (id: "${epic.id}", target: ${epic.target_date || 'none'})${goalLines ? '\n' + goalLines : ''}`;
    }).join('\n');
    return `  - Objective: "${obj.title}" (id: "${obj.id}", domain: ${obj.domain || 'none'})${epicLines ? '\n' + epicLines : ''}`;
  }).join('\n') || '(no objectives yet)';
})()}

## RECENT TASKS (can be updated/deleted/rescheduled)
${ctx.recentTasks.length ? ctx.recentTasks.map(t => `- "${t.title}" (id: "${t.id}", status: ${t.status}, due: ${t.due_date || 'none'}, priority: ${t.priority})`).join('\n') : '(no recent tasks)'}

## UPCOMING EVENTS (can be rescheduled/cancelled)
${ctx.recentEvents.length ? ctx.recentEvents.map(e => `- "${e.title}" (id: "${e.id}", start: ${e.start_time}, location: ${e.location || 'none'})`).join('\n') : '(no upcoming events)'}

## RECENT EXPENSES (can be updated/corrected)
${ctx.recentExpenses.length ? ctx.recentExpenses.map(e => `- "${e.description}" $${e.amount} on ${e.date} (id: "${e.id}")`).join('\n') : '(no recent expenses)'}

## ACTIVE GROCERY LISTS
${ctx.activeGroceryLists.length ? ctx.activeGroceryLists.map(l => `- "${l.name}" (id: "${l.id}", store: ${l.store || 'unset'}, ${l.item_count} items)`).join('\n') : '(no active grocery lists — create one when items are added)'}

## TODAY'S HEALTH
${ctx.todayHealth ? `Mood: ${ctx.todayHealth.mood_score || 'not set'}, Energy: ${ctx.todayHealth.energy_score || 'not set'}, Sleep: ${ctx.todayHealth.sleep_hours || 'not set'}h, Water: ${ctx.todayHealth.water_glasses || 0} glasses, Weight: ${ctx.todayHealth.weight_kg || 'not set'}kg` : 'No health data logged today yet.'}

## ACTIVE HABITS
${ctx.habits.length ? ctx.habits.map(h => `- "${h.title}" (id: "${h.id}", streak: ${h.streak_current || 0} days)`).join('\n') : '(no active habits)'}

${ctx.financialSummary ? `## FINANCIAL SNAPSHOT\n${ctx.financialSummary}` : ''}

${ctx.habitSuggestions?.length ? `## SUGGESTED HABITS (mention when relevant)\n${ctx.habitSuggestions.map(h => `- ${h}`).join('\n')}` : ''}

## INTENT CLASSIFICATION — CRITICAL RULES
CLASSIFY CORRECTLY. The most common mistake is routing everything to "task". Use the MOST SPECIFIC type:
- "Add bananas/milk/bread/eggs" → **grocery_add** (NOT task)
- "Shopping list" / "grocery list" → **grocery_add** (NOT task)
- "Buy [food item]" → **grocery_add** (NOT task or expense)
- "Remove/delete [item] from grocery list" → **grocery_remove** (NOT search or delete_task)
- "Clear/empty grocery list" / "remove all groceries" → **grocery_clear** (NOT search)
- "Take [item] off my list" → **grocery_remove** (NOT search)
- "Spent $X" / "Paid $X" / "Cost $X" → **expense** (NOT task)
- "Log [food]" / "Had [food] for [meal]" → **meal_log** (NOT task)
- "Slept X hours" / "Weight Xkg" / "Feeling [mood]" → **health_log** (NOT journal)
- "Meditated X minutes" / "Did breathing" → **meditation_log** (NOT habit_log)
- "Grateful for X" / "Thankful for X" → **gratitude** (NOT journal)
- "Journal: X" / "Dear diary" / reflection → **journal**
- "Schedule X" / "Meeting at X" / "Tomorrow X at Y" → **event** (single, NOT task)
- "Every Tuesday/Thursday at 6am" / "Work out 3x/week" / "Shopping every Sunday at 11am" → **recurring_event** (NOT event, NOT habit, NOT goal_plan)
- "X every day at Y for the next month" → **recurring_event**
- "Remind me to X" / "Need to X" / "Todo: X" → **task**
- "Did my push-ups" / "Completed [habit name]" / "Done with [habit]" → **habit_log** (match habit_id from ACTIVE HABITS list by title)
- "Create a business" / "Add my side hustle" / "New business: X" → **business**
- "I have 2 clients" / "Add a client" / "New client: X" → **create_client** (link to business if one exists)
- "I'm on night shift" / "Switching to days" / "My schedule changed" → **schedule_shift**
- "Earned $X from cleaning" / "Got paid $X" → **income** (NOT expense)
- If it's about BUYING FOOD → grocery_add. Period.

## TYPO CORRECTION
Fix typos silently: "bangs"→"bananas", "brocoli"→"broccoli", "chiken"→"chicken", "tomorow"→"tomorrow"

## AUSTRALIAN PRICE ESTIMATION
When the user mentions buying items without specifying prices, estimate using typical Australian prices:
- Coffee (instant jar): $8-12, Coffee (cafe): $5-6, Coffee beans 1kg: $15-25
- Milk 2L: $3-4, Bread: $3-5, Eggs dozen: $5-7
- Chicken breast 1kg: $10-14, Mince 500g: $7-10
- Rice 1kg: $3-5, Pasta 500g: $2-3
- Petrol per litre: $1.80-2.10
- Cleaning supplies (general): $5-15 per item
- Fast food meal: $12-18
- Restaurant meal: $25-45
Always use the MIDDLE of the range as the estimate.

## OUTPUT SCHEMA
You MUST return valid JSON matching this exact structure:
{
  "actions": [
    {
      "type": "task" | "expense" | "income" | "bill" | "event" | "recurring_event" | "habit" | "habit_log" | "goal" | "navigate" | "info" | "update_task" | "delete_task" | "update_event" | "delete_event" | "update_expense" | "delete_expense" | "search" | "grocery_add" | "grocery_remove" | "grocery_clear" | "grocery_check" | "health_log" | "meal_log" | "meditation_log" | "gratitude" | "journal" | "log_workout" | "body_marker" | "goal_plan" | "schedule_shift" | "reschedule_tasks" | "update_schedule_preferences" | "business" | "create_client" | "orchestrator_tool",
      "data": { ... },  // Table-specific fields (see below)
      "summary": "Human-readable description",
      "confidence": 0.0-1.0
    }
  ],
  "reply": "Conversational response to the user",
  "needs_confirmation": true | false,
  "follow_up": "Optional follow-up question" | null
}

## TABLE SCHEMAS (data field format for each type)

### type: "task"
{
  "user_id": "${ctx.userId}",
  "title": "string",
  "description": "string | null",
  "status": "todo",
  "priority": "low" | "medium" | "high" | "urgent",
  "due_date": "YYYY-MM-DD | null",
  "due_time": "HH:MM | null",
  "estimated_minutes": "number | null",
  "goal_id": "string | null",
  "financial_amount": "number | null",
  "financial_type": "cost_center | null"
}

### type: "expense"
{
  "user_id": "${ctx.userId}",
  "amount": number,
  "description": "string describing the expense — include ALL context (which clients, what for, frequency)",
  "category_id": "id from AVAILABLE EXPENSE CATEGORIES | null",
  "business_id": "UUID of business this expense belongs to | null",
  "date": "YYYY-MM-DD",
  "is_deductible": true | false,
  "is_recurring": false,
  "recurrence_rule": "weekly" | "fortnightly" | "monthly" | null,
  "payment_method": "cash" | "bank" | "card" | null,
  "travel_km": number | null,
  "travel_odometer": number | null
}

**SMART EXPENSE RULES:**
1. **Fuel / petrol / gas / mileage / travel** → ALWAYS set is_deductible: true if linked to a business. Include "🚗" in description. If the user doesn't mention km, ASK in your follow_up: "How many km was the trip? (ATO rate: 88¢/km for 2025-26)". Set travel_km if they mention distance.
2. **Business expense** → If the user says "under [business name]" or the expense is clearly for work (cleaning supplies, fuel for work, tools, uniforms, equipment), set business_id to the matching business UUID and is_deductible: true.
3. **Recurring expenses** → If the user mentions a weekly/monthly cost, set is_recurring: true and recurrence_rule.
4. **Multi-client expenses** → If the expense relates to multiple clients, mention ALL of them in the description (e.g., "Fuel for Client A and Client B runs — $100/week"). ONE expense, not two.
5. **Tax categories auto-detect:** fuel/petrol = deductible, phone/internet (work %) = deductible, tools/equipment = deductible, cleaning supplies = deductible, work clothing/uniform = deductible, insurance (work) = deductible.
6. **ATO context (Australia):** The current ATO cents-per-km rate is 88¢/km (2025-26). Mention this in your reply when logging travel/fuel expenses so the user knows the tax benefit.

### type: "income"
{
  "user_id": "${ctx.userId}",
  "amount": number,
  "description": "string",
  "source": "Cleaning" | "Security" | "Freelance" | "Investment" | "Other",
  "date": "YYYY-MM-DD",
  "is_recurring": true | false,
  "recurrence_rule": "weekly" | "fortnightly" | "monthly" | "quarterly" | "yearly" | null,
  "client_id": "UUID from clients list or null",
  "category_id": "UUID from CATEGORIES list or null"
}
**IMPORTANT for income:** If the user says "$X per week", set is_recurring: true AND recurrence_rule: "weekly". If "$X per month", set recurrence_rule: "monthly". ALWAYS set the recurrence_rule when income is recurring — without it, the financial engine can't calculate monthly projections correctly.

### type: "bill"
{
  "user_id": "${ctx.userId}",
  "title": "string",
  "amount": number,
  "due_date": "YYYY-MM-DD",
  "is_recurring": true | false,
  "recurrence_rule": "weekly" | "fortnightly" | "monthly" | "quarterly" | "yearly" | null,
  "status": "pending"
}

### type: "event"
Use for SINGLE one-off events (e.g., "tomorrow jogging at 6am", "meeting at 3pm next Friday").
If no duration or end_time is specified, DEFAULT to 1 hour duration.
"tomorrow" = the day after today. "next Monday" = calculate the exact date.
{
  "user_id": "${ctx.userId}",
  "title": "string",
  "description": "string | null",
  "start_time": "ISO 8601 datetime",
  "end_time": "ISO 8601 datetime (default: start_time + 1 hour if not specified)",
  "all_day": true | false,
  "location": "string | null",
  "color": "#hex color"
}

### type: "recurring_event"
Use for RECURRING events (e.g., "work out every Tue/Thu/Sat at 6am for the next month", "shopping every Sunday at 11am").
The system will expand this into individual schedule_events.
- If "for the next month" or "for X weeks" → set until_date accordingly
- If "from henceforth" / "every X" with no end → set until_date to 12 weeks from today (rolling horizon)
- If no duration specified → default 1 hour
- Days: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
{
  "user_id": "${ctx.userId}",
  "title": "string",
  "description": "string | null",
  "days_of_week": [0-6],
  "time": "HH:MM (24-hour format)",
  "duration_minutes": 60,
  "until_date": "YYYY-MM-DD (end date for recurrence, inclusive)",
  "location": "string | null",
  "color": "#hex color",
  "recurrence_label": "string — human-readable label e.g. 'Every Tue/Thu/Sat at 6:00 AM'"
}

### type: "habit"

HABIT vs TASK RULES:
- Habits are ONGOING with no end date (exercise daily, meditate, read before bed)
- If an item has a specific end date or duration limit, it is a TASK not a habit
- "Run every day for 30 days" = recurring task, NOT habit

{
  "user_id": "${ctx.userId}",
  "title": "string",
  "description": "string | null",
  "frequency": "daily" | "weekdays" | "weekends" | "weekly",
  "target_count": 1,
  "icon": "emoji",
  "is_active": true
}

### type: "habit_log"
Log that a habit was completed today. Match the habit_id from ACTIVE HABITS list by title.
{
  "user_id": "${ctx.userId}",
  "habit_id": "UUID from ACTIVE HABITS list (REQUIRED — match by habit title)",
  "date": "${ctx.today}",
  "count": 1,
  "notes": "string | null"
}

### type: "navigate"
{
  "path": "/schedule" | "/goals" | "/habits" | "/finances" | "/journal" | "/inbox" | "/settings" | "/health" | "/review" | "/",
  "tab": "string | null",
  "query": "string | null"
}

### type: "info"
{
  "message": "string"  // Just provide information, no database action
}

### type: "orchestrator_tool"
Invoke an AI Brain tool for deep analysis. Use this when the user asks for goal analysis, weekly insights, meal suggestions, workouts, schedule optimization, morning brief, or balance check.
{
  "tool": "analyze_goals" | "weekly_insights" | "meal_suggestions" | "generate_workout" | "optimize_schedule" | "morning_brief" | "reschedule_overdue" | "check_balance",
  "params": {}  // Optional tool-specific params (e.g., { "goal": "build_muscle", "durationMin": 30 } for generate_workout)
}

### type: "update_task"
{
  "id": "UUID of the task from RECENT TASKS list",
  "updates": {
    "title": "new title (optional)",
    "status": "todo | in_progress | done (optional)",
    "priority": "low | medium | high | urgent (optional)",
    "due_date": "YYYY-MM-DD (optional)",
    "due_time": "HH:MM (optional)"
  }
}

### type: "delete_task"
{
  "id": "UUID of the task from RECENT TASKS list"
}

### type: "update_event"
{
  "id": "UUID of the event from UPCOMING EVENTS list",
  "updates": {
    "title": "new title (optional)",
    "start_time": "ISO 8601 datetime (optional)",
    "end_time": "ISO 8601 datetime (optional)",
    "location": "string (optional)"
  }
}

### type: "delete_event"
{
  "id": "UUID of the event from UPCOMING EVENTS list"
}

### type: "update_expense"
{
  "id": "UUID of the expense from RECENT EXPENSES list",
  "updates": {
    "amount": "number (optional)",
    "description": "string (optional)",
    "category_id": "UUID (optional)"
  }
}

### type: "delete_expense"
{
  "id": "UUID of the expense from RECENT EXPENSES list"
}

### type: "grocery_add"
Add items to a grocery/shopping list. Use when user mentions food items, ingredients, household supplies.
{
  "user_id": "${ctx.userId}",
  "list_id": "id from ACTIVE GROCERY LISTS or null (will use/create default)",
  "name": "item name (fix typos!)",
  "quantity": "1kg | 2L | 1 bunch | 500g | null",
  "estimated_cost": number_or_null,
  "category": "produce | dairy | meat | bakery | pantry | frozen | drinks | household | snacks | other"
}
For multiple items, create MULTIPLE grocery_add actions (one per item).

### type: "grocery_remove"
Remove specific items from a grocery list. Use when user says "remove X from grocery list", "take X off my list", "delete X from shopping list".
For multiple items, create MULTIPLE grocery_remove actions (one per item).
{
  "item_name": "name of item to remove (fuzzy matched)",
  "list_id": "id from ACTIVE GROCERY LISTS or null (searches all active lists)"
}

### type: "grocery_clear"
Clear ALL items from a grocery list. Use when user says "empty my grocery list", "clear shopping list", "remove all groceries".
{
  "list_id": "id from ACTIVE GROCERY LISTS or null (clears default/first active list)"
}

### type: "grocery_check"
Check off a grocery item (mark as purchased).
{
  "item_name": "name of item to check off",
  "actual_cost": number_or_null
}

### type: "health_log"
Log health metrics: weight, mood, energy, sleep, water.
{
  "user_id": "${ctx.userId}",
  "date": "${ctx.today}",
  "weight_kg": number_or_null,
  "mood_score": 1-5_or_null,
  "energy_score": 1-5_or_null,
  "sleep_hours": number_or_null,
  "sleep_quality": 1-5_or_null,
  "water_glasses": number_or_null,
  "notes": "string | null"
}

### type: "meal_log"
Log what was eaten.
{
  "user_id": "${ctx.userId}",
  "date": "${ctx.today}",
  "meal_type": "breakfast | lunch | dinner | snack",
  "description": "what was eaten",
  "calories": number_or_null,
  "rating": 1-5_or_null
}

### type: "meditation_log"
Log a meditation session.
{
  "user_id": "${ctx.userId}",
  "date": "${ctx.today}",
  "duration_min": number,
  "type": "silent | guided | breathing | body_scan | prayer"
}

### type: "gratitude"
Add a gratitude entry. Auto-syncs to journal.
{
  "user_id": "${ctx.userId}",
  "date": "${ctx.today}",
  "entry": "what you're grateful for",
  "category": "people | health | work | growth | faith | nature | other"
}

### type: "journal"
Write a journal entry.
{
  "user_id": "${ctx.userId}",
  "date": "${ctx.today}",
  "title": "string | null",
  "content": "journal text",
  "mood": 1-5_or_null,
  "energy": 1-5_or_null,
  "tags": "comma-separated tags | null"
}

### type: "log_workout"
Log a completed or skipped workout.
{
  "user_id": "${ctx.userId}",
  "date": "${ctx.today}",
  "template_id": "id if known | null",
  "duration_min": number_or_null,
  "completed": true | false,
  "skipped": true | false,
  "skip_reason": "string | null",
  "mood_before": 1-5_or_null,
  "mood_after": 1-5_or_null
}

### type: "body_marker"
Log pain, injury, or tension on a body part.
{
  "user_id": "${ctx.userId}",
  "body_part": "head | neck | left_shoulder | right_shoulder | chest | upper_back | lower_back | left_arm | right_arm | abdomen | left_hip | right_hip | left_leg | right_leg | left_knee | right_knee | left_foot | right_foot",
  "marker_type": "pain | injury | tension | soreness | note",
  "severity": 1-5,
  "description": "string | null",
  "date": "${ctx.today}",
  "affects_workout": true | false
}

### type: "goal_plan"
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
- Think holistically: what else in the user's life supports this goal?

### type: "business"
Create a new business/side hustle.
{
  "user_id": "${ctx.userId}",
  "name": "string",
  "type": "cleaning" | "security" | "freelance" | "ecommerce" | "consulting" | "other",
  "icon": "emoji",
  "color": "#hex",
  "status": "active" | "idea" | "paused"
}

### type: "create_client"
Create a new client for a business.
{
  "user_id": "${ctx.userId}",
  "name": "string",
  "business_id": "UUID of business from BUSINESSES list, or null if creating business in same action set",
  "rate": number_or_null,
  "rate_type": "per_clean" | "hourly" | "fixed" | "per_visit",
  "notes": "any details about the client"
}

### type: "schedule_shift"
Change the user's work shift pattern. Use when they say "I'm on night shift", "switching to days", etc.
{
  "user_id": "${ctx.userId}",
  "shift_pattern": "night" | "day" | "rotating" | "custom",
  "wake_time": "HH:MM",
  "sleep_time": "HH:MM",
  "work_blocks": [{"days": [0,1,2,3,4,5,6], "start": "HH:MM", "end": "HH:MM", "label": "string"}],
  "reschedule_from": "YYYY-MM-DD | null",
  "reschedule_rules": [{"task_id": "UUID", "new_due_date": "YYYY-MM-DD"}]
}

### type: "reschedule_tasks"
Bulk reschedule specific tasks to new dates.
{
  "moves": [{"task_id": "UUID from task list", "new_due_date": "YYYY-MM-DD"}]
}

### type: "update_schedule_preferences"
Update the user's general schedule preferences (preferred work hours, focus time, etc.).
{
  "user_id": "${ctx.userId}",
  "preferences": {
    "preferred_wake_time": "HH:MM | null",
    "preferred_sleep_time": "HH:MM | null",
    "focus_hours": {"start": "HH:MM", "end": "HH:MM"} | null,
    "blocked_days": [0-6] | null
  }
}

### type: "search"
Use this when the user wants to update/delete/reschedule something that is NOT in the RECENT TASKS, UPCOMING EVENTS, or RECENT EXPENSES lists.
{
  "table": "tasks" | "schedule_events" | "expenses",
  "query": "keywords to search for",
  "intent": "what the user wants to do after finding it (e.g. 'delete', 'reschedule to March 5', 'mark done')"
}

## RULES
1. Parse dates relative to today (${ctx.today}). "tomorrow" = next day, "next Monday" = calculate it.
2. **ALWAYS fill the "description" field with useful details.** The title should be concise; the description should capture context, items, notes, locations, quantities, and anything the user mentioned. Think of it as the "notes" section. Example: title="Shopping at Coles", description="Pick up milk (2L), bread, coffee beans. Budget ~$25. Preferred local store."
3. When items to buy are mentioned (food, groceries, ingredients), create grocery_add actions — NOT tasks or expenses. Expenses are for things already bought/paid for.
4. If the user mentions a store (Coles, Woolworths, Aldi, etc.), set the store on the grocery list.
4. For expenses (things already paid for), always try to match to an expense category. "Food & Groceries" for food.
5. Multiple grocery items = MULTIPLE grocery_add actions (one per item). Each with estimated cost.
6. Set needs_confirmation to TRUE for any financial action (expense/income/bill) or multi-action intents.
7. Set needs_confirmation to FALSE for simple tasks, navigation, or info queries.
8. If something is ambiguous, set confidence lower and ask a follow_up question.
9. Use the user's timezone (${ctx.timezone}, UTC offset ${ctx.utcOffset}) for ALL datetime calculations. Current local time is ${ctx.currentTime}. All ISO datetimes MUST use offset "${ctx.utcOffset}", never "Z".
10. Be conversational in 'reply' — brief but helpful, not robotic.
11. If the user is just chatting, asking a question, or sharing feelings — use type "info" with a natural, warm response in "reply". Do NOT create any actions. Most messages are conversation, not commands.
12. Cleaning work = income source "Cleaning", security work = income source "Security".
13. For events AND recurring_events, if no duration/end_time is specified, DEFAULT to 1 hour. Estimate reasonable durations: shopping ~1hr, meetings ~30min, gym ~1hr, jogging ~45min, study ~1.5hr.
14. Business expenses (cleaning supplies, fuel for work) should have is_deductible: true.
15. **CRITICAL: All IDs (category_id, goal_id, business_id) MUST be complete UUIDs exactly as listed above. Do NOT truncate or shorten them. If unsure, use null instead of guessing.**
16. If no expense category matches, set category_id to null rather than inventing an ID.
17. For updates/deletes, ONLY use IDs from the RECENT TASKS, UPCOMING EVENTS, or RECENT EXPENSES lists. Match by title/description keywords.
18. If the user says "delete/remove/cancel" something, use the delete action type. Always set needs_confirmation to TRUE for deletes.
19b. grocery_remove and grocery_clear are destructive — ALWAYS set needs_confirmation to TRUE for these.
19c. goal_plan creates many records — ALWAYS set needs_confirmation to TRUE. Show the user what will be created before executing.
19. If the user says "reschedule/move/change" something, use the update action type.
20. If the user corrects a price ("it was actually $12"), use update_expense.
21. "Mark as done/complete" → update_task with status: "done".
22. For travel/driving mentions, create an expense with category "Transport" and include km in description.
23. For events with a location, ALWAYS fill the location field. For tasks about going somewhere, mention location in description.
24. Write descriptions like personal notes — capture everything the user said that won't fit in the title.
25. **If the user wants to modify/delete something NOT in the recent lists, use type "search" to find it first.** The system will search and re-ask you with the results.
26. **SCHEDULE SHIFTS:** If the user says "I'm on night shift", "switching to days", "my schedule changed", or similar life-pattern changes:
    - Use type "schedule_shift" with data: { user_id, shift_pattern: "night"|"day"|"rotating"|"custom", wake_time: "HH:MM", sleep_time: "HH:MM", work_blocks: [{days:[0-6], start:"HH:MM", end:"HH:MM", label:""}], reschedule_from: "YYYY-MM-DD" }
    - Ask 1-2 clarifying questions in follow_up: "What time will you be sleeping? What days is this shift?"
    - Set needs_confirmation to TRUE — this is a major life change
    - In reply, acknowledge the shift change warmly: "Got it — switching to night shift. Let me reorganize your schedule."
27. **DO NOT add extra fields** that aren't in the schema above. Only include fields listed in the type's data definition.
28. **ENTITY DECOMPOSITION — THE MASTER RULE:**
    Every user message must be decomposed top-down through this entity hierarchy. For each level, ask: "Did the user imply this exists?" If yes, create it.

    **HIERARCHY (create top → down, always):**
    \`\`\`
    L1: BUSINESS / OBJECTIVE   — "I started a business" / "I want to get fit"
    L2: CLIENT / GOAL / EPIC   — "I have 2 clients" / "Lose 10kg" / "Learn electronics"
    L3: INCOME / EXPENSE / BILL — "$650/week from client" / "Gym costs $60/month"
    L4: EVENT / RECURRING_EVENT / SCHEDULE — "I work at the office on Mondays" (recurring_event) / "Meeting tomorrow at 3pm" (event)
    L5: TASK / HABIT            — "Need to buy supplies" / "Run every morning"
    L6: HEALTH / JOURNAL        — "Feeling great" / "Today was productive"
    \`\`\`

    **THE RULE:** Never create an L3 without checking if L1 and L2 should exist first. Never create an L5 without checking L3-L4. Work DOWN the hierarchy.

    **Examples of full decomposition:**
    - "I started a cleaning business with 2 clients, Client A and Client B, $650/week each"
      → L1: 1× business (cleaning) → L2: 2× client (Client A, Client B) → L3: 2× income ($650 weekly recurring each)
    - "I want to get fit — gym 3x/week, $60/month membership, need to buy shoes"
      → L2: 1× goal ("Get fit") → L3: 1× bill ($60/month gym) → L4: 1× recurring_event (gym Mon/Wed/Fri) → L5: 1× task (buy shoes) + 1× habit (gym 3x/week)
    - "Got a new job at Google, $120k, start Monday, need a laptop"
      → L1: 1× business (employment) → L3: 1× income (recurring) → L4: 1× event (start date) → L5: 1× task (buy laptop)
    - "Spent $45 on fuel driving to work"
      → L3: 1× expense ($45, transport, deductible) — no higher entities needed
    - "Bible study every morning at 5am, working through Psalms"
      → L2: 1× goal (if none exists for education/spirituality) → L4: 1× recurring_event (daily at 5am) → L5: 1× habit (Bible study)
    - "Slept 7 hours, feeling good, had eggs for breakfast"
      → L6: 1× health_log (sleep 7h, mood good) + 1× meal_log (eggs, breakfast) — no higher entities needed

    **DEDUPLICATION:** Before creating L1/L2 entities, check BUSINESSES and GOALS lists. If one already exists with a matching name, use its ID — don't create a duplicate. Only create new entities when they genuinely don't exist yet.

    **When in doubt, CREATE MORE not fewer.** It's easier to cancel unwanted actions (needs_confirmation: true) than to miss entities the user expected.`;

}

// ─── Context Loader ──────────────────────────────────────────────

export async function loadIntentContext(userId: string): Promise<IntentContext> {
  // Use Australia/Melbourne timezone for all date/time calculations
  const melbTZ = 'Australia/Melbourne';
  const nowMelb = new Date();
  const today = nowMelb.toLocaleDateString('en-CA', { timeZone: melbTZ }); // YYYY-MM-DD in Melbourne
  const tomorrowDate = new Date(nowMelb.getTime() + 86400000);
  const tomorrow = tomorrowDate.toLocaleDateString('en-CA', { timeZone: melbTZ });
  const currentTime = nowMelb.toLocaleTimeString('en-GB', { timeZone: melbTZ, hour: '2-digit', minute: '2-digit', hour12: false }); // HH:MM
  // Calculate UTC offset for Melbourne (handles DST automatically)
  const utcOffset = (() => {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: melbTZ, timeZoneName: 'shortOffset' });
    const parts = fmt.formatToParts(nowMelb);
    const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || '+11:00';
    // Format like "GMT+11" → "+11:00"
    const m = tzPart.match(/GMT([+-])(\d+)/);
    return m ? `${m[1]}${m[2].padStart(2, '0')}:00` : '+11:00';
  })();
  const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toLocaleDateString('en-CA');

  // ── Hydrate stores (they deduplicate/cache internally) ──
  await Promise.all([
    useScheduleStore.getState().fetchAll(),
    useGoalsStore.getState().fetchAll(),
    useHabitsStore.getState().fetchAll(),
    useFinanceStore.getState().fetchAll(),
    useHealthStore.getState().fetchToday(),
  ]);

  // ── Read from stores (instant, no network) ──
  const schedStore = useScheduleStore.getState();
  const goalsStore = useGoalsStore.getState();
  const habitsStore = useHabitsStore.getState();
  const finStore = useFinanceStore.getState();
  const healthStore = useHealthStore.getState();

  // User profile — still needs direct query (no store for profiles)
  const profileRes = await supabase.from('user_profiles')
    .select('display_name').eq('user_id', userId).maybeSingle();
  const userName = profileRes.data?.display_name || '';

  // Grocery lists — still needs direct query (no store for grocery)
  const groceryRes = await supabase.from('grocery_lists').select('id,name,store,grocery_items(id)')
    .eq('user_id', userId).eq('is_active', true).eq('is_deleted', false);

  // ── Build context from store data ──

  // Categories from finance store (deduplicated)
  const seenCats = new Set<string>();
  const categories = finStore.categories
    .map(c => ({ id: c.id, name: c.name, icon: c.icon || '📦', scope: c.scope || 'personal' }))
    .filter(c => {
      const key = `${c.name}-${c.scope}`;
      if (seenCats.has(key)) return false;
      seenCats.add(key);
      return true;
    });

  // Businesses from goals store (deduplicated)
  const seenBiz = new Set<string>();
  const businesses = goalsStore.businesses
    .map(b => ({ id: b.id, name: b.name, type: b.type || 'other', icon: b.icon || '💼' }))
    .filter(b => {
      if (seenBiz.has(b.name)) return false;
      seenBiz.add(b.name);
      return true;
    });

  // Goals from store
  const allGoals = goalsStore.goals;
  const topGoals = allGoals
    .filter(g => !g.parent_goal_id || g.category === 'objective')
    .map(g => ({ id: g.id, title: g.title, category: g.category || 'goal' }));
  const goalTree = allGoals
    .filter(g => g.status === 'active')
    .map(g => ({
      id: g.id, title: g.title, category: g.category || 'goal',
      domain: (g as any).domain || null, parent_goal_id: g.parent_goal_id || null,
      target_date: g.target_date || null, status: g.status || 'active',
    }));

  // Tasks from schedule store (recent, todo/in_progress)
  const recentTasks = schedStore.tasks
    .filter(t => t.status === 'todo' || t.status === 'in_progress')
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, 20)
    .map(t => ({ id: t.id, title: t.title, status: t.status, due_date: t.due_date || null, priority: t.priority || 'medium' }));

  // Events from schedule store (upcoming 7 days)
  const nowIso = new Date().toISOString();
  const recentEvents = schedStore.events
    .filter(e => e.start_time && e.start_time >= nowIso && e.start_time <= weekAhead)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
    .slice(0, 15)
    .map(e => ({ id: e.id, title: e.title, start_time: e.start_time || '', location: (e as any).location || null }));

  // Expenses from finance store (last 7 days)
  const recentExpenses = finStore.expenses
    .filter(e => e.date >= sevenDaysAgo)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 15)
    .map(e => ({ id: e.id, description: e.description || '', amount: e.amount, date: e.date, category_id: e.category_id || null }));

  // Habits from store
  const habits = habitsStore.habits
    .slice(0, 20)
    .map(h => ({ id: h.id, title: h.title, streak_current: h.streak_current || null }));

  // Today's health from store
  const todayHealth = healthStore.todayMetrics ? {
    mood_score: healthStore.todayMetrics.mood_score ?? null,
    energy_score: healthStore.todayMetrics.energy_score ?? null,
    sleep_hours: healthStore.todayMetrics.sleep_hours ?? null,
    water_glasses: healthStore.todayMetrics.water_glasses ?? null,
    weight_kg: healthStore.todayMetrics.weight_kg ?? null,
  } : null;

  return {
    userId,
    userName,
    today,
    tomorrow,
    currentTime,
    utcOffset,
    timezone: 'Australia/Melbourne',
    categories,
    businesses,
    topGoals,
    goalTree,
    recentTasks,
    recentEvents,
    recentExpenses,
    activeGroceryLists: (groceryRes.data || []).map((l: any) => ({
      id: l.id, name: l.name, store: l.store,
      item_count: l.grocery_items?.length || 0,
    })),
    todayHealth,
    habits,
    financialSummary: await buildFinancialSummary(userId),
    habitSuggestions: await buildHabitSuggestionsList(userId),
  };
}

async function buildFinancialSummary(userId: string): Promise<string> {
  try {
    const { getFinancialSnapshot } = await import('./financial-engine');
    const snap = await getFinancialSnapshot(userId);
    const lines: string[] = [];
    if (snap.monthlyIncome > 0) lines.push(`Monthly income: $${snap.monthlyIncome.toFixed(0)}`);
    if (snap.costOfLiving > 0) lines.push(`Cost of living: $${snap.costOfLiving.toFixed(0)}/month`);
    if (snap.monthlyExpenses > 0) lines.push(`Expenses this month: $${snap.monthlyExpenses.toFixed(0)}`);
    if (snap.disposableIncome !== 0) lines.push(`Disposable: $${snap.disposableIncome.toFixed(0)}/month`);
    if (snap.savingsRate !== 0) lines.push(`Savings rate: ${snap.savingsRate.toFixed(0)}%`);
    lines.push(`Financial health: ${snap.financialHealthScore}/100`);
    if (snap.alerts.length > 0) {
      lines.push('Alerts: ' + snap.alerts.map(a => a.message).join('; '));
    }
    return lines.join('\n') || '';
  } catch {
    return '';
  }
}

async function buildHabitSuggestionsList(userId: string): Promise<string[]> {
  try {
    const { getAllSuggestions } = await import('./habit-engine');
    const suggestions = await getAllSuggestions(userId);
    return suggestions.slice(0, 5).map(s => `${s.icon} ${s.title} (${s.reason})`);
  } catch {
    return [];
  }
}

// ─── LLM Caller (via server proxy) ──────────────────────────────

interface ProxyConfig {
  provider: string;
  model?: string;
  proxyUrl: string;
}

const DEFAULT_PROXY_CONFIG: ProxyConfig = {
  provider: 'openrouter',
  model: 'google/gemini-2.0-flash-001',
  proxyUrl: '/api/intent-proxy.php',  // Unified Intent API (shared with Telegram bot)
};

// Legacy config for fallback
const LEGACY_PROXY_CONFIG: ProxyConfig = {
  provider: 'openrouter',
  model: 'google/gemini-2.0-flash-001',
  proxyUrl: '/api/llm-proxy.php',
};

// ═══ SHORTHAND PARSER — catches common patterns before hitting the LLM ═══
// Saves tokens and latency for mundane actions like "fuel 89" or "groceries 38"
function parseShorthand(msg: string, ctx: IntentContext): IntentResult | null {
  const trimmed = msg.trim();
  const today = ctx.today || new Date().toISOString().slice(0, 10);

  // ── Expense patterns ──
  // "fuel 89", "groceries $38", "petrol $120.50", "lunch 15", "coffee $5.50"
  const expensePatterns = [
    // "fuel 89" or "fuel $89" or "fuel $89.50"
    /^(fuel|petrol|gas|diesel|groceries|grocery|food|lunch|dinner|breakfast|coffee|uber|parking|toll|tolls|rent|electricity|water|internet|phone|insurance|cleaning supplies|supplies|equipment|tools|uniform|clothing|medical|pharmacy|vet|haircut|barber|gym|subscription|netflix|spotify)\s+\$?(\d+(?:\.\d{1,2})?)\s*$/i,
    // "$89 fuel" or "$89.50 on fuel"
    /^\$?(\d+(?:\.\d{1,2})?)\s+(?:on\s+|for\s+)?(fuel|petrol|gas|diesel|groceries|grocery|food|lunch|dinner|breakfast|coffee|uber|parking|toll|tolls|rent|electricity|water|internet|phone|insurance|cleaning supplies|supplies|equipment|tools|uniform|clothing|medical|pharmacy|vet|haircut|barber|gym|subscription)\s*$/i,
    // "spent 89 on fuel" or "paid $89 for groceries"
    /^(?:spent|paid|cost)\s+\$?(\d+(?:\.\d{1,2})?)\s+(?:on|for)\s+(.+)$/i,
  ];

  // Work-related expense keywords → auto-deductible
  const deductibleKeywords = /fuel|petrol|gas|diesel|cleaning supplies|supplies|equipment|tools|uniform|clothing|work|business/i;

  for (const pattern of expensePatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      let description: string;
      let amount: number;

      if (pattern === expensePatterns[0]) {
        description = match[1];
        amount = parseFloat(match[2]);
      } else if (pattern === expensePatterns[1]) {
        amount = parseFloat(match[1]);
        description = match[2];
      } else {
        amount = parseFloat(match[1]);
        description = match[2];
      }

      // Capitalize first letter
      description = description.charAt(0).toUpperCase() + description.slice(1).toLowerCase();
      const isDeductible = deductibleKeywords.test(description);

      return {
        actions: [{
          type: 'expense',
          data: {
            amount,
            description,
            date: today,
            is_recurring: false,
            is_deductible: isDeductible,
          },
          summary: `Log $${amount.toFixed(2)} expense for ${description.toLowerCase()}`,
          confidence: 0.95,
        }],
        reply: `✅ Logged $${amount.toFixed(2)} expense for ${description.toLowerCase()}${isDeductible ? ' (tax deductible)' : ''}`,
        needs_confirmation: false,
      };
    }
  }

  // ── Income patterns ──
  // "earned 500", "got paid 1200", "cleaning 150", "income 500"
  const incomePatterns = [
    /^(?:earned|got paid|received|income|pay|payment)\s+\$?(\d+(?:\.\d{1,2})?)\s*(?:from\s+(.+))?$/i,
    /^(?:cleaning|security|work)\s+\$?(\d+(?:\.\d{1,2})?)$/i,
  ];

  for (const pattern of incomePatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const amount = parseFloat(match[1]);
      const source = match[2] || (pattern === incomePatterns[1] ? match[0].split(/\s/)[0] : 'Work');

      return {
        actions: [{
          type: 'income',
          data: {
            amount,
            source: source.charAt(0).toUpperCase() + source.slice(1),
            date: today,
            is_recurring: false,
          },
          summary: `Log $${amount.toFixed(2)} income from ${source}`,
          confidence: 0.95,
        }],
        reply: `✅ Logged $${amount.toFixed(2)} income from ${source}`,
        needs_confirmation: false,
      };
    }
  }

  return null; // No shorthand match — fall through to LLM
}

export async function callIntentEngine(
  userMessage: string,
  context: IntentContext,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  config: Partial<ProxyConfig> = {},
  abortSignal?: AbortSignal,
): Promise<IntentResult> {
  // ── Try pre-classifier patterns first (no LLM needed) ──
  const quick = quickClassify(userMessage, context.userId);
  if (quick) return quick;

  // ── Try shorthand parser (no LLM needed) ──
  const shorthand = parseShorthand(userMessage, context);
  if (shorthand) return shorthand;

  const cfg = { ...DEFAULT_PROXY_CONFIG, ...config };

  // 30-second timeout to prevent indefinite hangs on proxy failure
  const INTENT_TIMEOUT_MS = 30_000;
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), INTENT_TIMEOUT_MS);
  if (abortSignal) {
    abortSignal.addEventListener('abort', () => timeoutController.abort());
  }
  const effectiveSignal = timeoutController.signal;

  try {

  // Get auth token
  const { data: { session } } = await useUserStore.getState().getSessionCached();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  // ─── Unified Intent API path ────────────────────────────────
  // Sends message to the shared intent API which builds its own context server-side
  if (cfg.proxyUrl.includes('intent-proxy')) {
    const res = await fetch(cfg.proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        message: userMessage,
        context: { userName: context.userName },
        history: history.slice(-6),  // Last 6 messages for conversation context
      }),
      signal: effectiveSignal,
    });

    if (!res.ok) {
      // Fallback to legacy proxy on unified API failure
      logger.warn('Unified intent API failed, falling back to legacy proxy');
      return callIntentEngine(userMessage, context, history, { ...config, proxyUrl: LEGACY_PROXY_CONFIG.proxyUrl }, abortSignal);
    }

    const result = await res.json();
    return {
      actions: result.actions || [],
      reply: result.reply || 'Done.',
      needs_confirmation: result.needs_confirmation ?? true,
      follow_up: result.follow_up || undefined,
      rateLimit: result._meta ? { remaining: 999, limit: 1000, used: 1, resetAt: 0, resetIn: 0 } : undefined,
    };
  }

  // ─── Legacy direct-LLM path (fallback) ──────────────────────
  const systemPrompt = buildSystemPrompt(context);

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user' as const, content: userMessage },
  ];

  const res = await fetch(cfg.proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      messages,
      provider: cfg.provider,
      model: cfg.model,
    }),
    signal: abortSignal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    // Include full error body (with rateLimit) so caller can extract it
    throw new Error(JSON.stringify(err));
  }

  const llmResponse = await res.json();
  const content = llmResponse.content || '';
  const rateLimitData: RateLimitInfo | undefined = llmResponse.rateLimit || undefined;

  // Parse the JSON response — handle models that wrap JSON in conversational text
  let jsonContent = content;

  // If content doesn't start with '{', try to extract JSON from within the text
  const trimmed = content.trim();
  if (!trimmed.startsWith('{')) {
    // Try to find a JSON block (with or without markdown fences)
    const fencedMatch = trimmed.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    const rawMatch = trimmed.match(/(\{[\s\S]*"actions"\s*:\s*\[[\s\S]*"reply"\s*:\s*"[\s\S]*\})\s*$/);
    if (fencedMatch) {
      jsonContent = fencedMatch[1];
    } else if (rawMatch) {
      jsonContent = rawMatch[1];
    }
  }

  try {
    const parsed = JSON.parse(jsonContent);
    const result: IntentResult = {
      actions: parsed.actions || [],
      reply: parsed.reply || 'Done.',
      needs_confirmation: parsed.needs_confirmation ?? true,
      follow_up: parsed.follow_up || undefined,
      rateLimit: rateLimitData,
    };

    // ─── Search-then-act: if AI needs to find something ────────
    const searchAction = result.actions.find((a: IntentAction) => a.type === 'search');
    if (searchAction) {
      const { table, query, intent } = searchAction.data as { table: string; query: string; intent: string };
      const searchResults = await searchDatabase(context.userId, table, query);

      if (searchResults.length === 0) {
        return {
          actions: [{ type: 'info', data: { message: `Couldn't find anything matching "${query}".` }, summary: `No results for "${query}"`, confidence: 1 }],
          reply: `I searched your ${table} for "${query}" but didn't find anything. Could you be more specific?`,
          needs_confirmation: false,
        };
      }

      // Second LLM call with search results
      const searchContext = `\n\n## SEARCH RESULTS for "${query}" in ${table}:\n${searchResults.map((r: Record<string, unknown>) => JSON.stringify(r)).join('\n')}\n\nThe user wants to: ${intent}\nNow generate the correct update/delete action using the IDs from these results.`;

      const retryMessages = [
        ...messages,
        { role: 'assistant' as const, content: content },
        { role: 'user' as const, content: searchContext },
      ];

      const retryRes = await fetch(cfg.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: retryMessages,
          provider: cfg.provider,
          model: cfg.model,
        }),
        signal: effectiveSignal,
      });

      if (retryRes.ok) {
        const retryLlm = await retryRes.json();
        const retryContent = retryLlm.content || '';
        try {
          // Try direct parse first, then extract from mixed content
          let retryJson = retryContent;
          if (!retryContent.trim().startsWith('{')) {
            const fm = retryContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
            const rm = retryContent.match(/(\{[\s\S]*"actions"\s*:\s*\[[\s\S]*"reply"\s*:\s*"[\s\S]*\})\s*$/);
            if (fm) retryJson = fm[1];
            else if (rm) retryJson = rm[1];
          }
          const retryParsed = JSON.parse(retryJson);
          return {
            actions: retryParsed.actions || [],
            reply: retryParsed.reply || 'Done.',
            needs_confirmation: retryParsed.needs_confirmation ?? true,
            follow_up: retryParsed.follow_up || undefined,
          };
        } catch {
          // Strip JSON artifacts from display
          const clean = retryContent
            .replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/g, '')
            .replace(/\{[\s\S]*"actions"\s*:[\s\S]*\}\s*$/g, '')
            .trim();
          return { actions: [], reply: clean || retryContent, needs_confirmation: false };
        }
      }
    }

    return validateIntentResult(result);
  } catch {
    // If LLM didn't return valid JSON, try one more extraction attempt
    // Some models output: "Sure! Here's the result:\n{...json...}"
    try {
      const lastBrace = content.lastIndexOf('}');
      const firstBrace = content.indexOf('{');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        const extracted = content.substring(firstBrace, lastBrace + 1);
        const fallbackParsed = JSON.parse(extracted);
        if (fallbackParsed.reply) {
          return {
            actions: fallbackParsed.actions || [],
            reply: fallbackParsed.reply,
            needs_confirmation: fallbackParsed.needs_confirmation ?? true,
            follow_up: fallbackParsed.follow_up || undefined,
            rateLimit: rateLimitData,
          };
        }
      }
    } catch {
      // Truly not JSON — fall through
    }

    // Strip any JSON-like blocks from display text so users don't see raw JSON
    const cleanContent = content
      .replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/g, '')
      .replace(/\{[\s\S]*"actions"\s*:[\s\S]*"reply"\s*:[\s\S]*\}\s*$/g, '')
      .trim();

    return {
      actions: [{ type: 'info', data: { message: cleanContent || content }, summary: cleanContent || content, confidence: 0.5 }],
      reply: cleanContent || content,
      needs_confirmation: false,
    };
  }

  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Database Search (for items not in recent context) ───────────

async function searchDatabase(userId: string, table: string, query: string): Promise<Record<string, unknown>[]> {
  const allowedTables: Record<string, { searchCol: string; selectCols: string }> = {
    tasks: { searchCol: 'title', selectCols: 'id,title,status,due_date,priority,description' },
    schedule_events: { searchCol: 'title', selectCols: 'id,title,start_time,end_time,location,description' },
    expenses: { searchCol: 'description', selectCols: 'id,description,amount,date,category_id' },
  };

  const config = allowedTables[table];
  if (!config) return [];

  // Search with ilike pattern matching
  const keywords = query.split(/\s+/).filter(Boolean);
  let q = supabase
    .from(table)
    .select(config.selectCols)
    .eq('user_id', userId)
    .eq('is_deleted', false);

  // Chain ilike for each keyword (AND logic)
  for (const kw of keywords) {
    q = q.ilike(config.searchCol, `%${kw}%`);
  }

  const { data, error } = await q.order('created_at', { ascending: false }).limit(10);
  if (error || !data) return [];
  return data as unknown as Record<string, unknown>[];
}

// ─── Intent Executor ─────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sanitize data — null out any foreign key fields that aren't valid UUIDs */
function sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
  const fkFields = ['category_id', 'goal_id', 'business_id', 'parent_goal_id', 'client_id', 'project_id', 'parent_task_id', 'financial_category_id', 'habit_id', 'list_id', 'template_id'];
  const cleaned = { ...data };
  for (const field of fkFields) {
    if (cleaned[field] && typeof cleaned[field] === 'string' && !UUID_REGEX.test(cleaned[field] as string)) {
      cleaned[field] = null; // Invalid UUID — null it out instead of crashing
    }
  }
  return cleaned;
}

// ─── Companion Schedule Event Creator ────────────────────────────
// Automatically creates a schedule_event when an activity is logged,
// so everything appears on the calendar.

async function createCompanionEvent(opts: {
  userId: string;
  title: string;
  color?: string;
  durationMin?: number;
  startTime?: string; // ISO string or time like "6:30am"
}) {
  try {
    const now = new Date();
    const dur = opts.durationMin || 60; // Default 1 hour

    let start: Date;

    if (opts.startTime) {
      // If it looks like an ISO string, parse directly
      if (opts.startTime.includes('T')) {
        start = new Date(opts.startTime);
      } else {
        // Parse time string like "6:30am" relative to today
        start = parseTimeToToday(opts.startTime);
      }
    } else {
      // No time given — use current time as start
      start = now;
    }

    const end = new Date(start.getTime() + dur * 60 * 1000);

    await supabase.from('schedule_events').insert({
      user_id: opts.userId,
      title: opts.title,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      color: opts.color || '#A855F7',
      is_deleted: false,
      sync_status: 'synced',
    });
  } catch (err) {
    // Best-effort — don't fail the main action if event creation fails
    logger.warn('Companion event creation failed:', err);
  }
}

function parseTimeToToday(timeStr: string): Date {
  const now = new Date();
  let hours = 0, minutes = 0;

  // Try "HH:MM" or "H:MM" with optional am/pm
  const colonMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (colonMatch) {
    hours = parseInt(colonMatch[1]);
    minutes = parseInt(colonMatch[2]);
    if (colonMatch[3]) {
      if (colonMatch[3].toLowerCase() === 'pm' && hours < 12) hours += 12;
      if (colonMatch[3].toLowerCase() === 'am' && hours === 12) hours = 0;
    }
  } else {
    // Try "530am" or "6am" style
    const compactMatch = timeStr.match(/(\d{1,4})\s*(am|pm)/i);
    if (compactMatch) {
      const num = compactMatch[1];
      if (num.length <= 2) {
        hours = parseInt(num);
      } else {
        hours = parseInt(num.slice(0, -2));
        minutes = parseInt(num.slice(-2));
      }
      if (compactMatch[2].toLowerCase() === 'pm' && hours < 12) hours += 12;
      if (compactMatch[2].toLowerCase() === 'am' && hours === 12) hours = 0;
    }
  }

  const result = new Date(now);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export async function executeActions(actions: IntentAction[]): Promise<{
  successes: string[];
  failures: string[];
}> {
  const successes: string[] = [];
  const failures: string[] = [];

  for (const action of actions) {
    try {
      const data = sanitizeData(action.data as Record<string, unknown>);
      switch (action.type) {
        case 'task': {
          const { error } = await supabase.from('tasks').insert(data);
          if (error) throw error;
          successes.push(`✅ Task: ${action.summary}`);
          break;
        }
        case 'expense': {
          // Extract travel and business fields before inserting (expenses table may not have all columns)
          const expBusinessId = data.business_id as string | null;
          const travelKm = data.travel_km as number | null;
          const travelOdo = data.travel_odometer as number | null;
          const expPayment = data.payment_method as string | null;
          const expRecurring = data.is_recurring as boolean;
          const expRecRule = data.recurrence_rule as string | null;

          // Whitelist only columns that exist in the expenses table
          const expenseInsert: Record<string, unknown> = {
            user_id: data.user_id, amount: data.amount, description: data.description,
            category_id: data.category_id || null, date: data.date,
            is_deductible: data.is_deductible || false, is_recurring: expRecurring || false,
            payment_method: data.payment_method || null,
            travel_km: data.travel_km || null,
            is_deleted: false, sync_status: 'synced',
          };
          const { error: expErr } = await supabase.from('expenses').insert(expenseInsert);
          if (expErr) throw expErr;

          // Also write to transactions table (for unified financial view)
          const travelMeta = travelKm ? { km: travelKm, odometer: travelOdo || null } : null;
          const txNotes = JSON.stringify({
            payment_method: expPayment || 'card',
            travel: travelMeta,
            recurrence: expRecurring ? expRecRule : null,
          });
          await supabase.from('transactions').insert({
            user_id: data.user_id, type: 'expense', amount: data.amount,
            title: data.description || 'Expense', date: data.date,
            category_id: data.category_id || null, business_id: expBusinessId || null,
            recurring: expRecurring, notes: txNotes,
          }).then(r => { if (r.error) logger.warn('tx insert failed:', r.error.message); });

          successes.push(`✅ Expense: ${action.summary}`);
          // Companion schedule event
          await createCompanionEvent({
            userId: data.user_id as string,
            title: `💸 ${data.description || 'Expense'}: $${data.amount}`,
            color: '#F97316',
            durationMin: 15,
          });
          break;
        }
        case 'income': {
          // Extract fields before inserting
          const incClientId = data.client_id as string | null;
          const incRecurring = data.is_recurring as boolean;
          const incRecRule = data.recurrence_rule as string | null;

          // Whitelist only columns that exist in the income table
          const incomeInsert: Record<string, unknown> = {
            user_id: data.user_id, amount: data.amount, description: data.description,
            source: data.source || 'manual', date: data.date,
            client_id: incClientId || null, category_id: data.category_id || null,
            is_recurring: incRecurring || false, recurrence_rule: incRecRule || null,
            is_deleted: false, sync_status: 'synced',
          };
          const { error: incErr } = await supabase.from('income').insert(incomeInsert);
          if (incErr) throw incErr;

          // Also write to transactions table
          await supabase.from('transactions').insert({
            user_id: data.user_id, type: 'income', amount: data.amount,
            title: data.description || data.source || 'Income', date: data.date,
            client_id: incClientId || null, recurring: incRecurring,
            notes: JSON.stringify({ recurrence: incRecurring ? incRecRule : null }),
          }).then(r => { if (r.error) logger.warn('tx insert failed:', r.error.message); });

          successes.push(`✅ Income: ${action.summary}`);
          // Companion schedule event
          await createCompanionEvent({
            userId: data.user_id as string,
            title: `💰 ${data.source || 'Income'}: $${data.amount}`,
            color: '#22C55E',
          });
          break;
        }
        case 'bill': {
          const { error } = await supabase.from('bills').insert(data);
          if (error) throw error;
          successes.push(`✅ Bill: ${action.summary}`);
          break;
        }
        case 'event': {
          // Route through the schedule event factory (single source of truth)
          await createScheduleEvent(supabase, {
            userId:      data.user_id as string,
            title:       String(data.title || 'Event'),
            startTime:   String(data.start_time || new Date().toISOString()),
            endTime:     data.end_time ? String(data.end_time) : null,
            description: data.description ? String(data.description) : null,
            location:    data.location ? String(data.location) : null,
            category:    data.day_type ? String(data.day_type) : null,
            color:       data.color ? String(data.color) : null,
            allDay:      data.all_day === true,
          });
          successes.push(`✅ Event: ${action.summary}`);
          break;
        }
        case 'recurring_event': {
          // Expand recurring pattern into individual schedule_events
          const recData = data as Record<string, any>;
          const recUserId = recData.user_id as string;
          const recTitle = recData.title as string || 'Event';
          const recDesc = recData.description as string | null;
          const recDays = recData.days_of_week as number[] || [];
          const recTime = recData.time as string || '09:00'; // HH:MM
          const recDuration = (recData.duration_minutes as number) || 60;
          const recUntil = recData.until_date as string;
          const recLocation = recData.location as string | null;
          const recColor = recData.color as string || '#00D4FF';
          const recLabel = recData.recurrence_label as string || '';

          if (recDays.length === 0) {
            failures.push(`❌ Recurring event "${recTitle}": no days specified`);
            break;
          }

          // Parse time
          const [hours, minutes] = recTime.split(':').map(Number);

          // Calculate end date (default 12 weeks if not specified)
          const today = new Date();
          const untilDate = recUntil
            ? new Date(recUntil + 'T23:59:59')
            : new Date(today.getTime() + 12 * 7 * 24 * 60 * 60 * 1000);

          // Generate all occurrences
          const eventRows: Record<string, unknown>[] = [];
          const cursor = new Date(today);
          cursor.setHours(0, 0, 0, 0);

          // Start from tomorrow if today's time has passed
          const nowTime = today.getHours() * 60 + today.getMinutes();
          const eventTime = hours * 60 + minutes;
          if (nowTime >= eventTime) {
            cursor.setDate(cursor.getDate() + 1);
          }

          while (cursor <= untilDate) {
            const dayOfWeek = cursor.getDay(); // 0=Sun
            if (recDays.includes(dayOfWeek)) {
              const startDt = new Date(cursor);
              startDt.setHours(hours, minutes, 0, 0);
              const endDt = new Date(startDt.getTime() + recDuration * 60 * 1000);

              eventRows.push({
                user_id: recUserId,
                title: recTitle,
                description: recLabel ? `[recurring] ${recLabel}${recDesc ? '\n' + recDesc : ''}` : recDesc,
                start_time: startDt.toISOString(),
                end_time: endDt.toISOString(),
                location: recLocation,
                color: recColor,
                is_deleted: false,
                sync_status: 'synced',
                recurrence_rule: `FREQ=WEEKLY;BYDAY=${recDays.map(d => ['SU','MO','TU','WE','TH','FR','SA'][d]).join(',')}`,
              });
            }
            cursor.setDate(cursor.getDate() + 1);
          }

          if (eventRows.length === 0) {
            failures.push(`❌ Recurring event "${recTitle}": no occurrences generated`);
            break;
          }

          // Batch insert (Supabase supports bulk inserts)
          const BATCH_SIZE = 50;
          let inserted = 0;
          for (let i = 0; i < eventRows.length; i += BATCH_SIZE) {
            const batch = eventRows.slice(i, i + BATCH_SIZE);
            const { error: batchErr } = await supabase.from('schedule_events').insert(batch);
            if (batchErr) {
              failures.push(`❌ Failed to insert batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchErr.message}`);
            } else {
              inserted += batch.length;
            }
          }

          if (inserted > 0) {
            successes.push(`📅 Recurring schedule created: "${recTitle}" — ${inserted} events${recLabel ? ` (${recLabel})` : ''}`);
          }
          break;
        }
        case 'habit': {
          const { error } = await supabase.from('habits').insert(data);
          if (error) throw error;
          successes.push(`✅ Habit: ${action.summary}`);
          break;
        }
        case 'habit_log': {
          const { error } = await supabase.from('habit_logs').insert(data);
          if (error) throw error;
          successes.push(`✅ Habit logged: ${action.summary}`);
          // Companion schedule event
          await createCompanionEvent({
            userId: data.user_id as string,
            title: `✅ ${action.summary}`,
            color: '#FACC15',
          });
          break;
        }
        case 'goal': {
          const { error } = await supabase.from('goals').insert(data);
          if (error) throw error;
          successes.push(`✅ Goal: ${action.summary}`);
          break;
        }
        // ─── UPDATE actions ───────────────────────────────
        case 'update_task': {
          const id = data.id as string;
          const updates = sanitizeData(data.updates as Record<string, unknown> || {});
          if (!id || !UUID_REGEX.test(id)) throw new Error('Invalid task ID');
          const { error } = await supabase.from('tasks').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
          if (error) throw error;
          successes.push(`✏️ Task updated: ${action.summary}`);
          break;
        }
        case 'update_event': {
          let eventId = data.id as string;
          const updates = data.updates as Record<string, unknown> || {};
          
          // If ID is not a valid UUID, try to find event by title match
          if (!eventId || !UUID_REGEX.test(eventId)) {
            const searchTitle = data.title as string || data.id as string || '';
            if (searchTitle) {
              const today = new Date();
              const dayStart = new Date(today); dayStart.setHours(0,0,0,0);
              const dayEnd = new Date(today); dayEnd.setHours(23,59,59,999);
              const { data: found } = await supabase.from('schedule_events')
                .select('id, title')
                .eq('is_deleted', false)
                .eq('user_id', data.user_id as string)
                .ilike('title', `%${searchTitle}%`)
                .gte('start_time', dayStart.toISOString())
                .lte('start_time', dayEnd.toISOString())
                .order('start_time', { ascending: false })
                .limit(1);
              if (found?.length) {
                eventId = found[0].id;
              } else {
                // Try broader search (any non-deleted event)
                const { data: broader } = await supabase.from('schedule_events')
                  .select('id, title')
                  .eq('is_deleted', false)
                  .ilike('title', `%${searchTitle}%`)
                  .order('start_time', { ascending: false })
                  .limit(1);
                if (broader?.length) eventId = broader[0].id;
                else throw new Error(`Could not find event matching "${searchTitle}"`);
              }
            } else {
              throw new Error('No event ID or title provided');
            }
          }
          
          // Whitelist update fields
          const eventUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (updates.title) eventUpdates.title = updates.title;
          if (updates.start_time) eventUpdates.start_time = updates.start_time;
          if (updates.end_time) eventUpdates.end_time = updates.end_time;
          if (updates.location !== undefined) eventUpdates.location = updates.location;
          if (updates.description !== undefined) eventUpdates.description = updates.description;
          if (updates.color) eventUpdates.color = updates.color;
          if (updates.day_type) eventUpdates.day_type = updates.day_type;
          
          const { error } = await supabase.from('schedule_events').update(eventUpdates).eq('id', eventId);
          if (error) throw error;
          successes.push(`✏️ Event updated: ${action.summary}`);
          break;
        }
        case 'update_expense': {
          const id = data.id as string;
          const updates = sanitizeData(data.updates as Record<string, unknown> || {});
          if (!id || !UUID_REGEX.test(id)) throw new Error('Invalid expense ID');
          const { error } = await supabase.from('expenses').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
          if (error) throw error;
          successes.push(`✏️ Expense updated: ${action.summary}`);
          break;
        }
        // ─── DELETE actions ───────────────────────────────
        case 'delete_task': {
          const id = data.id as string;
          if (!id || !UUID_REGEX.test(id)) throw new Error('Invalid task ID');
          const { error } = await supabase.from('tasks').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id);
          if (error) throw error;
          successes.push(`🗑️ Task deleted: ${action.summary}`);
          break;
        }
        case 'delete_event': {
          let delEventId = data.id as string;
          if (!delEventId || !UUID_REGEX.test(delEventId)) {
            // Try to find by title
            const searchTitle = data.title as string || data.id as string || '';
            if (searchTitle) {
              const { data: found } = await supabase.from('schedule_events')
                .select('id').eq('is_deleted', false)
                .ilike('title', `%${searchTitle}%`)
                .order('start_time', { ascending: false }).limit(1);
              if (found?.length) delEventId = found[0].id;
              else throw new Error(`Could not find event matching "${searchTitle}"`);
            } else throw new Error('No event ID or title provided');
          }
          const { error } = await supabase.from('schedule_events').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', delEventId);
          if (error) throw error;
          successes.push(`🗑️ Event cancelled: ${action.summary}`);
          break;
        }
        case 'delete_expense': {
          const id = data.id as string;
          if (!id || !UUID_REGEX.test(id)) throw new Error('Invalid expense ID');
          const { error } = await supabase.from('expenses').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id);
          if (error) throw error;
          successes.push(`🗑️ Expense removed: ${action.summary}`);
          break;
        }
        // ─── GROCERY actions ───────────────────────────
        case 'grocery_add': {
          // Find or create active list
          const userId = data.user_id as string;
          let listId = data.list_id as string;
          if (!listId || !UUID_REGEX.test(listId)) {
            const { data: lists } = await supabase.from('grocery_lists')
              .select('id').eq('user_id', userId).eq('is_active', true).eq('is_deleted', false)
              .order('created_at', { ascending: false }).limit(1);
            if (lists?.length) {
              listId = lists[0].id;
            } else {
              const { data: newList, error: listErr } = await supabase.from('grocery_lists')
                .insert({ user_id: userId, name: 'Shopping List' }).select().single();
              if (listErr) throw listErr;
              listId = newList.id;
            }
          }
          const groceryItem = { user_id: userId, list_id: listId, name: data.name, quantity: data.quantity, estimated_cost: data.estimated_cost, category: data.category };
          const { error: giErr } = await supabase.from('grocery_items').insert(groceryItem);
          if (giErr) throw giErr;
          successes.push(`🛒 ${action.summary}`);
          break;
        }
        case 'grocery_remove': {
          const rmName = data.item_name as string;
          let rmQuery = supabase.from('grocery_items')
            .select('id,name')
            .eq('is_deleted', false)
            .ilike('name', `%${rmName}%`);
          if (data.list_id && UUID_REGEX.test(data.list_id as string)) {
            rmQuery = rmQuery.eq('list_id', data.list_id);
          }
          const { data: rmItems } = await rmQuery;
          if (!rmItems?.length) { failures.push(`❌ Item "${rmName}" not found on grocery list`); break; }
          // Remove all matches (soft delete)
          for (const item of rmItems) {
            const { error: rmErr } = await supabase.from('grocery_items')
              .update({ is_deleted: true }).eq('id', item.id);
            if (rmErr) throw rmErr;
          }
          successes.push(`🗑️ Removed ${rmItems.length > 1 ? rmItems.length + ' items matching' : ''} "${rmName}" from grocery list`);
          break;
        }
        case 'grocery_clear': {
          // Find the target list
          let clearListId = data.list_id as string;
          if (!clearListId || !UUID_REGEX.test(clearListId)) {
            const { data: lists } = await supabase.from('grocery_lists')
              .select('id').eq('is_active', true).eq('is_deleted', false)
              .order('created_at', { ascending: false }).limit(1);
            if (!lists?.length) { failures.push(`❌ No active grocery list found`); break; }
            clearListId = lists[0].id;
          }
          // Soft-delete all unchecked items on this list
          const { data: clearItems, error: countErr } = await supabase.from('grocery_items')
            .select('id').eq('list_id', clearListId).eq('is_deleted', false);
          if (countErr) throw countErr;
          if (!clearItems?.length) { successes.push(`ℹ️ Grocery list is already empty`); break; }
          const { error: clearErr } = await supabase.from('grocery_items')
            .update({ is_deleted: true }).eq('list_id', clearListId).eq('is_deleted', false);
          if (clearErr) throw clearErr;
          successes.push(`🗑️ Cleared ${clearItems.length} items from grocery list`);
          break;
        }
        case 'grocery_check': {
          const itemName = data.item_name as string;
          const { data: items } = await supabase.from('grocery_items')
            .select('id,name').eq('is_deleted', false).eq('checked', false)
            .ilike('name', `%${itemName}%`).limit(1);
          if (!items?.length) { failures.push(`❌ Item "${itemName}" not found`); break; }
          const updates: Record<string, unknown> = { checked: true };
          if (data.actual_cost) updates.actual_cost = data.actual_cost;
          const { error: gcErr } = await supabase.from('grocery_items').update(updates).eq('id', items[0].id);
          if (gcErr) throw gcErr;
          successes.push(`✅ ${action.summary}`);
          break;
        }
        // ─── HEALTH actions ───────────────────────────
        case 'health_log': {
          const healthUserId = data.user_id as string;
          const healthDate = (data.date as string) || new Date().toLocaleDateString('en-CA');
          const { data: existing } = await supabase.from('health_metrics')
            .select('id').eq('user_id', healthUserId).eq('date', healthDate).limit(1);
          const metrics: Record<string, unknown> = {};
          for (const k of ['weight_kg', 'mood_score', 'energy_score', 'sleep_hours', 'sleep_quality', 'water_glasses', 'notes']) {
            if (data[k] !== undefined && data[k] !== null) metrics[k] = data[k];
          }
          if (existing?.length) {
            metrics.updated_at = new Date().toISOString();
            const { error: hErr } = await supabase.from('health_metrics').update(metrics).eq('id', existing[0].id);
            if (hErr) throw hErr;
          } else {
            metrics.user_id = healthUserId;
            metrics.date = healthDate;
            const { error: hErr } = await supabase.from('health_metrics').insert(metrics);
            if (hErr) throw hErr;
          }
          successes.push(`💪 ${action.summary}`);
          // Companion schedule event
          const healthTitle = data.sleep_hours ? `😴 Sleep: ${data.sleep_hours}h` : `💪 Health check-in`;
          await createCompanionEvent({
            userId: healthUserId,
            title: healthTitle,
            color: '#F43F5E',
            durationMin: (data.sleep_hours as number) ? (data.sleep_hours as number) * 60 : undefined,
          });
          break;
        }
        case 'meal_log': {
          const { error: mlErr } = await supabase.from('meals').insert(data);
          if (mlErr) throw mlErr;
          successes.push(`🍽️ ${action.summary}`);
          // Companion schedule event
          const mealEmoji: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍿' };
          const mealType = (data.meal_type as string) || 'meal';
          await createCompanionEvent({
            userId: data.user_id as string,
            title: `${mealEmoji[mealType] || '🍽️'} ${mealType.charAt(0).toUpperCase() + mealType.slice(1)}`,
            color: '#FDCB6E',
            durationMin: 30,
          });
          break;
        }
        case 'meditation_log': {
          const { error: medErr } = await supabase.from('meditation_logs').insert(data);
          if (medErr) throw medErr;
          successes.push(`🧘 ${action.summary}`);
          // Companion schedule event with duration
          await createCompanionEvent({
            userId: data.user_id as string,
            title: `🧘 Meditation`,
            color: '#A855F7',
            durationMin: (data.duration_min as number) || undefined,
          });
          break;
        }
        case 'gratitude': {
          const { error: grErr } = await supabase.from('gratitude_entries').insert(data);
          if (grErr) throw grErr;
          successes.push(`🙏 ${action.summary}`);
          await createCompanionEvent({
            userId: data.user_id as string,
            title: `🙏 Gratitude`,
            color: '#EC4899',
            durationMin: 15,
          });
          break;
        }
        case 'journal': {
          const { error: jErr } = await supabase.from('journal_entries').insert(data);
          if (jErr) throw jErr;
          successes.push(`📖 ${action.summary}`);
          await createCompanionEvent({
            userId: data.user_id as string,
            title: `📖 Journal`,
            color: '#EC4899',
            durationMin: 30,
          });
          break;
        }
        case 'log_workout': {
          const wData: Record<string, unknown> = { ...data };
          wData.started_at = new Date().toISOString();
          if (wData.completed) wData.completed_at = new Date().toISOString();
          const { error: wErr } = await supabase.from('exercise_logs').insert(wData);
          if (wErr) throw wErr;
          successes.push(`🏋️ ${action.summary}`);
          await createCompanionEvent({
            userId: data.user_id as string,
            title: `🏋️ Workout`,
            color: '#39FF14',
            durationMin: (data.duration_min as number) || 45,
          });
          break;
        }
        case 'body_marker': {
          const { error: bmErr } = await supabase.from('body_markers').insert(data);
          if (bmErr) throw bmErr;
          successes.push(`🩹 ${action.summary}`);
          break;
        }
        case 'goal_plan': {
          const plan = data as Record<string, any>;
          const planUserId = plan.user_id as string;
          logger.info('[goal_plan] Starting execution', { planUserId, hasObjective: !!plan.objective, goalsCount: plan.goals?.length, intake: plan.intake });
          if (!planUserId) {
            failures.push('❌ Goal plan missing user_id — cannot create goals');
            break;
          }
          const intake = plan.intake as { weekly_hours?: number; budget?: number | null; target_date?: string } | undefined;
          let objectiveId: string;
          let createdCounts = { objectives: 0, epics: 0, goals: 0, tasks: 0, habits: 0 };

          // Calculate estimated_hours from intake
          const targetDate = intake?.target_date || plan.epic?.target_date || null;
          const weeksUntilTarget = targetDate
            ? Math.max(1, Math.ceil((new Date(targetDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)))
            : null;

          // 1. Resolve or create objective
          if (plan.objective?.existing_id && UUID_REGEX.test(plan.objective.existing_id)) {
            objectiveId = plan.objective.existing_id;
          } else {
            const { data: newObj, error: objErr } = await supabase.from('goals').insert({
              user_id: planUserId,
              title: plan.objective?.title || 'New Objective',
              description: plan.objective?.title || '',
              category: 'objective',
              domain: plan.objective?.domain || null,
              status: 'active',
              color: plan.objective?.color || '#00D4FF',
              icon: plan.objective?.icon || '🎯',
              sort_order: 0,
              priority: 'high',
              estimated_hours: intake?.weekly_hours && weeksUntilTarget ? intake.weekly_hours * weeksUntilTarget : null,
              budget_allocated: intake?.budget || null,
              target_date: targetDate,
            }).select('id').single();
            if (objErr || !newObj) { logger.error('[goal_plan] Objective creation failed', objErr); throw new Error(`Failed to create objective: ${objErr?.message}`); }
            objectiveId = newObj.id;
            createdCounts.objectives = 1;
          }

          // 2. Create epic under objective
          const { data: newEpic, error: epicErr } = await supabase.from('goals').insert({
            user_id: planUserId,
            title: plan.epic?.title || 'New Epic',
            description: plan.epic?.description || '',
            category: 'epic',
            domain: plan.objective?.domain || null,
            parent_goal_id: objectiveId,
            status: 'active',
            target_date: plan.epic?.target_date || null,
            color: plan.objective?.color || '#00D4FF',
            icon: '⚡',
            sort_order: 0,
            priority: 'high',
          }).select('id').single();
          if (epicErr || !newEpic) { logger.error('[goal_plan] Epic creation failed', epicErr); throw new Error(`Failed to create epic: ${epicErr?.message}`); }
          createdCounts.epics = 1;

          // 3. Create goals under epic, with tasks under each goal
          const createdTaskRows: any[] = [];
          const goals = plan.goals || [];
          for (let gi = 0; gi < goals.length; gi++) {
            const g = goals[gi];
            const { data: newGoal, error: gErr } = await supabase.from('goals').insert({
              user_id: planUserId,
              title: g.title || `Goal ${gi + 1}`,
              description: g.description || '',
              category: 'goal',
              domain: plan.objective?.domain || null,
              parent_goal_id: newEpic.id,
              status: 'active',
              target_date: g.target_date || null,
              color: plan.objective?.color || '#00D4FF',
              icon: '🏁',
              sort_order: gi,
              priority: g.priority || 'medium',
            }).select('id').single();
            if (gErr || !newGoal) { failures.push(`❌ Failed to create goal: ${g.title}`); continue; }
            createdCounts.goals++;

            // Create tasks under this goal (collect for direct scheduling)
            const tasks = g.tasks || [];
            for (let ti = 0; ti < tasks.length; ti++) {
              const t = tasks[ti];
              const taskRow = {
                user_id: planUserId,
                title: t.title || `Task ${ti + 1}`,
                description: t.description || '',
                status: 'todo',
                priority: t.priority || 'medium',
                due_date: t.due_date || null,
                estimated_minutes: t.estimated_minutes || null,
                suggested_week: t.suggested_week || null,
                goal_id: newGoal.id,
                sort_order: ti,
                is_deleted: false,
                sync_status: 'synced',
              };
              const { data: newTask, error: tErr } = await supabase.from('tasks').insert(taskRow).select('id').single();
              if (tErr || !newTask) { failures.push(`❌ Failed to create task: ${t.title}`); continue; }
              createdTaskRows.push({ ...taskRow, id: newTask.id, created_at: new Date().toISOString() });
              createdCounts.tasks++;
            }
          }

          // 4. Create habits
          const habits = plan.habits || [];
          for (const h of habits) {
            const { error: hErr } = await supabase.from('habits').insert({
              user_id: planUserId,
              title: h.title || 'New Habit',
              description: h.description || '',
              frequency: h.frequency || 'daily',
              target_count: 1,
              icon: h.icon || '🔵',
              color: plan.objective?.color || '#00D4FF',
              is_active: true,
              streak_current: 0,
              streak_best: 0,
            });
            if (hErr) { failures.push(`❌ Failed to create habit: ${h.title}`); continue; }
            createdCounts.habits++;
          }

          // 5. Smart-schedule all objective tasks (pass directly — no re-fetch)
          if (createdTaskRows.length > 0) {
            try {
              const { scheduled } = await schedulePreloadedTasks(supabase, planUserId, createdTaskRows, { weeklyHours: intake?.weekly_hours });
              logger.log(`[intent] Scheduled ${scheduled}/${createdTaskRows.length} tasks`);
            } catch (e) {
              logger.warn('[intent] schedulePreloadedTasks failed:', e);
            }
          }

          const parts = [];
          if (createdCounts.objectives) parts.push(`1 objective`);
          parts.push(`1 epic`);
          if (createdCounts.goals) parts.push(`${createdCounts.goals} goals`);
          if (createdCounts.tasks) parts.push(`${createdCounts.tasks} tasks`);
          if (createdCounts.habits) parts.push(`${createdCounts.habits} daily habits`);
          successes.push(`🎯 Plan created: ${parts.join(', ')}`);
          break;
        }
        case 'business': {
          const { error } = await supabase.from('businesses').insert(data);
          if (error) throw error;
          successes.push(`🏢 ${action.summary}`);
          break;
        }
        case 'create_client': {
          const clientData: Record<string, unknown> = {
            user_id: data.user_id,
            name: data.name,
            business_id: data.business_id || null,
            rate: data.rate || null,
            rate_type: data.rate_type || 'per_clean',
            notes: data.notes || null,
            is_active: true,
          };
          const { error } = await supabase.from('clients').insert(clientData);
          if (error) throw error;
          successes.push(`👤 Client added: ${data.name}`);
          break;
        }
        case 'schedule_shift': {
          // User says "I'm on night shift now" or "switching to day shift"
          // Update schedule preferences and bulk reschedule unfinished tasks
          const shift = data as Record<string, any>;
          const shiftUserId = shift.user_id as string;
          
          // Update user's schedule preferences
          const newPrefs = {
            shift_pattern: shift.shift_pattern || 'custom',
            wake_time: shift.wake_time || null,
            sleep_time: shift.sleep_time || null,
            work_blocks: shift.work_blocks || [],
            blocked_times: shift.blocked_times || [],
          };
          
          await supabase.from('user_profiles').update({
            schedule_preferences: newPrefs,
          }).eq('user_id', shiftUserId);
          
          // Reschedule all future TODO tasks that have dates
          if (shift.reschedule_from && shift.reschedule_rules) {
            const { data: futureTasks } = await supabase.from('tasks')
              .select('id,title,due_date,estimated_minutes')
              .eq('user_id', shiftUserId)
              .eq('is_deleted', false)
              .eq('status', 'todo')
              .gte('due_date', shift.reschedule_from)
              .order('due_date');
            
            if (futureTasks && futureTasks.length > 0) {
              // Apply new time preferences to existing tasks
              // The LLM should have calculated new dates/times in reschedule_rules
              const rules = shift.reschedule_rules as Array<{task_id: string; new_due_date: string}>;
              for (const rule of rules) {
                await supabase.from('tasks').update({
                  due_date: rule.new_due_date,
                }).eq('id', rule.task_id);
              }
              successes.push(`🔄 Schedule shifted: ${rules.length} tasks rescheduled to fit ${shift.shift_pattern || 'new'} pattern`);
            } else {
              successes.push(`🔄 Schedule preferences updated to ${shift.shift_pattern || 'custom'} pattern`);
            }
          } else {
            successes.push(`🔄 Schedule preferences updated: ${shift.shift_pattern || 'custom'} shift pattern saved`);
          }
          break;
        }
        
        case 'reschedule_tasks': {
          // Bulk reschedule specific tasks
          const reschData = data as Record<string, any>;
          const moves = reschData.moves as Array<{task_id: string; new_due_date: string}> || [];
          let moved = 0;
          for (const m of moves) {
            const { error } = await supabase.from('tasks').update({
              due_date: m.new_due_date,
            }).eq('id', m.task_id);
            if (!error) moved++;
          }
          successes.push(`📅 Rescheduled ${moved} tasks`);
          break;
        }

        case 'update_schedule_preferences': {
          const prefData = data as Record<string, any>;
          await supabase.from('user_profiles').update({
            schedule_preferences: prefData.preferences,
          }).eq('user_id', prefData.user_id);
          successes.push(`⚙️ Schedule preferences updated`);
          break;
        }

        case 'orchestrator_tool': {
          // Orchestrator tools are handled by the AIChat component, not here.
          // The intent engine just passes them through. Mark as success.
          const toolName = data.tool as string;
          successes.push(`🧠 Running AI tool: ${toolName}`);
          break;
        }

        case 'navigate':
        case 'info':
          // No DB action needed
          successes.push(`ℹ️ ${action.summary}`);
          break;
        default:
          failures.push(`❓ Unknown action type: ${action.type}`);
      }
    } catch (err: unknown) {
      failures.push(`❌ ${action.summary}: ${getErrorMessage(err)}`);
    }
  }

  // Sync Supabase → local IndexedDB after any successful writes
  // This ensures data created via direct Supabase inserts is available
  // in the local-first store on next load (survives logout/login)
  if (successes.length > 0) {
    try {
      const { data: { session } } = await useUserStore.getState().getSessionCached();
      if (session?.user) {
        await syncNowImmediate(session.user.id);
        // Invalidate stores so they re-read from updated local DB
        useGoalsStore.getState().invalidate();
        useScheduleStore.getState().invalidate();
        useHabitsStore.getState().invalidate();
        useFinanceStore.getState().invalidate();
      }
    } catch (syncErr) {
      logger.warn('[executeActions] Post-action sync failed:', syncErr);
    }
  }

  return { successes, failures };
}

// ─── Settings helpers ────────────────────────────────────────────

export interface AISettings {
  provider: string;
  model: string;
  proxyUrl: string;
  enabled: boolean;
}

const AI_SETTINGS_KEY = 'lifeos-ai-settings';

const ALLOWED_PROVIDERS = ['openrouter', 'gemini', 'anthropic', 'openai'];

export function getAISettings(): AISettings {
  const defaults: AISettings = {
    provider: 'openrouter',
    model: 'google/gemini-2.0-flash-001',
    proxyUrl: '/api/llm-proxy.php',
    enabled: true,
  };
  try {
    const stored = localStorage.getItem(AI_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migrate from expired Gemini direct → OpenRouter
      if (parsed.provider === 'gemini') {
        parsed.provider = 'openrouter';
        parsed.model = 'google/gemini-2.0-flash-001';
        try { localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(parsed)); } catch { /* Safari private */ }
      }
      // Force provider to OpenRouter if saved provider isn't configured
      if (!ALLOWED_PROVIDERS.includes(parsed.provider)) {
        parsed.provider = 'openrouter';
        parsed.model = 'google/gemini-2.0-flash-001';
        try { localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(parsed)); } catch { /* Safari private */ }
      }
      return { ...defaults, ...parsed };
    }
  } catch { /* ignore */ }
  return defaults;
}

export function saveAISettings(settings: AISettings): void {
  try { localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Safari private */ }
}
