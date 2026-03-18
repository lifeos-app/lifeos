/**
 * Setup List — Accessible from sidebar, shows all 3 onboarding phases with progress.
 * Users can start or continue any phase from here.
 * Rendered via portal to escape sidebar's backdrop-filter containing block.
 */
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import { PHASES, PHASE_ORDER, getPhasePercents, getOverallPercent, type PhaseId } from '../lib/onboarding-phases';
import { useUserStore } from '../stores/useUserStore';
import { assetPath } from '../utils/assets';
import './SetupList.css';

interface PhaseCard {
  id: PhaseId;
  npcImg: string;
  npcName: string;
  route: string;
}

const PHASE_CARDS: PhaseCard[] = [
  { id: 'life',    npcImg: '/images/npcs/sage.png',     npcName: 'The Sage',     route: '/setup' },
  { id: 'health',  npcImg: '/images/npcs/warrior.png',  npcName: 'The Warrior',  route: '/setup/health' },
  { id: 'finance', npcImg: '/images/npcs/merchant.png', npcName: 'The Merchant', route: '/setup/finance' },
];

interface SetupListProps {
  open: boolean;
  onClose: () => void;
}

export function SetupList({ open, onClose }: SetupListProps) {
  const navigate = useNavigate();
  const profile = useUserStore(s => s.profile);
  const prefs = (profile?.preferences || {}) as Record<string, any>;
  const percents = getPhasePercents(prefs);
  const overall = getOverallPercent(prefs);

  if (!open) return null;

  const handleNavigate = (route: string) => {
    onClose();
    navigate(route);
  };

  /* Portal to document.body — escapes sidebar's backdrop-filter containing block */
  return createPortal(
    <div className="setup-list-overlay" onClick={onClose}>
      <div className="setup-list-panel" onClick={e => e.stopPropagation()}>
        <div className="setup-list-header">
          <div className="setup-list-header-left">
            <Sparkles size={18} />
            <span>Life Setup</span>
          </div>
          <button className="setup-list-close" onClick={onClose} aria-label="Close setup panel">
            <X size={16} />
          </button>
        </div>

        {/* Overall Progress */}
        <div className="setup-list-progress">
          <div className="setup-list-progress-bar">
            <div className="setup-list-progress-fill" style={{ width: `${overall}%` }} />
          </div>
          <span className="setup-list-progress-text">
            {overall}% complete
          </span>
        </div>

        {/* Phase Cards */}
        <div className="setup-list-cards">
          {PHASE_CARDS.map(card => {
            const phase = PHASES[card.id];
            const pct = percents[card.id];
            const started = pct > 0;
            const done = pct >= 100;

            return (
              <div
                key={card.id}
                className={`setup-list-card ${done ? 'complete' : ''}`}
                onClick={() => handleNavigate(card.route)}
                style={{ '--phase-color': phase.color, cursor: 'pointer' } as any}
              >
                <img className="setup-list-card-icon" src={assetPath(card.npcImg)} alt={card.npcName} />
                <div className="setup-list-card-info">
                  <div className="setup-list-card-npc">{card.npcName}</div>
                  <div className="setup-list-card-title">{phase.title}</div>
                  <div className="setup-list-card-subtitle">{phase.subtitle}</div>
                  {/* Phase progress bar */}
                  <div className="setup-list-card-progress">
                    <div className="setup-list-card-progress-bar">
                      <div
                        className="setup-list-card-progress-fill"
                        style={{ width: `${pct}%`, background: phase.color }}
                      />
                    </div>
                    <span className="setup-list-card-pct">{pct}%</span>
                  </div>
                </div>
                <div className="setup-list-card-action">
                  <span className="setup-list-card-btn-label" style={{ color: phase.color }}>
                    {done ? 'Review' : started ? 'Continue' : 'Start'}
                  </span>
                  <ArrowRight size={14} style={{ color: phase.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
