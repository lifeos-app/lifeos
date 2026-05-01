/**
 * DreamJournal.tsx — Main page for the Dream Journal & Subconscious Tracker
 *
 * Morning dream log, mood/symbol tags, intensity slider, lucid toggle,
 * AI symbol interpretation, stats cards, and a calendar strip.
 * Designed to feel mystical, deep, and Hermetic.
 */

import { useState, useEffect } from 'react';
import { useDreamJournal, DREAM_MOODS, DREAM_SYMBOLS } from './useDreamJournal';
import { DreamCalendar } from './DreamCalendar';
import { DreamInterpreter } from './DreamInterpreter';
import { localDateStr } from '../../utils/date';

export function DreamJournal() {
  const {
    entries, stats, recurringSymbols, symbolCorrelations,
    addDream, updateDream, deleteDream,
    getSymbolMeaning, isDreamRecurring, calculateIntensityMoodCorrelation,
  } = useDreamJournal();

  const [selectedDate, setSelectedDate] = useState(localDateStr());
  const [showInterpreter, setShowInterpreter] = useState(false);
  const [editingDream, setEditingDream] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [narrative, setNarrative] = useState('');
  const [selectedMoods, setSelectedMoods] = useState<Set<string>>(new Set());
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set());
  const [intensity, setIntensity] = useState(5);
  const [isLucid, setIsLucid] = useState(false);

  // Current hour for morning prompt
  const hour = new Date().getHours();
  const isMorning = hour >= 5 && hour < 12;

  // Reset form when date changes or load existing dream
  useEffect(() => {
    const existing = entries.find(e => e.date === selectedDate);
    if (existing) {
      setTitle(existing.title);
      setNarrative(existing.narrative);
      setSelectedMoods(new Set(existing.mood_tags));
      setSelectedSymbols(new Set(existing.symbol_tags));
      setIntensity(existing.intensity);
      setIsLucid(existing.isLucid);
      setEditingDream(existing.id);
    } else {
      setTitle('');
      setNarrative('');
      setSelectedMoods(new Set());
      setSelectedSymbols(new Set());
      setIntensity(5);
      setIsLucid(false);
      setEditingDream(null);
    }
  }, [selectedDate, entries]);

  const handleSave = () => {
    if (editingDream) {
      updateDream(editingDream, {
        title: title || 'Untitled Dream',
        narrative,
        mood_tags: [...selectedMoods] as any[],
        symbol_tags: [...selectedSymbols],
        intensity,
        isLucid,
        isRecurring: isDreamRecurring([...selectedSymbols]),
      });
    } else if (narrative.trim()) {
      const dream = addDream({
        date: selectedDate,
        title: title || 'Untitled Dream',
        narrative,
        mood_tags: [...selectedMoods] as any[],
        symbol_tags: [...selectedSymbols],
        intensity,
        isLucid,
        isRecurring: isDreamRecurring([...selectedSymbols]),
      });
      setEditingDream(dream.id);
    }
  };

  const handleDelete = () => {
    if (editingDream) {
      deleteDream(editingDream);
      setTitle('');
      setNarrative('');
      setSelectedMoods(new Set());
      setSelectedSymbols(new Set());
      setIntensity(5);
      setIsLucid(false);
      setEditingDream(null);
    }
  };

  const toggleMood = (mood: string) => {
    setSelectedMoods(prev => {
      const next = new Set(prev);
      if (next.has(mood)) next.delete(mood);
      else next.add(mood);
      return next;
    });
  };

  const toggleSymbol = (symbol: string) => {
    setSelectedSymbols(prev => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  const correlation = calculateIntensityMoodCorrelation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] via-[#0d0d2b] to-[#0a0a1a] text-white">
      {/* Header */}
      <div className="px-4 pt-6 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌙</span>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-300 via-blue-300 to-indigo-300 bg-clip-text text-transparent">
              Dream Journal
            </h1>
          </div>
          <button
            onClick={() => setShowInterpreter(true)}
            className="px-3 py-1.5 bg-gradient-to-r from-purple-600/60 to-indigo-600/60 hover:from-purple-500/70 hover:to-indigo-500/70 rounded-lg text-sm font-medium transition-all border border-purple-500/30"
          >
            ✨ Interpret
          </button>
        </div>
        <p className="text-xs text-purple-300/60 ml-9 -mt-1">
          Track your subconscious. Decode your symbols.
        </p>
      </div>

      {/* Morning Prompt */}
      {isMorning && !editingDream && (
        <div className="mx-4 mb-4 p-4 rounded-xl bg-gradient-to-r from-indigo-900/40 via-purple-900/40 to-violet-900/40 border border-purple-500/20">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🌅</span>
            <span className="text-sm font-medium text-purple-200">Morning Dream Log</span>
          </div>
          <p className="text-xs text-purple-300/70">
            What visited you in the night? Record it now before it fades...
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="px-4 mb-4">
        <div className="grid grid-cols-4 gap-2">
          <StatCard
            icon="📝"
            value={stats.totalDreams}
            label="Dreams"
            color="from-blue-600/30 to-blue-900/30"
          />
          <StatCard
            icon="🔁"
            value={stats.recurringThemes}
            label="Recurring"
            color="from-purple-600/30 to-purple-900/30"
          />
          <StatCard
            icon="💫"
            value={stats.averageIntensity}
            label="Avg Intensity"
            color="from-amber-600/30 to-amber-900/30"
          />
          <StatCard
            icon="👁️"
            value={stats.lucidDreamCount}
            label="Lucid"
            color="from-emerald-600/30 to-emerald-900/30"
          />
        </div>
      </div>

      {/* Correlation Insight */}
      {correlation !== 0 && stats.totalDreams >= 3 && (
        <div className="mx-4 mb-4 p-3 rounded-lg bg-gradient-to-r from-violet-900/30 to-indigo-900/30 border border-violet-500/15">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">🔗</span>
            <span className="text-xs font-medium text-violet-200">Dream-Reality Correlation</span>
          </div>
          <p className="text-xs text-violet-300/70">
            Intensity-mood correlation: <span className="text-violet-200 font-mono">{correlation >= 0 ? '+' : ''}{correlation}</span>
            {correlation > 0.3 ? ' — Vivid dreams predict better next-day mood.' :
             correlation < -0.3 ? ' — Intense dreams may precede lower mood days.' :
             ' — Weak or no linear relationship found.'}
          </p>
        </div>
      )}

      {/* Calendar Strip */}
      <div className="px-4 mb-4">
        <DreamCalendar
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          compact
        />
      </div>

      {/* Dream Entry Form */}
      <div className="px-4 pb-24">
        <div className="rounded-2xl bg-gradient-to-b from-[#111132] to-[#0d0d24] border border-purple-500/15 overflow-hidden">
          {/* Title */}
          <div className="p-4 pb-2">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Dream title..."
              className="w-full bg-transparent text-white text-lg font-medium placeholder-white/30 outline-none"
            />
          </div>

          {/* Narrative */}
          <div className="px-4 pb-2">
            <textarea
              value={narrative}
              onChange={e => setNarrative(e.target.value)}
              placeholder="Describe your dream in detail... the symbols, the feelings, the narrative arc..."
              rows={6}
              className="w-full bg-transparent text-purple-100/90 text-sm leading-relaxed placeholder-purple-400/30 outline-none resize-none"
            />
          </div>

          {/* Mood Tags */}
          <div className="px-4 pb-3">
            <label className="text-[10px] uppercase tracking-widest text-purple-400/60 mb-2 block">
              Mood & Emotion
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DREAM_MOODS.map(mood => (
                <button
                  key={mood.value}
                  onClick={() => toggleMood(mood.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                    selectedMoods.has(mood.value)
                      ? 'border-opacity-100 text-white scale-105'
                      : 'border-white/10 text-white/50 hover:text-white/70'
                  }`}
                  style={{
                    backgroundColor: selectedMoods.has(mood.value) ? mood.color + '40' : 'transparent',
                    borderColor: selectedMoods.has(mood.value) ? mood.color + '80' : undefined,
                  }}
                >
                  {mood.emoji} {mood.label}
                </button>
              ))}
            </div>
          </div>

          {/* Symbol Tags */}
          <div className="px-4 pb-3">
            <label className="text-[10px] uppercase tracking-widest text-purple-400/60 mb-2 block">
              Dream Symbols
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DREAM_SYMBOLS.map(symbol => {
                const symData = getSymbolMeaning(symbol);
                const isRecurringTag = recurringSymbols.some(r => r.symbol === symbol);
                return (
                  <button
                    key={symbol}
                    onClick={() => toggleSymbol(symbol)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                      selectedSymbols.has(symbol)
                        ? 'bg-indigo-600/30 border-indigo-400/60 text-white'
                        : 'border-white/10 text-white/50 hover:text-white/70'
                    }`}
                  >
                    {symData?.emoji || '◈'} {symbol}
                    {isRecurringTag && selectedSymbols.has(symbol) && (
                      <span className="ml-1 text-[9px] text-purple-300">🔁</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Intensity Slider */}
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-widest text-purple-400/60">
                Dream Intensity
              </label>
              <span className="text-sm font-mono text-purple-200">
                {intensity}/10 {intensity <= 2 ? '💤' : intensity <= 4 ? '🌫️' : intensity <= 6 ? '🔮' : intensity <= 8 ? '💫' : '🌌'}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={intensity}
              onChange={e => setIntensity(Number(e.target.value))}
              className="w-full h-2 bg-gradient-to-r from-slate-800 via-purple-800 to-indigo-800 rounded-full appearance-none cursor-pointer accent-purple-500"
            />
            <div className="flex justify-between text-[9px] text-purple-500/50 mt-0.5">
              <span>Faint</span>
              <span>Moderate</span>
              <span>Vivid</span>
              <span>Overwhelming</span>
            </div>
          </div>

          {/* Lucid Toggle */}
          <div className="px-4 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">👁️</span>
              <span className="text-sm text-purple-200">Lucid Dream</span>
            </div>
            <button
              onClick={() => setIsLucid(!isLucid)}
              className={`w-11 h-6 rounded-full transition-all relative ${
                isLucid
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-500'
                  : 'bg-slate-700'
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                isLucid ? 'left-5.5' : 'left-0.5'
              }`} />
            </button>
          </div>

          {/* Save / Delete */}
          <div className="px-4 pb-4 flex gap-2">
            <button
              onClick={handleSave}
              disabled={!narrative.trim()}
              className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {editingDream ? '💾 Update Dream' : '🌙 Record Dream'}
            </button>
            {editingDream && (
              <button
                onClick={handleDelete}
                className="px-4 py-2.5 rounded-xl text-sm bg-red-900/40 hover:bg-red-900/60 text-red-300 border border-red-500/20 transition-all"
              >
                🗑️
              </button>
            )}
          </div>
        </div>

        {/* Symbol Correlation Insights */}
        {symbolCorrelations.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs uppercase tracking-widest text-purple-400/60 mb-2 px-1">
              Symbol-Mood Patterns
            </h3>
            <div className="space-y-2">
              {symbolCorrelations.slice(0, 5).map(sc => {
                const symData = getSymbolMeaning(sc.symbol);
                return (
                  <div
                    key={sc.symbol}
                    className="p-3 rounded-lg bg-purple-900/20 border border-purple-500/10"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-purple-200">
                        {symData?.emoji || '◈'} {sc.symbol}
                      </span>
                      <span className="text-[10px] text-purple-400/60">
                        {sc.occurrenceCount} dream{sc.occurrenceCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {sc.avgNextDayMood > 0 && (
                      <p className="text-xs text-purple-300/70">
                        Next-day mood avg: <span className="text-purple-200 font-mono">{sc.avgNextDayMood}</span> · 
                        Energy: <span className="text-purple-200 font-mono">{sc.avgNextDayEnergy}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Dreams */}
        {entries.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs uppercase tracking-widest text-purple-400/60 mb-3 px-1">
              Recent Dreams
            </h3>
            <div className="space-y-2">
              {entries.slice(0, 10).map(dream => (
                <button
                  key={dream.id}
                  onClick={() => setSelectedDate(dream.date)}
                  className="w-full text-left p-3 rounded-lg bg-[#111132]/60 border border-purple-500/10 hover:border-purple-500/25 transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-purple-100 truncate max-w-[70%]">
                      {dream.title}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {dream.isLucid && <span className="text-xs" title="Lucid">👁️</span>}
                      <span className="text-[10px] text-purple-400/50">{dream.date}</span>
                    </div>
                  </div>
                  <p className="text-xs text-purple-300/50 line-clamp-2">
                    {dream.narrative.substring(0, 100)}{dream.narrative.length > 100 ? '...' : ''}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {dream.mood_tags.slice(0, 3).map(m => {
                      const mood = DREAM_MOODS.find(dm => dm.value === m);
                      return mood ? (
                        <span key={m} className="text-[10px]">{mood.emoji}</span>
                      ) : null;
                    })}
                    {dream.symbol_tags.slice(0, 3).map(s => {
                      const sym = getSymbolMeaning(s);
                      return (
                        <span key={s} className="text-[10px] text-purple-300/40">
                          {sym?.emoji || '◈'} {s}
                        </span>
                      );
                    })}
                    <span className="ml-auto text-[10px] text-purple-400/40">
                      {dream.intensity}/10
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dream Interpreter Modal */}
      {showInterpreter && (
        <DreamInterpreter
          onClose={() => setShowInterpreter(false)}
        />
      )}
    </div>
  );
}

function StatCard({ icon, value, label, color }: { icon: string; value: number; label: string; color: string }) {
  return (
    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${color} border border-white/5`}>
      <div className="text-lg">{icon}</div>
      <div className="text-lg font-bold text-white mt-0.5">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-white/50">{label}</div>
    </div>
  );
}