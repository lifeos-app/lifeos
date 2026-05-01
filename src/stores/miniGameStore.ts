/**
 * Mini-Game Store — Zustand with persist middleware
 *
 * Manages mini-game results, personal records, daily limits, leaderboards.
 * Offline-first with localStorage persistence.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { genId } from '../utils/date';
import { logger } from '../utils/logger';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export type MiniGameType = 'reflex' | 'memory' | 'typing' | 'math' | 'color_match' | 'pattern';

export interface MiniGameResult {
  id: string;
  game: MiniGameType;
  score: number;
  xpEarned: number;
  timestamp: string;
  isNewRecord: boolean;
  isDailyChallenge: boolean;
}

export interface PersonalRecord {
  game: MiniGameType;
  bestScore: number;
  totalGames: number;
  totalXPEarned: number;
  lastPlayed: string;
}

export interface DailyAttempts {
  game: MiniGameType;
  date: string; // YYYY-MM-DD
  attempts: number;
  maxAttempts: number;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  score: number;
  timestamp: string;
}

export interface MiniGameDefinition {
  id: MiniGameType;
  name: string;
  icon: string;
  description: string;
  color: string;
  bgGradient: string;
  difficulty: 'easy' | 'medium' | 'hard';
  rules: string;
}

// ═══════════════════════════════════════════════════
// GAME DEFINITIONS
// ═══════════════════════════════════════════════════

export const MINI_GAMES: MiniGameDefinition[] = [
  {
    id: 'reflex',
    name: 'Reflex Challenge',
    icon: '⚡',
    description: 'Test your reaction time! Wait for the signal and tap as fast as you can.',
    color: '#FACC15',
    bgGradient: 'from-yellow-500/20 to-orange-500/20',
    difficulty: 'easy',
    rules: '5 rounds. Lowest average ms wins. Sub-300ms earns bonus XP!',
  },
  {
    id: 'memory',
    name: 'Memory Match',
    icon: '🧠',
    description: 'Find matching pairs of cards. Train your short-term memory!',
    color: '#A855F7',
    bgGradient: 'from-purple-500/20 to-pink-500/20',
    difficulty: 'medium',
    rules: 'Flip cards to find pairs. Fewer moves = higher score.',
  },
  {
    id: 'typing',
    name: 'Typing Speed',
    icon: '⌨️',
    description: 'Type falling words before they hit the bottom. How fast can you go?',
    color: '#06B6D4',
    bgGradient: 'from-cyan-500/20 to-blue-500/20',
    difficulty: 'hard',
    rules: 'Type words as they fall. Faster + more accurate = higher score.',
  },
  {
    id: 'math',
    name: 'Math Puzzle',
    icon: '🔢',
    description: 'Solve arithmetic problems against the clock. Build mental math skills!',
    color: '#F97316',
    bgGradient: 'from-orange-500/20 to-red-500/20',
    difficulty: 'medium',
    rules: 'Solve math problems quickly. Streak bonuses for consecutive correct answers!',
  },
  {
    id: 'color_match',
    name: 'Color Match',
    icon: '🎨',
    description: 'Stroop challenge: tap the COLOR of the text, not the word!',
    color: '#EC4899',
    bgGradient: 'from-pink-500/20 to-rose-500/20',
    difficulty: 'hard',
    rules: 'The word says one color, but is written in another. Tap the actual color!',
  },
  {
    id: 'pattern',
    name: 'Pattern Recall',
    icon: '🔮',
    description: 'Remember and reproduce growing patterns. Simon-says style!',
    color: '#10B981',
    bgGradient: 'from-emerald-500/20 to-teal-500/20',
    difficulty: 'medium',
    rules: 'Watch the pattern, then repeat it. Sequences get longer each round.',
  },
];

export const MAX_DAILY_ATTEMPTS = 5;

// ═══════════════════════════════════════════════════
// DEMO LEADERBOARDS
// ═══════════════════════════════════════════════════

const DEMO_LEADERBOARD: Record<MiniGameType, LeaderboardEntry[]> = {
  reflex: [
    { userId: 'u1', username: 'FlashHand', score: 185, timestamp: new Date().toISOString() },
    { userId: 'u2', username: 'QuickDraw', score: 210, timestamp: new Date().toISOString() },
    { userId: 'u3', username: 'LightningPaw', score: 235, timestamp: new Date().toISOString() },
    { userId: 'u4', username: 'ReflexKing', score: 250, timestamp: new Date().toISOString() },
    { userId: 'u5', username: 'SpeedDemon', score: 270, timestamp: new Date().toISOString() },
  ],
  memory: [
    { userId: 'u1', username: 'MemoryMaster', score: 950, timestamp: new Date().toISOString() },
    { userId: 'u2', username: 'RecallChamp', score: 850, timestamp: new Date().toISOString() },
    { userId: 'u3', username: 'BrainBox', score: 720, timestamp: new Date().toISOString() },
    { userId: 'u4', username: 'SharpMind', score: 680, timestamp: new Date().toISOString() },
    { userId: 'u5', username: 'PairFinder', score: 600, timestamp: new Date().toISOString() },
  ],
  typing: [
    { userId: 'u1', username: 'TypeRacer', score: 85, timestamp: new Date().toISOString() },
    { userId: 'u2', username: 'KeyboardNinja', score: 72, timestamp: new Date().toISOString() },
    { userId: 'u3', username: 'FastFingers', score: 65, timestamp: new Date().toISOString() },
    { userId: 'u4', username: 'WordSmith', score: 55, timestamp: new Date().toISOString() },
    { userId: 'u5', username: 'KeyMaster', score: 48, timestamp: new Date().toISOString() },
  ],
  math: [
    { userId: 'u1', username: 'MathWhiz', score: 420, timestamp: new Date().toISOString() },
    { userId: 'u2', username: 'NumberNerd', score: 380, timestamp: new Date().toISOString() },
    { userId: 'u3', username: 'CalcKing', score: 350, timestamp: new Date().toISOString() },
    { userId: 'u4', username: 'AlgebraAce', score: 310, timestamp: new Date().toISOString() },
    { userId: 'u5', username: 'SigmaStar', score: 270, timestamp: new Date().toISOString() },
  ],
  color_match: [
    { userId: 'u1', username: 'ColorBlind', score: 28, timestamp: new Date().toISOString() },
    { userId: 'u2', username: 'StroopMaster', score: 24, timestamp: new Date().toISOString() },
    { userId: 'u3', username: 'HueHunter', score: 20, timestamp: new Date().toISOString() },
    { userId: 'u4', username: 'RainbowDash', score: 17, timestamp: new Date().toISOString() },
    { userId: 'u5', username: 'ChromaChamp', score: 14, timestamp: new Date().toISOString() },
  ],
  pattern: [
    { userId: 'u1', username: 'PatternPro', score: 12, timestamp: new Date().toISOString() },
    { userId: 'u2', username: 'SequenceSage', score: 10, timestamp: new Date().toISOString() },
    { userId: 'u3', username: 'RecallRuler', score: 8, timestamp: new Date().toISOString() },
    { userId: 'u4', username: 'EchoMind', score: 7, timestamp: new Date().toISOString() },
    { userId: 'u5', username: 'Simonsays', score: 6, timestamp: new Date().toISOString() },
  ],
};

// ═══════════════════════════════════════════════════
// STORE INTERFACE
// ═══════════════════════════════════════════════════

interface MiniGameState {
  results: MiniGameResult[];
  personalRecords: PersonalRecord[];
  dailyAttempts: DailyAttempts[];
  leaderboards: Record<MiniGameType, LeaderboardEntry[]>;
  dailyChallenge: { game: MiniGameType; date: string; multiplier: number };
  playingGame: MiniGameType | null;
  isPracticeMode: boolean;
}

interface MiniGameActions {
  // Game results
  submitResult: (game: MiniGameType, score: number, isPractice?: boolean) => MiniGameResult;
  calculateXP: (game: MiniGameType, score: number) => number;

  // Daily attempt tracking
  getRemainingAttempts: (game: MiniGameType) => number;
  canPlayCompetitive: (game: MiniGameType) => boolean;

  // Personal records
  getPersonalRecord: (game: MiniGameType) => PersonalRecord | undefined;

  // Leaderboard
  getLeaderboard: (game: MiniGameType) => LeaderboardEntry[];

  // Daily challenge
  getDailyChallenge: () => { game: MiniGameType; multiplier: number };

  // Game state
  startGame: (game: MiniGameType, isPractice: boolean) => void;
  endGame: () => void;
}

// ═══════════════════════════════════════════════════
// XP CALCULATION
// ═══════════════════════════════════════════════════

function getCachedDailyChallenge(): MiniGameType {
  const gameOrder: MiniGameType[] = ['reflex', 'memory', 'typing', 'math', 'color_match', 'pattern'];
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return gameOrder[dayOfYear % gameOrder.length];
}

// ═══════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════

export const useMiniGameStore = create<MiniGameState & MiniGameActions>()(
  persist(
    (set, get) => ({
      results: [],
      personalRecords: [],
      dailyAttempts: [],
      leaderboards: DEMO_LEADERBOARD,
      dailyChallenge: { game: getCachedDailyChallenge(), date: new Date().toISOString().split('T')[0], multiplier: 2 },
      playingGame: null,
      isPracticeMode: false,

      submitResult: (game, score, isPractice = false) => {
        if (isPractice) {
          // Practice mode: no XP, no record tracking
          return {
            id: genId('mgr-'),
            game,
            score,
            xpEarned: 0,
            timestamp: new Date().toISOString(),
            isNewRecord: false,
            isDailyChallenge: false,
          };
        }

        const state = get();
        const today = new Date().toISOString().split('T')[0];

        // Check daily attempt limit
        const dailyKey = `${game}-${today}`;
        const currentAttempt = state.dailyAttempts.find(d => `${d.game}-${d.date}` === dailyKey);
        if (currentAttempt && currentAttempt.attempts >= MAX_DAILY_ATTEMPTS) {
          logger.warn(`[mini-games] Daily attempt limit reached for ${game}`);
          return {
            id: genId('mgr-'),
            game,
            score,
            xpEarned: 0,
            timestamp: new Date().toISOString(),
            isNewRecord: false,
            isDailyChallenge: false,
          };
        }

        // Calculate XP
        const isDailyChallenge = state.dailyChallenge.game === game && state.dailyChallenge.date === today;
        let xp = state.calculateXP(game, score);
        if (isDailyChallenge) xp = Math.round(xp * state.dailyChallenge.multiplier);

        // Check if new record
        const existingRecord = state.personalRecords.find(r => r.game === game);
        const isNewRecord = !existingRecord || score > existingRecord.bestScore;

        const result: MiniGameResult = {
          id: genId('mgr-'),
          game,
          score,
          xpEarned: xp,
          timestamp: new Date().toISOString(),
          isNewRecord,
          isDailyChallenge,
        };

        // Update daily attempts
        const newDailyAttempts = [...state.dailyAttempts];
        const dailyIdx = newDailyAttempts.findIndex(d => `${d.game}-${d.date}` === dailyKey);
        if (dailyIdx >= 0) {
          newDailyAttempts[dailyIdx] = { ...newDailyAttempts[dailyIdx], attempts: newDailyAttempts[dailyIdx].attempts + 1 };
        } else {
          newDailyAttempts.push({ game, date: today, attempts: 1, maxAttempts: MAX_DAILY_ATTEMPTS });
        }

        // Update personal records
        const newRecords = [...state.personalRecords];
        const recordIdx = newRecords.findIndex(r => r.game === game);
        if (recordIdx >= 0) {
          const rec = newRecords[recordIdx];
          newRecords[recordIdx] = {
            ...rec,
            bestScore: isNewRecord ? score : rec.bestScore,
            totalGames: rec.totalGames + 1,
            totalXPEarned: rec.totalXPEarned + xp,
            lastPlayed: new Date().toISOString(),
          };
        } else {
          newRecords.push({
            game,
            bestScore: score,
            totalGames: 1,
            totalXPEarned: xp,
            lastPlayed: new Date().toISOString(),
          });
        }

        // Update leaderboard (insert user if high enough)
        const username = 'You';
        const newLeaderboards = { ...state.leaderboards };
        if (isNewRecord) {
          const lb = [...(newLeaderboards[game] || [])];
          const insertIdx = lb.findIndex(e => score > e.score);
          if (insertIdx >= 0) {
            lb.splice(insertIdx, 0, { userId: 'current-user', username, score, timestamp: new Date().toISOString() });
            if (lb.length > 10) lb.pop();
          } else if (lb.length < 10) {
            lb.push({ userId: 'current-user', username, score, timestamp: new Date().toISOString() });
          }
          newLeaderboards[game] = lb;
        }

        set({
          results: [...state.results, result],
          dailyAttempts: newDailyAttempts,
          personalRecords: newRecords,
          leaderboards: newLeaderboards,
        });

        return result;
      },

      calculateXP: (game, score) => {
        // Base XP: 5-50 based on game and score
        switch (game) {
          case 'reflex': {
            // Lower ms = better. Score is average ms.
            if (score < 200) return 50;
            if (score < 250) return 40;
            if (score < 300) return 30;
            if (score < 400) return 20;
            return 10;
          }
          case 'memory': {
            // Higher score = better
            return Math.min(50, Math.max(5, Math.round(score / 20)));
          }
          case 'typing': {
            // Score is WPM
            if (score > 80) return 50;
            if (score > 60) return 40;
            if (score > 40) return 30;
            if (score > 25) return 20;
            return 10;
          }
          case 'math': {
            // Score is points from correct answers + streak
            return Math.min(50, Math.max(5, Math.round(score / 10)));
          }
          case 'color_match': {
            // Score is correct answers in 30s
            return Math.min(50, Math.max(5, score * 2));
          }
          case 'pattern': {
            // Score is longest streak
            return Math.min(50, Math.max(5, score * 5));
          }
          default:
            return 5;
        }
      },

      getRemainingAttempts: (game) => {
        const today = new Date().toISOString().split('T')[0];
        const daily = get().dailyAttempts.find(d => d.game === game && d.date === today);
        if (!daily) return MAX_DAILY_ATTEMPTS;
        return Math.max(0, daily.maxAttempts - daily.attempts);
      },

      canPlayCompetitive: (game) => {
        return get().getRemainingAttempts(game) > 0;
      },

      getPersonalRecord: (game) => {
        return get().personalRecords.find(r => r.game === game);
      },

      getLeaderboard: (game) => {
        return get().leaderboards[game] || [];
      },

      getDailyChallenge: () => {
        const state = get();
        const today = new Date().toISOString().split('T')[0];
        if (state.dailyChallenge.date !== today) {
          const newDaily = { game: getCachedDailyChallenge(), date: today, multiplier: 2 };
          set({ dailyChallenge: newDaily });
          return { game: newDaily.game, multiplier: newDaily.multiplier };
        }
        return { game: state.dailyChallenge.game, multiplier: state.dailyChallenge.multiplier };
      },

      startGame: (game, isPractice) => {
        set({ playingGame: game, isPracticeMode: isPractice });
      },

      endGame: () => {
        set({ playingGame: null, isPracticeMode: false });
      },
    }),
    {
      name: 'lifeos-mini-games',
      partialize: (state) => ({
        results: state.results.slice(-100), // keep last 100
        personalRecords: state.personalRecords,
        dailyAttempts: state.dailyAttempts,
        leaderboards: state.leaderboards,
        dailyChallenge: state.dailyChallenge,
      }),
    }
  )
);