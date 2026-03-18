/**
 * QuickLogMeal — Meal type selector, food input, optional calories. One-tap log.
 */

import { useState, useRef, useEffect } from 'react';
import { UtensilsCrossed, Send, Sunrise, Sun, Moon, Cookie } from 'lucide-react';
import { BottomSheet } from '../../BottomSheet';
import { useUserStore } from '../../../stores/useUserStore';
import { supabase } from '../../../lib/supabase';
import { localDateStr } from '../../../utils/date';
import { showToast } from '../../Toast';

interface Props {
  open: boolean;
  onClose: () => void;
}

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', icon: <Sunrise size={16} />, emoji: '🌅' },
  { value: 'lunch', label: 'Lunch', icon: <Sun size={16} />, emoji: '☀️' },
  { value: 'dinner', label: 'Dinner', icon: <Moon size={16} />, emoji: '🌙' },
  { value: 'snack', label: 'Snack', icon: <Cookie size={16} />, emoji: '🍪' },
];

// Auto-guess meal type from current time
function guessMealType(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 21) return 'dinner';
  return 'snack';
}

export function QuickLogMeal({ open, onClose }: Props) {
  const [mealType, setMealType] = useState(guessMealType());
  const [description, setDescription] = useState('');
  const [calories, setCalories] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const user = useUserStore(s => s.user);

  useEffect(() => {
    if (open) {
      setMealType(guessMealType());
      setTimeout(() => inputRef.current?.focus(), 350);
    } else {
      setDescription('');
      setCalories('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!description.trim() || !user?.id || saving) return;
    
    setSaving(true);
    
    const { error } = await supabase.from('meals').insert({
      user_id: user.id,
      date: localDateStr(),
      meal_type: mealType,
      description: description.trim(),
      calories: calories ? parseInt(calories) : null,
      is_deleted: false,
    });
    
    if (!error) {
      const typeEmoji = MEAL_TYPES.find(m => m.value === mealType)?.emoji || '🍽️';
      showToast(`${typeEmoji} ${mealType.charAt(0).toUpperCase() + mealType.slice(1)} logged!`, '🍽️', '#F97316');
      setDescription('');
      setCalories('');
      onClose();
    } else {
      showToast('Failed to log meal', '❌', '#F43F5E');
    }
    setSaving(false);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Log Meal" icon={<UtensilsCrossed size={18} />}>
      <div className="bs-meal-types">
        {MEAL_TYPES.map(m => (
          <button
            key={m.value}
            className={`bs-meal-type ${mealType === m.value ? 'bs-meal-type-active' : ''}`}
            onClick={() => setMealType(m.value)}
          >
            {m.icon}
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      <div className="bs-field">
        <label className="bs-label">What did you eat?</label>
        <input
          ref={inputRef}
          className="bs-input"
          placeholder="e.g. Eggs and toast, Chicken stir fry..."
          value={description}
          onChange={e => setDescription(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
        />
      </div>

      <div className="bs-field">
        <label className="bs-label">Calories (optional)</label>
        <input
          className="bs-input"
          type="number"
          inputMode="numeric"
          placeholder="e.g. 450"
          value={calories}
          onChange={e => setCalories(e.target.value)}
        />
      </div>

      <button
        className="bs-submit"
        onClick={handleSubmit}
        disabled={!description.trim() || saving}
      >
        <Send size={16} />
        {saving ? 'Logging...' : 'Log Meal'}
      </button>
    </BottomSheet>
  );
}
