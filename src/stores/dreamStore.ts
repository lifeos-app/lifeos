/**
 * Dream Store — Zustand + Persist
 *
 * Central store for dream journal entries with offline-first persistence.
 * Tracks dream narratives, mood tags, symbol tags, intensity, lucid state,
 * and next-day mood/health correlations.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { genId } from '../utils/date';
import { logger } from '../utils/logger';

// ── Types ────────────────────────────────────────────────────────────

export type DreamMood = 'mysterious' | 'anxious' | 'peaceful' | 'vivid' | 'nightmare' | 'lucid' | 'prophetic' | 'recurring';

export interface DreamEntry {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  narrative: string;
  mood_tags: DreamMood[];
  symbol_tags: string[];
  intensity: number; // 1-10
  isLucid: boolean;
  isRecurring: boolean;
  linked_tradition?: string; // which tradition's symbolism applies
  ai_interpretation?: string;
  following_day_mood?: number;
  following_day_energy?: number;
  created_at: string;
  updated_at: string;
}

export interface DreamStats {
  totalDreams: number;
  recurringThemes: number;
  averageIntensity: number;
  lucidDreamCount: number;
  topSymbols: { symbol: string; count: number }[];
  topMoods: { mood: DreamMood; count: number }[];
  currentStreak: number;
  longestStreak: number;
}

interface DreamState {
  entries: DreamEntry[];
  isLoaded: boolean;

  // CRUD
  addDream: (entry: Partial<DreamEntry>) => DreamEntry;
  updateDream: (id: string, updates: Partial<DreamEntry>) => void;
  deleteDream: (id: string) => void;

  // Selectors
  getDreamForDate: (date: string) => DreamEntry | undefined;
  getDreamsForMonth: (yearMonth: string) => DreamEntry[];
  getDreamById: (id: string) => DreamEntry | undefined;
  getStats: () => DreamStats;
  getRecurringSymbols: () => { symbol: string; count: number; dates: string[] }[];
  getSymbolCorrelations: () => { symbol: string; avgNextDayMood: number; avgNextDayEnergy: number; occurrenceCount: number }[];

  // Health linking
  linkNextDayMood: (dreamId: string, mood: number, energy: number) => void;

  // AI interpretation
  setInterpretation: (dreamId: string, interpretation: string) => void;
}

export const useDreamStore = create<DreamState>()(
  persist(
    (set, get) => ({
      entries: [],
      isLoaded: false,

      addDream: (data: Partial<DreamEntry>): DreamEntry => {
        const now = new Date().toISOString();
        const newEntry: DreamEntry = {
          id: genId(),
          date: data.date || now.split('T')[0],
          title: data.title || 'Untitled Dream',
          narrative: data.narrative || '',
          mood_tags: data.mood_tags || [],
          symbol_tags: data.symbol_tags || [],
          intensity: data.intensity ?? 5,
          isLucid: data.isLucid ?? false,
          isRecurring: data.isRecurring ?? false,
          linked_tradition: data.linked_tradition,
          ai_interpretation: data.ai_interpretation,
          following_day_mood: data.following_day_mood,
          following_day_energy: data.following_day_energy,
          created_at: now,
          updated_at: now,
        };
        set(s => ({ entries: [newEntry, ...s.entries] }));
        logger.info('[dream] Added dream entry:', newEntry.id);
        return newEntry;
      },

      updateDream: (id: string, updates: Partial<DreamEntry>) => {
        set(s => ({
          entries: s.entries.map(e =>
            e.id === id
              ? { ...e, ...updates, updated_at: new Date().toISOString() }
              : e
          ),
        }));
      },

      deleteDream: (id: string) => {
        set(s => ({ entries: s.entries.filter(e => e.id !== id) }));
        logger.info('[dream] Deleted dream entry:', id);
      },

      getDreamForDate: (date: string) => {
        return get().entries.find(e => e.date === date);
      },

      getDreamsForMonth: (yearMonth: string) => {
        return get().entries.filter(e => e.date.startsWith(yearMonth));
      },

      getDreamById: (id: string) => {
        return get().entries.find(e => e.id === id);
      },

      getStats: () => {
        const { entries } = get();
        const totalDreams = entries.length;

        // Average intensity
        const averageIntensity = totalDreams > 0
          ? Math.round((entries.reduce((sum, e) => sum + e.intensity, 0) / totalDreams) * 10) / 10
          : 0;

        // Lucid dream count
        const lucidDreamCount = entries.filter(e => e.isLucid).length;

        // Recurring themes (symbols appearing in 2+ dreams)
        const symbolCounts: Record<string, number> = {};
        entries.forEach(e => e.symbol_tags.forEach(s => {
          symbolCounts[s] = (symbolCounts[s] || 0) + 1;
        }));
        const recurringThemes = Object.values(symbolCounts).filter(c => c >= 2).length;

        // Top symbols
        const topSymbols = Object.entries(symbolCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([symbol, count]) => ({ symbol, count }));

        // Top moods
        const moodCounts: Record<string, number> = {};
        entries.forEach(e => e.mood_tags.forEach(m => {
          moodCounts[m] = (moodCounts[m] || 0) + 1;
        }));
        const topMoods = Object.entries(moodCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([mood, count]) => ({ mood: mood as DreamMood, count }));

        // Streak calculation
        const dateStrings = [...new Set(entries.map(e => e.date))].sort().reverse();
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;
        const today = new Date();

        if (dateStrings.length > 0) {
          // Check current streak from today backwards
          let checkDate = new Date(today);
          for (let i = 0; i < 365; i++) {
            const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
            if (dateStrings.includes(dateStr)) {
              currentStreak++;
            } else if (i > 0) {
              break; // Allow today to not have an entry yet, but break if yesterday doesn't
            }
            checkDate.setDate(checkDate.getDate() - 1);
          }
        }

        // Longest streak
        const sortedDates = [...new Set(entries.map(e => e.date))].sort();
        if (sortedDates.length > 0) {
          tempStreak = 1;
          for (let i = 1; i < sortedDates.length; i++) {
            const prev = new Date(sortedDates[i - 1] + 'T00:00:00');
            const curr = new Date(sortedDates[i] + 'T00:00:00');
            const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
            if (diffDays === 1) {
              tempStreak++;
            } else {
              longestStreak = Math.max(longestStreak, tempStreak);
              tempStreak = 1;
            }
          }
          longestStreak = Math.max(longestStreak, tempStreak);
        }

        return {
          totalDreams,
          recurringThemes,
          averageIntensity,
          lucidDreamCount,
          topSymbols,
          topMoods,
          currentStreak,
          longestStreak,
        };
      },

      getRecurringSymbols: () => {
        const { entries } = get();
        const symbolMap: Record<string, { count: number; dates: string[] }> = {};

        entries.forEach(e => {
          e.symbol_tags.forEach(s => {
            if (!symbolMap[s]) symbolMap[s] = { count: 0, dates: [] };
            symbolMap[s].count++;
            symbolMap[s].dates.push(e.date);
          });
        });

        return Object.entries(symbolMap)
          .filter(([, data]) => data.count >= 2)
          .map(([symbol, data]) => ({ symbol, ...data }))
          .sort((a, b) => b.count - a.count);
      },

      getSymbolCorrelations: () => {
        const { entries } = get();
        const correlations: Record<string, { moods: number[]; energies: number[]; count: number }> = {};

        entries.forEach(e => {
          if (e.following_day_mood != null || e.following_day_energy != null) {
            e.symbol_tags.forEach(s => {
              if (!correlations[s]) correlations[s] = { moods: [], energies: [], count: 0 };
              if (e.following_day_mood != null) correlations[s].moods.push(e.following_day_mood);
              if (e.following_day_energy != null) correlations[s].energies.push(e.following_day_energy);
              correlations[s].count++;
            });
          }
        });

        return Object.entries(correlations).map(([symbol, data]) => ({
          symbol,
          avgNextDayMood: data.moods.length > 0
            ? Math.round((data.moods.reduce((a, b) => a + b, 0) / data.moods.length) * 10) / 10
            : 0,
          avgNextDayEnergy: data.energies.length > 0
            ? Math.round((data.energies.reduce((a, b) => a + b, 0) / data.energies.length) * 10) / 10
            : 0,
          occurrenceCount: data.count,
        }));
      },

      linkNextDayMood: (dreamId: string, mood: number, energy: number) => {
        set(s => ({
          entries: s.entries.map(e =>
            e.id === dreamId
              ? { ...e, following_day_mood: mood, following_day_energy: energy, updated_at: new Date().toISOString() }
              : e
          ),
        }));
      },

      setInterpretation: (dreamId: string, interpretation: string) => {
        set(s => ({
          entries: s.entries.map(e =>
            e.id === dreamId
              ? { ...e, ai_interpretation: interpretation, updated_at: new Date().toISOString() }
              : e
          ),
        }));
      },
    }),
    {
      name: 'lifeos-dream-store',
      onRehydrateStorage: () => (state) => {
        if (state) state.isLoaded = true;
        logger.info('[dream] Store rehydrated');
      },
    }
  )
);