/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Check, AlertTriangle, Frown, Meh, Smile, Moon, Calendar, RefreshCw, Edit3, ChevronUp, ChevronDown, Clock } from 'lucide-react';
import { ProgressRing, BarChart, AreaChart } from '../../components/charts';
import { DataTooltip } from '../../components/ui/DataTooltip';
import type { DataTooltipData } from '../../components/ui/DataTooltip';
import type { CSSVarStyle } from './types';
import { supabase } from '../../lib/supabase';
import { createScheduleEvent } from '../../lib/schedule-events';
import { validateHealth } from '../../utils/health-validation';

// ── Sleep Schedule Types ──
interface SleepSchedulePrefs {
  weekday: { bedtime: string; wake: string };
  weekend: { bedtime: string; wake: string };
  enabled: boolean;
}

const DEFAULT_SCHEDULE: SleepSchedulePrefs = {
  weekday: { bedtime: '22:00', wake: '06:00' },
  weekend: { bedtime: '23:00', wake: '08:00' },
  enabled: true,
};

const STORAGE_KEY = 'lifeos_sleep_schedule';
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Helpers ──
function loadSchedule(): SleepSchedulePrefs | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveScheduleToStorage(schedule: SleepSchedulePrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule));
}

function formatTime12(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function calcDurationHours(bedtime: string, wake: string): number {
  const [bh, bm] = bedtime.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let bedMins = bh * 60 + bm;
  let wakeMins = wh * 60 + wm;
  if (wakeMins <= bedMins) wakeMins += 24 * 60; // crosses midnight
  return (wakeMins - bedMins) / 60;
}

function calcDurationMinutes(bedtime: string, wake: string): number {
  return Math.round(calcDurationHours(bedtime, wake) * 60);
}

function isWeekend(dayOfWeek: number): boolean {
  return dayOfWeek === 0 || dayOfWeek === 6;
}

// ── Sleep Score Calculation ──
function computeSleepScore(
  metrics: any[],
  schedule: SleepSchedulePrefs | null
): { score: number; durationPts: number; qualityPts: number; consistencyPts: number; trend: 'up' | 'down' | 'flat' } {
  const last7 = metrics.filter((m: any) => m.sleep_hours).slice(0, 7);
  const prev7 = metrics.filter((m: any) => m.sleep_hours).slice(7, 14);

  if (last7.length === 0) return { score: 0, durationPts: 0, qualityPts: 0, consistencyPts: 0, trend: 'flat' };

  // Duration score (40 pts): 7-9hrs = full marks
  const avgHours = last7.reduce((s: number, m: any) => s + (m.sleep_hours || 0), 0) / last7.length;
  let durationPts: number;
  if (avgHours >= 7 && avgHours <= 9) {
    durationPts = 40;
  } else if (avgHours >= 6 && avgHours < 7) {
    durationPts = 40 - (7 - avgHours) * 20; // 20-40
  } else if (avgHours > 9 && avgHours <= 10) {
    durationPts = 40 - (avgHours - 9) * 15; // 25-40
  } else if (avgHours < 6) {
    durationPts = Math.max(0, avgHours * 3.3);
  } else {
    durationPts = Math.max(0, 40 - (avgHours - 9) * 10);
  }

  // Quality score (30 pts): 1-5 → 6-30
  const qualityEntries = last7.filter((m: any) => m.sleep_quality);
  const qualityPts = qualityEntries.length > 0
    ? (qualityEntries.reduce((s: number, m: any) => s + (m.sleep_quality || 0), 0) / qualityEntries.length) * 6
    : 15; // neutral if no data

  // Consistency score (30 pts): low variance in sleep hours = high score
  let consistencyPts = 15;
  if (last7.length >= 3) {
    const sleepHours = last7.map((m: any) => m.sleep_hours || 0);
    const mean = sleepHours.reduce((a: number, b: number) => a + b, 0) / sleepHours.length;
    const variance = sleepHours.reduce((s: number, h: number) => s + Math.pow(h - mean, 2), 0) / sleepHours.length;
    const stdDev = Math.sqrt(variance);
    // stdDev 0 = perfect (30pts), stdDev 2+ = terrible (0pts)
    consistencyPts = Math.max(0, Math.min(30, 30 - stdDev * 15));
  }

  const score = Math.round(Math.min(100, Math.max(0, durationPts + qualityPts + consistencyPts)));

  // Trend: compare to previous week
  let trend: 'up' | 'down' | 'flat' = 'flat';
  if (prev7.length >= 3) {
    const prevAvg = prev7.reduce((s: number, m: any) => s + (m.sleep_hours || 0), 0) / prev7.length;
    if (avgHours > prevAvg + 0.3) trend = 'up';
    else if (avgHours < prevAvg - 0.3) trend = 'down';
  }

  return { score, durationPts: Math.round(durationPts), qualityPts: Math.round(qualityPts), consistencyPts: Math.round(consistencyPts), trend };
}

// ── Adherence color ──
function adherenceColor(scheduled: number, actual: number): string {
  const diff = Math.abs(scheduled - actual);
  if (diff <= 0.5) return '#39FF14';  // green
  if (diff <= 1.5) return '#FACC15';  // orange
  return '#F43F5E'; // red
}

export function SleepTab({ metrics, allMetrics, onUpdateMetrics }: any) {
  const [hours, setHours] = useState(metrics?.sleep_hours?.toString() || '');
  const [quality, setQuality] = useState(metrics?.sleep_quality || 0);

  // Schedule state
  const [schedule, setSchedule] = useState<SleepSchedulePrefs | null>(loadSchedule);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<SleepSchedulePrefs>(schedule || DEFAULT_SCHEDULE);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const sleepHistory = allMetrics.filter((m: any) => m.sleep_hours).slice(0, 14).reverse();
  const avgSleep = sleepHistory.length > 0
    ? sleepHistory.reduce((s: any, m: any) => s + (m.sleep_hours || 0), 0) / sleepHistory.length
    : null;

  const sleepPct = metrics?.sleep_hours ? Math.min((metrics.sleep_hours / 9) * 100, 100) : 0;
  const sleepColor = (metrics?.sleep_hours || 0) >= 7 ? '#39FF14' : (metrics?.sleep_hours || 0) >= 6 ? '#FACC15' : '#F43F5E';

  const last7Sleep = sleepHistory.slice(-7);
  const barLabels = last7Sleep.map((m: any) =>
    new Date(m.date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short' })
  );

  const last14 = Array.from({ length: 14 }, (_: any, i: any) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    return d.toISOString().split('T')[0];
  });
  const qualityData = last14.map((date: any) => allMetrics.find((m: any) => m.date === date)?.sleep_quality || 0);
  const sleepHoursData = last14.map((date: any) => allMetrics.find((m: any) => m.date === date)?.sleep_hours || 0);
  const chart14Labels = last14.map((d: any, i: any) => i % 3 === 0 ? new Date(d + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '');

  // ── Sleep Score ──
  const sleepScore = useMemo(() => computeSleepScore(
    allMetrics.filter((m: any) => m.sleep_hours || m.sleep_quality),
    schedule
  ), [allMetrics, schedule]);

  const scoreColor = sleepScore.score >= 71 ? '#39FF14' : sleepScore.score >= 41 ? '#FACC15' : '#F43F5E';

  // ── Scheduled vs Actual (last 7 days) ──
  const comparisonData = useMemo(() => {
    if (!schedule) return [];
    const result: { date: string; dayLabel: string; scheduledHrs: number; actualHrs: number; }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dow = d.getDay();
      const prefs = isWeekend(dow) ? schedule.weekend : schedule.weekday;
      const scheduledHrs = calcDurationHours(prefs.bedtime, prefs.wake);
      const entry = allMetrics.find((m: any) => m.date === dateStr);
      const actualHrs = entry?.sleep_hours || 0;
      result.push({
        date: dateStr,
        dayLabel: DAYS_OF_WEEK[dow],
        scheduledHrs,
        actualHrs,
      });
    }
    return result;
  }, [allMetrics, schedule]);

  // Build bar chart series for scheduled vs actual
  const compBarSeries = useMemo(() => {
    if (comparisonData.length === 0) return [];
    return [
      { data: comparisonData.map(d => d.scheduledHrs), color: 'rgba(129,140,248,0.35)', label: 'Scheduled' },
      { data: comparisonData.map(d => d.actualHrs), color: '#818CF8', label: 'Actual' },
    ];
  }, [comparisonData]);
  const compBarLabels = comparisonData.map(d => d.dayLabel);

  // Long-press tooltip state
  const [tooltipData, setTooltipData] = useState<DataTooltipData | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const dismissTooltip = useCallback(() => { setTooltipData(null); setTooltipPos(null); }, []);

  const handleSleepBarLongPress = useCallback((idx: number, pos: { x: number; y: number }) => {
    if (idx < 0 || idx >= last7Sleep.length) return;
    const entry = last7Sleep[idx];
    const value = entry.sleep_hours as number;
    const date = new Date(entry.date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });
    const prevValue = idx > 0 ? (last7Sleep[idx - 1].sleep_hours as number) : null;
    setTooltipData({
      value, label: 'Sleep', date, unit: 'hrs', color: '#818CF8',
      previousValue: prevValue,
      extras: [
        { label: 'Quality', value: entry.sleep_quality ? qualityLabels[entry.sleep_quality - 1] : '—', color: '#38BDF8' },
        { label: 'Rating', value: value >= 7 ? '✅ Good' : value >= 6 ? '⚠️ Fair' : '❌ Low', color: value >= 7 ? '#39FF14' : value >= 6 ? '#FACC15' : '#F43F5E' },
      ],
    });
    setTooltipPos(pos);
  }, [last7Sleep]);

  const handleSleepTrendLongPress = useCallback((idx: number, pos: { x: number; y: number }) => {
    const hoursVal = sleepHoursData[idx];
    const qualityVal = qualityData[idx];
    const dateStr = last14[idx];
    if (!hoursVal && !qualityVal) return;
    const date = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
    setTooltipData({
      value: hoursVal, label: 'Sleep', date, unit: 'hrs', color: '#818CF8',
      previousValue: idx > 0 ? sleepHoursData[idx - 1] || null : null,
      extras: qualityVal ? [{ label: 'Quality', value: `${qualityVal}/5 — ${qualityLabels[qualityVal - 1] || '—'}`, color: '#38BDF8' }] : [],
    });
    setTooltipPos(pos);
  }, [sleepHoursData, qualityData, last14]);

  const qualityLabels = ['Terrible', 'Poor', 'Fair', 'Good', 'Excellent'];
  const qualityEmojis = [
    <Frown size={16} color="#EF4444" />,
    <Frown size={16} color="#F43F5E" />,
    <Meh size={16} color="#FACC15" />,
    <Smile size={16} color="#00D4FF" />,
    <Moon size={16} color="#818CF8" />,
  ];

  // ── Schedule Sync Logic ──
  const syncScheduleToCalendar = useCallback(async () => {
    if (!schedule) return;
    setSyncing(true);
    setSyncMsg('');
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) { setSyncMsg('Not logged in'); setSyncing(false); return; }
      const userId = userData.user.id;

      // Delete existing sleep schedule events for the next 7 days
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 8);
      const endStr = endDate.toISOString().split('T')[0];

      await supabase
        .from('schedule_events')
        .update({ is_deleted: true })
        .eq('user_id', userId)
        .eq('event_type', 'sleep')
        .eq('source', 'webapp')
        .gte('start_time', todayStr + 'T00:00:00')
        .lte('start_time', endStr + 'T23:59:59');

      // Create events for next 7 nights
      let created = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        const dow = d.getDay();
        const prefs = isWeekend(dow) ? schedule.weekend : schedule.weekday;
        const dateStr = d.toISOString().split('T')[0];
        const bedtimeISO = `${dateStr}T${prefs.bedtime}:00`;
        const durationMins = calcDurationMinutes(prefs.bedtime, prefs.wake);

        // Compute endTime
        const startDt = new Date(bedtimeISO);
        const endDt = new Date(startDt.getTime() + durationMins * 60 * 1000);

        await createScheduleEvent(supabase, {
          userId,
          title: '😴 Sleep',
          startTime: bedtimeISO,
          endTime: endDt.toISOString(),
          eventType: 'sleep',
          scheduleLayer: 'primary',
          source: 'webapp',
          description: 'Scheduled sleep block',
        });
        created++;
      }

      // Dispatch refresh event
      window.dispatchEvent(new CustomEvent('lifeos-refresh'));
      setSyncMsg(`✅ ${created} sleep blocks added to calendar`);
    } catch (err: any) {
      setSyncMsg(`❌ ${err.message || 'Sync failed'}`);
    }
    setSyncing(false);
    setTimeout(() => setSyncMsg(''), 4000);
  }, [schedule]);

  const handleSaveSchedule = useCallback(() => {
    saveScheduleToStorage(editForm);
    setSchedule(editForm);
    setEditing(false);
  }, [editForm]);

  // ── Today's schedule info ──
  const todayDow = new Date().getDay();
  const todayPrefs = schedule ? (isWeekend(todayDow) ? schedule.weekend : schedule.weekday) : null;
  const todayScheduledHrs = todayPrefs ? calcDurationHours(todayPrefs.bedtime, todayPrefs.wake) : null;

  // Build actual bar series for last 7 nights
  const barSeries = last7Sleep.length > 0 ? [{
    data: last7Sleep.map((m: any) => m.sleep_hours as number),
    color: '#818CF8',
    label: 'Hours',
  }] : [];

  return (
    <div className="sleep-tab h-fade-up">

      {/* ═══ SLEEP SCORE HERO ═══ */}
      {sleepScore.score > 0 && (
        <>
          <div className="hv2-section-label">SLEEP SCORE</div>
          <div className="hv2-sleep-score-hero glass-card">
            <div className="hv2-sleep-score-ring">
              <ProgressRing
                value={sleepScore.score}
                size={100}
                strokeWidth={8}
                color={scoreColor}
                centerContent={
                  <div className="hv2-ring-center">
                    <span className="text-[26px] font-bold font-[var(--font-display)]" style={{ color: scoreColor }}>
                      {sleepScore.score}
                    </span>
                    <span className="text-[8px] text-white/40 uppercase">/ 100</span>
                  </div>
                }
              />
            </div>
            <div className="hv2-sleep-score-details">
              <div className="hv2-sleep-score-title">
                <span>Sleep Score</span>
                {sleepScore.trend !== 'flat' && (
                  <span className={`hv2-sleep-score-trend ${sleepScore.trend}`}>
                    {sleepScore.trend === 'up' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {sleepScore.trend === 'up' ? 'Improving' : 'Declining'}
                  </span>
                )}
              </div>
              <div className="hv2-sleep-score-breakdown">
                <div className="hv2-ssb-item">
                  <span className="hv2-ssb-label">Duration</span>
                  <span className="hv2-ssb-val">{sleepScore.durationPts}<span className="hv2-ssb-max">/40</span></span>
                </div>
                <div className="hv2-ssb-item">
                  <span className="hv2-ssb-label">Quality</span>
                  <span className="hv2-ssb-val">{sleepScore.qualityPts}<span className="hv2-ssb-max">/30</span></span>
                </div>
                <div className="hv2-ssb-item">
                  <span className="hv2-ssb-label">Consistency</span>
                  <span className="hv2-ssb-val">{sleepScore.consistencyPts}<span className="hv2-ssb-max">/30</span></span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══ LAST NIGHT HERO ═══ */}
      <div className="hv2-section-label">LAST NIGHT</div>
      <div className="hv2-sleep-hero glass-card">
        <div className="hv2-sleep-hero-ring">
          <ProgressRing value={sleepPct} size={110} strokeWidth={9} color={sleepColor}
            centerContent={
              <div className="hv2-ring-center">
                <span className="text-[22px] font-bold font-[var(--font-display)]" style={{ color: sleepColor }}>
                  {metrics?.sleep_hours || '—'}
                </span>
                <span className="text-[9px] text-white/40 uppercase">hours</span>
              </div>
            }
          />
        </div>
        <div className="hv2-sleep-hero-details">
          {avgSleep && (
            <div className="hv2-sleep-avg">
              <span className="hv2-sleep-avg-val">{avgSleep.toFixed(1)}h</span>
              <span className="hv2-sleep-avg-label">avg {sleepHistory.length}d</span>
              {avgSleep < 7 && <AlertTriangle size={12} className="text-yellow-400" />}
            </div>
          )}
          {/* Scheduled vs Actual for tonight */}
          {todayPrefs && metrics?.sleep_hours && (
            <div className="hv2-sleep-vs-row">
              <span className="hv2-svs-scheduled">
                <Clock size={10} /> {formatTime12(todayPrefs.bedtime)} → {formatTime12(todayPrefs.wake)} ({todayScheduledHrs?.toFixed(1)}h)
              </span>
              <span className="hv2-svs-actual" style={{ color: adherenceColor(todayScheduledHrs || 8, metrics.sleep_hours) }}>
                Actual: {metrics.sleep_hours}h
              </span>
            </div>
          )}
          <div className="hv2-sleep-log">
            <label>Log hours</label>
            <div className="hv2-sleep-input-row">
              <input type="number" step="0.5" value={hours} onChange={e => setHours(e.target.value)} placeholder="7.5" />
              <button className="btn-glow-sm" onClick={() => { if (hours) { if (!validateHealth('sleep_hours', parseFloat(hours))) return; onUpdateMetrics({ sleep_hours: parseFloat(hours) }); setHours(''); } }}>
                <Check size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SLEEP SCHEDULE ═══ */}
      <div className="hv2-section-label">SLEEP SCHEDULE</div>
      <div className="hv2-sleep-schedule-card glass-card">
        {!editing ? (
          <>
            {schedule ? (
              <div className="hv2-sched-display">
                <div className="hv2-sched-row">
                  <span className="hv2-sched-tag">Weekday</span>
                  <span className="hv2-sched-times">
                    {formatTime12(schedule.weekday.bedtime)} → {formatTime12(schedule.weekday.wake)}
                    <span className="hv2-sched-dur">({calcDurationHours(schedule.weekday.bedtime, schedule.weekday.wake).toFixed(1)}h)</span>
                  </span>
                </div>
                <div className="hv2-sched-row">
                  <span className="hv2-sched-tag weekend">Weekend</span>
                  <span className="hv2-sched-times">
                    {formatTime12(schedule.weekend.bedtime)} → {formatTime12(schedule.weekend.wake)}
                    <span className="hv2-sched-dur">({calcDurationHours(schedule.weekend.bedtime, schedule.weekend.wake).toFixed(1)}h)</span>
                  </span>
                </div>
                <div className="hv2-sched-actions">
                  <button className="btn-ghost-sm" onClick={() => { setEditForm(schedule); setEditing(true); }}>
                    <Edit3 size={12} /> Edit
                  </button>
                  <button
                    className="btn-glow-sm hv2-btn-sleep"
                    onClick={syncScheduleToCalendar}
                    disabled={syncing}
                  >
                    <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                    {syncing ? 'Syncing...' : 'Sync to Schedule'}
                  </button>
                </div>
                {syncMsg && <div className="hv2-sync-msg">{syncMsg}</div>}
              </div>
            ) : (
              <div className="hv2-sched-empty">
                <Moon size={20} className="text-indigo-400" />
                <span>No sleep schedule set</span>
                <button className="btn-glow-sm hv2-btn-sleep" onClick={() => { setEditForm(DEFAULT_SCHEDULE); setEditing(true); }}>
                  <Calendar size={12} /> Set Sleep Schedule
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="hv2-sched-form">
            <div className="hv2-sched-form-title">Set Sleep Schedule</div>

            {/* Weekday */}
            <div className="hv2-sched-form-group">
              <span className="hv2-sched-form-label">Weekday (Mon–Fri)</span>
              <div className="hv2-sched-time-row">
                <label>
                  <span className="hv2-sched-tl">Bedtime</span>
                  <input type="time" value={editForm.weekday.bedtime}
                    onChange={e => setEditForm(f => ({ ...f, weekday: { ...f.weekday, bedtime: e.target.value } }))} />
                </label>
                <label>
                  <span className="hv2-sched-tl">Wake</span>
                  <input type="time" value={editForm.weekday.wake}
                    onChange={e => setEditForm(f => ({ ...f, weekday: { ...f.weekday, wake: e.target.value } }))} />
                </label>
                <span className="hv2-sched-dur-badge">
                  {calcDurationHours(editForm.weekday.bedtime, editForm.weekday.wake).toFixed(1)}h
                </span>
              </div>
            </div>

            {/* Weekend */}
            <div className="hv2-sched-form-group">
              <span className="hv2-sched-form-label">Weekend (Sat–Sun)</span>
              <div className="hv2-sched-time-row">
                <label>
                  <span className="hv2-sched-tl">Bedtime</span>
                  <input type="time" value={editForm.weekend.bedtime}
                    onChange={e => setEditForm(f => ({ ...f, weekend: { ...f.weekend, bedtime: e.target.value } }))} />
                </label>
                <label>
                  <span className="hv2-sched-tl">Wake</span>
                  <input type="time" value={editForm.weekend.wake}
                    onChange={e => setEditForm(f => ({ ...f, weekend: { ...f.weekend, wake: e.target.value } }))} />
                </label>
                <span className="hv2-sched-dur-badge">
                  {calcDurationHours(editForm.weekend.bedtime, editForm.weekend.wake).toFixed(1)}h
                </span>
              </div>
            </div>

            {/* Day Preview */}
            <div className="hv2-sched-day-preview">
              {DAYS_OF_WEEK.map((day, i) => {
                const we = isWeekend(i);
                const prefs = we ? editForm.weekend : editForm.weekday;
                const hrs = calcDurationHours(prefs.bedtime, prefs.wake);
                return (
                  <div key={day} className={`hv2-sdp-day ${we ? 'weekend' : ''}`}>
                    <span className="hv2-sdp-name">{day}</span>
                    <span className="hv2-sdp-hrs">{hrs.toFixed(0)}h</span>
                  </div>
                );
              })}
            </div>

            <div className="hv2-sched-form-actions">
              <button className="btn-ghost-sm" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn-glow-sm hv2-btn-sleep" onClick={handleSaveSchedule}>
                <Check size={12} /> Save Schedule
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ SCHEDULED vs ACTUAL ═══ */}
      {schedule && compBarSeries.length > 0 && comparisonData.some(d => d.actualHrs > 0) && (
        <>
          <div className="hv2-section-label">SCHEDULED vs ACTUAL</div>
          <div className="glass-card hv2-chart-card">
            <BarChart series={compBarSeries} labels={compBarLabels} height={120} showValues />
            <div className="hv2-comp-legend">
              <span><span className="sl-dot" style={{ background: 'rgba(129,140,248,0.35)' }} />Scheduled</span>
              <span><span className="sl-dot" style={{ background: '#818CF8' }} />Actual</span>
            </div>
            {/* Adherence summary */}
            <div className="hv2-adherence-row">
              {comparisonData.filter(d => d.actualHrs > 0).map((d, i) => (
                <div key={i} className="hv2-adh-pip" style={{ background: adherenceColor(d.scheduledHrs, d.actualHrs) }} title={`${d.dayLabel}: ${d.actualHrs}h / ${d.scheduledHrs}h`} />
              ))}
              <span className="hv2-adh-label">
                {(() => {
                  const tracked = comparisonData.filter(d => d.actualHrs > 0);
                  const onTrack = tracked.filter(d => Math.abs(d.scheduledHrs - d.actualHrs) <= 0.5).length;
                  return tracked.length > 0 ? `${onTrack}/${tracked.length} on track` : '';
                })()}
              </span>
            </div>
          </div>
        </>
      )}

      {/* ═══ SLEEP QUALITY ═══ */}
      <div className="hv2-section-label">SLEEP QUALITY</div>
      <div className="glass-card hv2-quality-card">
        <div className="hv2-quality-orbs">
          {qualityEmojis.map((emoji, i) => (
            <button key={i}
              className={`hv2-quality-orb ${quality === i + 1 ? 'active' : ''}`}
              onClick={() => { setQuality(i + 1); onUpdateMetrics({ sleep_quality: i + 1 }); }}
              style={{ '--q-color': ['#EF4444', '#F43F5E', '#FACC15', '#00D4FF', '#818CF8'][i] } as CSSVarStyle}>
              <span>{emoji}</span>
              <span className="hv2-quality-label">{qualityLabels[i]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ═══ LAST 7 NIGHTS ═══ */}
      {barSeries.length > 0 && (
        <>
          <div className="hv2-section-label">LAST 7 NIGHTS</div>
          <div className="glass-card hv2-chart-card">
            <BarChart series={barSeries} labels={barLabels} height={130} showValues onBarLongPress={handleSleepBarLongPress} />
            <div className="hv2-sleep-legend">
              <span><span className="sl-dot" style={{ background: '#39FF14' }} />7+ hrs</span>
              <span><span className="sl-dot" style={{ background: '#FACC15' }} />6-7 hrs</span>
              <span><span className="sl-dot" style={{ background: '#F43F5E' }} />Under 6</span>
            </div>
          </div>
        </>
      )}

      {/* ═══ 2-WEEK TREND ═══ */}
      {qualityData.some(v => v > 0) && (
        <>
          <div className="hv2-section-label">2-WEEK TREND</div>
          <div className="glass-card hv2-chart-card">
            <AreaChart
              series={[
                { data: sleepHoursData, color: '#818CF8', label: 'Hours', fillOpacity: 0.2 },
                { data: qualityData, color: '#38BDF8', label: 'Quality', fillOpacity: 0.1 },
              ]}
              labels={chart14Labels} height={110} showDots={false}
              showTrendLine
              onPointLongPress={handleSleepTrendLongPress}
            />
            <div className="hv2-chart-legend">
              <span className="text-indigo-400">● Hours</span>
              <span className="text-sky-400">● Quality</span>
            </div>
          </div>
        </>
      )}

      {/* Data Tooltip for long-press */}
      <DataTooltip data={tooltipData} position={tooltipPos} onDismiss={dismissTooltip} />
    </div>
  );
}
