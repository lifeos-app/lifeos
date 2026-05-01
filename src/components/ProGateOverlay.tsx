/**
 * ProGateOverlay — Dark glass panel that shows when a free user tries
 * to access a Pro feature. Displays "This is a Pro feature" with
 * description and an Upgrade/Coming Soon button.
 *
 * Uses Lucide icons only (no emoji per DESIGN-RULES.md).
 */
import { type JSX } from 'react';
import { Lock, Crown, Sparkles } from 'lucide-react';
import {
  type ProFeature,
  getFeatureDescription,
} from '../lib/feature-gates';

interface ProGateOverlayProps {
  /** Which Pro feature is gated */
  feature: ProFeature;
  /** Override the default description */
  description?: string;
  /** In early adopter mode, show a softer badge */
  earlyAdopterFree?: boolean;
  /** Remaining free uses (shown when limit applies) */
  remaining?: number;
  /** Limit value for display */
  limit?: number | 'unlimited';
  /** Called when user clicks Upgrade / Coming Soon */
  onUpgrade?: () => void;
  /** Extra class name for the overlay wrapper */
  className?: string;
}

export function ProGateOverlay({
  feature,
  description,
  earlyAdopterFree = false,
  remaining,
  limit,
  onUpgrade,
  className = '',
}: ProGateOverlayProps): JSX.Element {
  const desc = description ?? getFeatureDescription(feature);
  const isEarlyAdopter = earlyAdopterFree;

  return (
    <div
      className={`pro-gate-overlay ${className}`}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 180,
        width: '100%',
      }}
    >
      {/* Glass panel */}
      <div
        style={{
          background: 'var(--bg-glass-heavy, rgba(10, 14, 26, 0.92))',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: 'var(--radius-lg, 14px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '32px 28px',
          maxWidth: 380,
          width: '100%',
          textAlign: 'center',
          boxShadow: 'var(--shadow-elevation-lg, 0 8px 32px rgba(0, 0, 0, 0.4))',
        }}
      >
        {/* Icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: '50%',
            margin: '0 auto 16px',
            background: isEarlyAdopter
              ? 'var(--accent-gold-dim, rgba(255, 215, 0, 0.15))'
              : 'var(--accent-cyan-dim, rgba(0, 212, 255, 0.15))',
          }}
        >
          {isEarlyAdopter ? (
            <Sparkles size={24} style={{ color: 'var(--accent-gold, #FFD700)' }} />
          ) : (
            <Lock size={24} style={{ color: 'var(--accent-cyan, #00D4FF)' }} />
          )}
        </div>

        {/* Badge for early adopter */}
        {isEarlyAdopter && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 10px',
              borderRadius: 'var(--radius-full, 9999px)',
              background: 'var(--accent-gold-dim, rgba(255, 215, 0, 0.15))',
              color: 'var(--accent-gold, #FFD700)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase' as const,
              marginBottom: 12,
            }}
          >
            <Crown size={12} />
            Early Adopter — Free
          </div>
        )}

        {/* Title */}
        <h3
          style={{
            margin: 0,
            marginBottom: 6,
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary, #F9FAFB)',
          }}
        >
          {isEarlyAdopter ? 'Coming Soon' : 'This is a Pro Feature'}
        </h3>

        {/* Description */}
        <p
          style={{
            margin: 0,
            marginBottom: 16,
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--text-secondary, #9CA3AF)',
          }}
        >
          {desc}
        </p>

        {/* Usage info */}
        {typeof remaining === 'number' && typeof limit === 'number' && !isEarlyAdopter && (
          <p
            style={{
              margin: 0,
              marginBottom: 16,
              fontSize: 12,
              color: 'var(--text-muted, #6B7280)',
            }}
          >
            {remaining === 0
              ? `You've used all ${limit} free uses today`
              : `${remaining} of ${limit} free uses remaining today`}
          </p>
        )}

        {/* CTA button */}
        <button
          onClick={onUpgrade}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 20px',
            borderRadius: 'var(--radius-base, 8px)',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            background: isEarlyAdopter
              ? 'var(--accent-gold-dim, rgba(255, 215, 0, 0.15))'
              : 'linear-gradient(135deg, var(--accent-cyan, #00D4FF), var(--accent-purple, #8B5CF6))',
            color: isEarlyAdopter
              ? 'var(--accent-gold, #FFD700)'
              : '#fff',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = isEarlyAdopter
              ? '0 0 16px rgba(255, 215, 0, 0.3)'
              : '0 0 16px rgba(0, 212, 255, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = '';
            e.currentTarget.style.boxShadow = '';
          }}
        >
          <Crown size={14} />
          {isEarlyAdopter ? 'Learn More' : 'Upgrade to Pro'}
        </button>
      </div>
    </div>
  );
}