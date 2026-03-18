// ═══════════════════════════════════════════════════════════
// MEAL DETAIL — Meal event type
// Parses macros from notes, shows nutrition bars, log meal
// ═══════════════════════════════════════════════════════════

import { useState } from 'react';
import { Check, UtensilsCrossed } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { showToast } from '../Toast';
import type { ScheduleEvent } from '../../types/database';

interface MealDetailProps {
  event: ScheduleEvent;
}

interface MacroData {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
}

/** Detect meal type from event time */
function detectMealType(startTime: string): { label: string; emoji: string } {
  const hour = new Date(startTime).getHours();
  if (hour >= 5 && hour < 11) return { label: 'Breakfast', emoji: '🌅' };
  if (hour >= 11 && hour < 14) return { label: 'Lunch', emoji: '☀️' };
  if (hour >= 14 && hour < 17) return { label: 'Snack', emoji: '🍎' };
  if (hour >= 17 && hour < 21) return { label: 'Dinner', emoji: '🌙' };
  return { label: 'Snack', emoji: '🍎' };
}

/** Parse macros and ingredients from notes text */
function parseMacros(text: string): MacroData {
  const data: MacroData = { calories: 0, protein: 0, carbs: 0, fat: 0, ingredients: [] };
  if (!text) return data;
  
  // Try to find calorie info: "450 cal", "450 kcal", "calories: 450"
  const calMatch = text.match(/(\d+)\s*(?:k?cal(?:ories?)?)/i) || text.match(/calories?:?\s*(\d+)/i);
  if (calMatch) data.calories = parseInt(calMatch[1]);
  
  // Protein: "30g protein", "protein: 30g"
  const proteinMatch = text.match(/(\d+)\s*g?\s*protein/i) || text.match(/protein:?\s*(\d+)/i);
  if (proteinMatch) data.protein = parseInt(proteinMatch[1]);
  
  // Carbs: "50g carbs", "carbohydrates: 50"
  const carbsMatch = text.match(/(\d+)\s*g?\s*carb(?:ohydrate)?s?/i) || text.match(/carbs?:?\s*(\d+)/i);
  if (carbsMatch) data.carbs = parseInt(carbsMatch[1]);
  
  // Fat: "15g fat", "fat: 15"
  const fatMatch = text.match(/(\d+)\s*g?\s*fat/i) || text.match(/fat:?\s*(\d+)/i);
  if (fatMatch) data.fat = parseInt(fatMatch[1]);
  
  // Ingredients: lines starting with - or •, or after "ingredients:"
  const ingredientSection = text.match(/ingredients?:?\s*\n?([\s\S]*?)(?:\n\n|$)/i);
  if (ingredientSection) {
    const lines = ingredientSection[1].split('\n');
    for (const line of lines) {
      const cleaned = line.replace(/^[-•*\s]+/, '').trim();
      if (cleaned && cleaned.length > 1) data.ingredients.push(cleaned);
    }
  } else {
    // Look for bullet-point style lines anywhere
    const lines = text.split('\n');
    for (const line of lines) {
      if (/^[-•*]\s/.test(line.trim())) {
        const cleaned = line.trim().replace(/^[-•*]\s+/, '');
        if (cleaned) data.ingredients.push(cleaned);
      }
    }
  }
  
  // If we have no calories but have macros, estimate
  if (data.calories === 0 && (data.protein || data.carbs || data.fat)) {
    data.calories = (data.protein * 4) + (data.carbs * 4) + (data.fat * 9);
  }
  
  return data;
}

export function MealDetail({ event }: MealDetailProps) {
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);
  
  const noteText = event.notes || event.description || '';
  const macros = parseMacros(noteText);
  const mealType = detectMealType(event.start_time);
  
  // Max value for bar scaling
  const maxMacro = Math.max(macros.protein, macros.carbs, macros.fat, 1);

  const handleLogMeal = async () => {
    setLogging(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) { showToast('Not logged in', 'error'); return; }

      const today = new Date().toISOString().split('T')[0];

      await supabase.from('health_metrics').insert({
        user_id: user.user.id,
        date: today,
        metric_type: 'meal',
        value: macros.calories || 0,
        notes: `${mealType.label}: ${event.title}. P:${macros.protein}g C:${macros.carbs}g F:${macros.fat}g`,
        schedule_event_id: event.id,
      });

      setLogged(true);
      showToast('Meal logged! 🍽️', 'success');
      window.dispatchEvent(new Event('lifeos-refresh'));
    } catch {
      showToast('Failed to log meal', 'error');
    } finally {
      setLogging(false);
    }
  };

  return (
    <div className="ed-meal">
      {/* Meal Type Badge */}
      <div className="ed-meal-type-badge">
        {mealType.emoji} {mealType.label}
      </div>

      {/* Calories */}
      {macros.calories > 0 && (
        <div className="ed-card">
          <div className="ed-calories">
            <div className="ed-calories-value">{macros.calories}</div>
            <div className="ed-calories-label">Calories</div>
          </div>
        </div>
      )}

      {/* Macro Bars */}
      {(macros.protein > 0 || macros.carbs > 0 || macros.fat > 0) && (
        <div className="ed-card">
          <div className="ed-card-header">Macronutrients</div>
          <div className="ed-macros">
            <div className="ed-macro-row">
              <span className="ed-macro-label protein">Protein</span>
              <div className="ed-macro-bar">
                <div className="ed-macro-bar-fill protein" style={{ width: `${(macros.protein / maxMacro) * 100}%` }} />
              </div>
              <span className="ed-macro-value">{macros.protein}g</span>
            </div>
            <div className="ed-macro-row">
              <span className="ed-macro-label carbs">Carbs</span>
              <div className="ed-macro-bar">
                <div className="ed-macro-bar-fill carbs" style={{ width: `${(macros.carbs / maxMacro) * 100}%` }} />
              </div>
              <span className="ed-macro-value">{macros.carbs}g</span>
            </div>
            <div className="ed-macro-row">
              <span className="ed-macro-label fat">Fat</span>
              <div className="ed-macro-bar">
                <div className="ed-macro-bar-fill fat" style={{ width: `${(macros.fat / maxMacro) * 100}%` }} />
              </div>
              <span className="ed-macro-value">{macros.fat}g</span>
            </div>
          </div>
        </div>
      )}

      {/* Ingredients */}
      {macros.ingredients.length > 0 && (
        <div className="ed-card">
          <div className="ed-card-header">Ingredients</div>
          <div className="ed-ingredients">
            {macros.ingredients.map((ing, i) => (
              <div key={i} className="ed-ingredient">
                <div className="ed-ingredient-dot" />
                <span>{ing}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Show raw notes if no structured data was parsed */}
      {macros.calories === 0 && macros.protein === 0 && macros.ingredients.length === 0 && noteText && (
        <div className="ed-card">
          <div className="ed-card-header">Notes</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>
            {noteText}
          </p>
        </div>
      )}

      {/* Log Meal Button */}
      <button
        className="ed-action-btn"
        onClick={handleLogMeal}
        disabled={logging || logged}
        style={logged ? { background: 'rgba(34,197,94,0.15)', color: '#22C55E', borderColor: 'rgba(34,197,94,0.3)' } : undefined}
      >
        {logged ? (
          <><Check size={16} /> Meal Logged!</>
        ) : logging ? (
          <>Logging...</>
        ) : (
          <><UtensilsCrossed size={16} /> Log Meal</>
        )}
      </button>
    </div>
  );
}
