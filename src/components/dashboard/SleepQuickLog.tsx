/**
 * SleepQuickLog — Journal-style sleep logging widget for the dashboard.
 * The PRIMARY sleep entry point: making sleep as easy as journaling.
 * Adapts to time-of-day, supports one-tap bedtime/wake, quality, hours.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Moon, Sunrise, Clock, BedDouble, Heart, Check, ChevronUp, ChevronDown, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { useDashboardMode } from '../../hooks/useDashboardMode';
import { ProgressRing } from '../charts';
import { SparkLine } from '../charts/SparkLine';
import type { HealthMetric } from '../../types/database';

const BEDTIME_KEY = 'lifeos_bedtime';
const SLEEP_COLOR = '#818CF8';
const QUALITY_LABELS = ['', 'Rough', 'Poor', 'Okay', 'Good', 'Great'] as const;
const QUICK_HOURS = [4, 5, 6, 7, 8, 9] as const;

export interface SleepQuickLogProps {
  todayMetrics: HealthMetric | null;
  recentMetrics: HealthMetric[];
  onUpdateMetrics: (metrics: Partial<HealthMetric>) => Promise<void>;
  compact?: boolean;
}

// LocalStorage helpers
const getBedtime = (): string | null => { try { return localStorage.getItem(BEDTIME_KEY); } catch { return null; } };
const setBedtimeLS = (ts: string): void => { try { localStorage.setItem(BEDTIME_KEY, ts); } catch { /* noop */ } };
const clearBedtime = (): void => { try { localStorage.removeItem(BEDTIME_KEY); } catch { /* noop */ } };
const calcHours = (bed: string): number => Math.max(0, Math.round(((Date.now() - new Date(bed).getTime()) / 3600000) * 2) / 2);
const fmtTime = (iso: string): string => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function get7Day(metrics: HealthMetric[]): number[] {
  return metrics.filter(m => m.sleep_hours != null && m.sleep_hours > 0).slice(-7).map(m => m.sleep_hours!);
}

function trendOf(d: number[]): 'up' | 'down' | 'stable' {
  if (d.length < 3) return 'stable';
  const r = d.slice(-3).reduce((s, v) => s + v, 0) / 3;
  const o = d.slice(-6, -3).reduce((s, v) => s + v, 0) / Math.max(d.slice(-6, -3).length, 1);
  return r - o > 0.5 ? 'up' : o - r > 0.5 ? 'down' : 'stable';
}

function TrendArrow({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') return <ArrowUpRight size={12} style={{ color: '#4ECB71' }} />;
  if (trend === 'down') return <ArrowDownRight size={12} style={{ color: '#F43F5E' }} />;
  return <Minus size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />;
}

const s = {
  btn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 0 } as React.CSSProperties,
  qBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, border: '1px solid transparent', cursor: 'pointer', padding: 0, transition: 'all 0.15s ease' } as React.CSSProperties,
  hBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, height: 28, borderRadius: 8, border: '1px solid transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '0 8px', transition: 'all 0.15s ease' } as React.CSSProperties,
  fullBtn: (accent = false): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: accent ? `1px solid ${SLEEP_COLOR}` : '1px solid rgba(255,255,255,0.15)',
    background: accent ? `${SLEEP_COLOR}22` : 'rgba(255,255,255,0.06)',
    color: accent ? SLEEP_COLOR : '#fff',
  }),
};

export function SleepQuickLog({ todayMetrics, recentMetrics, onUpdateMetrics, compact }: SleepQuickLogProps) {
  const { mode } = useDashboardMode();
  const [sleepHours, setSleepHours] = useState(todayMetrics?.sleep_hours ?? 0);
  const [sleepQuality, setSleepQuality] = useState(todayMetrics?.sleep_quality ?? 0);
  const [bedtime, setBedtimeState] = useState(getBedtime());
  const [sweetDreams, setSweetDreams] = useState(false);
  const [wakeConfirm, setWakeConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState(false);

  const tracked = todayMetrics?.sleep_hours != null && todayMetrics.sleep_hours > 0;
  const qTracked = todayMetrics?.sleep_quality != null && todayMetrics.sleep_quality > 0;
  const spark = useMemo(() => get7Day(recentMetrics), [recentMetrics]);
  const trend = useMemo(() => trendOf(spark), [spark]);

  useEffect(() => {
    if (todayMetrics?.sleep_hours != null && !edited) setSleepHours(todayMetrics.sleep_hours);
    if (todayMetrics?.sleep_quality != null) setSleepQuality(todayMetrics.sleep_quality);
  }, [todayMetrics?.sleep_hours, todayMetrics?.sleep_quality, edited]);

  const goBed = useCallback(() => {
    const ts = new Date().toISOString();
    setBedtimeLS(ts); setBedtimeState(ts);
    setSweetDreams(true);
    setTimeout(() => setSweetDreams(false), 3000);
  }, []);

  const goWake = useCallback(() => {
    const b = getBedtime();
    if (b) { setSleepHours(calcHours(b)); setEdited(false); setWakeConfirm(true); }
  }, []);

  const confirmWake = useCallback(async () => {
    setSaving(true);
    await onUpdateMetrics({ sleep_hours: sleepHours, sleep_quality: sleepQuality || undefined });
    clearBedtime(); setBedtimeState(null); setWakeConfirm(false); setSaving(false);
  }, [sleepHours, sleepQuality, onUpdateMetrics]);

  const pickQuality = useCallback(async (q: number) => {
    setSleepQuality(q); setSaving(true);
    await onUpdateMetrics({ sleep_quality: q, sleep_hours: sleepHours > 0 ? sleepHours : undefined });
    setSaving(false);
  }, [sleepHours, onUpdateMetrics]);

  const pickHours = useCallback(async (h: number) => {
    setSleepHours(h); setEdited(true); setSaving(true);
    await onUpdateMetrics({ sleep_hours: h, sleep_quality: sleepQuality > 0 ? sleepQuality : undefined });
    setSaving(false);
  }, [sleepQuality, onUpdateMetrics]);

  const adjust = useCallback(async (d: number) => {
    const n = Math.min(12, Math.max(0, Math.round((sleepHours + d) * 2) / 2));
    if (n === sleepHours) return;
    setSleepHours(n); setEdited(true); setSaving(true);
    await onUpdateMetrics({ sleep_hours: n, sleep_quality: sleepQuality > 0 ? sleepQuality : undefined });
    setSaving(false);
  }, [sleepHours, sleepQuality, onUpdateMetrics]);

  // Context-aware header
  const ctx = useMemo(() => {
    if (mode === 'morning' && !tracked) return { t: 'How did you sleep?', sub: 'Good morning', icon: <Sunrise size={18} /> };
    if (mode === 'morning') return { t: 'Last night', sub: `${sleepHours}h tracked`, icon: <Sunrise size={18} /> };
    if (mode === 'evening') return { t: 'Bedtime soon?', sub: 'Record when you go to bed', icon: <Moon size={18} /> };
    if (mode === 'night') return { t: 'Still up?', sub: 'Track your bedtime', icon: <Clock size={18} /> };
    if (tracked) return { t: 'Last night', sub: `${sleepHours}h tracked`, icon: <Moon size={18} /> };
    return { t: 'Track sleep', sub: "Log last night's rest", icon: <BedDouble size={18} /> };
  }, [mode, tracked, sleepHours]);

  const p = compact ? 12 : 16;

  // ═══ Fully tracked: minimal display ═══
  if (tracked && qTracked && !wakeConfirm) {
    const pct = Math.min(100, (sleepHours / 8) * 100);
    return (
      <section className="glass-card" style={{ padding: p }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ProgressRing value={pct} size={compact ? 44 : 56} strokeWidth={5} color={SLEEP_COLOR} glow={false}
            centerContent={<div style={{ textAlign: 'center' }}><div style={{ fontSize: compact ? 11 : 13, fontWeight: 700, color: SLEEP_COLOR }}>{sleepHours}h</div></div>} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Moon size={14} style={{ color: SLEEP_COLOR }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Sleep tracked</span>
              <Check size={14} style={{ color: '#4ECB71' }} />
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{QUALITY_LABELS[sleepQuality] || `Quality: ${sleepQuality}/5`}</div>
            {spark.length >= 2 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}><SparkLine data={spark} color={SLEEP_COLOR} width={60} height={20} /><TrendArrow trend={trend} /></div>}
          </div>
        </div>
      </section>
    );
  }

  // ═══ Wake-up confirmation ═══
  if (wakeConfirm) {
    const storedBed = getBedtime();
    return (
      <section className="glass-card" style={{ padding: p }}>
        <div style={{ marginBottom: 10, fontSize: 14, fontWeight: 600, color: SLEEP_COLOR }}>
          <Sunrise size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Good morning!
        </div>
        {storedBed && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Bedtime: {fmtTime(storedBed)} → Now</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <button onClick={() => adjust(-0.5)} style={s.btn}><ChevronDown size={14} /></button>
          <span style={{ fontSize: 18, fontWeight: 700, color: SLEEP_COLOR, minWidth: 40, textAlign: 'center' }}>{sleepHours}h</span>
          <button onClick={() => adjust(0.5)} style={s.btn}><ChevronUp size={14} /></button>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>How was it?</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {[1, 2, 3, 4, 5].map(q => (
            <button key={q} onClick={() => setSleepQuality(q)}
              style={{ ...s.qBtn, background: sleepQuality === q ? SLEEP_COLOR : 'rgba(255,255,255,0.06)', color: sleepQuality === q ? '#fff' : 'rgba(255,255,255,0.5)' }}
              title={QUALITY_LABELS[q]}><Heart size={12} fill={sleepQuality >= q ? SLEEP_COLOR : 'none'} /></button>
          ))}
        </div>
        <button onClick={confirmWake} disabled={saving} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '8px 14px', borderRadius: 8, border: 'none', background: SLEEP_COLOR, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
          <Check size={14} />{saving ? 'Saving...' : 'Confirm'}
        </button>
      </section>
    );
  }

  // ═══ Sweet dreams ═══
  if (sweetDreams) {
    return (
      <section className="glass-card" style={{ padding: compact ? 14 : 20, textAlign: 'center' }}>
        <Moon size={24} style={{ color: SLEEP_COLOR, marginBottom: 8 }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: SLEEP_COLOR }}>Sweet dreams</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Bedtime recorded. Tap "I woke up" in the morning.</div>
      </section>
    );
  }

  // ═══ Main contextual UI ═══
  return (
    <section className="glass-card" style={{ padding: p }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ color: SLEEP_COLOR }}>{ctx.icon}</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{ctx.t}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{ctx.sub}</div>
        </div>
      </div>

      {/* Evening/Night: Bedtime action */}
      {(mode === 'evening' || mode === 'night') && !bedtime && (
        <div style={{ marginBottom: 12 }}>
          <button onClick={goBed} style={s.fullBtn(true)}><BedDouble size={14} />I'm going to bed</button>
          {mode === 'night' && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 6, textAlign: 'center' }}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
        </div>
      )}

      {/* Bedtime recorded, waiting for wake */}
      {bedtime && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}><Moon size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Bedtime: {fmtTime(bedtime)}</div>
          <button onClick={goWake} style={s.fullBtn(false)}><Sunrise size={14} />I just woke up</button>
        </div>
      )}

      {/* Morning/Active: Quick log */}
      {!tracked && (mode === 'morning' || mode === 'active') && !bedtime && (
        <>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Sleep quality</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map(q => (
              <button key={q} onClick={() => pickQuality(q)}
                style={{ ...s.qBtn, background: sleepQuality === q ? SLEEP_COLOR : 'rgba(255,255,255,0.06)', color: sleepQuality === q ? '#fff' : 'rgba(255,255,255,0.5)' }}
                title={QUALITY_LABELS[q]}><Heart size={12} fill={sleepQuality >= q ? SLEEP_COLOR : 'none'} /></button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Hours slept</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            {QUICK_HOURS.map(h => (
              <button key={h} onClick={() => pickHours(h)}
                style={{ ...s.hBtn, background: sleepHours === h ? SLEEP_COLOR : 'rgba(255,255,255,0.06)', color: sleepHours === h ? '#fff' : 'rgba(255,255,255,0.55)', borderColor: sleepHours === h ? SLEEP_COLOR : 'transparent' }}>
                {h}h</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => adjust(-0.5)} style={s.btn}><ChevronDown size={14} /></button>
            <span style={{ fontSize: 13, fontWeight: 600, color: SLEEP_COLOR, minWidth: 32, textAlign: 'center' }}>{sleepHours || '—'}</span>
            <button onClick={() => adjust(0.5)} style={s.btn}><ChevronUp size={14} /></button>
          </div>
        </>
      )}

      {/* Hours logged but no quality */}
      {tracked && !qTracked && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{sleepHours}h tracked</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>How was it?</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(q => (
              <button key={q} onClick={() => pickQuality(q)}
                style={{ ...s.qBtn, background: sleepQuality === q ? SLEEP_COLOR : 'rgba(255,255,255,0.06)', color: sleepQuality === q ? '#fff' : 'rgba(255,255,255,0.5)' }}
                title={QUALITY_LABELS[q]}><Heart size={12} fill={sleepQuality >= q ? SLEEP_COLOR : 'none'} /></button>
            ))}
          </div>
          {spark.length >= 2 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}><SparkLine data={spark} color={SLEEP_COLOR} width={60} height={20} /><TrendArrow trend={trend} /></div>}
        </>
      )}

      {/* 7-day sparkline */}
      {tracked && qTracked && spark.length >= 2 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <SparkLine data={spark} color={SLEEP_COLOR} width={60} height={20} />
          <TrendArrow trend={trend} />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>7d</span>
        </div>
      )}
    </section>
  );
}