/**
 * DailyHermeticAffirmation — Today's governing Hermetic principle
 * with a living affirmation drawn from the Seven.
 *
 * Rotates daily via getDailyPrinciple().
 * Renders as a compact, ethereal card with subtle glow.
 */

import { getDailyPrinciple, getDailyAffirmation } from '../../lib/hermetic-integration';

export function DailyHermeticAffirmation() {
  const principle = getDailyPrinciple();
  const affirmation = getDailyAffirmation();
  const today = new Date();
  const dayName = today.toLocaleDateString('en-AU', { weekday: 'long' });

  return (
    <div style={{
      background: `linear-gradient(135deg, ${principle.color}06 0%, #0F2D4A 100%)`,
      border: `1px solid ${principle.color}15`,
      borderRadius: 16,
      padding: '14px 18px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Accent glow */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 70, height: 70, borderRadius: '50%',
        background: `radial-gradient(circle, ${principle.color}0C 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 8,
      }}>
        <div style={{
          padding: '3px 8px',
          background: `${principle.color}12`,
          border: `1px solid ${principle.color}25`,
          borderRadius: 6,
          fontSize: 9, fontWeight: 700, letterSpacing: 1.2,
          color: principle.color,
          textTransform: 'uppercase' as const,
        }}>
          {principle.name}
        </div>
        <span style={{ fontSize: 10, color: '#5A7A9A' }}>
          {dayName}'s principle
        </span>
      </div>

      {/* Axiom */}
      <div style={{
        fontSize: 13, fontWeight: 600,
        color: 'rgba(255,255,255,0.85)',
        marginBottom: 6,
      }}>
        {principle.axiom}
      </div>

      {/* Affirmation */}
      <div style={{
        fontSize: 12, fontStyle: 'italic',
        color: principle.color, opacity: 0.7,
        lineHeight: 1.5,
      }}>
        "{affirmation.text}"
      </div>

      {/* Correspondence */}
      <div style={{
        marginTop: 8, fontSize: 10,
        color: '#5A7A9A', lineHeight: 1.4,
        borderTop: '1px solid rgba(26,58,92,0.3)',
        paddingTop: 6,
      }}>
        {principle.correspondences}
      </div>

      {/* Hermetic footer */}
      <div style={{
        marginTop: 8, textAlign: 'center',
        fontSize: 8, color: 'rgba(255,255,255,0.12)',
        fontStyle: 'italic',
      }}>
        AS ABOVE, SO BELOW — THE KYBALION
      </div>
    </div>
  );
}