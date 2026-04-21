/**
 * SageWidget — Holy Sage Oracle card for the Dashboard
 *
 * A compact card inviting users to "ask the oracle" with a one-liner input.
 * On enter, navigates to /sage with the question pre-filled via URL search params.
 * Spiritual times (morning/night) boost visibility via dashboard-modes.ts priorities.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import './SageWidget.css';

export function SageWidget() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    // Navigate to /sage with question pre-filled as search param
    navigate(`/sage?q=${encodeURIComponent(q)}`);
    setQuestion('');
  }, [question, navigate]);

  return (
    <div className="sage-widget">
      {/* Ambient glow orb */}
      <div className="sage-widget__glow" aria-hidden="true" />

      {/* Header */}
      <div className="sage-widget__header">
        <div className="sage-widget__icon">
          <Sparkles size={16} />
        </div>
        <div className="sage-widget__label">
          <span className="sage-widget__name">HOLY SAGE ORACLE</span>
          <span className="sage-widget__tagline">Wisdom across traditions</span>
        </div>
      </div>

      {/* Motivational line */}
      <p className="sage-widget__invite">
        The Oracle awaits your question&hellip;
      </p>

      {/* Input — one-liner, no chat */}
      <form className="sage-widget__form" onSubmit={handleSubmit}>
        <input
          className="sage-widget__input"
          type="text"
          placeholder="Ask the Oracle..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          aria-label="Ask the Holy Sage Oracle a question"
          maxLength={280}
        />
        <button
          className="sage-widget__submit"
          type="submit"
          disabled={!question.trim()}
          aria-label="Go to Sage"
        >
          <ArrowRight size={16} />
        </button>
      </form>

      {/* Hint */}
      <span className="sage-widget__hint">
        Press Enter to consult the Sage
      </span>
    </div>
  );
}