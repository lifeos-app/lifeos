/**
 * DashboardGreeting — Personalized header with level badge + quick actions bar.
 */

import { useState, lazy, Suspense } from 'react';
import { Moon, Sun, Flame, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../../stores/useUserStore';
import { useGamificationContext } from '../../lib/gamification/context';
import { useDashboardLayout } from '../../hooks/useDashboardLayout';
import { GamificationModal } from '../GamificationModal';
import { getGreeting, formatDate } from '../../utils/date';

const MiniCharacter = lazy(() => import('../../realm/ui/MiniCharacter').then(m => ({ default: m.MiniCharacter })));

interface DashboardGreetingProps {
  selectedDate: string;
  bestHabitStreak: number;
  todayMood: string | null;
  onEditLayout?: () => void;
}

function getGreetingIcon() {
  const h = new Date().getHours();
  if (h < 6) return <Moon size={16} />;
  if (h < 12) return <Sun size={16} />;
  if (h < 17) return <Flame size={16} />;
  if (h < 21) return <Sun size={16} />;
  return <Moon size={16} />;
}

export function DashboardGreeting({ selectedDate, bestHabitStreak, todayMood, onEditLayout }: DashboardGreetingProps) {
  const firstName = useUserStore(s => s.firstName);
  const gam = useGamificationContext();
  const layout = useDashboardLayout();
  const navigate = useNavigate();
  const [gamModalOpen, setGamModalOpen] = useState(false);

  const todayStr = formatDate(selectedDate);

  return (
    <>
      <div className="dash-header animate-fadeUp">
        <div style={{ flex: 1 }}>
          <p className="dash-greeting" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {getGreetingIcon()}{getGreeting()}, {firstName}
          </p>
          <h1 className="dash-name">{firstName}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
            <p className="dash-date">{todayStr}{todayMood && <span className="dash-mood"> {todayMood}</span>}</p>
            {bestHabitStreak > 0 && (
              <span role="status" aria-label={`${bestHabitStreak} day streak`} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)',
                borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                color: '#F97316', transition: 'all 0.2s',
              }}>
                <Flame size={12} style={{ marginRight: 2, verticalAlign: 'middle' }} />{bestHabitStreak}d streak
              </span>
            )}
          </div>
        </div>
        <div className="dash-header-actions" style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexShrink: 0, marginLeft: 'auto' }}>
          {/* Mini character — desktop only (mobile has it in MobileHeader) */}
          <Suspense fallback={null}>
            <div
              className="dash-character-btn"
              role="button"
              tabIndex={0}
              onClick={() => navigate('/character')}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('/character'); }}
              aria-label="View character"
              title="Character"
              style={{
                cursor: 'pointer',
                borderRadius: 8,
                border: '1px solid rgba(212,175,55,0.2)',
                background: 'rgba(212,175,55,0.06)',
                padding: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >
              <MiniCharacter size={32} animate fps={10} />
            </div>
          </Suspense>
          {!gam.loading && (
            <button
              className="dash-level-btn"
              onClick={() => setGamModalOpen(true)}
              aria-label={`Level ${gam.level}, ${gam.title}, ${gam.xp} XP total`}
              title={`Level ${gam.level} — ${gam.title} — ${gam.xp} XP total`}
              style={{
                background: 'linear-gradient(135deg, rgba(212,175,55,0.12) 0%, rgba(255,215,0,0.08) 100%)',
                border: '1px solid rgba(212,175,55,0.3)',
                borderRadius: 8, padding: '4px 8px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(212,175,55,0.6)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)')}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: 'linear-gradient(135deg, #D4AF37, #FFD700)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Orbitron', monospace", fontWeight: 900,
                fontSize: 10, color: '#0A0E1A', flexShrink: 0,
                boxShadow: '0 0 8px rgba(212,175,55,0.4)',
              }}>
                {gam.level}
              </div>
              <div className="dash-level-detail" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <span style={{ fontSize: 9, color: '#D4AF37', fontWeight: 700, lineHeight: 1 }}>{gam.title}</span>
                <div style={{ width: 48, height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${Math.round(gam.xpProgress * 100)}%`,
                    background: 'linear-gradient(90deg, #D4AF37, #FFD700)',
                    borderRadius: 2, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
                  }} />
                </div>
              </div>
            </button>
          )}
          <button className="dash-icon-btn dash-layout-btn" onClick={() => onEditLayout ? onEditLayout() : layout.setEditing(true)} aria-label="Customise dashboard layout" title="Customise Dashboard" style={{
            background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)',
            borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#00D4FF',
            fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4,
            transition: 'all 0.2s',
          }}>
            <Settings size={13} /><span className="dash-layout-label" style={{ fontSize: 11 }}>Layout</span>
          </button>
        </div>
      </div>

      <GamificationModal open={gamModalOpen} onClose={() => setGamModalOpen(false)} />
    </>
  );
}
