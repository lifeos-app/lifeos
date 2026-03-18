/**
 * QuickLogHealth — Weight, mood, energy, sleep. One-tap save.
 */

import { useState, useEffect } from 'react';
import { Activity, Send } from 'lucide-react';
import { BottomSheet } from '../../BottomSheet';
import { useUserStore } from '../../../stores/useUserStore';
import { useHealthStore } from '../../../stores/useHealthStore';
import { supabase } from '../../../lib/supabase';
import { localDateStr } from '../../../utils/date';
import { showToast } from '../../Toast';

interface Props {
  open: boolean;
  onClose: () => void;
}

const MOODS = [
  { value: 1, emoji: '😫', label: 'Awful' },
  { value: 2, emoji: '😕', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

const ENERGY_LEVELS = [1, 2, 3, 4, 5];

export function QuickLogHealth({ open, onClose }: Props) {
  const user = useUserStore(s => s.user);
  const todayMetrics = useHealthStore(s => s.todayMetrics);
  const invalidateHealth = useHealthStore(s => s.invalidate);
  
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [sleep, setSleep] = useState('');
  const [weight, setWeight] = useState('');
  const [water, setWater] = useState('');
  const [saving, setSaving] = useState(false);

  // Pre-fill from today's existing data
  useEffect(() => {
    if (open && todayMetrics) {
      setMood(todayMetrics.mood_score ?? null);
      setEnergy(todayMetrics.energy_score ?? null);
      setSleep(todayMetrics.sleep_hours?.toString() || '');
      setWeight(todayMetrics.weight_kg?.toString() || '');
      setWater(todayMetrics.water_glasses?.toString() || '');
    } else if (!open) {
      setMood(null);
      setEnergy(null);
      setSleep('');
      setWeight('');
      setWater('');
    }
  }, [open, todayMetrics]);

  const hasAny = mood !== null || energy !== null || sleep || weight || water;

  const handleSubmit = async () => {
    if (!hasAny || !user?.id || saving) return;

    // Validate ranges before submitting
    const sleepNum = sleep ? parseFloat(sleep) : null;
    const weightNum = weight ? parseFloat(weight) : null;
    const waterNum = water ? parseInt(water) : null;

    if (sleepNum !== null && (isNaN(sleepNum) || sleepNum < 0 || sleepNum > 24)) {
      showToast('Sleep must be 0-24 hours', '⚠️', '#F97316'); return;
    }
    if (weightNum !== null && (isNaN(weightNum) || weightNum < 20 || weightNum > 300)) {
      showToast('Weight must be 20-300 kg', '⚠️', '#F97316'); return;
    }
    if (waterNum !== null && (isNaN(waterNum) || waterNum < 0 || waterNum > 50)) {
      showToast('Water must be 0-50 glasses', '⚠️', '#F97316'); return;
    }

    setSaving(true);

    const metrics: Record<string, unknown> = {
      user_id: user.id,
      date: localDateStr(),
      updated_at: new Date().toISOString(),
    };

    if (mood !== null) metrics.mood_score = mood;
    if (energy !== null) metrics.energy_score = energy;
    if (sleepNum !== null) metrics.sleep_hours = sleepNum;
    if (weightNum !== null) metrics.weight_kg = weightNum;
    if (waterNum !== null) metrics.water_glasses = waterNum;

    const { error } = await supabase.from('health_metrics').upsert(
      metrics,
      { onConflict: 'user_id,date' }
    );
    
    if (!error) {
      const moodEmoji = mood ? MOODS.find(m => m.value === mood)?.emoji || '✓' : '✓';
      showToast(`Health logged! ${moodEmoji}`, '💪', '#00D4FF');
      invalidateHealth();
      onClose();
    } else {
      showToast('Failed to save health data', '❌', '#F43F5E');
    }
    setSaving(false);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Log Health" icon={<Activity size={18} />}>
      {/* Mood */}
      <div className="bs-field">
        <label className="bs-label">Mood</label>
        <div className="bs-emoji-row">
          {MOODS.map(m => (
            <button
              key={m.value}
              className={`bs-emoji-btn ${mood === m.value ? 'bs-emoji-selected' : ''}`}
              onClick={() => setMood(mood === m.value ? null : m.value)}
              title={m.label}
            >
              {m.emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Energy */}
      <div className="bs-field">
        <label className="bs-label">Energy Level</label>
        <div className="bs-rating-row">
          {ENERGY_LEVELS.map(e => (
            <button
              key={e}
              className={`bs-rating-dot ${energy !== null && e <= energy ? 'bs-rating-active' : ''}`}
              onClick={() => setEnergy(energy === e ? null : e)}
            >
              ⚡{e}
            </button>
          ))}
        </div>
      </div>

      {/* Sleep & Weight & Water */}
      <div className="bs-row">
        <div className="bs-field">
          <label className="bs-label">Sleep (hrs)</label>
          <input
            className="bs-input"
            type="number"
            inputMode="decimal"
            placeholder="7.5"
            step="0.5"
            value={sleep}
            onChange={e => setSleep(e.target.value)}
          />
        </div>
        <div className="bs-field">
          <label className="bs-label">Weight (kg)</label>
          <input
            className="bs-input"
            type="number"
            inputMode="decimal"
            placeholder="75"
            step="0.1"
            value={weight}
            onChange={e => setWeight(e.target.value)}
          />
        </div>
        <div className="bs-field">
          <label className="bs-label">Water 🥤</label>
          <input
            className="bs-input"
            type="number"
            inputMode="numeric"
            placeholder="8"
            value={water}
            onChange={e => setWater(e.target.value)}
          />
        </div>
      </div>

      <button
        className="bs-submit"
        onClick={handleSubmit}
        disabled={!hasAny || saving}
      >
        <Send size={16} />
        {saving ? 'Saving...' : 'Save Health Data'}
      </button>
    </BottomSheet>
  );
}
