/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo } from 'react';
import { Brain, Play, Pause, Plus, Flame } from 'lucide-react';
import { EmojiIcon } from '../../lib/emoji-icon';
import { ProgressRing, AreaChart } from '../../components/charts';
import { MOOD_ICONS_EL, BreathingCircle } from './components';
import { MOOD_COLORS, MOOD_LABELS, type CSSVarStyle } from './types';

export function MindTab({ meditationLogs, gratitudeEntries, onLogMeditation, onAddGratitude, todayMetrics, onUpdateMetrics, allMetrics }: any) {
  const [meditating, setMeditating] = useState(false);
  const [timer, setTimer] = useState(0);
  const [gratitudeText, setGratitudeText] = useState('');
  const [gratCategory, setGratCategory] = useState('other');
  const today = new Date().toISOString().split('T')[0];
  const todayMeditations = meditationLogs.filter((l: any) => l.date === today);
  const todayGratitude = gratitudeEntries.filter((e: any) => e.date === today);
  const totalMins = todayMeditations.reduce((s: any, m: any) => s + m.duration_min, 0);

  const last14 = Array.from({ length: 14 }, (_, i: any) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    return d.toISOString().split('T')[0];
  });
  const moodData = last14.map((date: any) => allMetrics.find((m: any) => m.date === date)?.mood_score || 0);
  const energyData = last14.map((date: any) => allMetrics.find((m: any) => m.date === date)?.energy_score || 0);
  const chartLabels = last14.map((d: any, i: any) => i % 2 === 0 ? new Date(d + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '');

  const meditationGoalMins = 15;
  const meditationPct = Math.min((totalMins / meditationGoalMins) * 100, 100);

  // ── Mindfulness Streak Calculation ──
  const { streak, last14Active } = useMemo(() => {
    const meditationDates = new Set(meditationLogs.map((l: any) => l.date));
    const gratitudeDates = new Set(gratitudeEntries.map((e: any) => e.date));
    const metricDates = new Set(
      allMetrics
        .filter((m: any) => m.mood_score || m.energy_score)
        .map((m: any) => m.date)
    );

    const isActiveDay = (dateStr: string) =>
      meditationDates.has(dateStr) || gratitudeDates.has(dateStr) || metricDates.has(dateStr);

    // Calculate streak (consecutive days ending today or yesterday)
    let streakCount = 0;
    const d = new Date();
    // Check if today is active; if not, start from yesterday
    const todayStr = d.toISOString().split('T')[0];
    if (!isActiveDay(todayStr)) {
      d.setDate(d.getDate() - 1);
    }
    while (true) {
      const dateStr = d.toISOString().split('T')[0];
      if (isActiveDay(dateStr)) {
        streakCount++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }

    // Last 14 days active status
    const last14Active = Array.from({ length: 14 }, (_, i) => {
      const day = new Date();
      day.setDate(day.getDate() - (13 - i));
      return isActiveDay(day.toISOString().split('T')[0]);
    });

    return { streak: streakCount, last14Active };
  }, [meditationLogs, gratitudeEntries, allMetrics]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (meditating) {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [meditating]);

  const stopMeditation = () => {
    setMeditating(false);
    const mins = Math.ceil(timer / 60);
    if (mins > 0) onLogMeditation({ date: today, duration_min: mins, type: 'silent' });
    setTimer(0);
  };

  const addGrat = () => {
    if (gratitudeText.trim()) {
      onAddGratitude({ date: today, entry: gratitudeText.trim(), category: gratCategory });
      setGratitudeText('');
    }
  };

  return (
    <div className="mind-tab h-fade-up">
      {/* ── Mindfulness Streak Hero ── */}
      <div className="hv2-streak-hero glass-card">
        <div className="hv2-streak-hero-top">
          <div className="hv2-streak-hero-left">
            <span className="hv2-streak-emoji"><Brain size={16} /></span>
            <div className="hv2-streak-info">
              <div className="hv2-streak-title">
                Mindfulness Streak
                {(streak ?? 0) > 3 && <span className="hv2-streak-flame-icon"><Flame size={16} /></span>}
              </div>
              <div className="hv2-streak-count-row">
                <span className="hv2-streak-number">{streak ?? 0}</span>
                <span className="hv2-streak-unit">day{streak !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="hv2-streak-dots">
          {last14Active.map((active, i) => (
            <div
              key={i}
              className={`hv2-streak-dot ${active ? 'active' : ''} ${i === 13 ? 'today' : ''}`}
              title={(() => {
                const d = new Date();
                d.setDate(d.getDate() - (13 - i));
                return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
              })()}
            />
          ))}
        </div>
        <div className="hv2-streak-dots-labels">
          <span>14d ago</span>
          <span>Today</span>
        </div>
      </div>

      {/* Mood Trend Chart */}
      {moodData.some(v => v > 0) && (
        <>
          <div className="hv2-section-label">MOOD & ENERGY — 14 DAYS</div>
          <div className="glass-card hv2-chart-card">
            <AreaChart
              series={[
                { data: moodData, color: '#F43F5E', label: 'Mood', fillOpacity: 0.15 },
                { data: energyData, color: '#FACC15', label: 'Energy', fillOpacity: 0.1 },
              ]}
              labels={chartLabels} height={110} showDots={false}
            />
            <div className="hv2-chart-legend">
              <span className="text-[#F43F5E]">● Mood</span>
              <span className="text-yellow-400">● Energy</span>
            </div>
          </div>
        </>
      )}

      {/* Mood Selector */}
      <div className="hv2-section-label">HOW ARE YOU FEELING?</div>
      <div className="glass-card hv2-mood-card">
        <div className="hv2-mood-orbs">
          {MOOD_ICONS_EL.map((icon, i) => (
            <button key={i}
              className={`hv2-mood-orb ${todayMetrics?.mood_score === i + 1 ? 'active' : ''}`}
              onClick={() => onUpdateMetrics({ mood_score: i + 1 })}
              style={{ '--m-color': MOOD_COLORS[i] } as CSSVarStyle}>
              <span className="hv2-mood-orb-icon">{icon}</span>
              <span className="hv2-mood-orb-label">{MOOD_LABELS[i]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Meditation */}
      <div className="hv2-section-label">MEDITATION</div>
      <div className="glass-card hv2-meditation-card">
        <div className="hv2-med-layout">
          <div className="hv2-med-ring">
            <ProgressRing value={meditationPct} size={100} strokeWidth={8} color="#A855F7"
              centerContent={
                <div className="hv2-ring-center">
                  <span className="text-base font-bold font-[var(--font-display)] text-purple-400">
                    {meditating
                      ? `${String(Math.floor(timer / 60)).padStart(2, '0')}:${String(timer % 60).padStart(2, '0')}`
                      : `${totalMins}m`}
                  </span>
                  {meditating && <span className="text-[8px] text-purple-400/60 uppercase">live</span>}
                </div>
              }
            />
          </div>
          <div className="hv2-med-controls">
            <div className="hv2-med-breathing">
              <BreathingCircle active={meditating} />
            </div>
            {!meditating ? (
              <button className="btn-glow hv2-med-btn" onClick={() => setMeditating(true)}>
                <Play size={16} /> Begin Session
              </button>
            ) : (
              <button className="btn-glow hv2-med-btn" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.3), rgba(168,85,247,0.15))' }} onClick={stopMeditation}>
                <Pause size={16} /> End & Log
              </button>
            )}
            {totalMins > 0 && <div className="hv2-med-today"><Brain size={12} /> {totalMins} min today · {meditationGoalMins}min goal</div>}
          </div>
        </div>
      </div>

      {/* Gratitude Journal */}
      <div className="hv2-section-label">GRATITUDE JOURNAL</div>
      <div className="glass-card hv2-gratitude-card">
        <div className="hv2-grat-cats">
          {[
            { id: 'people', icon: 'users' }, { id: 'health', icon: 'heart' }, { id: 'work', icon: 'wrench' },
            { id: 'growth', icon: 'sprout' }, { id: 'faith', icon: 'hand-heart' }, { id: 'nature', icon: 'leaf' }, { id: 'other', icon: 'sparkles' },
          ].map(cat => (
            <button key={cat.id} className={`hv2-grat-cat ${gratCategory === cat.id ? 'active' : ''}`}
              onClick={() => setGratCategory(cat.id)}>
              <EmojiIcon emoji={cat.icon} size={13} />
            </button>
          ))}
        </div>
        <div className="hv2-grat-input">
          <input type="text" placeholder="I'm grateful for..." value={gratitudeText}
            onChange={e => setGratitudeText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addGrat(); }} />
          <button aria-label="Add gratitude entry" className="btn-glow-sm" onClick={addGrat}><Plus size={14} /></button>
        </div>
        <div className="hv2-grat-entries">
          {todayGratitude.map((g: any, i: any) => (
            <div key={g.id} className="hv2-grat-entry h-fade-up" style={{ animationDelay: `${i * 0.06}s` }}>
              <span className="hv2-grat-dot text-purple-400">✦</span>
              <span>{g.entry}</span>
              {g.category && g.category !== 'other' && <span className="hv2-grat-tag">{g.category}</span>}
            </div>
          ))}
          {todayGratitude.length === 0 && <div className="hv2-grat-empty">Write something you're grateful for today</div>}
        </div>
        <div className="hv2-grat-hint">Syncs to your Journal page</div>
      </div>
    </div>
  );
}
