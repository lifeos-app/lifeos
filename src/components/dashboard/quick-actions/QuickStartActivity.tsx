/**
 * QuickStartActivity — Start/stop live activities from the dashboard.
 * Bottom sheet with activity name input (autocomplete), category pills, and start button.
 * Fetches AI-powered suggestions from the server agent when in free time.
 */

import { useState, useRef, useEffect } from 'react';
import { Play, Square, Sparkles } from 'lucide-react';
import { BottomSheet } from '../../BottomSheet';
import { useLiveActivityStore } from '../../../stores/useLiveActivityStore';
import { useUserStore } from '../../../stores/useUserStore';
import { showToast } from '../../Toast';
import './QuickStartActivity.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface AgentSuggestion {
  title: string;
  category: string;
  icon: string;
  reason: string;
  source: string;
}

const FALLBACK_SUGGESTIONS = [
  'Commute',
  'Travel to work',
  'Travel home',
  'Office',
  'Cleaning',
  'Gym',
  'Study',
];

const CATEGORIES = [
  { value: 'travel', label: '🚗 Travel', color: '#00D4FF' },
  { value: 'work', label: '💼 Work', color: '#F97316' },
  { value: 'exercise', label: '💪 Exercise', color: '#39FF14' },
  { value: 'study', label: '📚 Study', color: '#A78BFA' },
  { value: 'personal', label: '🏠 Personal', color: '#F472B6' },
];

/** Auto-detect category from title */
function inferCategory(title: string): string | null {
  const lower = title.toLowerCase();
  if (lower.includes('travel') || lower.includes('drive') || lower.includes('commute')) return 'travel';
  if (lower.includes('clean') || lower.includes('work') || lower.includes('office')) return 'work';
  if (lower.includes('gym') || lower.includes('run') || lower.includes('walk') || lower.includes('exercise')) return 'exercise';
  if (lower.includes('study') || lower.includes('read') || lower.includes('learn')) return 'study';
  return null;
}

const AGENT_URL = import.meta.env.VITE_ZEROCLAW_URL || `${import.meta.env.VITE_API_BASE_URL || ''}/zeroclaw`;

export function QuickStartActivity({ open, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('personal');
  const [starting, setStarting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AgentSuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startActivity = useLiveActivityStore(s => s.startActivity);
  const user = useUserStore(s => s.user);

  // Fetch AI suggestions when sheet opens
  useEffect(() => {
    if (open && user?.id) {
      setTimeout(() => inputRef.current?.focus(), 350);
      // Fetch smart suggestions from agent
      setAiLoading(true);
      fetch(`${AGENT_URL}/suggest-activities?userId=${user.id}`)
        .then(r => r.ok ? r.json() : [])
        .then((data: AgentSuggestion[]) => {
          setAiSuggestions(data || []);
          setAiLoading(false);
        })
        .catch(() => {
          setAiSuggestions([]);
          setAiLoading(false);
        });
    } else if (!open) {
      setTitle('');
      setCategory('personal');
      setShowSuggestions(false);
    }
  }, [open, user?.id]);

  // Merge AI suggestions with fallbacks
  const allSuggestionTitles = aiSuggestions.length > 0
    ? aiSuggestions.map(s => s.title)
    : FALLBACK_SUGGESTIONS;

  const filteredSuggestions = title.trim()
    ? allSuggestionTitles.filter(s => s.toLowerCase().includes(title.toLowerCase()))
    : allSuggestionTitles;

  const handleSelectSuggestion = (suggestion: string) => {
    setTitle(suggestion);
    setShowSuggestions(false);
    const inferred = inferCategory(suggestion);
    if (inferred) setCategory(inferred);
    inputRef.current?.focus();
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    setShowSuggestions(true);
    const inferred = inferCategory(val);
    if (inferred) setCategory(inferred);
  };

  const handleStart = async () => {
    if (!title.trim() || starting) return;

    setStarting(true);
    const event = await startActivity(title.trim(), category);

    if (event) {
      showToast(`▶ ${title.trim()} started!`, '⏱️', '#00D4FF');
      setTitle('');
      setCategory('personal');
      onClose();
    } else {
      showToast('Failed to start activity', '❌', '#F43F5E');
    }
    setStarting(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleStart();
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Start Activity" icon={<Play size={18} />}>
      <div className="bs-field qsa-field">
        <label className="bs-label">What are you doing?</label>
        <input
          ref={inputRef}
          className="bs-input"
          placeholder="e.g. Travel home, Cleaning, Gym..."
          value={title}
          onChange={e => handleTitleChange(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />

        {/* AI-powered suggestions */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="qsa-suggestions">
            {aiSuggestions.length > 0 && !title.trim() && (
              <div className="qsa-ai-label">
                <Sparkles size={12} /> {aiLoading ? 'Thinking...' : 'Suggested for you'}
              </div>
            )}
            {filteredSuggestions.map(s => {
              const aiMatch = aiSuggestions.find(a => a.title === s);
              return (
                <button
                  key={s}
                  className={`qsa-suggestion ${aiMatch ? 'qsa-suggestion-ai' : ''}`}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => handleSelectSuggestion(s)}
                >
                  <span className="qsa-suggestion-title">
                    {aiMatch?.icon && <span className="qsa-suggestion-icon">{aiMatch.icon}</span>}
                    {s}
                  </span>
                  {aiMatch?.reason && (
                    <span className="qsa-suggestion-reason">{aiMatch.reason}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="bs-field">
        <label className="bs-label">Category</label>
        <div className="qsa-categories">
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              className={`qsa-pill ${category === c.value ? 'qsa-pill-active' : ''}`}
              onClick={() => setCategory(c.value)}
              style={category === c.value ? {
                borderColor: c.color,
                color: c.color,
                background: `${c.color}15`,
              } : {}}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <button
        className="bs-submit"
        onClick={handleStart}
        disabled={!title.trim() || starting}
      >
        <Play size={16} />
        {starting ? 'Starting...' : 'Start Timer ▶'}
      </button>
    </BottomSheet>
  );
}
