/**
 * HermeticPrincipleOverlay — Data-driven Hermetic wisdom overlay.
 *
 * Consumes a PrincipleInsight from the bridge module and renders
 * PRINCIPLE / WISDOM / PRACTICE / MIRACLE in a glass morphism card
 * with the principle's signature color.
 *
 * Falls back to the daily principle when no insight is provided.
 *
 * "The lips of wisdom are closed, except to the ears of understanding."
 */

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { type PrincipleInsight, getCurrentPrincipleInsight } from '../../lib/hermetic-principle-insight';
import { type DetectedPattern } from '../../lib/pattern-engine';
import './HermeticPrincipleOverlay.css';

interface Props {
  /** A pre-resolved insight, or null to derive from patterns / daily fallback */
  insight: PrincipleInsight | null;
  /** Patterns to derive insight from when insight is null */
  patterns?: DetectedPattern[];
  /** Optional style overrides */
  style?: React.CSSProperties;
}

export function HermeticPrincipleOverlay({ insight: insightProp, patterns, style }: Props) {
  const [miracleOpen, setMiracleOpen] = useState(false);

  const insight = useMemo<PrincipleInsight>(() => {
    if (insightProp) return insightProp;
    if (patterns && patterns.length > 0) {
      const derived = getCurrentPrincipleInsight(patterns);
      if (derived) return derived;
    }
    // Daily fallback — pass empty array so getCurrentPrincipleInsight returns daily principle
    return getCurrentPrincipleInsight([]);
  }, [insightProp, patterns]);

  const color = insight.color;

  // Truncate wisdom to ~2 lines for card readability
  const wisdomText = useMemo(() => {
    const maxLen = 180;
    const w = insight.wisdom;
    if (w.length <= maxLen) return w;
    // Cut at last complete sentence or word boundary before maxLen
    const cut = w.lastIndexOf('.', maxLen);
    if (cut > maxLen * 0.5) return w.slice(0, cut + 1);
    const space = w.lastIndexOf(' ', maxLen);
    return w.slice(0, space > 0 ? space : maxLen) + '...';
  }, [insight.wisdom]);

  // Truncate practice to one-liner
  const practiceText = useMemo(() => {
    const maxLen = 120;
    const p = insight.practice;
    if (p.length <= maxLen) return p;
    const cut = p.lastIndexOf('.', maxLen);
    if (cut > maxLen * 0.4) return p.slice(0, cut + 1);
    const space = p.lastIndexOf(' ', maxLen);
    return p.slice(0, space > 0 ? space : maxLen) + '...';
  }, [insight.practice]);

  return (
    <div
      className="hermetic-overlay"
      style={{
        ...style,
        '--hermetic-color': color,
        borderLeftColor: color,
        boxShadow: `0 0 12px -4px ${color}40`,
      } as React.CSSProperties}
    >
      {/* PRINCIPLE + AXIOM */}
      <div className="hermetic-overlay__header">
        <span className="hermetic-overlay__principle-name" style={{ color }}>
          {insight.principle.name}
        </span>
        <span className="hermetic-overlay__axiom" style={{ color }}>
          {insight.principle.axiom}
        </span>
      </div>

      {/* WISDOM */}
      <div className="hermetic-overlay__wisdom">
        {wisdomText}
      </div>

      {/* PRACTICE */}
      <div className="hermetic-overlay__practice">
        <div
          className="hermetic-overlay__practice-bullet"
          style={{ background: color }}
        />
        <span>{practiceText}</span>
      </div>

      {/* MIRACLE — collapsible */}
      <button
        className="hermetic-overlay__miracle-toggle"
        style={{ color: miracleOpen ? color : undefined }}
        onClick={() => setMiracleOpen(v => !v)}
      >
        <Eye size={9} />
        {miracleOpen ? 'Hide Miracle' : 'Reveal Miracle'}
        {miracleOpen ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
      </button>

      {miracleOpen && (
        <div className="hermetic-overlay__miracle-content" style={{ color: `${color}CC` }}>
          {insight.miracle}
        </div>
      )}
    </div>
  );
}