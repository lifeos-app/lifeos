/**
 * PatternGame — Pattern recall / Simon-says style
 *
 * Show a pattern (grid flashes), reproduce it.
 * Pattern gets longer each round. XP based on longest streak.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMiniGames } from './useMiniGames';
import { GameResults } from './GameResults';
import type { MiniGameResult } from '../../stores/miniGameStore';

type GamePhase = 'ready' | 'showing' | 'input' | 'wrong' | 'finished';

const GRID_SIZE = 3;
const PATTERN_COLORS = [
  'from-emerald-500 to-emerald-600',
  'from-blue-500 to-blue-600',
  'from-purple-500 to-purple-600',
  'from-amber-500 to-amber-600',
  'from-pink-500 to-pink-600',
  'from-cyan-500 to-cyan-600',
  'from-red-500 to-red-600',
  'from-indigo-500 to-indigo-600',
  'from-teal-500 to-teal-600',
];
const FLASH_COLOR = 'from-emerald-400 to-emerald-300';

export function PatternGame() {
  const { submitResult, endGame } = useMiniGames();
  const [phase, setPhase] = useState<GamePhase>('ready');
  const [pattern, setPattern] = useState<number[]>([]);
  const [userInput, setUserInput] = useState<number[]>([]);
  const [activeCell, setActiveCell] = useState<number | null>(null);
  const [level, setLevel] = useState(0);
  const [bestLevel, setBestLevel] = useState(0);
  const [currentResult, setCurrentResult] = useState<MiniGameResult | null>(null);
  const showIndexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addRandomToPattern = useCallback(() => {
    const next = Math.floor(Math.random() * (GRID_SIZE * GRID_SIZE));
    setPattern(prev => [...prev, next]);
  }, []);

  // Start new level
  const startLevel = useCallback((currentPattern: number[]) => {
    setPhase('showing');
    setUserInput([]);
    showIndexRef.current = 0;

    // Show pattern with delays
    const showPattern = (index: number) => {
      if (index >= currentPattern.length) {
        setActiveCell(null);
        setPhase('input');
        return;
      }
      setActiveCell(currentPattern[index]);
      timerRef.current = setTimeout(() => {
        setActiveCell(null);
        timerRef.current = setTimeout(() => {
          showPattern(index + 1);
        }, 200);
      }, 500);
    };

    timerRef.current = setTimeout(() => {
      showPattern(0);
    }, 800);
  }, []);

  const startNewGame = useCallback(() => {
    const initialPattern = [Math.floor(Math.random() * (GRID_SIZE * GRID_SIZE))];
    setPattern(initialPattern);
    setLevel(1);
    setBestLevel(0);
    setUserInput([]);
    setPhase('ready-showing');
    startLevel(initialPattern);
  }, [startLevel]);

  // Handle cell tap
  const handleCellTap = useCallback((cellIndex: number) => {
    if (phase !== 'input') return;

    setActiveCell(cellIndex);
    setTimeout(() => setActiveCell(null), 200);

    const newUserInput = [...userInput, cellIndex];
    setUserInput(newUserInput);

    const inputIndex = newUserInput.length - 1;

    // Check if correct
    if (cellIndex !== pattern[inputIndex]) {
      // Wrong!
      setPhase('wrong');
      const result = submitResult('pattern', bestLevel > 0 ? bestLevel : level - 1);
      setCurrentResult(result);
      return;
    }

    // Check if completed the pattern
    if (newUserInput.length === pattern.length) {
      // Success! Next level
      const newLevel = level + 1;
      setLevel(newLevel);
      if (newLevel > bestLevel + 1) setBestLevel(newLevel - 1);
      const newPattern = [...pattern, Math.floor(Math.random() * (GRID_SIZE * GRID_SIZE))];
      setPattern(newPattern);

      timerRef.current = setTimeout(() => {
        startLevel(newPattern);
      }, 1000);
    }
  }, [phase, userInput, pattern, level, bestLevel, startLevel, submitResult]);

  const resetGame = useCallback(() => {
    setPhase('ready');
    setPattern([]);
    setUserInput([]);
    setLevel(0);
    setBestLevel(0);
    setActiveCell(null);
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
    <div className="min-h-screen bg-gradient-to-b from-emerald-950/30 via-stone-950/50 to-stone-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button onClick={handleBack} className="text-stone-400 hover:text-white transition-colors text-sm">
          ← Back
        </button>
        <h2 className="text-emerald-300 font-bold">🔮 Pattern Recall</h2>
        <div className="text-stone-400 text-sm">Level {level}</div>
      </div>

      {/* Ready */}
      {phase === 'ready' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
          <div className="text-6xl">🔮</div>
          <h3 className="text-2xl font-bold text-emerald-200">Pattern Recall</h3>
          <p className="text-stone-400 text-sm text-center max-w-sm">
            Watch the pattern light up, then repeat it from memory. Each level adds one more step. How far can you go?
          </p>
          <div className="space-y-1 text-sm text-stone-400 text-center">
            <div>👁️ Watch the pattern</div>
            <div>👆 Tap the cells in order</div>
            <div>📈 Each level adds one more step</div>
          </div>
          <button
            onClick={startNewGame}
            className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl text-white font-bold hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-900/30"
          >
            Start Game
          </button>
        </div>
      )}

      {/* Showing / Input / Wrong */}
      {(phase === 'showing' || phase === 'input' || phase === 'wrong' || phase === 'ready-showing') && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
          {/* Status */}
          <div className="text-center">
            {phase === 'showing' && (
              <div className="text-emerald-300 text-lg font-bold animate-pulse">👁️ Watch carefully...</div>
            )}
            {phase === 'input' && (
              <div className="text-teal-300 text-lg font-bold">👆 Your turn! Repeat the pattern</div>
            )}
            {phase === 'wrong' && (
              <div className="text-red-400 text-lg font-bold">❌ Wrong! Game Over</div>
            )}
          </div>

          {/* Progress dots */}
          {phase === 'input' && (
            <div className="flex gap-1">
              {pattern.map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i < userInput.length ? 'bg-emerald-400' : 'bg-stone-700'
                  }`}
                />
              ))}
            </div>
          )}

          {/* 3x3 Grid */}
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, idx) => {
              const isActive = activeCell === idx;
              const isUserHighlight = phase === 'input' && activeCell === idx;

              return (
                <button
                  key={idx}
                  onClick={() => handleCellTap(idx)}
                  disabled={phase !== 'input'}
                  className={`w-24 h-24 rounded-xl transition-all duration-150 border-2 ${
                    isActive
                      ? `bg-gradient-to-br ${FLASH_COLOR} border-emerald-300 scale-110 shadow-lg shadow-emerald-400/30`
                      : isUserHighlight
                      ? 'bg-gradient-to-br from-teal-400 to-teal-500 border-teal-300 scale-105'
                      : idx < GRID_SIZE * GRID_SIZE
                      ? 'bg-gradient-to-br from-stone-800 to-stone-900 border-stone-700 hover:border-emerald-500/50 hover:from-stone-700'
                      : 'bg-stone-900 border-stone-700'
                  }`}
                />
              );
            })}
          </div>

          {/* Level indicator */}
          <div className="text-stone-400 text-sm">
            Pattern length: {pattern.length}
          </div>
        </div>
      )}
    </div>
  );
}