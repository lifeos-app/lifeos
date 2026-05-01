/**
 * TypingGame — Typing speed test
 *
 * Falling words, type them before they hit bottom.
 * Words get faster and longer. WPM tracking. XP based on WPM + accuracy.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMiniGames } from './useMiniGames';
import { GameResults } from './GameResults';
import type { MiniGameResult } from '../../stores/miniGameStore';

const WORD_LIST = [
  'life', 'quest', 'habit', 'focus', 'grind', 'streak', 'level', 'xp', 'growth',
  'daily', 'goal', 'mind', 'fire', 'flow', 'grind', 'power', 'sage', 'hero',
  'brave', 'swift', 'calm', 'zen', 'arc', 'forge', 'spark', 'pulse', 'core',
  'drift', 'bloom', 'rush', 'glow', 'dawn', 'dusk', 'tide', 'peak', 'vast',
  'realm', 'guild', 'skill', 'stats', 'bonus', 'arena', 'quest', 'trial',
  'meditate', 'exercise', 'productive', 'consistent', 'challenge', 'victory',
  'discipline', 'strength', 'resilience', 'adventure', 'experience',
];

interface FallingWord {
  id: number;
  text: string;
  x: number;
  y: number;
  speed: number;
  typed: string;
}

const GAME_DURATION = 60; // 60 seconds
const MAX_LIVES = 5;

export function TypingGame() {
  const { submitResult, endGame } = useMiniGames();
  const [phase, setPhase] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [words, setWords] = useState<FallingWord[]>([]);
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [currentWPM, setCurrentWPM] = useState(0);
  const [currentResult, setCurrentResult] = useState<MiniGameResult | null>(null);
  const [totalCharsTyped, setTotalCharsTyped] = useState(0);
  const [correctChars, setCorrectChars] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wordIdRef = useRef(0);
  const startTimeRef = useRef(0);

  // Word spawner
  useEffect(() => {
    if (phase !== 'playing') return;

    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const difficulty = Math.min(3, 0.5 + elapsed / 30); // increases over 90s
    const spawnRate = Math.max(700, 2000 - elapsed * 10); // spawns faster over time

    const interval = setInterval(() => {
      const word = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
      const newWord: FallingWord = {
        id: wordIdRef.current++,
        text: word,
        x: 10 + Math.random() * 80,
        y: 0,
        speed: 0.3 + difficulty * 0.2 + Math.random() * 0.2,
        typed: '',
      };
      setWords(prev => [...prev, newWord]);
    }, spawnRate);

    return () => clearInterval(interval);
  }, [phase]);

  // Word movement
  useEffect(() => {
    if (phase !== 'playing') return;

    const interval = setInterval(() => {
      setWords(prev => {
        let newLives = lives;
        const filtered = prev.filter(w => {
          if (w.y > 100) {
            newLives--;
            return false;
          }
          return true;
        });

        if (newLives !== lives) setLives(newLives);
        if (newLives <= 0) setPhase('finished');

        return filtered.map(w => ({ ...w, y: w.y + w.speed }));
      });
    }, 50);

    return () => clearInterval(interval);
  }, [phase, lives]);

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

  // Calculate WPM
  useEffect(() => {
    if (phase === 'playing' && wordsCompleted > 0) {
      const elapsed = (Date.now() - startTimeRef.current) / 60000;
      const wpm = elapsed > 0 ? Math.round(wordsCompleted / elapsed) : 0;
      setCurrentWPM(wpm);
    }
  }, [wordsCompleted, phase]);

  // Game over
  useEffect(() => {
    if (phase === 'finished') {
      const wpm = currentWPM || wordsCompleted;
      const result = submitResult('typing', wpm);
      setCurrentResult(result);
    }
  }, [phase]);

  // Focus input
  useEffect(() => {
    if (phase === 'playing') inputRef.current?.focus();
  }, [phase]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase();
    setInput(value);
    setTotalCharsTyped(prev => prev + 1);

    // Check if any word matches
    setWords(prev => {
      const matchIdx = prev.findIndex(w => w.text.toLowerCase().startsWith(value));
      if (matchIdx >= 0) {
        const word = prev[matchIdx];
        if (word.text.toLowerCase() === value) {
          // Complete word!
          setWordsCompleted(p => p + 1);
          setScore(p => p + word.text.length * 10);
          setCorrectChars(p => p + word.text.length);
          setInput('');
          return prev.filter((_, i) => i !== matchIdx);
        }
        return prev.map((w, i) => i === matchIdx ? { ...w, typed: value } : w);
      }
      return prev;
    });
  }, []);

  const startGame = useCallback(() => {
    setPhase('playing');
    setWords([]);
    setInput('');
    setScore(0);
    setWordsCompleted(0);
    setLives(MAX_LIVES);
    setTimeLeft(GAME_DURATION);
    setCurrentWPM(0);
    setTotalCharsTyped(0);
    setCorrectChars(0);
    startTimeRef.current = Date.now();
  }, []);

  const resetGame = useCallback(() => {
    setPhase('ready');
    setCurrentResult(null);
  }, [submitResult]);

  const handleBack = useCallback(() => {
    endGame();
  }, [endGame]);

  if (currentResult) {
    return <GameResults result={currentResult} onPlayAgain={resetGame} onBack={handleBack} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-950/30 via-stone-950/50 to-stone-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button onClick={handleBack} className="text-stone-400 hover:text-white transition-colors text-sm">
          ← Back
        </button>
        <h2 className="text-cyan-300 font-bold">⌨️ Typing Speed</h2>
        <div className="text-stone-400 text-sm flex items-center gap-2">
          ❤️ {lives}/{MAX_LIVES}
        </div>
      </div>

      {/* Ready screen */}
      {phase === 'ready' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
          <div className="text-6xl">⌨️</div>
          <h3 className="text-2xl font-bold text-cyan-200">Typing Speed</h3>
          <p className="text-stone-400 text-sm text-center max-w-sm">
            Type the falling words before they reach the bottom. The faster you type, the higher your WPM score!
          </p>
          <div className="space-y-2 text-sm text-stone-400">
            <div>⏱️ 60 second challenge</div>
            <div>❤️ {MAX_LIVES} lives — lose one per missed word</div>
            <div>📈 Words get faster and longer over time</div>
          </div>
          <button
            onClick={startGame}
            className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl text-white font-bold hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg shadow-cyan-900/30"
          >
            Start Typing
          </button>
        </div>
      )}

      {/* Playing */}
      {phase === 'playing' && (
        <div className="flex-1 flex flex-col">
          {/* Stats bar */}
          <div className="flex justify-between px-4 py-2 text-sm">
            <div className="text-amber-400">Score: {score}</div>
            <div className="text-cyan-400">{currentWPM} WPM</div>
            <div className={`font-bold ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-stone-400'}`}>
              {timeLeft}s
            </div>
          </div>

          {/* Falling words area */}
          <div className="flex-1 relative overflow-hidden bg-stone-900/30 mx-4 rounded-xl border border-stone-700/50">
            {words.map(word => (
              <div
                key={word.id}
                className={`absolute text-sm font-mono transition-none ${
                  word.typed ? 'text-cyan-300' : 'text-stone-200'
                }`}
                style={{
                  left: `${word.x}%`,
                  top: `${word.y}%`,
                }}
              >
                {word.text.split('').map((char, i) => (
                  <span
                    key={i}
                    className={i < word.typed.length ? 'text-cyan-400 font-bold' : ''}
                  >
                    {char}
                  </span>
                ))}
              </div>
            ))}

            {/* Bottom zone indicator */}
            <div className="absolute bottom-0 left-0 right-0 h-2 bg-red-500/30 border-t border-red-500/50" />
          </div>

          {/* Input */}
          <div className="p-4">
            <input
              ref={inputRef}
              value={input}
              onChange={handleInput}
              className="w-full px-4 py-3 bg-stone-800 rounded-xl border border-stone-700 text-stone-200 text-center text-lg font-mono focus:border-cyan-500/50 focus:outline-none"
              placeholder="Type the word..."
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Lost lives message */}
      {phase === 'finished' && !currentResult && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
          <div className="text-4xl">⌨️</div>
          <h3 className="text-xl font-bold text-cyan-200">
            {lives <= 0 ? 'Game Over!' : 'Time\'s Up!'}
          </h3>
          <div className="text-4xl font-bold text-cyan-400">{currentWPM} WPM</div>
          <div className="text-stone-400 text-sm">{wordsCompleted} words completed</div>
        </div>
      )}
    </div>
  );
}