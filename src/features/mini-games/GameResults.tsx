/**
 * GameResults — Results overlay after each game
 *
 * Shows score, XP earned, new record indicator, personal best comparison,
 * share score card, play again button, and leaderboard position.
 */

import type { MiniGameResult } from '../../stores/miniGameStore';
import { useMiniGames } from './useMiniGames';
import type { MiniGameType } from '../../stores/miniGameStore';

const GAME_ICONS: Record<MiniGameType, string> = {
  reflex: '⚡',
  memory: '🧠',
  typing: '⌨️',
  math: '🔢',
  color_match: '🎨',
  pattern: '🔮',
};

const GAME_NAMES: Record<MiniGameType, string> = {
  reflex: 'Reflex Challenge',
  memory: 'Memory Match',
  typing: 'Typing Speed',
  math: 'Math Puzzle',
  color_match: 'Color Match',
  pattern: 'Pattern Recall',
};

const GAME_COLORS: Record<MiniGameType, string> = {
  reflex: 'from-yellow-600 to-amber-600',
  memory: 'from-purple-600 to-pink-600',
  typing: 'from-cyan-600 to-blue-600',
  math: 'from-orange-600 to-red-600',
  color_match: 'from-pink-600 to-rose-600',
  pattern: 'from-emerald-600 to-teal-600',
};

interface GameResultsProps {
  result: MiniGameResult;
  onPlayAgain: () => void;
  onBack: () => void;
}

export function GameResults({ result, onPlayAgain, onBack }: GameResultsProps) {
  const { getPersonalRecord, getLeaderboard } = useMiniGames();
  const { game, score, xpEarned, isNewRecord, isDailyChallenge } = result;

  const personalRecord = getPersonalRecord(game);
  const leaderboard = getLeaderboard(game);
  const playerPosition = leaderboard.findIndex(e => e.userId === 'current-user') + 1;

  const icon = GAME_ICONS[game];
  const name = GAME_NAMES[game];
  const gradient = GAME_COLORS[game];

  const scoreLabel = game === 'typing' ? 'WPM' : game === 'reflex' ? 'ms (avg)' : 'points';

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 flex flex-col items-center justify-center p-6">
      {/* Results card */}
      <div className="bg-stone-900/80 rounded-2xl border border-stone-700/50 max-w-sm w-full overflow-hidden">
        {/* Header */}
        <div className={`bg-gradient-to-r ${gradient} p-6 text-center relative`}>
          {isNewRecord && (
            <div className="absolute top-3 right-3 text-2xl animate-bounce">🎉</div>
          )}
          <div className="text-5xl mb-2">${icon}</div>
          <h2 className="text-2xl font-bold text-white">{name}</h2>
          {isDailyChallenge && (
            <span className="inline-block mt-1 px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
              ⚡ Daily Challenge 2x XP!
            </span>
          )}
        </div>

        {/* Score */}
        <div className="p-6 space-y-4">
          {isNewRecord && (
            <div className="bg-amber-600/20 border border-amber-500/30 rounded-xl p-3 text-center">
              <span className="text-amber-200 font-bold text-lg">🏆 New Personal Record!</span>
            </div>
          )}

          <div className="text-center">
            <div className="text-5xl font-black text-white">{score}</div>
            <div className="text-stone-400 text-sm">{scoreLabel}</div>
          </div>

          {/* XP earned */}
          <div className="flex items-center justify-center gap-2">
            <div className="bg-emerald-600/20 border border-emerald-500/30 rounded-lg px-4 py-2">
              <div className="text-emerald-400 text-2xl font-bold">+{xpEarned}</div>
              <div className="text-emerald-300 text-xs">XP Earned</div>
            </div>
          </div>

          {/* Personal comparison */}
          {personalRecord && !isNewRecord && (
            <div className="bg-stone-800/50 rounded-xl p-3 text-center">
              <div className="text-stone-400 text-xs">Personal Best</div>
              <div className="text-amber-400 font-bold">{personalRecord.bestScore} {scoreLabel}</div>
              <div className="text-stone-500 text-xs">{personalRecord.totalGames} games played</div>
            </div>
          )}

          {/* Leaderboard position */}
          {playerPosition > 0 && (
            <div className="bg-stone-800/50 rounded-xl p-3 text-center">
              <div className="text-stone-400 text-xs">Leaderboard Position</div>
              <div className="text-purple-400 font-bold text-xl">#{playerPosition}</div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onBack}
              className="flex-1 py-3 rounded-xl border border-stone-700 text-stone-400 hover:text-stone-200 transition-all"
            >
              Back to Arena
            </button>
            <button
              onClick={onPlayAgain}
              className={`flex-1 py-3 rounded-xl bg-gradient-to-r ${gradient} text-white font-bold hover:opacity-90 transition-all shadow-lg`}
            >
              Play Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}