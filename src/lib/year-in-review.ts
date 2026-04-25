/**
 * Year in Review — Annual stats aggregation
 *
 * Generates comprehensive year-end data from all LifeOS stores.
 */

export interface YearInReviewData {
  year: number;

  // Productivity
  tasksCompleted: number;
  totalFocusMinutes: number;
  mostProductiveMonth: string;
  tasksByMonth: number[];

  // Habits
  totalHabitLogs: number;
  bestStreak: number;
  mostConsistentHabit: string;
  habitCompletionRate: number;
  habitLogsByMonth: number[];

  // Health
  avgSleep: number;
  avgMood: number;
  bestWellnessMonth: string;
  workoutsLogged: number;

  // Finances
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  largestExpenseCategory: string;
  incomeByMonth: number[];
  expensesByMonth: number[];

  // Growth
  xpEarned: number;
  levelsGained: number;
  achievementsUnlocked: number;
  journalEntriesWritten: number;

  // Goals
  goalsCompleted: number;
  goalCompletionPercent: number;
  mostProgressedGoal: string;

  // Highlights
  topHighlights: string[];

  // Word cloud
  wordCloud: Array<{ word: string; count: number }>;
}

export interface YearComparison {
  tasksCompletedChange: number | null;
  habitLogsChange: number | null;
  journalEntriesChange: number | null;
  savingsRateChange: number | null;
  xpEarnedChange: number | null;
}

interface ReviewStores {
  tasks: Array<{ status?: string; completed_at?: string; created_at: string; actual_duration?: number; scheduled_date?: string; due_date?: string }>;
  habits: Array<{ id: string; title: string; streak_best: number }>;
  habitLogs: Array<{ habit_id: string; date: string }>;
  goals: Array<{ id: string; title: string; status?: string; progress?: number }>;
  income: Array<{ amount: number; date: string }>;
  expenses: Array<{ amount: number; date: string; category_id?: string; description?: string }>;
  journalEntries: Array<{ date: string; content: string; title?: string }>;
  healthMetrics: Array<{ date: string; mood_score?: number; sleep_hours?: number; exercise_minutes?: number }>;
  xpTotal: number;
  level: number;
  achievements: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Common English stop words to filter out of word cloud
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do',
  'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can',
  'not', 'no', 'so', 'if', 'then', 'than', 'that', 'this', 'it', 'its', 'i', 'me',
  'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them', 'their', 'what',
  'which', 'who', 'when', 'where', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'some', 'any', 'just', 'also', 'very', 'really', 'about', 'up',
  'out', 'much', 'still', 'even', 'way', 'thing', 'things', 'like', 'get', 'got',
  'go', 'going', 'went', 'come', 'make', 'made', 'know', 'think', 'thought', 'feel',
  'felt', 'day', 'today', 'time', 'well', 'back', 'one', 'two', 'am', 'pm',
  'dont', 'didnt', 'cant', 'wont', 'im', 'ive',
]);

function isInYear(dateStr: string, year: number): boolean {
  return dateStr.startsWith(String(year));
}

function getMonth(dateStr: string): number {
  return parseInt(dateStr.slice(5, 7), 10) - 1;
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export function generateYearInReview(year: number, stores: ReviewStores): YearInReviewData {
  const yearStr = String(year);

  // --- Productivity ---
  const yearTasks = stores.tasks.filter(t => {
    const dateStr = t.completed_at || t.scheduled_date || t.due_date || t.created_at;
    return dateStr && isInYear(dateStr, year);
  });
  const completedTasks = yearTasks.filter(t => t.status === 'done' || t.status === 'completed');
  const tasksByMonth = Array(12).fill(0);
  for (const t of completedTasks) {
    const dateStr = t.completed_at || t.scheduled_date || t.due_date || t.created_at;
    if (dateStr) tasksByMonth[getMonth(dateStr)]++;
  }
  const mostProductiveMonthIdx = tasksByMonth.indexOf(Math.max(...tasksByMonth));
  const totalFocusMinutes = yearTasks.reduce((sum, t) => sum + (t.actual_duration || 0), 0);

  // --- Habits ---
  const yearHabitLogs = stores.habitLogs.filter(l => isInYear(l.date, year));
  const habitLogsByMonth = Array(12).fill(0);
  for (const l of yearHabitLogs) {
    habitLogsByMonth[getMonth(l.date)]++;
  }

  // Most consistent habit (most logs)
  const habitLogCounts: Record<string, number> = {};
  for (const l of yearHabitLogs) {
    habitLogCounts[l.habit_id] = (habitLogCounts[l.habit_id] || 0) + 1;
  }
  let mostConsistentHabitId = '';
  let mostConsistentCount = 0;
  for (const [id, count] of Object.entries(habitLogCounts)) {
    if (count > mostConsistentCount) {
      mostConsistentCount = count;
      mostConsistentHabitId = id;
    }
  }
  const mostConsistentHabit = stores.habits.find(h => h.id === mostConsistentHabitId)?.title || 'N/A';
  const bestStreak = Math.max(0, ...stores.habits.map(h => h.streak_best));

  // Habit completion rate: total logs / (habits * days in year so far)
  const daysInYear = year === new Date().getFullYear()
    ? Math.ceil((Date.now() - new Date(year, 0, 1).getTime()) / 86400000)
    : (year % 4 === 0 ? 366 : 365);
  const habitCompletionRate = stores.habits.length > 0
    ? Math.round((yearHabitLogs.length / (stores.habits.length * daysInYear)) * 100)
    : 0;

  // --- Health ---
  const yearHealth = stores.healthMetrics.filter(m => isInYear(m.date, year));
  const sleepEntries = yearHealth.filter(m => m.sleep_hours && m.sleep_hours > 0);
  const avgSleep = sleepEntries.length > 0
    ? Math.round((sleepEntries.reduce((s, m) => s + (m.sleep_hours || 0), 0) / sleepEntries.length) * 10) / 10
    : 0;
  const moodEntries = yearHealth.filter(m => m.mood_score && m.mood_score > 0);
  const avgMood = moodEntries.length > 0
    ? Math.round((moodEntries.reduce((s, m) => s + (m.mood_score || 0), 0) / moodEntries.length) * 10) / 10
    : 0;
  const workoutsLogged = yearHealth.filter(m => m.exercise_minutes && m.exercise_minutes > 0).length;

  // Best wellness month (most health entries)
  const healthByMonth = Array(12).fill(0);
  for (const m of yearHealth) healthByMonth[getMonth(m.date)]++;
  const bestWellnessIdx = healthByMonth.indexOf(Math.max(...healthByMonth));

  // --- Finances ---
  const yearIncome = stores.income.filter(i => isInYear(i.date, year));
  const yearExpenses = stores.expenses.filter(e => isInYear(e.date, year));
  const totalIncome = yearIncome.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = yearExpenses.reduce((s, e) => s + e.amount, 0);
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0;

  const incomeByMonth = Array(12).fill(0);
  for (const i of yearIncome) incomeByMonth[getMonth(i.date)] += i.amount;
  const expensesByMonth = Array(12).fill(0);
  for (const e of yearExpenses) expensesByMonth[getMonth(e.date)] += e.amount;

  // Largest expense category
  const catTotals: Record<string, number> = {};
  for (const e of yearExpenses) {
    const cat = e.category_id || e.description || 'Uncategorized';
    catTotals[cat] = (catTotals[cat] || 0) + e.amount;
  }
  let largestExpenseCategory = 'N/A';
  let largestCatAmount = 0;
  for (const [cat, amt] of Object.entries(catTotals)) {
    if (amt > largestCatAmount) {
      largestCatAmount = amt;
      largestExpenseCategory = cat;
    }
  }

  // --- Growth ---
  const yearJournals = stores.journalEntries.filter(e => isInYear(e.date, year));

  // --- Goals ---
  const completedGoals = stores.goals.filter(g => g.status === 'completed' || g.status === 'done');
  const goalCompletionPercent = stores.goals.length > 0
    ? Math.round((completedGoals.length / stores.goals.length) * 100)
    : 0;
  let mostProgressedGoal = 'N/A';
  let maxProgress = 0;
  for (const g of stores.goals) {
    if ((g.progress || 0) > maxProgress) {
      maxProgress = g.progress || 0;
      mostProgressedGoal = g.title;
    }
  }

  // --- Highlights ---
  const highlights: string[] = [];
  if (completedTasks.length > 0) highlights.push(`You completed ${completedTasks.length} tasks!`);
  if (yearHabitLogs.length > 0) highlights.push(`You logged ${yearHabitLogs.length} habit completions!`);
  if (bestStreak > 0) highlights.push(`Your best streak reached ${bestStreak} days!`);
  if (yearJournals.length > 0) highlights.push(`You wrote ${yearJournals.length} journal entries!`);
  if (totalIncome > 0) highlights.push(`You earned $${totalIncome.toLocaleString()} this year!`);

  // --- Word Cloud ---
  const wordFreq: Record<string, number> = {};
  for (const entry of yearJournals) {
    const text = `${entry.title || ''} ${entry.content || ''}`.toLowerCase();
    const words = text.replace(/[^a-z\s]/g, '').split(/\s+/);
    for (const word of words) {
      if (word.length < 3 || STOP_WORDS.has(word)) continue;
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  }
  const wordCloud = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }));

  return {
    year,
    tasksCompleted: completedTasks.length,
    totalFocusMinutes,
    mostProductiveMonth: MONTH_NAMES[mostProductiveMonthIdx] || 'N/A',
    tasksByMonth,
    totalHabitLogs: yearHabitLogs.length,
    bestStreak,
    mostConsistentHabit,
    habitCompletionRate,
    habitLogsByMonth,
    avgSleep,
    avgMood,
    bestWellnessMonth: MONTH_NAMES[bestWellnessIdx] || 'N/A',
    workoutsLogged,
    totalIncome,
    totalExpenses,
    savingsRate,
    largestExpenseCategory,
    incomeByMonth,
    expensesByMonth,
    xpEarned: stores.xpTotal,
    levelsGained: stores.level,
    achievementsUnlocked: stores.achievements,
    journalEntriesWritten: yearJournals.length,
    goalsCompleted: completedGoals.length,
    goalCompletionPercent,
    mostProgressedGoal,
    topHighlights: highlights.slice(0, 5),
    wordCloud,
  };
}

export function getYearComparison(currentYear: YearInReviewData, lastYear?: YearInReviewData): YearComparison {
  if (!lastYear) {
    return {
      tasksCompletedChange: null,
      habitLogsChange: null,
      journalEntriesChange: null,
      savingsRateChange: null,
      xpEarnedChange: null,
    };
  }
  return {
    tasksCompletedChange: percentChange(currentYear.tasksCompleted, lastYear.tasksCompleted),
    habitLogsChange: percentChange(currentYear.totalHabitLogs, lastYear.totalHabitLogs),
    journalEntriesChange: percentChange(currentYear.journalEntriesWritten, lastYear.journalEntriesWritten),
    savingsRateChange: percentChange(currentYear.savingsRate, lastYear.savingsRate),
    xpEarnedChange: percentChange(currentYear.xpEarned, lastYear.xpEarned),
  };
}
