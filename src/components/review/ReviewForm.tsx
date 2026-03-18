/**
 * ReviewForm — Wins, improvements, priorities, and week score editing.
 * Only shown when editing an existing review for completed weeks.
 */

import {
  Trophy, TrendingUp, Target, Plus, X, GripVertical, Sparkles, Save, Loader2,
} from 'lucide-react';
import { useState } from 'react';

interface ReviewFormProps {
  wins: string;
  improvements: string;
  priorities: string[];
  weekScore: number;
  saving: boolean;
  onWinsChange: (v: string) => void;
  onImprovementsChange: (v: string) => void;
  onPrioritiesChange: (p: string[]) => void;
  onWeekScoreChange: (v: number) => void;
  onSave: () => void;
  hasExistingReview: boolean;
}

export function ReviewForm({
  wins, improvements, priorities, weekScore, saving,
  onWinsChange, onImprovementsChange, onPrioritiesChange, onWeekScoreChange,
  onSave, hasExistingReview,
}: ReviewFormProps) {
  const [newPriority, setNewPriority] = useState('');

  const addPriority = () => {
    if (newPriority.trim() && priorities.length < 5) {
      onPrioritiesChange([...priorities, newPriority.trim()]);
      setNewPriority('');
    }
  };

  const removePriority = (index: number) => {
    onPrioritiesChange(priorities.filter((_, i) => i !== index));
  };

  const movePriority = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newPriorities = [...priorities];
      [newPriorities[index], newPriorities[index - 1]] = [newPriorities[index - 1], newPriorities[index]];
      onPrioritiesChange(newPriorities);
    } else if (direction === 'down' && index < priorities.length - 1) {
      const newPriorities = [...priorities];
      [newPriorities[index], newPriorities[index + 1]] = [newPriorities[index + 1], newPriorities[index]];
      onPrioritiesChange(newPriorities);
    }
  };

  return (
    <>
      {/* Wins */}
      <section className="review-wk-section">
        <h2 className="review-wk-section-title">
          <Trophy size={18} /> What went well this week?
        </h2>
        <textarea
          className="review-wk-textarea"
          placeholder="Celebrate your wins, big and small..."
          value={wins}
          onChange={e => onWinsChange(e.target.value)}
          rows={5}
        />
      </section>

      {/* Improvements */}
      <section className="review-wk-section">
        <h2 className="review-wk-section-title">
          <TrendingUp size={18} /> What could be better?
        </h2>
        <textarea
          className="review-wk-textarea"
          placeholder="Reflect on challenges and areas for growth..."
          value={improvements}
          onChange={e => onImprovementsChange(e.target.value)}
          rows={5}
        />
      </section>

      {/* Next Week Priorities */}
      <section className="review-wk-section">
        <h2 className="review-wk-section-title">
          <Target size={18} /> Next Week Priorities
        </h2>
        <div className="review-wk-priorities">
          {priorities.map((priority, index) => (
            <div key={index} className="review-wk-priority-item">
              <div className="review-wk-priority-drag">
                <button onClick={() => movePriority(index, 'up')} disabled={index === 0}>
                  <GripVertical size={14} />
                </button>
                <button onClick={() => movePriority(index, 'down')} disabled={index === priorities.length - 1}>
                  <GripVertical size={14} />
                </button>
              </div>
              <span className="review-wk-priority-number">{index + 1}</span>
              <span className="review-wk-priority-text">{priority}</span>
              <button className="review-wk-priority-remove" onClick={() => removePriority(index)} aria-label={`Remove priority: ${priority}`}>
                <X size={14} />
              </button>
            </div>
          ))}
          {priorities.length < 5 && (
            <div className="review-wk-priority-add">
              <input
                type="text"
                className="review-wk-priority-input"
                placeholder="Add a priority..."
                value={newPriority}
                onChange={e => setNewPriority(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPriority()}
              />
              <button className="review-wk-priority-add-btn" onClick={addPriority} aria-label="Add priority">
                <Plus size={16} />
              </button>
            </div>
          )}
          {priorities.length === 0 && (
            <p className="review-wk-empty">No priorities set yet</p>
          )}
        </div>
      </section>

      {/* Week Score */}
      <section className="review-wk-section">
        <h2 className="review-wk-section-title">
          <Sparkles size={18} /> Score this week
        </h2>
        <div className="review-wk-score-slider">
          <span className="review-wk-score-label">1</span>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={weekScore}
            onChange={e => onWeekScoreChange(parseInt(e.target.value))}
            className="review-wk-slider"
          />
          <span className="review-wk-score-label">10</span>
          <span className="review-wk-score-value">{weekScore}</span>
        </div>
      </section>

      {/* Submit */}
      <button className="review-wk-submit-btn" onClick={onSave} disabled={saving}>
        {saving ? (
          <>
            <Sparkles size={16} className="spin" /> Saving...
          </>
        ) : (
          <>
            <Save size={16} /> {hasExistingReview ? 'Update Review' : 'Submit Review'}
          </>
        )}
      </button>
    </>
  );
}
