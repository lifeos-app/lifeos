/**
 * DreamCorrelations.tsx — Dream-to-reality correlation panel
 *
 * Charts showing dream intensity vs next-day mood/energy,
 * symbol frequency over time, dream precursors, lucid dream ratios,
 * seasonal patterns, and correlation coefficients.
 */

import { useMemo } from 'react';
import { useDreamJournal, DREAM_MOODS } from './useDreamJournal';

export function DreamCorrelations() {
  const { entries, recurringSymbols, symbolCorrelations, calculateIntensityMoodCorrelation, getSeasonalPatterns } = useDreamJournal();
  const intensityMoodCorr = calculateIntensityMoodCorrelation();

  // ── Intensity vs Mood data ──────────────────────────────────────
  const intensityMoodData = useMemo(() => {
    return entries
      .filter(e => e.following_day_mood != null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30)
      .map(e => ({
        date: e.date,
        intensity: e.intensity,
        mood: e.following_day_mood!,
        energy: e.following_day_energy ?? 0,
      }));
  }, [entries]);

  // ── Lucid dream ratio over time ─────────────────────────────────
  const lucidRatioByMonth = useMemo(() => {
    const monthData: Record<string, { total: number; lucid: number }> = {};
    entries.forEach(e => {
      const month = e.date.substring(0, 7);
      if (!monthData[month]) monthData[month] = { total: 0, lucid: 0 };
      monthData[month].total++;
      if (e.isLucid) monthData[month].lucid++;
    });
    return Object.entries(monthData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        total: data.total,
        lucid: data.lucid,
        ratio: data.total > 0 ? Math.round((data.lucid / data.total) * 100) : 0,
      }));
  }, [entries]);

  // ── Dream precursors (most common moods before high-intensity dreams) ──
  const dreamPrecursors = useMemo(() => {
    const highIntensityDreams = entries.filter(e => e.intensity >= 7);
    const moodCounts: Record<string, number> = {};
    highIntensityDreams.forEach(e => {
      e.mood_tags.forEach(m => {
        moodCounts[m] = (moodCounts[m] || 0) + 1;
      });
    });
    return Object.entries(moodCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([mood, count]) => {
        const moodData = DREAM_MOODS.find(m => m.value === mood);
        return { mood, label: moodData?.label || mood, emoji: moodData?.emoji || '●', count };
      });
  }, [entries]);

  // ── Seasonal patterns ───────────────────────────────────────────
  const seasonalData = getSeasonalPatterns();
  const seasonalEntries = Object.entries(seasonalData)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12);

  // ── Correlation summary ─────────────────────────────────────────
  const correlations = useMemo(() => {
    const withMood = entries.filter(e => e.following_day_mood != null);

    // Calculate symbol-mood correlations
    const symbolMoodCorr = symbolCorrelations.slice(0, 5);

    return {
      dataPoints: withMood.length,
      intensityMood: intensityMoodCorr,
      avgIntensityHighMood: withMood.filter(e => (e.following_day_mood ?? 0) >= 4)
        .length > 0
        ? Math.round(withMood.filter(e => (e.following_day_mood ?? 0) >= 4).reduce((s, e) => s + e.intensity, 0) /
          withMood.filter(e => (e.following_day_mood ?? 0) >= 4).length * 10) / 10
        : 0,
      avgIntensityLowMood: withMood.filter(e => (e.following_day_mood ?? 0) < 4)
        .length > 0
        ? Math.round(withMood.filter(e => (e.following_day_mood ?? 0) < 4).reduce((s, e) => s + e.intensity, 0) /
          withMood.filter(e => (e.following_day_mood ?? 0) < 4).length * 10) / 10
        : 0,
      symbolMoodCorr,
    };
  }, [entries, symbolCorrelations, intensityMoodCorr]);

  const hasData = entries.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] via-[#0d0d2b] to-[#0a0a1a] text-white">
      {/* Header */}
      <div className="px-4 pt-6 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔗</span>
          <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-300 via-purple-300 to-rose-300 bg-clip-text text-transparent">
            Dream Correlations
          </h1>
        </div>
        <p className="text-xs text-purple-300/60 ml-9 -mt-1">
          How your dreams map to waking reality
        </p>
      </div>

      {!hasData ? (
        <div className="px-4 py-20 text-center">
          <div className="text-4xl mb-4">🌙</div>
          <p className="text-sm text-purple-300/50">Log some dreams to see correlations.</p>
          <p className="text-xs text-purple-400/40 mt-2">Link your next-day mood for deeper insights.</p>
        </div>
      ) : (
        <div className="px-4 pb-24 space-y-4">
          {/* Correlation Summary */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#111132] to-[#0d0d24] border border-purple-500/15">
            <h3 className="text-xs uppercase tracking-widest text-purple-400/60 mb-3">
              Correlation Summary
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-200">{entries.length}</div>
                <div className="text-[10px] text-purple-400/60">Dreams Logged</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-cyan-200">
                  {correlations.dataPoints > 0 ? correlations.intensityMood.toFixed(2) : '—'}
                </div>
                <div className="text-[10px] text-purple-400/60">Intensity↔Mood r</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-200">{correlations.dataPoints}</div>
                <div className="text-[10px] text-purple-400/60">Data Points</div>
              </div>
            </div>
            {correlations.intensityMood !== 0 && correlations.dataPoints >= 3 && (
              <div className="mt-3 p-2 rounded-lg bg-purple-900/20">
                <p className="text-xs text-purple-300/70">
                  {correlations.intensityMood > 0.3
                    ? '💎 Vivid dreams tend to precede better moods the next day.'
                    : correlations.intensityMood < -0.3
                    ? '🌑 Intense dreams may precede lower mood. Consider grounding practices.'
                    : '💫 No strong correlation between dream intensity and next-day mood yet.'}
                </p>
              </div>
            )}
          </div>

          {/* Intensity vs Mood Chart */}
          {intensityMoodData.length > 0 && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-[#111132] to-[#0d0d24] border border-purple-500/15">
              <h3 className="text-xs uppercase tracking-widest text-purple-400/60 mb-3">
                Intensity vs Next-Day Mood
              </h3>
              <div className="space-y-1.5">
                {intensityMoodData.slice(-10).map(d => (
                  <div key={d.date} className="flex items-center gap-2">
                    <span className="text-[10px] text-purple-400/50 w-16 shrink-0">{d.date.slice(5)}</span>
                    <div className="flex-1 flex items-center gap-1">
                      <div
                        className="h-2 rounded-full bg-purple-500/60"
                        style={{ width: `${d.intensity * 10}%` }}
                      />
                      <span className="text-[9px] text-purple-300/60 w-4">{d.intensity}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div
                        className="h-2 rounded-full bg-cyan-500/60"
                        style={{ width: `${Math.min(d.mood * 20, 100)}%` }}
                      />
                      <span className="text-[9px] text-cyan-300/60 w-4">{d.mood}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-4 mt-2">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-2 rounded bg-purple-500/60" />
                  <span className="text-[9px] text-purple-400/60">Intensity</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-2 rounded bg-cyan-500/60" />
                  <span className="text-[9px] text-cyan-400/60">Next-day Mood</span>
                </div>
              </div>
            </div>
          )}

          {/* Symbol Frequency — Recurring Symbols */}
          {recurringSymbols.length > 0 && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-[#111132] to-[#0d0d24] border border-purple-500/15">
              <h3 className="text-xs uppercase tracking-widest text-purple-400/60 mb-3">
                Recurring Symbols
              </h3>
              <div className="space-y-2">
                {recurringSymbols.slice(0, 8).map(rs => {
                  const maxCount = recurringSymbols[0]?.count || 1;
                  return (
                    <div key={rs.symbol}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-purple-200 capitalize">{rs.symbol}</span>
                        <span className="text-xs text-purple-400/60">{rs.count} dreams</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                          style={{ width: `${(rs.count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dream Precursors */}
          {dreamPrecursors.length > 0 && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-[#111132] to-[#0d0d24] border border-purple-500/15">
              <h3 className="text-xs uppercase tracking-widest text-purple-400/60 mb-3">
                Dream Precursors — Moods in Vivid Dreams
              </h3>
              <p className="text-[10px] text-purple-400/40 mb-2">
                Most common moods in dreams with intensity ≥ 7
              </p>
              <div className="space-y-1.5">
                {dreamPrecursors.map(dp => (
                  <div key={dp.mood} className="flex items-center gap-2">
                    <span className="text-sm">{dp.emoji}</span>
                    <span className="text-sm text-purple-200 flex-1">{dp.label}</span>
                    <span className="text-xs text-purple-400/60">{dp.count}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lucid Dream Ratio */}
          {lucidRatioByMonth.length > 0 && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-[#111132] to-[#0d0d24] border border-purple-500/15">
              <h3 className="text-xs uppercase tracking-widest text-purple-400/60 mb-3">
                Lucid Dream Ratio
              </h3>
              <div className="space-y-1.5">
                {lucidRatioByMonth.map(m => (
                  <div key={m.month} className="flex items-center gap-2">
                    <span className="text-[10px] text-purple-400/50 w-14 shrink-0">{m.month.slice(2)}</span>
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500/60 to-cyan-500/60 rounded-full"
                        style={{ width: `${Math.max(m.ratio, 5)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-purple-300/60 w-12 text-right">
                      {m.lucid}/{m.total} ({m.ratio}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Seasonal Patterns */}
          {seasonalEntries.length > 0 && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-[#111132] to-[#0d0d24] border border-purple-500/15">
              <h3 className="text-xs uppercase tracking-widest text-purple-400/60 mb-3">
                Seasonal Dream Patterns
              </h3>
              <div className="space-y-1.5">
                {seasonalEntries.map(([month, data]) => {
                  const maxCount = Math.max(...seasonalEntries.map(([, d]) => d.count));
                  return (
                    <div key={month} className="flex items-center gap-2">
                      <span className="text-[10px] text-purple-400/50 w-14 shrink-0">{month.slice(2)}/{month.slice(2, 4)}</span>
                      <div className="flex-1">
                        <div className="flex gap-1">
                          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500/60 to-purple-500/60 rounded-full"
                              style={{ width: `${(data.count / maxCount) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-purple-300/60 w-20 text-right">
                        {data.count} dreams · {data.avgIntensity} avg
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Symbol-Mood Correlations */}
          {symbolCorrelations.length > 0 && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-[#111132] to-[#0d0d24] border border-purple-500/15">
              <h3 className="text-xs uppercase tracking-widest text-purple-400/60 mb-3">
                Symbol → Next-Day Outcomes
              </h3>
              <div className="space-y-2">
                {symbolCorrelations.slice(0, 6).map(sc => (
                  <div key={sc.symbol} className="flex items-center justify-between p-2 rounded-lg bg-purple-900/15">
                    <span className="text-sm text-purple-200 capitalize">{sc.symbol}</span>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-[10px] text-purple-400/60">Mood</div>
                        <div className="text-xs font-mono text-cyan-300">{sc.avgNextDayMood || '—'}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-purple-400/60">Energy</div>
                        <div className="text-xs font-mono text-amber-300">{sc.avgNextDayEnergy || '—'}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-purple-400/60">N</div>
                        <div className="text-xs font-mono text-purple-300">{sc.occurrenceCount}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}