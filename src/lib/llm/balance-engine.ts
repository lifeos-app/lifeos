/**
 * LifeOS Balance Engine
 *
 * The philosophical core of LifeOS — measures how balanced your life is
 * across 6 key domains. Fetches XP data from Supabase, calculates a
 * balance score, and generates suggestions for improvement.
 *
 * Domains:
 *   Physical  — exercise, health metrics, body care
 *   Mental    — tasks, goals, education, learning
 *   Spiritual — junctions, meditation, gratitude, prayer
 *   Financial — income, expenses, budgeting
 *   Social    — events, partnerships, connections
 *   Creative  — journal entries, projects, creative work
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DomainXP {
  domain: BalanceDomain;
  label: string;
  icon: string;
  color: string;
  xp: number;
  /** Percentage of total XP in this domain */
  percentage: number;
  /** Number of activities in the last 7 days */
  recentActivity: number;
}

export type BalanceDomain = 'physical' | 'mental' | 'spiritual' | 'financial' | 'social' | 'creative';

export interface BalanceStatus {
  /** Overall balance score 0-100 (100 = perfectly balanced) */
  score: number;
  /** XP breakdown by domain */
  domains: DomainXP[];
  /** Total XP across all domains */
  totalXP: number;
  /** Strongest domain */
  strongest: DomainXP | null;
  /** Weakest domain */
  weakest: DomainXP | null;
  /** AI-ready suggestions for improvement */
  suggestions: string[];
  /** When this was calculated */
  calculatedAt: string;
}

// ── Domain Classification Map ──────────────────────────────────────────────────

/** Maps XP event categories to balance domains */
const CATEGORY_DOMAIN_MAP: Record<string, BalanceDomain> = {
  // Physical
  'exercise': 'physical',
  'workout': 'physical',
  'health': 'physical',
  'health_log': 'physical',
  'meal_log': 'physical',
  'body_marker': 'physical',
  'meditation_log': 'spiritual',  // spiritual, not physical
  'habit_health': 'physical',
  'habit_fitness': 'physical',

  // Mental
  'task': 'mental',
  'goal': 'mental',
  'goal_plan': 'mental',
  'education': 'mental',
  'learning': 'mental',
  'habit_learning': 'mental',
  'quest': 'mental',

  // Spiritual
  'spiritual': 'spiritual',
  'meditation': 'spiritual',
  'gratitude': 'spiritual',
  'prayer': 'spiritual',
  'junction': 'spiritual',
  'habit_mindfulness': 'spiritual',

  // Financial
  'expense': 'financial',
  'income': 'financial',
  'bill': 'financial',
  'finance': 'financial',
  'habit_finance': 'financial',
  'business': 'financial',

  // Social
  'social': 'social',
  'event': 'social',
  'partnership': 'social',
  'habit_social': 'social',
  'connection': 'social',

  // Creative
  'journal': 'creative',
  'creative': 'creative',
  'project': 'creative',
  'habit_creative': 'creative',
  'writing': 'creative',
};

/** Fallback: categorize by action_type if category not mapped */
const ACTION_TYPE_DOMAIN_MAP: Record<string, BalanceDomain> = {
  'task_complete': 'mental',
  'habit_log': 'mental',       // default; overridden by specific habit categories
  'goal_complete': 'mental',
  'journal_entry': 'creative',
  'health_log': 'physical',
  'expense_log': 'financial',
  'income_log': 'financial',
  'event_create': 'social',
  'meditation': 'spiritual',
  'gratitude': 'spiritual',
  'workout': 'physical',
  'meal_log': 'physical',
};

// ── Domain Metadata ────────────────────────────────────────────────────────────

const DOMAIN_META: Record<BalanceDomain, { label: string; icon: string; color: string }> = {
  physical:  { label: 'Physical',  icon: '💪', color: '#F43F5E' },
  mental:    { label: 'Mental',    icon: '🧠', color: '#3B82F6' },
  spiritual: { label: 'Spiritual', icon: '🙏', color: '#A855F7' },
  financial: { label: 'Financial', icon: '💰', color: '#22C55E' },
  social:    { label: 'Social',    icon: '👥', color: '#F97316' },
  creative:  { label: 'Creative',  icon: '🎨', color: '#EC4899' },
};

const ALL_DOMAINS: BalanceDomain[] = ['physical', 'mental', 'spiritual', 'financial', 'social', 'creative'];

// ── Cache ──────────────────────────────────────────────────────────────────────

const CACHE_KEY = 'lifeos_balance_status';

interface CachedBalance {
  date: string;
  userId: string;
  data: BalanceStatus;
}

function getCached(userId: string): BalanceStatus | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedBalance = JSON.parse(raw);
    const today = new Date().toISOString().split('T')[0];
    if (cached.date === today && cached.userId === userId) {
      return cached.data;
    }
    return null;
  } catch {
    return null;
  }
}

function setCache(userId: string, data: BalanceStatus) {
  try {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(CACHE_KEY, JSON.stringify({ date: today, userId, data }));
  } catch { /* quota exceeded — ignore */ }
}

export function clearBalanceCache() {
  localStorage.removeItem(CACHE_KEY);
}

// ── Core Functions ─────────────────────────────────────────────────────────────

/**
 * Classify an XP event into a balance domain.
 */
function classifyDomain(category: string | null, actionType: string | null): BalanceDomain {
  // Try category first
  if (category) {
    const cat = category.toLowerCase().replace(/\s+/g, '_');
    if (CATEGORY_DOMAIN_MAP[cat]) return CATEGORY_DOMAIN_MAP[cat];
    // Partial match
    for (const [key, domain] of Object.entries(CATEGORY_DOMAIN_MAP)) {
      if (cat.includes(key) || key.includes(cat)) return domain;
    }
  }

  // Try action_type
  if (actionType) {
    const act = actionType.toLowerCase().replace(/\s+/g, '_');
    if (ACTION_TYPE_DOMAIN_MAP[act]) return ACTION_TYPE_DOMAIN_MAP[act];
    for (const [key, domain] of Object.entries(ACTION_TYPE_DOMAIN_MAP)) {
      if (act.includes(key) || key.includes(act)) return domain;
    }
  }

  // Default to mental (tasks are the most common unclassified activity)
  return 'mental';
}

/**
 * Calculate the balance score (0-100).
 * 100 = perfectly even distribution across all domains.
 * Uses coefficient of variation (inverted and scaled).
 */
function calculateBalanceScore(domainXPs: number[]): number {
  const total = domainXPs.reduce((sum, xp) => sum + xp, 0);
  if (total === 0) return 0;

  const n = domainXPs.length;
  const mean = total / n;
  const variance = domainXPs.reduce((sum, xp) => sum + Math.pow(xp - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean; // coefficient of variation

  // CV of 0 = perfectly balanced (score 100)
  // CV of 1+ = very imbalanced (score ~0)
  // Scale: score = max(0, 100 - cv * 60)
  const score = Math.max(0, Math.min(100, Math.round(100 - cv * 60)));
  return score;
}

/**
 * Generate actionable suggestions based on balance data.
 */
function generateSuggestions(domains: DomainXP[], strongest: DomainXP | null, weakest: DomainXP | null): string[] {
  const suggestions: string[] = [];

  if (!weakest || !strongest) return ['Start logging activities to see your balance!'];

  // Gap-based suggestions
  if (strongest.xp > 0 && weakest.xp > 0) {
    const gap = strongest.xp - weakest.xp;
    suggestions.push(
      `Your ${weakest.icon} ${weakest.label} domain needs ~${gap.toLocaleString()} more XP to match ${strongest.icon} ${strongest.label}`
    );
  } else if (weakest.xp === 0) {
    suggestions.push(
      `${weakest.icon} ${weakest.label} has no activity yet — start with one small action today`
    );
  }

  // Domain-specific suggestions
  const domainSuggestions: Record<BalanceDomain, string[]> = {
    physical: ['Log a workout or go for a walk', 'Track your sleep and water intake', 'Do a quick 15-minute exercise'],
    mental: ['Complete a task from your backlog', 'Make progress on an active goal', 'Learn something new for 20 minutes'],
    spiritual: ['Try a 5-minute meditation', 'Write a gratitude entry', 'Spend time in quiet reflection'],
    financial: ['Log today\'s expenses', 'Review your monthly budget', 'Track a source of income'],
    social: ['Schedule a catch-up with a friend', 'Check in with your accountability partner', 'Attend or plan a social event'],
    creative: ['Write a journal entry', 'Work on a creative project', 'Sketch, draw, or brainstorm ideas'],
  };

  // Suggest for the two weakest domains
  const sorted = [...domains].sort((a, b) => a.xp - b.xp);
  for (const dom of sorted.slice(0, 2)) {
    const subs = domainSuggestions[dom.domain];
    if (subs?.length) {
      const randomSub = subs[Math.floor(Math.random() * subs.length)];
      suggestions.push(`${dom.icon} ${randomSub}`);
    }
  }

  // Inactivity warning
  const inactive = domains.filter(d => d.recentActivity === 0);
  if (inactive.length > 0 && inactive.length <= 3) {
    suggestions.push(
      `No activity in the last 7 days for: ${inactive.map(d => `${d.icon} ${d.label}`).join(', ')}`
    );
  }

  return suggestions.slice(0, 4); // Max 4 suggestions
}

// ── Main Entry Point ───────────────────────────────────────────────────────────

/**
 * Calculate the user's life balance status.
 * Fetches XP events, classifies them by domain, and scores the balance.
 *
 * @param userId   - LifeOS user ID
 * @param supabase - Authenticated Supabase client
 * @param options  - { forceRefresh: skip cache }
 */
export async function getBalanceStatus(
  userId: string,
  supabase: SupabaseClient,
  options: { forceRefresh?: boolean } = {},
): Promise<BalanceStatus> {
  // Check cache first
  if (!options.forceRefresh) {
    const cached = getCached(userId);
    if (cached) return cached;
  }

  // Fetch XP events from the last 30 days for balance calculation
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromDate = thirtyDaysAgo.toISOString();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentDate = sevenDaysAgo.toISOString();

  const { data: xpEvents, error } = await supabase
    .from('xp_events')
    .select('xp, category, action_type, created_at')
    .eq('user_id', userId)
    .gte('created_at', fromDate)
    .order('created_at', { ascending: false });

  if (error) {
    logger.warn('[BalanceEngine] Failed to fetch XP events:', error);
    // Return empty balance
    return buildEmptyBalance();
  }

  // Aggregate XP by domain
  const domainXPMap: Record<BalanceDomain, number> = {
    physical: 0, mental: 0, spiritual: 0, financial: 0, social: 0, creative: 0,
  };
  const domainRecentMap: Record<BalanceDomain, number> = {
    physical: 0, mental: 0, spiritual: 0, financial: 0, social: 0, creative: 0,
  };

  for (const event of (xpEvents || [])) {
    const domain = classifyDomain(event.category, event.action_type);
    domainXPMap[domain] += event.xp || 0;

    // Count recent activity (last 7 days)
    if (event.created_at && new Date(event.created_at) >= sevenDaysAgo) {
      domainRecentMap[domain]++;
    }
  }

  const totalXP = Object.values(domainXPMap).reduce((s, v) => s + v, 0);

  // Build domain array
  const domains: DomainXP[] = ALL_DOMAINS.map(key => ({
    domain: key,
    ...DOMAIN_META[key],
    xp: domainXPMap[key],
    percentage: totalXP > 0 ? Math.round((domainXPMap[key] / totalXP) * 100) : 0,
    recentActivity: domainRecentMap[key],
  }));

  // Find strongest and weakest
  const sorted = [...domains].sort((a, b) => b.xp - a.xp);
  const strongest = sorted[0]?.xp > 0 ? sorted[0] : null;
  const weakest = sorted[sorted.length - 1] || null;

  // Calculate balance score
  const score = calculateBalanceScore(domains.map(d => d.xp));

  // Generate suggestions
  const suggestions = generateSuggestions(domains, strongest, weakest);

  const status: BalanceStatus = {
    score,
    domains,
    totalXP,
    strongest,
    weakest,
    suggestions,
    calculatedAt: new Date().toISOString(),
  };

  // Cache the result
  setCache(userId, status);

  return status;
}

/**
 * Get a compact text summary of balance status for LLM context.
 */
export function formatBalanceForLLM(status: BalanceStatus): string {
  const lines = [
    `Life Balance Score: ${status.score}/100`,
    `Total XP (30 days): ${status.totalXP.toLocaleString()}`,
    '',
    'Domain Breakdown:',
    ...status.domains.map(d =>
      `  ${d.icon} ${d.label}: ${d.xp.toLocaleString()} XP (${d.percentage}%) · ${d.recentActivity} actions this week`
    ),
    '',
    status.strongest ? `Strongest: ${status.strongest.icon} ${status.strongest.label}` : '',
    status.weakest ? `Weakest: ${status.weakest.icon} ${status.weakest.label}` : '',
    '',
    'Suggestions:',
    ...status.suggestions.map(s => `  • ${s}`),
  ];

  return lines.filter(Boolean).join('\n');
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildEmptyBalance(): BalanceStatus {
  return {
    score: 0,
    domains: ALL_DOMAINS.map(key => ({
      domain: key,
      ...DOMAIN_META[key],
      xp: 0,
      percentage: 0,
      recentActivity: 0,
    })),
    totalXP: 0,
    strongest: null,
    weakest: null,
    suggestions: ['Start logging activities to build your balance profile!'],
    calculatedAt: new Date().toISOString(),
  };
}
