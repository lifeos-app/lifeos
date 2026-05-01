/**
 * DreamSymbolExplorer.tsx — Symbol interpretation explorer
 *
 * Grid of common dream symbols with meanings from different traditions.
 * Shows personal dream history per symbol, mood correlations, and
 * cross-tradition wisdom.
 */

import { useState, useMemo } from 'react';
import { useDreamJournal, SYMBOL_DATABASE, type DreamSymbol, type SymbolMeaning } from './useDreamJournal';

export function DreamSymbolExplorer() {
  const { entries, symbolCorrelations } = useDreamJournal();
  const [selectedSymbol, setSelectedSymbol] = useState<DreamSymbol | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All', emoji: '🔮' },
    { id: 'elements', label: 'Elements', emoji: '🌊' },
    { id: 'movement', label: 'Movement', emoji: '🏃' },
    { id: 'body', label: 'Body', emoji: '🦷' },
    { id: 'architecture', label: 'Architecture', emoji: '🏠' },
    { id: 'nature', label: 'Nature', emoji: '🦁' },
    { id: 'objects', label: 'Objects', emoji: '🪞' },
    { id: 'abstract', label: 'Abstract', emoji: '💀' },
  ];

  const filteredSymbols = useMemo(() => {
    if (filterCategory === 'all') return SYMBOL_DATABASE;
    return SYMBOL_DATABASE.filter(s => s.category === filterCategory);
  }, [filterCategory]);

  // Personal dream history for the selected symbol
  const personalDreamHistory = useMemo(() => {
    if (!selectedSymbol) return [];
    return entries.filter(e =>
      e.symbol_tags.some(st => st.toLowerCase() === selectedSymbol.name.toLowerCase())
    ).sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, selectedSymbol]);

  // Mood correlation data for the selected symbol
  const symbolCorrelation = useMemo(() => {
    if (!selectedSymbol) return null;
    return symbolCorrelations.find(sc => sc.symbol.toLowerCase() === selectedSymbol.name.toLowerCase());
  }, [symbolCorrelations, selectedSymbol]);

  // Overall average mood (for comparison)
  const overallMoodAvg = useMemo(() => {
    const withMood = entries.filter(e => e.following_day_mood != null);
    if (withMood.length === 0) return 0;
    return Math.round((withMood.reduce((s, e) => s + (e.following_day_mood ?? 0), 0) / withMood.length) * 10) / 10;
  }, [entries]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] via-[#0d0d2b] to-[#0a0a1a] text-white">
      {/* Header */}
      <div className="px-4 pt-6 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔮</span>
          <h1 className="text-xl font-bold bg-gradient-to-r from-amber-300 via-purple-300 to-indigo-300 bg-clip-text text-transparent">
            Symbol Explorer
          </h1>
        </div>
        <p className="text-xs text-purple-300/60 ml-9 -mt-1">
          Decode your dreams through 18 traditions of wisdom
        </p>
      </div>

      {/* Category Filter */}
      <div className="px-4 mb-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                filterCategory === cat.id
                  ? 'bg-purple-600/40 text-purple-100 border border-purple-500/40'
                  : 'bg-white/5 text-white/50 border border-white/5 hover:bg-white/10'
              }`}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Symbol Grid */}
      {!selectedSymbol ? (
        <div className="px-4">
          <div className="grid grid-cols-2 gap-2.5">
            {filteredSymbols.map(symbol => {
              const dreamCount = entries.filter(e =>
                e.symbol_tags.some(st => st.toLowerCase() === symbol.name.toLowerCase())
              ).length;
              return (
                <button
                  key={symbol.name}
                  onClick={() => setSelectedSymbol(symbol)}
                  className="p-3 rounded-xl bg-gradient-to-br from-[#111132] to-[#0d0d24] border border-purple-500/15 hover:border-purple-500/30 transition-all text-left group"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xl">{symbol.emoji}</span>
                    <span className="text-sm font-medium text-purple-100 group-hover:text-white transition-colors">
                      {symbol.name}
                    </span>
                    {dreamCount > 0 && (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-purple-600/30 text-purple-300">
                        {dreamCount}×</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {symbol.meanings.slice(0, 3).map(m => (
                      <span
                        key={m.tradition}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-400/70"
                      >
                        {m.traditionName}
                      </span>
                    ))}
                    {symbol.meanings.length > 3 && (
                      <span className="text-[9px] text-purple-400/50">+{symbol.meanings.length - 3}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Symbol Detail View */
        <div className="px-4 pb-24">
          <button
            onClick={() => setSelectedSymbol(null)}
            className="flex items-center gap-1.5 text-sm text-purple-300/70 hover:text-purple-200 mb-4"
          >
            ← Back to symbols
          </button>

          {/* Symbol Header */}
          <div className="text-center mb-4">
            <span className="text-4xl">{selectedSymbol.emoji}</span>
            <h2 className="text-xl font-bold text-white mt-2">{selectedSymbol.name}</h2>
            <p className="text-xs text-purple-400/60 mt-1 capitalize">{selectedSymbol.category}</p>
          </div>

          {/* Mood Correlation Insight */}
          {symbolCorrelation && symbolCorrelation.avgNextDayMood > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-500/15">
              <div className="text-xs font-medium text-indigo-200 mb-1">📊 In Your Life</div>
              <p className="text-xs text-indigo-300/70">
                When <span className="text-indigo-200 font-medium">{selectedSymbol.name}</span> appears in your dreams,
                your next-day mood averages{' '}
                <span className="text-indigo-200 font-mono font-medium">{symbolCorrelation.avgNextDayMood}</span>
                {overallMoodAvg > 0 && (
                  <> vs your usual <span className="text-purple-200 font-mono">{overallMoodAvg}</span></>
                )}
                {symbolCorrelation.avgNextDayMood > overallMoodAvg ? (
                  <span className="text-emerald-400 ml-1">↑ positive effect</span>
                ) : symbolCorrelation.avgNextDayMood < overallMoodAvg ? (
                  <span className="text-amber-400 ml-1">↓ lower than usual</span>
                ) : (
                  <span className="text-blue-400 ml-1">— neutral</span>
                )}
              </p>
            </div>
          )}

          {/* In Your Dreams */}
          {personalDreamHistory.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs uppercase tracking-widest text-purple-400/60 mb-2">
                In Your Dreams
              </h3>
              <div className="space-y-1.5">
                {personalDreamHistory.slice(0, 5).map(dream => (
                  <div
                    key={dream.id}
                    className="p-2.5 rounded-lg bg-purple-900/20 border border-purple-500/10"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-medium text-purple-200">{dream.title}</span>
                      <span className="text-[10px] text-purple-400/50">{dream.date}</span>
                    </div>
                    <p className="text-xs text-purple-300/50 line-clamp-1">
                      {dream.narrative.substring(0, 80)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Multi-Tradition Meanings */}
          <div className="mb-4">
            <h3 className="text-xs uppercase tracking-widest text-purple-400/60 mb-2">
              Cross-Tradition Interpretations
            </h3>
            <div className="space-y-2">
              {selectedSymbol.meanings.map((meaning: SymbolMeaning) => {
                const polarityColor = meaning.polarity === 'positive' ? 'text-emerald-400'
                  : meaning.polarity === 'negative' ? 'text-rose-400'
                  : meaning.polarity === 'dual' ? 'text-amber-400'
                  : 'text-blue-400';
                const polarityIcon = meaning.polarity === 'positive' ? '☀️'
                  : meaning.polarity === 'negative' ? '🌑'
                  : meaning.polarity === 'dual' ? '🌓'
                  : '🌕';
                return (
                  <div
                    key={meaning.tradition}
                    className="p-3 rounded-lg bg-[#111132]/60 border border-purple-500/10"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-purple-100">
                        {meaning.traditionName}
                      </span>
                      <span className={`text-xs ${polarityColor}`}>
                        {polarityIcon} {meaning.polarity}
                      </span>
                    </div>
                    <p className="text-xs text-purple-300/70 leading-relaxed">
                      {meaning.meaning}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}