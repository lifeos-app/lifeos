/**
 * AI Meal Suggestions Engine
 *
 * Analyzes recent meals (7 days), active diet plan, health metrics,
 * and generates personalized meal suggestions via the LLM proxy.
 *
 * Caches suggestions daily in localStorage to avoid redundant LLM calls.
 */

import { supabase } from '../supabase';
import { callLLMJson } from '../llm-proxy';
import { logger } from '../../utils/logger';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MealSuggestion {
  id: string;
  name: string;
  description: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  prep_time_min: number;
  ingredients: { name: string; quantity: string; aisle: string }[];
  emoji: string;
  reason: string;
}

export interface MealSuggestionsResult {
  suggestions: MealSuggestion[];
  summary: string;
  nutrient_gaps: string[];
  generated_at: string;
}

// ── Cache ──────────────────────────────────────────────────────────────────────

const CACHE_KEY = 'lifeos_ai_meal_suggestions';

interface CachedSuggestions {
  date: string;
  userId: string;
  planId: string | null;
  data: MealSuggestionsResult;
}

function getCached(userId: string, planId: string | null): MealSuggestionsResult | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedSuggestions = JSON.parse(raw);
    const today = new Date().toISOString().split('T')[0];
    if (cached.date === today && cached.userId === userId && cached.planId === planId) {
      return cached.data;
    }
    return null;
  } catch {
    return null;
  }
}

function setCache(userId: string, planId: string | null, data: MealSuggestionsResult) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const cached: CachedSuggestions = { date: today, userId, planId, data };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch { /* quota exceeded — ignore */ }
}

export function clearSuggestionsCache() {
  localStorage.removeItem(CACHE_KEY);
}

// ── Data Collection ────────────────────────────────────────────────────────────

async function collectMealContext(userId: string) {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  const fromDate = sevenDaysAgo.toISOString().split('T')[0];
  const toDate = today.toISOString().split('T')[0];

  const [logsRes, planRes, metricsRes] = await Promise.all([
    // Recent nutrition logs (7 days)
    supabase
      .from('nutrition_logs')
      .select('date, meal_type, meal_name, calories, protein_g, carbs_g, fat_g')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: false }),

    // Active diet plan
    supabase
      .from('diet_plans')
      .select('name, type, daily_calories, macros, description')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .limit(1),

    // Recent health metrics (latest)
    supabase
      .from('health_metrics')
      .select('weight_kg, mood_score, energy_score, sleep_hours')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('date', { ascending: false })
      .limit(3),
  ]);

  const recentLogs = (logsRes.data || []) as {
    date: string; meal_type: string; meal_name: string;
    calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null;
  }[];

  const activePlan = (planRes.data?.[0] || null) as {
    name: string; type: string; daily_calories: number;
    macros: { protein: number; carbs: number; fat: number }; description: string | null;
  } | null;

  const healthMetrics = (metricsRes.data || []) as {
    weight_kg: number | null; mood_score: number | null;
    energy_score: number | null; sleep_hours: number | null;
  }[];

  // Compute 7-day averages
  const daysWithLogs = new Set(recentLogs.map(l => l.date)).size || 1;
  const totalCals = recentLogs.reduce((s, l) => s + (l.calories || 0), 0);
  const totalProtein = recentLogs.reduce((s, l) => s + (l.protein_g || 0), 0);
  const totalCarbs = recentLogs.reduce((s, l) => s + (l.carbs_g || 0), 0);
  const totalFat = recentLogs.reduce((s, l) => s + (l.fat_g || 0), 0);

  const avgDailyIntake = {
    calories: Math.round(totalCals / daysWithLogs),
    protein_g: Math.round(totalProtein / daysWithLogs),
    carbs_g: Math.round(totalCarbs / daysWithLogs),
    fat_g: Math.round(totalFat / daysWithLogs),
  };

  // Recent meal names for variety analysis
  const recentMealNames = [...new Set(recentLogs.map(l => l.meal_name).filter(Boolean))];

  // Meal type distribution
  const mealTypeCount: Record<string, number> = {};
  for (const l of recentLogs) {
    mealTypeCount[l.meal_type] = (mealTypeCount[l.meal_type] || 0) + 1;
  }

  return {
    avgDailyIntake,
    recentMealNames,
    mealTypeCount,
    activePlan,
    healthMetrics: healthMetrics[0] || null,
    logCount: recentLogs.length,
    daysWithLogs,
  };
}

// ── Main Generator ─────────────────────────────────────────────────────────────

export async function generateMealSuggestions(
  options: { forceRefresh?: boolean } = {},
): Promise<MealSuggestionsResult> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) throw new Error('Not authenticated');

  // Collect context
  const ctx = await collectMealContext(userId);

  // Extract plan ID for cache key (null if no active plan)
  const planId = ctx.activePlan ? String((ctx.activePlan as any).id || 'active') : null;

  // Check cache (unless force-refreshing)
  if (!options.forceRefresh) {
    const cached = getCached(userId, planId);
    if (cached) return cached;
  }

  // Build the prompt
  const prompt = buildPrompt(ctx);

  // Call LLM with fallback
  let result: MealSuggestionsResult;
  try {
    result = await callLLMJson<MealSuggestionsResult>(prompt, { timeoutMs: 45000 });
  } catch (err) {
    logger.warn('[meal-suggestions] LLM failed, using fallback:', err);
    result = generateFallbackMeals(ctx);
  }

  // Ensure IDs on each suggestion
  const withIds: MealSuggestionsResult = {
    ...result,
    generated_at: new Date().toISOString(),
    suggestions: (result.suggestions || []).map((s, i) => ({
      ...s,
      id: `ai-suggestion-${Date.now()}-${i}`,
      meal_type: normalizeMealType(s.meal_type),
    })),
  };

  // Cache
  setCache(userId, planId, withIds);

  return withIds;
}

function normalizeMealType(t: string): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const lower = (t || '').toLowerCase();
  if (lower.includes('breakfast')) return 'breakfast';
  if (lower.includes('lunch')) return 'lunch';
  if (lower.includes('dinner')) return 'dinner';
  return 'snack';
}

// ── Prompt Builder ─────────────────────────────────────────────────────────────

function buildPrompt(ctx: Awaited<ReturnType<typeof collectMealContext>>): string {
  const parts: string[] = [];

  parts.push('You are a nutrition AI for a personal health app. Generate personalized meal suggestions based on the user\'s data.');
  parts.push('');

  if (ctx.activePlan) {
    parts.push(`## Active Diet Plan: ${ctx.activePlan.name} (${ctx.activePlan.type})`);
    parts.push(`Target: ${ctx.activePlan.daily_calories} cal/day`);
    parts.push(`Macros: Protein ${ctx.activePlan.macros.protein}%, Carbs ${ctx.activePlan.macros.carbs}%, Fat ${ctx.activePlan.macros.fat}%`);
    if (ctx.activePlan.description) parts.push(`Plan description: ${ctx.activePlan.description}`);
    parts.push('');
  }

  if (ctx.logCount > 0) {
    parts.push('## Last 7 Days Intake (daily average):');
    parts.push(`Calories: ${ctx.avgDailyIntake.calories} cal | Protein: ${ctx.avgDailyIntake.protein_g}g | Carbs: ${ctx.avgDailyIntake.carbs_g}g | Fat: ${ctx.avgDailyIntake.fat_g}g`);
    parts.push(`Meals logged: ${ctx.logCount} across ${ctx.daysWithLogs} days`);
    parts.push('');

    if (ctx.recentMealNames.length > 0) {
      parts.push('## Recent Meals Eaten (for variety):');
      parts.push(ctx.recentMealNames.slice(0, 15).join(', '));
      parts.push('');
    }
  } else {
    parts.push('## User Context:');
    parts.push('User is just getting started - no nutrition logs yet.');
    parts.push('Provide balanced, healthy meal suggestions suitable for general wellness.');
    parts.push('');
  }

  if (ctx.healthMetrics) {
    parts.push('## Health Context:');
    if (ctx.healthMetrics.weight_kg) parts.push(`Weight: ${ctx.healthMetrics.weight_kg} kg`);
    if (ctx.healthMetrics.energy_score) parts.push(`Energy: ${ctx.healthMetrics.energy_score}/10`);
    if (ctx.healthMetrics.sleep_hours) parts.push(`Sleep: ${ctx.healthMetrics.sleep_hours} hours`);
    parts.push('');
  }

  parts.push('## Instructions:');
  parts.push('Generate exactly 5 meal suggestions. Include a mix of meal types (breakfast, lunch, dinner, snack).');
  parts.push('- Suggest meals the user has NOT been eating recently (variety)');
  parts.push('- Fill nutrient gaps based on their average intake vs. plan targets');
  parts.push('- Keep meals practical (under 30 min prep preferred)');
  parts.push('- Include ingredients with quantities and grocery aisle');
  parts.push('');

  parts.push('Respond in this exact JSON format:');
  parts.push('```json');
  parts.push(JSON.stringify({
    suggestions: [{
      name: "Meal Name",
      description: "Brief description (1-2 sentences)",
      meal_type: "breakfast|lunch|dinner|snack",
      calories: 400,
      protein_g: 30,
      carbs_g: 40,
      fat_g: 15,
      prep_time_min: 15,
      ingredients: [{ name: "Chicken breast", quantity: "200g", aisle: "protein" }],
      emoji: "🍗",
      reason: "Why this meal fits their goals (1 sentence)"
    }],
    summary: "Brief overview of the suggestions strategy",
    nutrient_gaps: ["List of identified nutrient gaps, e.g. 'Low protein intake'"]
  }, null, 2));
  parts.push('```');

  return parts.join('\n');
}

// ── Fallback Meals ──────────────────────────────────────────────────────────────

function generateFallbackMeals(ctx: Awaited<ReturnType<typeof collectMealContext>>): MealSuggestionsResult {
  const dietType = ctx.activePlan?.type?.toLowerCase() || 'balanced';

  const fallbackMeals: MealSuggestion[] = [
    {
      id: `fallback-${Date.now()}-0`,
      name: 'Greek Yogurt Power Bowl',
      description: 'High-protein breakfast with berries and granola.',
      meal_type: 'breakfast',
      calories: 380,
      protein_g: 28,
      carbs_g: 42,
      fat_g: 12,
      prep_time_min: 5,
      ingredients: [
        { name: 'Greek yogurt', quantity: '200g', aisle: 'dairy' },
        { name: 'Mixed berries', quantity: '100g', aisle: 'produce' },
        { name: 'Granola', quantity: '40g', aisle: 'cereal' },
        { name: 'Honey', quantity: '1 tbsp', aisle: 'condiments' },
      ],
      emoji: '🥣',
      reason: 'Balanced breakfast with protein to start the day.',
    },
    {
      id: `fallback-${Date.now()}-1`,
      name: 'Grilled Chicken Salad',
      description: 'Fresh mixed greens with grilled chicken and light vinaigrette.',
      meal_type: 'lunch',
      calories: 450,
      protein_g: 38,
      carbs_g: 18,
      fat_g: 22,
      prep_time_min: 20,
      ingredients: [
        { name: 'Chicken breast', quantity: '180g', aisle: 'protein' },
        { name: 'Mixed greens', quantity: '150g', aisle: 'produce' },
        { name: 'Cherry tomatoes', quantity: '80g', aisle: 'produce' },
        { name: 'Olive oil', quantity: '1 tbsp', aisle: 'oils' },
        { name: 'Lemon', quantity: '1/2', aisle: 'produce' },
      ],
      emoji: '🥗',
      reason: 'High protein, low carb lunch for sustained energy.',
    },
    {
      id: `fallback-${Date.now()}-2`,
      name: 'Salmon with Roasted Vegetables',
      description: 'Omega-3 rich salmon fillet with seasonal roasted veggies.',
      meal_type: 'dinner',
      calories: 520,
      protein_g: 35,
      carbs_g: 30,
      fat_g: 28,
      prep_time_min: 30,
      ingredients: [
        { name: 'Salmon fillet', quantity: '180g', aisle: 'seafood' },
        { name: 'Broccoli', quantity: '120g', aisle: 'produce' },
        { name: 'Sweet potato', quantity: '150g', aisle: 'produce' },
        { name: 'Olive oil', quantity: '1 tbsp', aisle: 'oils' },
      ],
      emoji: '🐟',
      reason: 'Rich in omega-3 and micronutrients for recovery.',
    },
    {
      id: `fallback-${Date.now()}-3`,
      name: 'Apple & Almond Butter Snack',
      description: 'Quick energy boost with healthy fats and fiber.',
      meal_type: 'snack',
      calories: 220,
      protein_g: 6,
      carbs_g: 28,
      fat_g: 12,
      prep_time_min: 2,
      ingredients: [
        { name: 'Apple', quantity: '1 medium', aisle: 'produce' },
        { name: 'Almond butter', quantity: '2 tbsp', aisle: 'spreads' },
      ],
      emoji: '🍎',
      reason: 'Quick healthy snack with fiber and healthy fats.',
    },
    {
      id: `fallback-${Date.now()}-4`,
      name: 'Overnight Oats',
      description: 'Prep-ahead breakfast with oats, chia seeds, and banana.',
      meal_type: 'breakfast',
      calories: 400,
      protein_g: 14,
      carbs_g: 58,
      fat_g: 12,
      prep_time_min: 5,
      ingredients: [
        { name: 'Rolled oats', quantity: '60g', aisle: 'cereal' },
        { name: 'Milk', quantity: '200ml', aisle: 'dairy' },
        { name: 'Chia seeds', quantity: '1 tbsp', aisle: 'health' },
        { name: 'Banana', quantity: '1', aisle: 'produce' },
      ],
      emoji: '🥣',
      reason: 'Easy prep-ahead meal with sustained energy release.',
    },
  ];

  // If diet type is keto/low-carb, swap high-carb meals
  if (dietType.includes('keto') || dietType.includes('low-carb')) {
    fallbackMeals[4] = {
      id: `fallback-${Date.now()}-4`,
      name: 'Avocado Egg Cups',
      description: 'Baked eggs in avocado halves with cheese.',
      meal_type: 'breakfast',
      calories: 350,
      protein_g: 18,
      carbs_g: 8,
      fat_g: 28,
      prep_time_min: 15,
      ingredients: [
        { name: 'Avocado', quantity: '1', aisle: 'produce' },
        { name: 'Eggs', quantity: '2', aisle: 'dairy' },
        { name: 'Cheese', quantity: '30g', aisle: 'dairy' },
      ],
      emoji: '🥑',
      reason: 'Low-carb, high-fat breakfast aligned with your diet plan.',
    };
  }

  return {
    suggestions: fallbackMeals,
    summary: 'Fallback suggestions based on general balanced nutrition (AI was unavailable).',
    nutrient_gaps: [],
    generated_at: new Date().toISOString(),
  };
}

// ── Grocery Integration ────────────────────────────────────────────────────────

/**
 * Add a meal suggestion's ingredients to the nutrition grocery list.
 */
export async function addSuggestionToGroceryList(suggestion: MealSuggestion): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return false;

  // Get Monday of current week
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(d.setDate(diff)).toISOString().split('T')[0];

  const items = suggestion.ingredients.map(ing => ({
    user_id: userId,
    week_start: weekStart,
    name: ing.name,
    quantity: parseFloat(ing.quantity) || null,
    unit: ing.quantity.replace(/[\d.]/g, '').trim() || null,
    aisle: ing.aisle || 'other',
    source_meal_ids: [suggestion.id],
    is_checked: false,
    is_manual: false,
  }));

  if (items.length === 0) return false;

  const { error } = await supabase.from('nutrition_grocery_items').insert(items);
  if (error) {
    logger.error('[addSuggestionToGrocery]', error.message);
    return false;
  }

  return true;
}
