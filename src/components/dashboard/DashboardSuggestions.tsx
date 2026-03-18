/**
 * DashboardSuggestions — Habit suggestions widget for the Dashboard.
 */

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';
import { acceptSuggestion, dismissSuggestion, type HabitSuggestion } from '../../lib/habit-engine';
import { showToast } from '../Toast';

interface DashboardSuggestionsProps {
  suggestions: HabitSuggestion[];
  onSuggestionsChange: (s: HabitSuggestion[]) => void;
  onRefresh: () => void;
}

export function DashboardSuggestions({ suggestions, onSuggestionsChange, onRefresh }: DashboardSuggestionsProps) {
  const user = useUserStore(s => s.user);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  if (suggestions.length === 0) return null;

  return (
    <section className="dash-card dash-suggestions">
      <div className="card-top">
        <h2><Sparkles size={16} /> Suggested Habits</h2>
        <span className="card-top-badge">{suggestions.length} new</span>
      </div>
      <p className="dash-suggestions-intro">Based on your patterns and goals</p>
      <div className="dash-suggestions-list">
        {suggestions.slice(0, 3).map((s, i) => (
          <div key={i} className="dash-suggestion-row">
            <span className="dash-suggestion-icon">{s.icon}</span>
            <div className="dash-suggestion-info">
              <span className="dash-suggestion-title">{s.title}</span>
              <span className="dash-suggestion-reason">{s.reason}</span>
            </div>
            <div className="dash-suggestion-actions">
              <button className="dash-suggestion-accept" disabled={acceptingId === s.title}
                onClick={async () => {
                  if (!user?.id) return;
                  setAcceptingId(s.title);
                  const { error } = await acceptSuggestion(user.id, s);
                  if (!error) {
                    showToast(`"${s.title}" added to habits!`, '✅', '#39FF14');
                    onSuggestionsChange(suggestions.filter(x => x.title !== s.title));
                    onRefresh();
                  }
                  setAcceptingId(null);
                }}>
                {acceptingId === s.title ? '...' : '✓'}
              </button>
              <button className="dash-suggestion-dismiss"
                onClick={async () => {
                  if (!user?.id) return;
                  await dismissSuggestion(user.id, s);
                  onSuggestionsChange(suggestions.filter(x => x.title !== s.title));
                }}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
