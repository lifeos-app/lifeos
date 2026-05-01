/**
 * ReflexGame — Reaction time game
 *
 * Wait for visual cue, tap/click ASAP. 5 rounds, average score.
 * Difficulty: Easy (bright flash), Medium (color change), Hard (subtle cue)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useMiniGames } from './useMiniGames';
import { GameResults } from './GameResults';
import type { MiniGameResult } from '../../stores/miniGameStore';

type Difficulty = 'easy' | 'medium' | 'hard';
type GamePhase = 'ready' | 'waiting' | 'react' | 'too-early' | 'result' | 'finished';

const TOTAL_ROUNDS = 5;
const DIFFICULTY_CONFIG = {
  easy: {
    waitMin: 1500,
    waitMax: 4000,
    label: 'Easy',
    color: 'bg-yellow-400',
    desc: 'Bright yellow flash',
  },
  medium: {
    waitMin: 2000,
    waitMax: 5000,
    label: 'Medium',
    color: 'bg-green-500',
    desc: 'Color change to green',
  },
  hard: {
    waitMin: 2500,
    waitMax: 6000,
    label: 'Hard',
    color: 'bg-teal-500',
    desc: 'Subtle teal shift',
  },
};

export function ReflexGame() {
  const { submitResult, endGame, gameMode } = useMiniGames();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<GamePhase>('ready');
  const [round, setRound] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [currentResult, setCurrentResult] = useState<MiniGameResult | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const config = DIFFICULTY_CONFIG[difficulty];

  const startRound = useCallback(() => {
    setPhase('waiting');

    const waitTime = config.waitMin + Math.random() * (config.waitMax - config.waitMin);

    timerRef.current = setTimeout(() => {
      startTimeRef.current = Date.now();
      setPhase('react');
    }, waitTime);
  }, [config]);

  const handleClick = useCallback(() => {
    if (phase === 'waiting') {
      // Too early!
      if (timerRef.current) clearTimeout(timerRef.current);
      setPhase('too-early');
    } else if (phase === 'react') {
      const reactionTime = Date.now() - startTimeRef.current;
      const newTimes = [...reactionTimes, reactionTime];
      setReactionTimes(newTimes);
      setRound(prev => prev + 1);

      if (prev => prev + 1 >= TOTAL_ROUNDS || newTimes.length >= TOTAL_ROUNDS) {
        // Game finished
        const avg = Math.round(newTimes.reduce((a, b) => a + b, 0) / newTimes.length);
        const result = submitResult('reflex', avg);
        setCurrentResult(result);
        setPhase('finished');
      } else {
        setPhase('result');
      }
    }
  }, [phase, reactionTimes, submitResult]);

  // Fixed handleClick
  const handleTap = useCallback(() => {
    if (phase === 'waiting') {
      if (timerRef.current) clearTimeout(timerRef.current);
      setPhase('too-early');
    } else if (phase === 'react') {
      const reactionTime = Date.now() - startTimeRef.current;
      const newTimes = [...reactionTimes, reactionTime];
      setReactionTimes(newTimes);

      if (newTimes.length >= TOTAL_ROUNDS) {
        const avg = Math.round(newTimes.reduce((a, b) => a + b, 0) / newTimes.length);
        const result = submitResult('reflex', avg);
        setCurrentResult(result);
        setPhase('finished');
      } else {
        setRound(newTimes.length);
        setPhase('result');
      }
    }
  }, [phase, reactionTimes, submitResult]);

  const resetGame = useCallback(() => {
    setPhase('ready');
    setRound(0);
    setReactionTimes([]);
    setCurrentResult(null);
  }, []);

  const handleBack = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    endGame();
  }, [endGame]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (currentResult) {
    return <GameResults result={currentResult} onPlayAgain={resetGame} onBack={handleBack} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-950/30 via-stone-950/50 to-stone-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button onClick={handleBack} className="text-stone-400 hover:text-white transition-colors text-sm">
          ← Back
        </button>
        <h2 className="text-yellow-300 font-bold">⚡ Reflex Challenge</h2>
        <div className="text-stone-400 text-sm">
          Round {Math.min(round + 1, TOTAL_ROUNDS)}/{TOTAL_ROUNDS}
        </div>
      </div>

      {/* Difficulty Selector */}
      {phase === 'ready' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
          <div className="text-6xl mb-4">⚡</div>
          <h3 className="text-2xl font-bold text-yellow-200">Reflex Challenge</h3>
          <p className="text-stone-400 text-sm text-center max-w-sm">
            Wait for the signal, then tap as fast as you can! Lower ms = better score.
            Sub-300ms earns bonus XP!
          </p>

          <div className="space-y-3 w-full max-w-xs">
            <h4 className="text-stone-300 text-sm font-medium text-center">Choose Difficulty</h4>
            {(Object.entries(DIFFICULTY_CONFIG) as [Difficulty, typeof DIFFICULTY_CONFIG.easy][]).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setDifficulty(key)}
                className={`w-full p-3 rounded-xl text-left transition-all border ${
                  difficulty === key
                    ? 'border-yellow-500/50 bg-yellow-600/10'
                    : 'border-stone-700/50 bg-stone-900/60 hover:border-yellow-500/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${cfg.color}`} />
                  <div>
                    <div className="text-stone-200 font-medium">{cfg.label}</div>
                    <div className="text-stone-400 text-xs">{cfg.desc}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={startRound}
            className="px-8 py-3 bg-gradient-to-r from-yellow-600 to-amber-600 rounded-xl text-white font-bold hover:from-yellow-500 hover:to-amber-500 transition-all shadow-lg shadow-yellow-900/30"
          >
            Start Game
          </button>
        </div>
      )}

      {/* Waiting phase */}
      {phase === 'waiting' && (
        <div
          className="flex-1 flex flex-col items-center justify-center cursor-pointer"
          onClick={handleTap}
        >
          <div className="text-8xl mb-6">🔴</div>
          <h3 className="text-2xl font-bold text-red-400">Wait for it...</h3>
          <p className="text-stone-500 text-sm mt-2">Don't tap yet!</p>
        </div>
      )}

      {/* React phase */}
      {phase === 'react' && (
        <div
          className="flex-1 flex flex-col items-center justify-center cursor-pointer animate-pulse"
          onClick={handleTap}
        >
          <div className={`w-64 h-64 rounded-full ${config.color} flex items-center justify-center shadow-2xl`}>
            <span className="text-6xl font-black text-stone-900">TAP!</span>
          </div>
          <h3 className="text-2xl font-bold text-emerald-300 mt-6">NOW!</h3>
        </div>
      )}

      {/* Too early */}
      {phase === 'too-early' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
          <div className="text-6xl">😬</div>
          <h3 className="text-2xl font-bold text-red-400">Too Early!</h3>
          <p className="text-stone-400 text-sm">Wait for the green signal before tapping.</p>
          <button
            onClick={() => { setPhase('waiting'); startRound(); }}
            className="px-6 py-2.5 bg-stone-800 text-stone-200 rounded-lg border border-stone-700 hover:border-yellow-500/50 transition-all"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Round result */}
      {phase === 'result' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
          <div className="text-4xl">
            {reactionTimes[reactionTimes.length - 1] < 200 ? '🤯' :
             reactionTimes[reactionTimes.length - 1] < 300 ? '⚡' :
             reactionTimes[reactionTimes.length - 1] < 400 ? '👍' : '🐢'}
          </div>
          <h3 className="text-3xl font-bold text-yellow-300">{reactionTimes[reactionTimes.length - 1]}ms</h3>
          <p className="text-stone-400 text-sm">
            {reactionTimes[reactionTimes.length - 1] < 200 ? 'Incredible!' :
             reactionTimes[reactionTimes.length - 1] < 300 ? 'Lightning fast!' :
             reactionTimes[reactionTimes.length - 1] < 400 ? 'Good reaction!' : 'Keep practicing!'}
          </p>
          <div className="flex gap-1">
            {reactionTimes.map((t, i) => (
              <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                t < 300 ? 'bg-emerald-600/30 text-emerald-300' : t < 400 ? 'bg-amber-600/30 text-amber-300' : 'bg-red-600/30 text-red-300'
              }`}>
                {i + 1}
              </div>
            ))}
            {Array.from({ length: TOTAL_ROUNDS - reactionTimes.length }).map((_, i) => (
              <div key={`empty-${i}`} className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center text-xs text-stone-500">
                {reactionTimes.length + i + 1}
              </div>
            ))}
          </div>
          <button
            onClick={startRound}
            className="px-6 py-2.5 bg-gradient-to-r from-yellow-600 to-amber-600 rounded-lg text-white font-bold hover:from-yellow-500 hover:to-amber-500 transition-all"
          >
            Next Round
          </button>
        </div>
      )}
    </div>
  );
}