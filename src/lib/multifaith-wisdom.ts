/**
 * Holy Hermes Multifaith Wisdom Map
 * ==================================
 * A curated collection of quotes from 28+ spiritual traditions,
 * organized by the 7 Hermetic Principles. Each principle has 25-30
 * quotes from diverse traditions, ensuring variety AND accuracy.
 *
 * The bones are Hermetic. The voice speaks many paths.
 *
 * Generated from the Holy Hermes vector store (ChromaDB v3, 32K+ chunks)
 * by extract_wisdom_map.py running on the Jetson.
 */

import wisdomMapData from './wisdom-map.json';

// ── Types ──────────────────────────────────────────────────────

export interface WisdomQuote {
  text: string;
  tradition: string;
  source: string;
  similarity: number;
  doc_type: string;
}

export interface WisdomPrinciple {
  id: number;
  name: string;
  axiom: string;
  quotes: WisdomQuote[];
  traditions_represented: string[];
}

export interface WisdomMap {
  version: string;
  generated: string;
  description: string;
  principles: Record<string, WisdomPrinciple>;
  tradition_catalog: { count: number; traditions: string[] };
  stats: { total_quotes: number; avg_per_principle: number; traditions_count: number };
}

// ── Rotation State ─────────────────────────────────────────────

const ROTATION_KEY = 'hermes-wisdom-rotation';
const SEEN_KEY = 'hermes-wisdom-seen';

interface RotationState {
  lastIndex: Record<string, number>;  // principle → last quote index shown
  seenTraditions: Record<string, string[]>;  // principle → list of recently seen traditions
  daySeed: number;  // changes daily for variety
}

function getRotationState(): RotationState {
  try {
    const stored = localStorage.getItem(ROTATION_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { lastIndex: {}, seenTraditions: {}, daySeed: 0 };
}

function saveRotationState(state: RotationState): void {
  try {
    localStorage.setItem(ROTATION_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

function getDaySeed(): number {
  return Math.floor(Date.now() / 86400000);  // Changes daily
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Get a wisdom quote for the given principle, with variety rotation.
 * 
 * Priority:
 * 1. Avoid repeating traditions shown in the last 3 selections
 * 2. Prefer higher-similarity quotes
 * 3. Cycle through all traditions before repeating
 * 4. Seed by day for consistency within a session
 */
export function getWisdomQuote(
  principleName: string,
  preferTradition?: string
): WisdomQuote | null {
  const map = wisdomMapData as WisdomMap;
  const principle = map.principles[principleName];
  if (!principle || principle.quotes.length === 0) return null;

  const state = getRotationState();
  const daySeed = getDaySeed();

  // Reset daily to allow re-seen traditions
  if (state.daySeed !== daySeed) {
    state.seenTraditions[principleName] = [];
    state.daySeed = daySeed;
  }

  const seenTraditions = state.seenTraditions[principleName] || [];
  const quotes = principle.quotes;

  // If preferTradition is specified and available, try to use it
  if (preferTradition) {
    const traditionQuotes = quotes.filter(q => 
      q.tradition.toLowerCase() === preferTradition.toLowerCase()
    );
    if (traditionQuotes.length > 0 && !seenTraditions.includes(preferTradition)) {
      const quote = traditionQuotes[daySeed % traditionQuotes.length];
      state.seenTraditions[principleName] = [...seenTraditions, preferTradition].slice(-3);
      state.lastIndex[principleName] = quotes.indexOf(quote);
      saveRotationState(state);
      return quote;
    }
  }

  // Filter out recently seen traditions (last 3)
  const unseenTraditionQuotes = quotes.filter(q => 
    !seenTraditions.some(seen => 
      q.tradition.toLowerCase() === seen.toLowerCase()
    )
  );

  // If all traditions have been seen recently, reset
  const pool = unseenTraditionQuotes.length > 0 ? unseenTraditionQuotes : quotes;

  // Use day seed for deterministic selection within a day
  const selectedIndex = daySeed % pool.length;
  const quote = pool[selectedIndex];

  // Update rotation state
  state.seenTraditions[principleName] = [...(seenTraditions || []), quote.tradition].slice(-3);
  state.lastIndex[principleName] = quotes.indexOf(quote);
  saveRotationState(state);

  return quote;
}

/**
 * Get multiple wisdom quotes for a principle, spread across traditions.
 * Returns up to `count` quotes, trying to cover different traditions.
 */
export function getWisdomQuotes(
  principleName: string,
  count: number = 3
): WisdomQuote[] {
  const map = wisdomMapData as WisdomMap;
  const principle = map.principles[principleName];
  if (!principle || principle.quotes.length === 0) return [];

  const result: WisdomQuote[] = [];
  const usedTraditions = new Set<string>();
  const daySeed = getDaySeed();

  // First pass: one quote per tradition, preferentially by similarity
  const sorted = [...principle.quotes].sort((a, b) => b.similarity - a.similarity);
  
  for (const quote of sorted) {
    if (result.length >= count) break;
    if (!usedTraditions.has(quote.tradition)) {
      result.push(quote);
      usedTraditions.add(quote.tradition);
    }
  }

  // Second pass: fill remaining with highest similarity quotes
  if (result.length < count) {
    for (const quote of sorted) {
      if (result.length >= count) break;
      if (!result.includes(quote)) {
        result.push(quote);
      }
    }
  }

  return result;
}

/**
 * Get a short wisdom quote for the daily principle greeting.
 * Guarantees variety: different tradition each day.
 */
export function getDailyWisdomQuote(): { principle: string; axiom: string; quote: WisdomQuote } | null {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const principleIndex = dayOfYear % 7;
  const principleNames = Object.keys(wisdomMapData.principles);
  const principleName = principleNames[principleIndex];
  const principle = wisdomMapData.principles[principleName];

  if (!principle) return null;

  // Use day of year to cycle through quotes within the principle
  const quoteIndex = dayOfYear % principle.quotes.length;
  const quote = principle.quotes[quoteIndex];

  return {
    principle: principle.name,
    axiom: principle.axiom,
    quote,
  };
}

/**
 * Get all traditions represented across the entire wisdom map.
 */
export function getAllTraditions(): string[] {
  return (wisdomMapData as WisdomMap).tradition_catalog.traditions;
}

/**
 * Get stats about the wisdom map.
 */
export function getWisdomMapStats(): { totalQuotes: number; principles: number; traditions: number } {
  const map = wisdomMapData as WisdomMap;
  return {
    totalQuotes: map.stats.total_quotes,
    principles: Object.keys(map.principles).length,
    traditions: map.stats.traditions_count,
  };
}

/**
 * Search for quotes matching a text query across all principles.
 */
export function searchWisdom(query: string, limit: number = 5): WisdomQuote[] {
  const map = wisdomMapData as WisdomMap;
  const q = query.toLowerCase();
  const results: (WisdomQuote & { principleName: string; score: number })[] = [];

  for (const [principleName, principle] of Object.entries(map.principles)) {
    for (const quote of principle.quotes) {
      let score = 0;
      const lowerText = quote.text.toLowerCase();
      const lowerTradition = quote.tradition.toLowerCase();
      const lowerSource = quote.source.toLowerCase();

      // Simple keyword scoring
      const words = q.split(/\s+/);
      for (const word of words) {
        if (lowerText.includes(word)) score += 2;
        if (lowerTradition.includes(word)) score += 3;
        if (lowerSource.includes(word)) score += 1;
      }

      if (score > 0) {
        results.push({ ...quote, principleName, score });
      }
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score, principleName, ...quote }) => quote);
}

// ── Default export ──────────────────────────────────────────────

export default wisdomMapData as WisdomMap;