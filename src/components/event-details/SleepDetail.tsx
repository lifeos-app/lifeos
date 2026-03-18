// ═══════════════════════════════════════════════════════════
// SLEEP DETAIL — Sleep event type
// Target bed/wake times, quality rating, log sleep
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { Check, Moon, Sun } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { showToast } from '../Toast';
import type { ScheduleEvent } from '../../types/database';

interface SleepDetailProps {
  event: ScheduleEvent;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function durationHours(start: string, end: string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);
}

export function SleepDetail({ event }: SleepDetailProps) {
  const [quality, setQuality] = useState(0);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);
  const [existingData, setExistingData] = useState<{ sleep_quality?: number; sleep_hours?: number } | null>(null);

  const bedtime = formatTime(event.start_time);
  const wakeTime = event.end_time ? formatTime(event.end_time) : '--:--';
  const targetHours = event.end_time ? durationHours(event.start_time, event.end_time) : 8;

  // Check for existing health_metrics data for this date
  useEffect(() => {
    const checkExisting = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) return;
      
      const date = new Date(event.start_time).toISOString().split('T')[0];
      const { data } = await supabase
        .from('health_metrics')
        .select('value, notes')
        .eq('user_id', user.user.id)
        .eq('date', date)
        .eq('metric_type', 'sleep')
        .maybeSingle();
      
      if (data) {
        // Parse quality from notes if stored
        const qualityMatch = data.notes?.match(/quality:\s*(\d)/);
        setExistingData({
          sleep_quality: qualityMatch ? parseInt(qualityMatch[1]) : undefined,
          sleep_hours: data.value,
        });
      }
    };
    checkExisting();
  }, [event.start_time]);

  const stars = ['😫', '😐', '🙂', '😊', '😴'];

  const handleLogSleep = async () => {
    if (quality === 0) { showToast('Rate your sleep quality first', 'error'); return; }
    setLogging(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) { showToast('Not logged in', 'error'); return; }

      const date = new Date(event.start_time).toISOString().split('T')[0];

      // Upsert so we don't duplicate
      const { error } = await supabase.from('health_metrics').upsert({
        user_id: user.user.id,
        date,
        metric_type: 'sleep',
        value: parseFloat(targetHours.toFixed(1)),
        notes: `quality: ${quality}/5, bedtime: ${bedtime}, wake: ${wakeTime}`,
        schedule_event_id: event.id,
      }, { onConflict: 'user_id,date,metric_type' });

      if (error) throw error;
      setLogged(true);
      showToast('Sleep logged! 😴', 'success');
      window.dispatchEvent(new Event('lifeos-refresh'));
    } catch {
      showToast('Failed to log sleep', 'error');
    } finally {
      setLogging(false);
    }
  };

  return (
    <div className="ed-sleep">
      {/* Sleep Times */}
      <div className="ed-card">
        <div className="ed-sleep-times">
          <div className="ed-sleep-time-card">
            <div className="ed-sleep-time-value">{bedtime}</div>
            <div className="ed-sleep-time-label"><Moon size={14} /> Bedtime</div>
          </div>
          <div className="ed-sleep-time-card">
            <div className="ed-sleep-time-value">{wakeTime}</div>
            <div className="ed-sleep-time-label"><Sun size={14} /> Wake Up</div>
          </div>
        </div>
        <div className="ed-sleep-duration">
          Target: <strong>{targetHours.toFixed(1)} hours</strong>
        </div>
      </div>

      {/* Existing Data Comparison */}
      {existingData && (
        <div className="ed-card">
          <div className="ed-card-header">Previous Log</div>
          <div className="ed-sleep-compare">
            {existingData.sleep_hours !== undefined && (
              <span>
                Logged: <strong>{existingData.sleep_hours}h</strong>
                {' '}
                <span className={existingData.sleep_hours >= targetHours ? 'good' : 'warn'}>
                  {existingData.sleep_hours >= targetHours ? '✓ On target' : '△ Below target'}
                </span>
              </span>
            )}
            {existingData.sleep_quality !== undefined && (
              <span> | Quality: {stars[existingData.sleep_quality - 1]} ({existingData.sleep_quality}/5)</span>
            )}
          </div>
        </div>
      )}

      {/* Quality Rating */}
      <div className="ed-card">
        <div className="ed-card-header">Sleep Quality</div>
        <div className="ed-star-rating">
          {stars.map((emoji, i) => (
            <span
              key={i}
              className={`ed-star ${quality >= i + 1 ? 'active' : ''}`}
              onClick={() => setQuality(i + 1)}
              role="button"
              aria-label={`Rate ${i + 1} out of 5`}
            >
              {emoji}
            </span>
          ))}
        </div>
        {quality > 0 && (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            {quality === 1 && 'Terrible — barely slept'}
            {quality === 2 && 'Poor — tossed and turned'}
            {quality === 3 && 'Okay — could be better'}
            {quality === 4 && 'Good — well rested'}
            {quality === 5 && 'Excellent — deep sleep!'}
          </div>
        )}
      </div>

      {/* Notes from event */}
      {(event.notes || event.description) && (
        <div className="ed-card">
          <div className="ed-card-header"><Moon size={12} /> Notes</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>
            {(event.notes || event.description || '').replace(/^\[.*?\]\s*/g, '').trim() || 'No notes'}
          </p>
        </div>
      )}

      {/* Log Sleep Button */}
      <button
        className="ed-action-btn"
        onClick={handleLogSleep}
        disabled={logging || logged || quality === 0}
        style={logged ? { background: 'rgba(34,197,94,0.15)', color: '#22C55E', borderColor: 'rgba(34,197,94,0.3)' } : undefined}
      >
        {logged ? (
          <><Check size={16} /> Sleep Logged!</>
        ) : logging ? (
          <>Logging...</>
        ) : (
          <><Moon size={16} /> Log Sleep</>
        )}
      </button>
    </div>
  );
}
