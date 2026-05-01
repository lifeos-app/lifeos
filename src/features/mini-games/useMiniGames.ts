/**
 * useMiniGames — Core hook for the Mini-Games system
 *
 * Provides game state, results tracking, daily challenges,
 * XP calculation, and leaderboard integration.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  useMiniGameStore,
  type MiniGameType,
  type MiniGameResult,
  type MiniGameDefinition,
  MINI_GAMES,
  MAX_DAILY_ATTEMPTS,
} from '../../stores/miniGameStore';

export type { MiniGameType, MiniGameResult, MiniGameDefinition };

export function useMiniGames() {
  const store = useMiniGameStore();

  const [selectedGame, setSelectedGame] = useState<MiniGameType | null>(null);
  const [gameMode, setGameMode] = useState<'practice' | 'competitive'>('competitive');

  // Get today's daily challenge
  const dailyChallenge = useMemo(() => store.getDailyChallenge(), [store.dailyChallenge]);

  // Personal records map
  const recordsMap = useMemo(() => {
    const map = new Map<MiniGameType, typeof store.personalRecords[0]>();
    store.personalRecords.forEach(r => map.set(r.game, r));
    return map;
  }, [store.personalRecords]);

  // Remaining attempts map
  const attemptsMap = useMemo(() => {
    const map = new Map<MiniGameType, number>();
    MINI_GAMES.forEach(g => map.set(g.id, store.getRemainingAttempts(g.id)));
    return map;
  }, [store.dailyAttempts]);

  // Submit a game result
  const submitResult = useCallback((game: MiniGameType, score: number): MiniGameResult => {
    return store.submitResult(game, score, gameMode === 'practice');
  }, [store, gameMode]);

  // Get remaining attempts for a game
  const getRemainingAttempts = useCallback((game: MiniGameType): number => {
    return store.getRemainingAttempts(game);
  }, [store]);

  // Check if can play competitive
  const canPlayCompetitive = useCallback((game: MiniGameType): boolean => {
    return store.canPlayCompetitive(game);
  }, [store]);

  // Get personal record for a game
  const getPersonalRecord = useCallback((game: MiniGameType) => {
    return store.getPersonalRecord(game);
  }, [store]);

  // Get leaderboard for a game
  const getLeaderboard = useCallback((game: MiniGameType) => {
    return store.getLeaderboard(game);
  }, [store]);

  // Calculate XP for a score
  const calculateXP = useCallback((game: MiniGameType, score: number): number => {
    return store.calculateXP(game, score);
  }, [store]);

  // Start game
  const startGame = useCallback((game: MiniGameType, isPractice: boolean) => {
    setGameMode(isPractice ? 'practice' : 'competitive');
    setSelectedGame(game);
    store.startGame(game, isPractice);
  }, [store]);

  // End game
  const endGame = useCallback(() => {
    setSelectedGame(null);
    store.endGame();
  }, [store]);

  return {
    // Game definitions
    games: MINI_GAMES,
    getGameDef: (id: MiniGameType) => MINI_GAMES.find(g => g.id === id),

    // State
    selectedGame,
    gameMode,
    results: store.results,
    personalRecords: store.personalRecords,
    dailyAttempts: store.dailyAttempts,
    dailyChallenge,

    // Maps
    recordsMap,
    attemptsMap,

    // Constants
    MAX_DAILY_ATTEMPTS,

    // Actions
    setSelectedGame,
    setGameMode,
    submitResult,
    getRemainingAttempts,
    canPlayCompetitive,
    getPersonalRecord,
    getLeaderboard,
    calculateXP,
    startGame,
    endGame,
  };
}