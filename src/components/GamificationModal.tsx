// LifeOS — Gamification Stats Modal (popup only, not inline)
// Uses portal to escape transformed containers (sidebar on mobile)
// v2: RPG-style game menu with icon tabs, quest filters, achievement showcase
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  X, Trophy, Gamepad2, Swords, Sparkles, Shield, Clock,
  Filter, Eye, EyeOff, Calendar,
} from 'lucide-react';
import { PlayerCard } from './gamification/PlayerCard';
import { QuestBoard } from './gamification/QuestBoard';
import { ACHIEVEMENTS, getAchievement, RARITY_COLORS } from '../lib/gamification/achievements';
import { useGamificationContext } from '../lib/gamification/context';
import { useJunction } from '../hooks/useJunction';
import { assetPath } from '../utils/assets';
import './GamificationModal.css';
import '../pages/Junction.css';

type Tab = 'stats' | 'quests' | 'achievements';
type QuestFilter = 'all' | 'daily' | 'weekly' | 'epic' | 'work';
type AchFilter = 'all' | 'common' | 'rare' | 'epic' | 'legendary';

export function GamificationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const gam = useGamificationContext();
  const junction = useJunction();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('stats');
  const [questFilter, setQuestFilter] = useState<QuestFilter>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [achFilter, setAchFilter] = useState<AchFilter>('all');

  // Quest count for badge
  const activeQuestCount = useMemo(() => {
    return [
      ...gam.dailyQuests.filter(q => !q.completed_at),
      ...gam.weeklyQuests.filter(q => !q.completed_at),
      ...gam.epicQuests.filter(q => !q.completed_at),
    ].length;
  }, [gam.dailyQuests, gam.weeklyQuests, gam.epicQuests]);

  // Filtered quests
  const filteredQuests = useMemo(() => {
    let daily = [...gam.dailyQuests];
    let weekly = [...gam.weeklyQuests];
    let epic = [...gam.epicQuests];

    // Work filter — show only quests with work-related keywords
    if (questFilter === 'work') {
      const workTerms = ['clean', 'security', 'shift', 'invoice', 'tcs', 'work', 'client'];
      const isWork = (q: { v2_title?: string; v2_description?: string; quest_data?: { title?: string; description?: string } }) => {
        const text = `${q.v2_title || ''} ${q.v2_description || ''} ${q.quest_data?.title || ''} ${q.quest_data?.description || ''}`.toLowerCase();
        return workTerms.some(t => text.includes(t));
      };
      daily = daily.filter(isWork);
      weekly = weekly.filter(isWork);
      epic = epic.filter(isWork);
    }

    // Type filters
    if (questFilter === 'daily') { weekly = []; epic = []; }
    if (questFilter === 'weekly') { daily = []; epic = []; }
    if (questFilter === 'epic') { daily = []; weekly = []; }

    // Hide completed unless toggled
    if (!showCompleted) {
      daily = daily.filter(q => !q.completed_at);
      weekly = weekly.filter(q => !q.completed_at);
      epic = epic.filter(q => !q.completed_at);
    }

    return { daily, weekly, epic };
  }, [gam.dailyQuests, gam.weeklyQuests, gam.epicQuests, questFilter, showCompleted]);

  // All achievements with unlock state
  const allAchievements = useMemo(() => {
    const userAchMap = new Map(
      gam.achievements.map(a => [a.achievementId, a])
    );
    return ACHIEVEMENTS
      .filter(a => !a.secret || userAchMap.get(a.id)?.unlockedAt)
      .map(a => {
        const ua = userAchMap.get(a.id);
        return {
          ...a,
          unlocked: !!ua?.unlockedAt,
          progress: ua?.progress ?? 0,
        };
      })
      .filter(a => achFilter === 'all' || a.rarity === achFilter);
  }, [gam.achievements, achFilter]);

  const unlockedAchCount = allAchievements.filter(a => a.unlocked).length;
  const totalAchCount = allAchievements.length;

  if (!open) return null;

  const TABS: { id: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'stats', label: 'Stats', icon: Gamepad2 },
    { id: 'quests', label: 'Quests', icon: Swords, badge: activeQuestCount || undefined },
    { id: 'achievements', label: 'Badges', icon: Shield },
  ];

  return createPortal(
    <div className="gam-modal-overlay" onClick={onClose}>
      <div className="gam-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="gam-modal-header">
          <Trophy size={17} style={{ color: '#D4AF37' }} />
          <h2>Player Stats</h2>
          <button className="gam-modal-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        {/* Tabs — game-like pills */}
        <div className="gam-modal-tabs">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={`gam-tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
                aria-label={`${t.label} tab${t.badge ? ` (${t.badge} active)` : ''}`}
                aria-selected={tab === t.id}
              >
                <Icon size={14} />
                <span>{t.label}</span>
                {t.badge ? <span className="gam-tab__badge">{t.badge}</span> : null}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="gam-modal-content">
          {/* ─── STATS TAB ─── */}
          {tab === 'stats' && (
            <>
              <PlayerCard
                level={gam.level}
                title={gam.title}
                xp={gam.xp}
                xpProgress={gam.xpProgress}
                xpToNext={gam.xpToNext}
                stats={gam.stats}
                achievements={gam.achievements}
              />

              {/* Junction Section */}
              <div className="gam-junction-section">
                <div className="gam-junction-header">
                  <Sparkles size={12} />
                  <span>Junction</span>
                </div>
                {junction.isEquipped && junction.tradition && junction.xpProgress.currentFigure ? (
                  <div
                    className="gam-junction-content"
                    style={{ cursor: 'pointer' }}
                    onClick={() => { onClose(); navigate('/character?tab=junction'); }}
                  >
                    <div className="gam-junction-avatar">
                      <img
                        src={assetPath(`/junction/figures/${junction.xpProgress.currentFigure.id}.webp`)}
                        alt={junction.xpProgress.currentFigure.name}
                        onError={(e) => {
                          // Fallback to emoji icon
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.textContent = junction.xpProgress.currentFigure?.icon || '🔮';
                          }
                        }}
                      />
                    </div>
                    <div className="gam-junction-info">
                      <div className="gam-junction-name">{junction.tradition.icon} {junction.tradition.name}</div>
                      <div className="gam-junction-figure">{junction.xpProgress.currentFigure.name}</div>
                      <div className="gam-junction-xp">
                        <div
                          className="gam-junction-xp-fill"
                          style={{ width: `${junction.xpProgress.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    className="jnc-mini-equip-link"
                    style={{ width: '100%', justifyContent: 'center', border: 'none' }}
                    onClick={() => { onClose(); navigate('/character?tab=junction'); }}
                    aria-label="Equip a spiritual tradition"
                  >
                    <Sparkles size={14} />
                    Equip a tradition
                  </button>
                )}
              </div>
            </>
          )}

          {/* ─── QUESTS TAB ─── */}
          {tab === 'quests' && (
            <>
              {/* Filter chips */}
              <div className="quest-filters">
                {([
                  { id: 'all', label: 'All' },
                  { id: 'daily', label: '☀️ Daily' },
                  { id: 'weekly', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><Calendar size={12} /> Weekly</span> },
                  { id: 'epic', label: '⚡ Epic' },
                  { id: 'work', label: '🧹 Work' },
                ] as { id: QuestFilter; label: React.ReactNode }[]).map(f => (
                  <button
                    key={f.id}
                    className={`quest-filter-chip ${questFilter === f.id ? 'active' : ''}`}
                    onClick={() => setQuestFilter(f.id)}
                    aria-label={`Filter quests: ${f.id}`}
                    aria-pressed={questFilter === f.id}
                  >
                    {f.label}
                  </button>
                ))}
                <button
                  className={`quest-filter-toggle ${showCompleted ? 'show-completed' : ''}`}
                  onClick={() => setShowCompleted(!showCompleted)}
                  title={showCompleted ? 'Hide completed' : 'Show completed'}
                >
                  {showCompleted ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
              </div>

              <QuestBoard
                dailyQuests={filteredQuests.daily}
                weeklyQuests={filteredQuests.weekly}
                epicQuests={filteredQuests.epic}
                showEpic
              />
            </>
          )}

          {/* ─── ACHIEVEMENTS TAB ─── */}
          {tab === 'achievements' && (
            <div className="gam-achievements-grid">
              {/* Summary stats */}
              <div className="gam-achievements-header">
                <div className="gam-ach-stat">
                  <span className="gam-ach-stat-val">{unlockedAchCount}</span>
                  <span className="gam-ach-stat-lbl">Unlocked</span>
                </div>
                <div className="gam-ach-stat">
                  <span className="gam-ach-stat-val" style={{ color: '#00D4FF' }}>{totalAchCount}</span>
                  <span className="gam-ach-stat-lbl">Total</span>
                </div>
                <div className="gam-ach-stat">
                  <span className="gam-ach-stat-val" style={{ color: '#39FF14', fontSize: 22 }}>
                    {totalAchCount > 0 ? Math.round((unlockedAchCount / totalAchCount) * 100) : 0}%
                  </span>
                  <span className="gam-ach-stat-lbl">Complete</span>
                </div>
              </div>

              {/* Rarity filter chips */}
              <div className="gam-ach-filters">
                {([
                  { id: 'all', label: 'All' },
                  { id: 'common', label: '⬜ Common', color: '#8BA4BE' },
                  { id: 'rare', label: '🔵 Rare', color: '#00D4FF' },
                  { id: 'epic', label: '🟣 Epic', color: '#A855F7' },
                  { id: 'legendary', label: '🟡 Legend', color: '#D4AF37' },
                ] as { id: AchFilter; label: string; color?: string }[]).map(f => (
                  <button
                    key={f.id}
                    className={`gam-ach-filter ${achFilter === f.id ? 'active' : ''}`}
                    onClick={() => setAchFilter(f.id)}
                    style={achFilter === f.id && f.color ? {
                      color: f.color,
                      borderColor: `${f.color}44`,
                      background: `${f.color}18`,
                    } : undefined}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Badge grid */}
              <div className="gam-ach-badges">
                {allAchievements.map(ach => {
                  const progressPct = ach.target
                    ? Math.min((ach.progress / ach.target) * 100, 100)
                    : ach.unlocked ? 100 : 0;

                  return (
                    <div
                      key={ach.id}
                      className={`gam-ach-badge ${ach.unlocked ? 'unlocked' : 'locked'} ${ach.rarity}`}
                      title={`${ach.title}: ${ach.description}${ach.target ? ` (${ach.progress}/${ach.target})` : ''}${ach.unlocked ? '' : ' — LOCKED'}`}
                    >
                      <div className="gam-ach-badge__icon">{ach.icon}</div>
                      <span className="gam-ach-badge__name">{ach.title}</span>
                      {!ach.unlocked && ach.target && ach.target > 1 && (
                        <div className="gam-ach-badge__progress">
                          <div
                            className="gam-ach-badge__progress-fill"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Recent XP */}
              {gam.recentXP.length > 0 && (
                <div className="gam-recent-xp">
                  <h3>Recent XP</h3>
                  {gam.recentXP.slice(0, 8).map((xp, i) => (
                    <div key={i} className="gam-xp-row">
                      <span className="gam-xp-desc">{xp.description || xp.action}</span>
                      <span className="gam-xp-amount">+{xp.amount}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
