/**
 * Setup Hub — Landing page for Life Setup phases.
 * Shows 3 phase cards with NPC flavor text and progress.
 */
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/useUserStore';
import { PHASE_ORDER, PHASES, getPhasePercents, getOverallPercent, type PhaseId } from '../lib/onboarding-phases';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { assetPath } from '../utils/assets';

const NPC_FLAVOR: Record<PhaseId, { img: string; name: string; line: string }> = {
  life: { img: '/images/npcs/sage.png', name: 'The Sage', line: 'Let me help you discover your values, goals, and purpose' },
  health: { img: '/images/npcs/warrior.png', name: 'The Warrior', line: "Let's forge your body into a temple of strength" },
  finance: { img: '/images/npcs/merchant.png', name: 'The Merchant', line: "I'll help you master the flow of gold" },
};

const ROUTE_MAP: Record<PhaseId, string> = {
  life: '/setup/life',
  health: '/setup/health',
  finance: '/setup/finance',
};

export function SetupHub() {
  const navigate = useNavigate();
  const profile = useUserStore(s => s.profile);
  const prefs = (profile?.preferences || {}) as Record<string, any>;
  const percents = getPhasePercents(prefs);
  const overall = getOverallPercent(prefs);

  return (
    <div style={{
      minHeight: '100dvh', background: '#050E1A',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center',
            padding: 0, fontFamily: 'inherit',
          }}
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0, flex: 1 }}>
          Life Setup
        </h1>
      </div>

      <div style={{ padding: '16px 16px 32px', maxWidth: 520, margin: '0 auto', width: '100%' }}>
        {/* Overall progress */}
        <div style={{ textAlign: 'center', marginBottom: 28, padding: '20px 0' }}>
          <div style={{
            fontSize: 40, fontWeight: 800, color: '#00D4FF',
            fontFamily: 'var(--font-display)', lineHeight: 1,
          }}>
            {overall}%
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
            {overall === 0 ? 'Personalize LifeOS to unlock its full power' :
             overall >= 100 ? 'All set! Your LifeOS is fully configured.' :
             'Keep going — each conversation makes LifeOS smarter'}
          </div>
        </div>

        {/* Phase cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {PHASE_ORDER.map(id => {
            const phase = PHASES[id];
            const npc = NPC_FLAVOR[id];
            const pct = percents[id];
            const isDone = pct >= 100;

            return (
              <button
                key={id}
                onClick={() => {
                  if (isDone) return;
                  navigate(ROUTE_MAP[id]);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '16px 18px',
                  background: isDone
                    ? 'rgba(78,203,113,0.06)'
                    : `linear-gradient(135deg, ${phase.color}08, ${phase.color}04)`,
                  border: `1px solid ${isDone ? 'rgba(78,203,113,0.2)' : phase.color + '25'}`,
                  borderRadius: 14,
                  cursor: isDone ? 'default' : 'pointer',
                  textAlign: 'left', fontFamily: 'inherit',
                  transition: 'all 0.2s ease', width: '100%',
                }}
              >
                {/* NPC portrait */}
                <img
                  src={assetPath(npc.img)}
                  alt={npc.name}
                  style={{
                    width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                    objectFit: 'cover',
                    border: isDone ? '2px solid rgba(78,203,113,0.4)' : `1px solid ${phase.color}30`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    opacity: isDone ? 0.7 : 1,
                  }}
                />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 15, fontWeight: 600,
                    color: isDone ? '#4ECB71' : '#fff',
                    marginBottom: 2,
                  }}>
                    {phase.title}
                  </div>
                  <div style={{
                    fontSize: 12, color: 'rgba(255,255,255,0.4)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {npc.name} — {npc.line}
                  </div>
                  {/* Progress bar */}
                  {!isDone && (
                    <div style={{
                      marginTop: 8, height: 4, borderRadius: 2,
                      background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        background: phase.color, width: `${pct}%`,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  )}
                </div>

                {/* Right side */}
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  {isDone ? (
                    <span style={{ fontSize: 12, color: '#4ECB71', fontWeight: 600 }}>Done</span>
                  ) : (
                    <>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginRight: 4 }}>
                        {pct > 0 ? `${pct}%` : 'Start'}
                      </span>
                      <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Tip */}
        <div style={{
          marginTop: 20, padding: '12px 14px', borderRadius: 10,
          background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.1)',
          fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5,
        }}>
          Tip: <strong style={{ color: 'rgba(255,255,255,0.6)' }}>Each conversation</strong> takes 5-10 minutes and deeply personalizes your LifeOS experience. Start with Life Foundation, then build on it with Health and Finance.
        </div>
      </div>
    </div>
  );
}
