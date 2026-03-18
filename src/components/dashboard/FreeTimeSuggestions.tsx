/**
 * FreeTimeSuggestions — AI-powered activity suggestions on the dashboard.
 * Shows when user is in "free time" (no active live event, gap before next event).
 * Fetches suggestions from the server agent based on goals, habits, and patterns.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Sparkles, Loader2 } from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';
import { useLiveActivityStore } from '../../stores/useLiveActivityStore';
import { useCurrentEvent } from '../../hooks/useCurrentEvent';
import { showToast } from '../Toast';
import './FreeTimeSuggestions.css';

interface AgentSuggestion {
  title: string;
  category: string;
  icon: string;
  reason: string;
  source: string;
}

const AGENT_URL = import.meta.env.VITE_ZEROCLAW_URL || `${import.meta.env.VITE_API_BASE_URL || ''}/zeroclaw`;

const CATEGORY_COLORS: Record<string, string> = {
  education: '#A78BFA',
  exercise: '#39FF14',
  work: '#F97316',
  travel: '#00D4FF',
  spiritual: '#FFD700',
  personal: '#F472B6',
  social: '#EC4899',
  financial: '#22C55E',
  habit: '#FACC15',
  task: '#EF4444',
};

export function FreeTimeSuggestions() {
  const user = useUserStore(s => s.user);
  const { activeEvent, startActivity } = useLiveActivityStore();
  const { currentEvent, freeUntil, minutesToNext } = useCurrentEvent();
  const [suggestions, setSuggestions] = useState<AgentSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // BUG-080: Track visibility to avoid unnecessary API calls
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isFreeTime = !activeEvent && !currentEvent;

  const fetchSuggestions = useCallback(async () => {
    // BUG-080: Only fetch when visible on screen
    if (!user?.id || !isFreeTime || !isVisible) return;
    setLoading(true);
    try {
      const res = await fetch(`${AGENT_URL}/suggest-activities?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [user?.id, isFreeTime, isVisible]);

  // BUG-080: IntersectionObserver to track visibility
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fetchSuggestions();
    // Refresh every 10 minutes (only when visible)
    const interval = setInterval(fetchSuggestions, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchSuggestions]);

  // Reset dismissed when free time status changes
  useEffect(() => {
    setDismissed(false);
  }, [isFreeTime]);

  const handleStart = async (suggestion: AgentSuggestion) => {
    setStarting(suggestion.title);
    const event = await startActivity(suggestion.title, suggestion.category);
    if (event) {
      showToast(`▶ ${suggestion.title} started!`, '⏱️', CATEGORY_COLORS[suggestion.category] || '#00D4FF');
    }
    setStarting(null);
  };

  // Don't show if: not free time, no suggestions, dismissed, or loading with no cached suggestions
  if (!isFreeTime || dismissed || (suggestions.length === 0 && !loading)) return null;

  const freeTimeLabel = minutesToNext != null && minutesToNext > 0 && minutesToNext < 120
    ? `${minutesToNext}min free`
    : 'Free time';

  return (
    <div ref={containerRef} className="fts-bar animate-fadeUp-03">
      <div className="fts-header">
        <div className="fts-title">
          <Sparkles size={14} className="fts-sparkle" />
          <span>{freeTimeLabel} — What's next?</span>
        </div>
      </div>

      {loading && suggestions.length === 0 ? (
        <div className="fts-loading">
          <Loader2 size={14} className="spin" /> Finding suggestions...
        </div>
      ) : (
        <div className="fts-chips">
          {suggestions.map(s => (
            <button
              key={s.title}
              className="fts-chip"
              onClick={() => handleStart(s)}
              disabled={starting !== null}
              style={{ '--chip-color': CATEGORY_COLORS[s.category] || '#00D4FF' } as React.CSSProperties}
            >
              <span className="fts-chip-icon">{s.icon}</span>
              <span className="fts-chip-text">
                <span className="fts-chip-title">{s.title}</span>
                {s.reason && <span className="fts-chip-reason">{s.reason}</span>}
              </span>
              <Play size={12} className="fts-chip-play" />
              {starting === s.title && <Loader2 size={12} className="spin fts-chip-spinner" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
