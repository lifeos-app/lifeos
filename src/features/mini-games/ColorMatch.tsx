/**
 * ColorMatch — Stroop effect color-word interference game
 *
 * Word says "BLUE" but text is red — tap the COLOR of the text.
 * Speed rounds, 30 seconds. XP based on accuracy + speed.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMiniGames } from './useMiniGames';
import { GameResults } from './GameResults';
import type { MiniGameResult } from '../../stores/miniGameStore';

type GamePhase = 'ready' | 'playing' | 'finished';

const COLORS = [
  { name: 'RED', hex: '#EF4444' },
  { name: 'BLUE', hex: '#3B82F6' },
  { name: 'GREEN', hex: '#22C55E' },
  { name: 'YELLOW', hex: '#EAB308' },
  { name: 'PURPLE', hex: '#A855F7' },
  { name: 'ORANGE', hex: '#F97316' },
];

const GAME_DURATION = 30;

function generateRound() {
  const colorIdx = Math.floor(Math.random() * COLORS.length);
  const textIdx = Math.floor(Math.random() * COLORS.length);
  // Ensure text and color are different most of the time
  const finalTextIdx = textIdx === colorIdx ? (textIdx + 1) % COLORS.length : textIdx;
  return {
    word: COLORS[finalTextIdx].name, // The word says
    color: COLORS[colorIdx].hex,      // But the text color is
    colorName: COLORS[colorIdx].name,  // Correct answer
    correctIdx: colorIdx,
  };
}

export function ColorMatch() {
  const { submitResult, endGame } = useMiniGames();
  const [phase, setPhase] = useState<GamePhase>('ready');
  const [round, setRound] = useState(generateRound());
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [currentResult, setCurrentResult] = useState<MiniGameResult | null>(null);

  // Timer
  useEffect(() => {
    if (phase !== 'playing') return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setPhase('finished');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // Game over
  useEffect(() => {
    if (phase === 'finished') {
      const result = submitResult('color_match', correct);
      setCurrentResult(result);
    }
  }, [phase, correct, submitResult]);

  const handleColorTap = useCallback((colorIdx: number) => {
    if (phase !== 'playing') return;

    setTotal(prev => prev + 1);

    if (colorIdx === round.correctIdx) {
      setCorrect(prev => prev + 1);
      setScore(prev => prev + 10 + Math.floor(timeLeft / 3));
      setFeedback('correct');
    } else {
      setFeedback('wrong');
    }

    setRound(generateRound());

    setTimeout(() => setFeedback(null), 200);
  }, [phase, round, timeLeft]);

  const startGame = useCallback(() => {
    setPhase('playing');
    setScore(0);
    setCorrect(0);
    setTotal(0);
    setTimeLeft(GAME_DURATION);
    setRound(generateRound());
    setFeedback(null);
  }, []);

  const resetGame = useCallback(() => {
    setPhase('ready');
    setCurrentResult(null);
  }, []);

  const handleBack = useCallback(() => {
    endGame();
  }, [endGame]);

  if (currentResult) {
    return <GameResults result={currentResult} onPlayAgain={resetGame} onBack={handleBack} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-950/30 via-stone-950/50 to-stone-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button onClick={handleBack} className="text-stone-400 hover:text-white transition-colors text-sm">
          ← Back
        </button>
        <h2 className="text-pink-300 font-bold">🎨 Color Match</h2>
        <div className="text-stone-400 text-sm">{correct}/{total}</div>
      </div>

      {/* Ready */}
      {phase === 'ready' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
          <div className="text-6xl">🎨</div>
          <h3 className="text-2xl font-bold text-pink-200">Color Match</h3>
          <div className="bg-pink-900/20 rounded-xl p-4 border border-pink-700/30 max-w-sm space-y-3">
            <p className="text-pink-200 text-sm font-medium">The Stroop Challenge</p>
            <p className="text-stone-400 text-xs">
              You'll see a color word like "BLUE" written in a different color like red.
              Your job: tap the button matching the <strong className="text-pink-300">COLOR of the text</strong>, not the word!
            </p>
            <div className="text-center py-2">
              <span className="text-3xl font-bold" style={{ color: '#EF4444' }}>BLUE</span>
              <p className="text-stone-400 text-xs mt-1">Tap RED (the text color), not BLUE (the word)</p>
            </div>
          </div>
          <div className="space-y-1 text-sm text-stone-400 text-center">
            <div>⏱️ 30 seconds</div>
            <div>🎯 Tap the button matching the TEXT COLOR</div>
            <div>⚡ Speed matters — time bonus!</div>
          </div>
          <button
            onClick={startGame}
            className="px-8 py-3 bg-gradient-to-r from-pink-600 to-rose-600 rounded-xl text-white font-bold hover:from-pink-500 hover:to-rose-500 transition-all shadow-lg shadow-pink-900/30"
          >
            Start Challenge
          </button>
        </div>
      )}

      {/* Playing */}
      {phase === 'playing' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
          {/* Timer */}
          <div className={`text-sm font-bold ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-pink-400'}`}>
            ⏱️ {timeLeft}s • Score: {score}
          </div>

          {/* Word */}
          <div className={`text-6xl font-black transition-all ${
            feedback === 'correct' ? 'scale-110' : feedback === 'wrong' ? 'scale-90' : ''
          }`}>
            <span style={{ color: round.color }}>{round.word}</span>
          </div>

          <p className="text-stone-400 text-sm">What COLOR is the text?</p>

          {/* Color buttons */}
          <div className="grid grid-cols-3 gap-3 max-w-xs">
            {COLORS.map((color, idx) => (
              <button
                key={color.name}
                onClick={() => handleColorTap(idx)}
                className={`py-3 rounded-xl font-bold text-white text-sm transition-all hover:scale-105 shadow-lg ${
                  feedback === 'correct' && idx === round.correctIdx ? 'ring-4 ring-emerald-400 scale-105' :
                  feedback === 'wrong' && idx === round.correctIdx ? 'ring-4 ring-red-400' : ''
                }`}
                style={{ backgroundColor: color.hex }}
              >
                {color.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}