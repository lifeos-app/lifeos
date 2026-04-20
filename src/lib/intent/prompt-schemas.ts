/**
 * LifeOS Intent Engine — System Prompt Schemas
 *
 * Table schemas and classification rules embedded in the LLM system prompt.
 * The goal_plan schema is in goal-plan-schema.ts.
 */

import type { IntentContext } from './types';
import { buildGoalPlanSchema } from './goal-plan-schema';

// ─── Table Schemas ───────────────────────────────────────────────

export function buildTableSchemas(ctx: IntentContext): string {
  return `## TABLE SCHEMAS (data field format for each type)

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
1. **Fuel / petrol / gas / mileage / travel** → ALWAYS set is_deductible: true if linked to a business. Include "🚗" in description. If the user doesn't mention km, ASK in your follow_up: "How many km was the trip? (ATO rate: 88c/km for 2025-26)". Set travel_km if they mention distance.
2. **Business expense** → If the user says "under [business name]" or the expense is clearly for work (cleaning supplies, fuel for work, tools, uniforms, equipment), set business_id to the matching business UUID and is_deductible: true.
3. **Recurring expenses** → If the user mentions a weekly/monthly cost, set is_recurring: true and recurrence_rule.
4. **Multi-client expenses** → If the expense relates to multiple clients, mention ALL of them in the description (e.g., "Fuel for Client A and Client B runs — $100/week"). ONE expense, not two.
5. **Tax categories auto-detect:** fuel/petrol = deductible, phone/internet (work %) = deductible, tools/equipment = deductible, cleaning supplies = deductible, work clothing/uniform = deductible, insurance (work) = deductible.
6. **ATO context (Australia):** The current ATO cents-per-km rate is 88c/km (2025-26). Mention this in your reply when logging travel/fuel expenses so the user knows the tax benefit.

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

${buildGoalPlanSchema(ctx)}

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
}`;
}

// ─── Classification & Entity Rules ───────────────────────────────

export function buildClassificationRules(_ctx: IntentContext): string {
  return `## INTENT CLASSIFICATION — CRITICAL RULES
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
Always use the MIDDLE of the range as the estimate.`;
}

export function buildEntityRules(ctx: IntentContext): string {
  return `## RULES
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