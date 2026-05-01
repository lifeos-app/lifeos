/**
 * MathPuzzle — Quick math challenges
 *
 * Solve arithmetic problems within time limit.
 * Difficulty scales: +/-/× simple → complex.
 * Streak bonus for consecutive correct answers.
 * XP based on streak and speed.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMiniGames } from './useMiniGames';
import { GameResults } from './GameResults';
import type { MiniGameResult } from '../../stores/miniGameStore';

type Difficulty = 'easy' | 'medium' | 'hard';
type GamePhase = 'ready' | 'playing' | 'finished';

const GAME_DURATION = 60;

interface MathProblem {
  text: string;
  answer: number;
}

function generateProblem(difficulty: Difficulty): MathProblem {
  let a: number, b: number, op: string, answer: number;

  if (difficulty === 'easy') {
    a = Math.floor(Math.random() * 20) + 1;
    b = Math.floor(Math.random() * 20) + 1;
    if (Math.random() < 0.5) { op = '+'; answer = a + b; }
    else { op = '-'; answer = a - b; if (answer < 0) { [a, b] = [b, a]; answer = a - b; } }
  } else if (difficulty === 'medium') {
    const r = Math.random();
    if (r < 0.33) {
      a = Math.floor(Math.random() * 50) + 10;
      b = Math.floor(Math.random() * 50) + 10;
      op = '+'; answer = a + b;
    } else if (r < 0.66) {
      a = Math.floor(Math.random() * 50) + 20;
      b = Math.floor(Math.random() * 30) + 1;
      op = '-'; answer = a - b;
    } else {
      a = Math.floor(Math.random() * 12) + 2;
      b = Math.floor(Math.random() * 12) + 2;
      op = '×'; answer = a * b;
    }
  } else {
    const r = Math.random();
    if (r < 0.25) {
      a = Math.floor(Math.random() * 100) + 50;
      b = Math.floor(Math.random() * 100) + 50;
      op = '+'; answer = a + b;
    } else if (r < 0.5) {
      a = Math.floor(Math.random() * 100) + 50;
      b = Math.floor(Math.random() * 50) + 10;
      op = '-'; answer = a - b;
    } else if (r < 0.75) {
      a = Math.floor(Math.random() * 15) + 3;
      b = Math.floor(Math.random() * 15) + 3;
      op = '×'; answer = a * b;
    } else {
      b = Math.floor(Math.random() * 12) + 2;
      answer = Math.floor(Math.random() * 12) + 2;
      a = b * answer;
      op = '÷';
    }
  }

  return { text: `${a} ${op} ${b}`, answer };
}

export function MathPuzzle() {
  const { submitResult, endGame } = useMiniGames();
  const [phase, setPhase] = useState<GamePhase>('ready');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [problem, setProblem] = useState<MathProblem>({ text: '1 + 1', answer: 2 });
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [currentResult, setCurrentResult] = useState<MiniGameResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      const result = submitResult('math', score);
      setCurrentResult(result);
    }
  }, [phase, score, submitResult]);

  const startGame = useCallback(() => {
    setPhase('playing');
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setCorrect(0);
    setTotal(0);
    setTimeLeft(GAME_DURATION);
    setInput('');
    setFeedback(null);
    setProblem(generateProblem(difficulty));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [difficulty]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const userAnswer = parseFloat(input);
    if (isNaN(userAnswer)) return;

    setTotal(prev => prev + 1);

    if (userAnswer === problem.answer) {
      const newStreak = streak + 1;
      const streakBonus = Math.min(newStreak * 2, 20);
      const points = 10 + streakBonus;
      setScore(prev => prev + points);
      setStreak(newStreak);
      setCorrect(prev => prev + 1);
      if (newStreak > bestStreak) setBestStreak(newStreak);
      setFeedback('correct');
    } else {
      setStreak(0);
      setFeedback('wrong');
    }

    setInput('');
    setProblem(generateProblem(difficulty));

    setTimeout(() => {
      setFeedback(null);
      inputRef.current?.focus();
    }, 300);
  }, [input, problem, streak, bestStreak, difficulty]);

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
    <div className="min-h-screen bg-gradient-to-b from-orange-950/30 via-stone-950/50 to-stone-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button onClick={handleBack} className="text-stone-400 hover:text-white transition-colors text-sm">
          ← Back
        </button>
        <h2 className="text-orange-300 font-bold">🔢 Math Puzzle</h2>
        <div className="text-stone-400 text-sm">{correct}/{total}</div>
      </div>

      {/* Ready screen */}
      {phase === 'ready' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
          <div className="text-6xl">🔢</div>
          <h3 className="text-2xl font-bold text-orange-200">Math Puzzle</h3>
          <p className="text-stone-400 text-sm text-center max-w-sm">
            Solve math problems as fast as you can! Build streaks for bonus points.
          </p>

          <div className="space-y-3 w-full max-w-xs">
            <h4 className="text-stone-300 text-sm font-medium text-center">Difficulty</h4>
            {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`w-full p-3 rounded-xl text-left transition-all border ${
                  difficulty === d
                    ? 'border-orange-500/50 bg-orange-600/10'
                    : 'border-stone-700/50 bg-stone-900/60 hover:border-orange-500/30'
                }`}
              >
                <div className="text-stone-200 font-medium capitalize">{d}</div>
                <div className="text-stone-400 text-xs">
                  {d === 'easy' ? 'Addition & subtraction (1-20)' :
                   d === 'medium' ? 'Add, subtract, multiply (10-100)' :
                   'All operations including division'}
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={startGame}
            className="px-8 py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl text-white font-bold hover:from-orange-500 hover:to-red-500 transition-all shadow-lg shadow-orange-900/30"
          >
            Start Challenge
          </button>
        </div>
      )}

      {/* Playing */}
      {phase === 'playing' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
          {/* Timer + Streak */}
          <div className="flex items-center gap-6 text-sm">
            <div className={`font-bold ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-orange-400'}`}>
              ⏱️ {timeLeft}s
            </div>
            <div className="text-amber-400">
              🔥 Streak: {streak}
            </div>
            <div className="text-orange-300 font-bold">
              {score} pts
            </div>
          </div>

          {/* Problem */}
          <div className={`text-5xl font-bold font-mono transition-colors ${
            feedback === 'correct' ? 'text-emerald-400' :
            feedback === 'wrong' ? 'text-red-400' : 'text-orange-200'
          }`}>
            {problem.text} = ?
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="w-full max-w-xs">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              className="w-full px-4 py-3 bg-stone-800 rounded-xl border border-stone-700 text-stone-200 text-center text-2xl font-mono focus:border-orange-500/50 focus:outline-none"
              placeholder="?"
              type="number"
              autoFocus
            />
          </form>

          {/* Streak indicator */}
          {streak >= 3 && (
            <div className="text-amber-400 text-sm animate-bounce">
              🔥 {streak} streak! +{Math.min(streak * 2, 20)} bonus pts
            </div>
          )}
        </div>
      )}
    </div>
  );
}