/**
 * MemoryGame — Card matching game
 *
 * Grid of face-down cards, find matching pairs.
 * 4x4 (8 pairs) or 6x6 (18 pairs). Timer + moves counter.
 * XP based on speed and accuracy.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMiniGames } from './useMiniGames';
import { GameResults } from './GameResults';
import type { MiniGameResult } from '../../stores/miniGameStore';

type GridSize = '4x4' | '6x6';

const EMOJIS_4x4 = ['🔥', '💧', '🌿', '⚡', '🌙', '☀️', '❄️', '🌟'];
const EMOJIS_6x6 = ['🔥', '💧', '🌿', '⚡', '🌙', '☀️', '❄️', '🌟', '🦊', '🐉', '🦅', '🦁', '🎭', '💎', '🔮', '🎪', '🏆', '🎯'];

interface Card {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createCards(size: GridSize): Card[] {
  const emojis = size === '4x4' ? EMOJIS_4x4 : EMOJIS_6x6;
  const pairs = [...emojis, ...emojis];
  return shuffle(pairs).map((emoji, i) => ({
    id: i,
    emoji,
    flipped: false,
    matched: false,
  }));
}

export function MemoryGame() {
  const { submitResult, endGame, gameMode } = useMiniGames();
  const [gridSize, setGridSize] = useState<GridSize>('4x4');
  const [cards, setCards] = useState<Card[]>(() => createCards('4x4'));
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [timer, setTimer] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [currentResult, setCurrentResult] = useState<MiniGameResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalPairs = gridSize === '4x4' ? 8 : 18;

  // Timer
  useEffect(() => {
    if (gameStarted && !gameOver) {
      timerRef.current = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameStarted, gameOver]);

  // Check for match
  useEffect(() => {
    if (flipped.length === 2) {
      const [first, second] = flipped;
      if (cards[first].emoji === cards[second].emoji) {
        // Match!
        setTimeout(() => {
          setCards(prev => prev.map((card, i) =>
            i === first || i === second ? { ...card, matched: true } : card
          ));
          setMatches(prev => prev + 1);
          setFlipped([]);
        }, 300);
      } else {
        // No match
        setTimeout(() => {
          setCards(prev => prev.map((card, i) =>
            i === first || i === second ? { ...card, flipped: false } : card
          ));
          setFlipped([]);
        }, 800);
      }
    }
  }, [flipped, cards]);

  // Check game over
  useEffect(() => {
    if (matches === totalPairs && gameStarted) {
      setGameOver(true);
      if (timerRef.current) clearInterval(timerRef.current);

      // Calculate score: base 1000 - (moves penalty) - (time penalty) + pairs bonus
      const accuracy = totalPairs / moves;
      const score = Math.max(0, Math.round(
        1000 - (moves * 10) - (timer * 2) + (accuracy * 200)
      ));
      const result = submitResult('memory', score);
      setCurrentResult(result);
    }
  }, [matches, totalPairs, gameStarted, moves, timer, submitResult]);

  const handleCardClick = useCallback((index: number) => {
    if (flipped.length >= 2) return;
    if (cards[index].flipped || cards[index].matched) return;

    if (!gameStarted) setGameStarted(true);

    setCards(prev => prev.map((card, i) =>
      i === index ? { ...card, flipped: true } : card
    ));
    setFlipped(prev => [...prev, index]);
    if (flipped.length === 0) setMoves(prev => prev + 1);
  }, [flipped, cards, gameStarted]);

  const resetGame = useCallback(() => {
    setCards(createCards(gridSize));
    setFlipped([]);
    setMoves(0);
    setMatches(0);
    setTimer(0);
    setGameStarted(false);
    setGameOver(false);
    setCurrentResult(null);
  }, [gridSize]);

  const handleBack = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    endGame();
  }, [endGame]);

  if (currentResult) {
    return <GameResults result={currentResult} onPlayAgain={resetGame} onBack={handleBack} />;
  }

  const cols = gridSize === '4x4' ? 'grid-cols-4' : 'grid-cols-6';
  const gap = gridSize === '4x4' ? 'gap-3' : 'gap-2';

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-950/30 via-stone-950/50 to-stone-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button onClick={handleBack} className="text-stone-400 hover:text-white transition-colors text-sm">
          ← Back
        </button>
        <h2 className="text-purple-300 font-bold">🧠 Memory Match</h2>
        <div className="text-stone-400 text-sm">{timer}s</div>
      </div>

      {/* Stats bar */}
      <div className="flex justify-center gap-6 py-2 text-sm">
        <div className="text-amber-400">Moves: <span className="font-bold">{moves}</span></div>
        <div className="text-emerald-400">Pairs: <span className="font-bold">{matches}/{totalPairs}</span></div>
      </div>

      {/* Grid Size Selector (before game starts) */}
      {!gameStarted && matches === 0 && moves === 0 && !gameOver && (
        <div className="flex justify-center gap-3 mb-4">
          {(['4x4', '6x6'] as GridSize[]).map(size => (
            <button
              key={size}
              onClick={() => { setGridSize(size); setCards(createCards(size)); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                gridSize === size
                  ? 'bg-purple-600/50 text-purple-100 border border-purple-500/50'
                  : 'bg-stone-800 text-stone-400 border border-stone-700'
              }`}
            >
              {size === '4x4' ? '4x4 (8 pairs)' : '6x6 (18 pairs)'}
            </button>
          ))}
        </div>
      )}

      {/* Card Grid */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className={`grid ${cols} ${gap} max-w-md`}>
          {cards.map((card, index) => (
            <button
              key={card.id}
              onClick={() => handleCardClick(index)}
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl text-2xl font-bold transition-all duration-300 transform ${
                card.matched
                  ? 'bg-emerald-600/20 border-2 border-emerald-500/30 scale-90 opacity-60'
                  : card.flipped
                  ? 'bg-purple-600/30 border-2 border-purple-400/50 rotate-0'
                  : 'bg-stone-800 border-2 border-stone-700 hover:border-purple-500/30 hover:bg-stone-700'
              }`}
              disabled={card.flipped || card.matched || flipped.length >= 2}
            >
              {card.flipped || card.matched ? card.emoji : '?'}
            </button>
          ))}
        </div>
      </div>

      {/* Reset button */}
      {gameOver && (
        <div className="p-4 text-center">
          <button
            onClick={resetGame}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-white font-bold"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}