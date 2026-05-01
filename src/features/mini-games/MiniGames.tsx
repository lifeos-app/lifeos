/**
 * MiniGames — Arena game selection page
 *
 * Game carousel, daily challenge, practice/competitive modes,
 * personal bests, and leaderboard. Arcade aesthetic.
 */

import { useState } from 'react';
import { useMiniGames } from './useMiniGames';
import type { MiniGameType } from '../../stores/miniGameStore';

export function MiniGames() {
  const {
    games,
    dailyChallenge,
    recordsMap,
    attemptsMap,
    selectedGame,
    gameMode,
    startGame,
  } = useMiniGames();

  const [view, setView] = useState<'arena' | 'records' | 'leaderboard'>('arena');
  const [filterGame, setFilterGame] = useState<MiniGameType | 'all'>('all');

  const handlePlay = (gameId: MiniGameType, practice: boolean) => {
    startGame(gameId, practice);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-950/30 via-stone-950/50 to-stone-950 p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <span className="text-4xl">🎮</span>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
            Realm Arena
          </h1>
        </div>
        <p className="text-stone-400 text-sm">Play mini-games, earn XP, climb the leaderboard!</p>
      </div>

      {/* Tab navigation */}
      <div className="flex justify-center">
        <div className="flex bg-stone-900/80 rounded-xl p-1 border border-stone-700/50">
          {(['arena', 'records', 'leaderboard'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === tab
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-900/30'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {tab === 'arena' ? '🏟️ Arena' : tab === 'records' ? '🏆 Records' : '📊 Leaderboard'}
            </button>
          ))}
        </div>
      </div>

      {/* Daily Challenge Banner */}
      {dailyChallenge && view === 'arena' && (
        <div className="bg-gradient-to-r from-amber-600/20 via-pink-600/20 to-purple-600/20 rounded-xl p-4 border border-amber-500/30 flex items-center gap-4">
          <div className="text-3xl animate-pulse">⚡</div>
          <div className="flex-1">
            <h3 className="text-amber-200 font-semibold text-sm">Daily Challenge</h3>
            <p className="text-stone-300 text-xs">
              {games.find(g => g.id === dailyChallenge.game)?.name} — {dailyChallenge.multiplier}x XP!
            </p>
          </div>
          <button
            onClick={() => handlePlay(dailyChallenge.game, false)}
            className="px-4 py-2 bg-gradient-to-r from-amber-600 to-pink-600 rounded-lg text-sm font-bold text-white hover:from-amber-500 hover:to-pink-500 transition-all shadow-lg shadow-amber-900/30"
          >
            Play Now
          </button>
        </div>
      )}

      {/* Arena View */}
      {view === 'arena' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map(game => {
            const record = recordsMap.get(game.id);
            const remaining = attemptsMap.get(game.id) ?? MAX_DAILY_ATTEMPTS;
            const isDaily = dailyChallenge?.game === game.id;
            const isSoldOut = remaining <= 0;

            return (
              <div
                key={game.id}
                className={`bg-gradient-to-br ${game.bgGradient} rounded-xl p-4 border transition-all hover:scale-[1.01] ${
                  isDaily ? 'border-amber-500/50 shadow-lg shadow-amber-900/20' : 'border-stone-700/50'
                }`}
              >
                {/* Game icon and name */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{game.icon}</div>
                    <div>
                      <h3 className="text-white font-semibold">{game.name}</h3>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        game.difficulty === 'easy' ? 'bg-emerald-600/20 text-emerald-300' :
                        game.difficulty === 'medium' ? 'bg-amber-600/20 text-amber-300' :
                        'bg-red-600/20 text-red-300'
                      }`}>
                        {game.difficulty}
                      </span>
                    </div>
                  </div>
                  {isDaily && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold animate-pulse">
                      2x XP
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-stone-300 text-xs mb-3 line-clamp-2">{game.description}</p>

                {/* Stats */}
                <div className="flex items-center gap-3 mb-3 text-xs">
                  {record && (
                    <div className="flex items-center gap-1">
                      <span className="text-amber-400">🏆</span>
                      <span className="text-stone-300">{record.bestScore}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="text-stone-400">🎯</span>
                    <span className={`${remaining <= 1 ? 'text-red-400' : 'text-stone-300'}`}>
                      {remaining}/{MAX_DAILY_ATTEMPTS}
                    </span>
                  </div>
                </div>

                {/* Rules tooltip */}
                <p className="text-stone-400 text-[10px] mb-3">{game.rules}</p>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePlay(game.id, false)}
                    disabled={isSoldOut}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                      isSoldOut
                        ? 'bg-stone-800 text-stone-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-900/30'
                    }`}
                  >
                    {isSoldOut ? 'Sold Out' : isDaily ? '⚡ Play (2x)' : '🎮 Play'}
                  </button>
                  <button
                    onClick={() => handlePlay(game.id, true)}
                    className="px-3 py-2 rounded-lg text-sm bg-stone-800/80 text-stone-300 border border-stone-700 hover:border-purple-500/50 transition-all"
                  >
                    Practice
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Records View */}
      {view === 'records' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setFilterGame('all')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                filterGame === 'all' ? 'bg-purple-600/50 text-purple-100 border border-purple-500/50' : 'bg-stone-800 text-stone-400 border border-stone-700'
              }`}
            >
              All Games
            </button>
            {games.map(g => (
              <button
                key={g.id}
                onClick={() => setFilterGame(g.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  filterGame === g.id ? 'bg-purple-600/50 text-purple-100 border border-purple-500/50' : 'bg-stone-800 text-stone-400 border border-stone-700'
                }`}
              >
                {g.icon} {g.name}
              </button>
            ))}
          </div>

          {games
            .filter(g => filterGame === 'all' || g.id === filterGame)
            .map(game => {
              const record = recordsMap.get(game.id);
              return (
                <div key={game.id} className="bg-stone-900/60 rounded-xl p-4 border border-stone-700/50">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{game.icon}</span>
                    <h4 className="text-white font-semibold">{game.name}</h4>
                  </div>
                  {record ? (
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-stone-800/50 rounded-lg p-2">
                        <div className="text-amber-400 text-lg font-bold">{record.bestScore}</div>
                        <div className="text-stone-400 text-[10px]">Best Score</div>
                      </div>
                      <div className="bg-stone-800/50 rounded-lg p-2">
                        <div className="text-purple-400 text-lg font-bold">{record.totalGames}</div>
                        <div className="text-stone-400 text-[10px]">Games Played</div>
                      </div>
                      <div className="bg-stone-800/50 rounded-lg p-2">
                        <div className="text-emerald-400 text-lg font-bold">{record.totalXPEarned}</div>
                        <div className="text-stone-400 text-[10px]">XP Earned</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-stone-500 text-sm">No records yet. Play this game!</div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Leaderboard View */}
      {view === 'leaderboard' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {games.map(g => (
              <button
                key={g.id}
                onClick={() => setFilterGame(g.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  filterGame === g.id ? 'bg-purple-600/50 text-purple-100 border border-purple-500/50' : 'bg-stone-800 text-stone-400 border border-stone-700'
                }`}
              >
                {g.icon} {g.name}
              </button>
            ))}
          </div>

          {filterGame !== 'all' && (() => {
            const game = games.find(g => g.id === filterGame);
            const leaderboard = useMiniGames().getLeaderboard(filterGame);
            if (!game) return null;
            return (
              <div className="bg-stone-900/60 rounded-xl overflow-hidden border border-stone-700/50">
                <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-4 py-3 border-b border-stone-700/50">
                  <h3 className="text-white font-semibold">{game.icon} {game.name} Leaderboard</h3>
                </div>
                <div className="divide-y divide-stone-800">
                  {leaderboard.map((entry, idx) => (
                    <div key={entry.userId + idx} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={`w-6 text-center font-bold ${
                        idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-stone-300' : idx === 2 ? 'text-orange-400' : 'text-stone-500'
                      }`}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </span>
                      <span className={`flex-1 text-sm ${entry.userId === 'current-user' ? 'text-purple-300 font-semibold' : 'text-stone-300'}`}>
                        {entry.username}
                      </span>
                      <span className="text-amber-400 font-medium text-sm">{entry.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}