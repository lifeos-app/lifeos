/**
 * ReengagementModal.tsx — Full-screen welcoming modal for returning users
 *
 * Shows when a user returns after 2+ days of inactivity.
 * Features an NPC-themed message with friendly greeting,
 * streak status, and action buttons.
 *
 * Design: Glass theme, warm amber/gold colors, Lucide icons (no emoji).
 * Position: fixed overlay, centered content card.
 * Auto-dismisses after 15 seconds if no interaction.
 */

import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Flame, RotateCcw, X, ChevronRight, Shield } from 'lucide-react';
import type { ChurnSignal } from '../lib/churn-prevention';
import { getReengagementMessage } from '../lib/churn-prevention';
import { NPC_DEFINITIONS } from '../lib/npc-friendship';

interface ReengagementModalProps {
  signal: ChurnSignal;
  onDismiss: () => void;
  userName?: string;
}

/** Background gradient and accent per churn level */
const LEVEL_STYLES: Record<string, { accent: string; bg: string; glow: string; iconBg: string }> = {
  warning: {
    accent: '#F59E0B',
    bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(252, 211, 77, 0.08) 50%, rgba(16, 185, 129, 0.06) 100%)',
    glow: '0 0 40px rgba(245, 158, 11, 0.15)',
    iconBg: 'rgba(245, 158, 11, 0.15)',
  },
  critical: {
    accent: '#EF4444',
    bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(245, 158, 11, 0.08) 50%, rgba(16, 185, 129, 0.06) 100%)',
    glow: '0 0 40px rgba(239, 68, 68, 0.15)',
    iconBg: 'rgba(239, 68, 68, 0.15)',
  },
  lost: {
    accent: '#10B981',
    bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(252, 211, 77, 0.08) 50%, rgba(99, 102, 241, 0.06) 100%)',
    glow: '0 0 40px rgba(16, 185, 129, 0.15)',
    iconBg: 'rgba(16, 185, 129, 0.15)',
  },
};

const LEVEL_ICONS: Record<string, typeof Heart> = {
  warning: Flame,
  critical: Shield,
  lost: RotateCcw,
};

const LEVEL_TITLES: Record<string, string> = {
  warning: 'Welcome Back',
  critical: 'We Missed You',
  lost: 'It\'s Good to See You Again',
};

export function ReengagementModal({ signal, onDismiss, userName }: ReengagementModalProps) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [autoDismissTimer, setAutoDismissTimer] = useState<NodeJS.Timeout | null>(null);

  const styles = LEVEL_STYLES[signal.level] || LEVEL_STYLES.warning;
  const IconComponent = LEVEL_ICONS[signal.level] || Heart;
  const levelTitle = LEVEL_TITLES[signal.level] || 'Welcome Back';

  // Find NPC definition for additional context
  const npcDef = NPC_DEFINITIONS.find(n => n.id === signal.npcId);

  // Full NPC-themed message
  const fullMessage = getReengagementMessage(signal, userName || '');

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => {
      setVisible(true);
    });
  }, []);

  // Auto-dismiss after 15 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss();
    }, 15000);
    setAutoDismissTimer(timer);
    return () => {
      clearTimeout(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      onDismiss();
    }, 300); // Wait for fade-out animation
  }, [onDismiss]);

  const handleAction = useCallback((route: string) => {
    setVisible(false);
    setTimeout(() => {
      onDismiss();
      navigate(route);
    }, 200);
  }, [onDismiss, navigate]);

  // Determine CTA buttons based on churn level
  const ctaButtons = signal.level === 'lost'
    ? [
        { label: 'Start Fresh', route: '/', icon: RotateCcw, primary: true },
        { label: 'View Dashboard', route: '/', icon: ChevronRight, primary: false },
      ]
    : [
        { label: 'Check Habits', route: '/habits', icon: Flame, primary: true },
        { label: 'View Dashboard', route: '/', icon: ChevronRight, primary: false },
      ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: visible ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        transition: 'background 0.3s ease',
        fontFamily: "'Poppins', sans-serif",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome back to LifeOS"
    >
      <div
        style={{
          maxWidth: 480,
          width: '90vw',
          padding: '40px 32px 32px',
          borderRadius: 20,
          background: visible
            ? 'linear-gradient(145deg, rgba(15, 45, 74, 0.95) 0%, rgba(10, 30, 50, 0.97) 100%)'
            : 'linear-gradient(145deg, rgba(15, 45, 74, 0.5) 0%, rgba(10, 30, 50, 0.6) 100%)',
          border: `1px solid ${signal.level === 'lost' ? 'rgba(16, 185, 129, 0.3)' : signal.level === 'critical' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
          boxShadow: visible ? styles.glow : 'none',
          transform: visible ? 'scale(1)' : 'scale(0.9)',
          opacity: visible ? 1 : 0,
          transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          overflow: 'hidden',
        }}
      >
        {/* Background gradient overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: styles.bg,
            borderRadius: 20,
            pointerEvents: 'none',
          }}
        />

        {/* Close button */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 8,
            padding: 6,
            cursor: 'pointer',
            color: 'rgba(255, 255, 255, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
          }}
        >
          <X size={16} />
        </button>

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          {/* Icon */}
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: styles.iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              border: `1px solid ${styles.accent}33`,
            }}
          >
            <IconComponent size={28} color={styles.accent} />
          </div>

          {/* Title */}
          <h2
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: '#fff',
              marginBottom: 6,
              letterSpacing: '-0.02em',
            }}
          >
            {levelTitle}
          </h2>

          {/* NPC attribution */}
          <p
            style={{
              fontSize: 13,
              color: styles.accent,
              fontWeight: 500,
              marginBottom: 16,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {signal.npcCharacter} sends a message
          </p>

          {/* Message */}
          <p
            style={{
              fontSize: 15,
              color: 'rgba(255, 255, 255, 0.8)',
              lineHeight: 1.65,
              marginBottom: 20,
            }}
          >
            {fullMessage}
          </p>

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 24,
              marginBottom: 24,
            }}
          >
            {/* Days inactive */}
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: styles.accent,
                }}
              >
                {signal.daysInactive}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255, 255, 255, 0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Days Away
              </div>
            </div>

            {/* Streak snapshot */}
            {signal.streakSnapshot > 0 && (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: '#F59E0B',
                  }}
                >
                  {signal.streakSnapshot}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'rgba(255, 255, 255, 0.5)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Active Streaks
                </div>
              </div>
            )}

            {/* NPC greeting */}
            {npcDef && (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontStyle: 'italic',
                    marginTop: 2,
                  }}
                >
                  "{npcDef.greeting}"
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'rgba(255, 255, 255, 0.5)',
                    marginTop: 4,
                  }}
                >
                  {npcDef.name}
                </div>
              </div>
            )}
          </div>

          {/* CTA Buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            {ctaButtons.map((cta) => (
              <button
                key={cta.label}
                onClick={() => handleAction(cta.route)}
                style={{
                  padding: '12px 24px',
                  borderRadius: 12,
                  border: cta.primary ? 'none' : '1px solid rgba(255, 255, 255, 0.15)',
                  background: cta.primary
                    ? `linear-gradient(135deg, ${styles.accent}, ${styles.accent}CC)`
                    : 'rgba(255, 255, 255, 0.06)',
                  color: cta.primary ? '#000' : 'rgba(255, 255, 255, 0.85)',
                  fontWeight: cta.primary ? 600 : 500,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.2s',
                  fontFamily: "'Poppins', sans-serif",
                }}
                onMouseEnter={(e) => {
                  if (cta.primary) {
                    e.currentTarget.style.transform = 'scale(1.03)';
                    e.currentTarget.style.boxShadow = `0 4px 20px ${styles.accent}40`;
                  } else {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (cta.primary) {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                  } else {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  }
                }}
              >
                <cta.icon size={16} />
                {cta.label}
              </button>
            ))}
          </div>

          {/* Dismiss link */}
          <button
            onClick={handleDismiss}
            style={{
              marginTop: 16,
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.35)',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: "'Poppins', sans-serif",
              textDecoration: 'underline',
              textUnderlineOffset: 2,
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}