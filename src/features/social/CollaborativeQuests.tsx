// LifeOS Social — Collaborative Quests Page
// Quest board, progress tracking, celebration, difficulty ratings

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Target, X, Plus, Clock, Users, Trophy, Flame, Star, Crown,
  Swords, Link2, BookOpen, Dragon, ChevronRight, Zap
} from 'lucide-react';
import {
  useCollaborativeQuests,
  QUEST_TYPE_CONFIG,
  DIFFICULTY_CONFIG,
  QUEST_TEMPLATES,
} from './useCollaborativeQuests';
import type {
  CollaborativeQuest,
  CollaborativeQuestType,
  QuestDifficulty,
  XPDistribution,
} from './useCollaborativeQuests';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

interface CollaborativeQuestsProps {
  guildId: string;
  userId: string;
  userRole: 'owner' | 'admin' | 'member';
  memberNames?: Record<string, string>;
}

// ═══════════════════════════════════════════════════
// CONFETTI
// ═══════════════════════════════════════════════════

function ConfettiOverlay({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  const particles = Array.from({ length: 40 }, (_, i) => {
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1', '#A855F7', '#F97316'];
    const color = colors[i % colors.length];
    const left = Math.random() * 100;
    const delay = Math.random() * 0.5;
    const duration = 1.5 + Math.random() * 1.5;
    const size = 4 + Math.random() * 6;

    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: `${left}%`,
          top: -10,
          width: size,
          height: size,
          background: color,
          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          animation: `cq-confetti-fall ${duration}s ${delay}s ease-out forwards`,
        }}
      />
    );
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 200, overflow: 'hidden',
    }}>
      {particles}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════

export function CollaborativeQuests({ guildId, userId, userRole, memberNames = {} }: CollaborativeQuestsProps) {
  const {
    quests, loading, error,
    createQuest, cancelQuest, contributeToQuest,
    completeQuest, deleteQuest,
    getActiveQuests, getCompletedQuests,
    getQuestProgress, getMemberContribution,
    isQuestExpired,
    refreshQuests,
  } = useCollaborativeQuests(guildId, userId);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedQuest, setSelectedQuest] = useState<CollaborativeQuest | null>(null);
  const [contributeAmount, setContributeAmount] = useState('');
  const [contributing, setContributing] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [celebrateQuest, setCelebrateQuest] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<CollaborativeQuestType | ''>('');

  const prevCompletedRef = useRef<Set<string>>(new Set());

  // Detect new completions for celebration
  useEffect(() => {
    const completed = getCompletedQuests();
    const newCompletions = completed.filter(q => !prevCompletedRef.current.has(q.id));
    newCompletions.forEach(q => {
      prevCompletedRef.current.add(q.id);
      setCelebrateQuest(q.id);
    });
  }, [quests]); // eslint-disable-line react-hooks/exhaustive-deps

  const canCreate = userRole === 'owner' || userRole === 'admin';
  const activeQuests = getActiveQuests().filter(q => filterType ? q.type === filterType : true);
  const completedQuests = getCompletedQuests();

  // ── Create Quest Form ─────────────────────────────────────────────
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState<CollaborativeQuestType>('collective_goal');
  const [formDifficulty, setFormDifficulty] = useState<QuestDifficulty>('medium');
  const [formTarget, setFormTarget] = useState('');
  const [formUnit, setFormUnit] = useState('XP');
  const [formXPReward, setFormXPReward] = useState('500');
  const [formDistribution, setFormDistribution] = useState<XPDistribution>('equal');
  const [formDeadline, setFormDeadline] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!formName.trim() || !formTarget) return;
    setCreating(true);
    await createQuest({
      guild_id: guildId,
      created_by: userId,
      name: formName.trim(),
      description: formDesc.trim(),
      type: formType,
      difficulty: formDifficulty,
      target: parseFloat(formTarget),
      unit: formUnit.trim(),
      xp_reward: parseFloat(formXPReward) || 500,
      xp_distribution: formDistribution,
      deadline: formDeadline || null,
    });
    // Reset form
    setFormName(''); setFormDesc(''); setFormType('collective_goal');
    setFormDifficulty('medium'); setFormTarget(''); setFormUnit('XP');
    setFormXPReward('500'); setFormDistribution('equal'); setFormDeadline('');
    setShowCreateForm(false); setShowTemplatePicker(false);
    setCreating(false);
  }, [formName, formDesc, formType, formDifficulty, formTarget, formUnit, formXPReward, formDistribution, formDeadline, createQuest, guildId, userId]);

  // ── Apply template ─────────────────────────────────────────────────
  const applyTemplate = useCallback((template: typeof QUEST_TEMPLATES[0]) => {
    setFormName(template.name);
    setFormDesc(template.description);
    setFormType(template.type);
    setFormDifficulty(template.difficulty);
    setFormTarget(String(template.target));
    setFormUnit(template.unit);
    setFormXPReward(String(template.xp_reward));
    setFormDistribution(template.xp_distribution);
    setShowTemplatePicker(false);
    setShowCreateForm(true);
  }, []);

  // ── Contribute ─────────────────────────────────────────────────────
  const handleContribute = useCallback(async (questId: string) => {
    const amount = parseFloat(contributeAmount);
    if (isNaN(amount) || amount <= 0 || contributing) return;
    setContributing(true);
    await contributeToQuest(questId, amount);
    setContributeAmount('');
    setContributing(false);
  }, [contributeAmount, contributing, contributeToQuest]);

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════

  return (
    <div className="cq-container">
      {/* Confetti celebration */}
      {celebrateQuest && (
        <ConfettiOverlay onDone={() => setCelebrateQuest(null)} />
      )}

      {/* Header */}
      <div className="cq-header">
        <div className="cq-header-left">
          <Target size={20} style={{ color: '#22C55E' }} />
          <h3 className="cq-title">Guild Quests</h3>
          <span className="cq-count">{quests.length}</span>
        </div>
        <div className="cq-header-right">
          {canCreate && (
            <>
              <button className="cq-template-btn" onClick={() => setShowTemplatePicker(true)}>
                📋 Templates
              </button>
              <button className="cq-create-btn" onClick={() => setShowCreateForm(true)}>
                <Plus size={14} /> New Quest
              </button>
            </>
          )}
        </div>
      </div>

      {/* Type filter */}
      <div className="cq-filter-row">
        <button
          className={`cq-filter-chip ${filterType === '' ? 'cq-filter-chip--active' : ''}`}
          onClick={() => setFilterType('')}
        >
          All
        </button>
        {(Object.entries(QUEST_TYPE_CONFIG) as [CollaborativeQuestType, typeof QUEST_TYPE_CONFIG[CollaborativeQuestType]][]).map(([type, config]) => (
          <button
            key={type}
            className={`cq-filter-chip ${filterType === type ? 'cq-filter-chip--active' : ''}`}
            onClick={() => setFilterType(type === filterType ? '' : type)}
            style={filterType === type ? { borderColor: config.color, color: config.color } : {}}
          >
            {config.icon} {config.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="cq-error">
          ⚠️ {error}
          <button onClick={() => void refreshQuests()} style={{ marginLeft: 8, color: '#60A5FA', background: 'none', border: 'none', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && <div className="cq-loading">Loading quests…</div>}

      {/* ── TEMPLATE PICKER ──────────────────────────────────────── */}
      {showTemplatePicker && (
        <div className="cq-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowTemplatePicker(false); }}>
          <div className="cq-modal cq-modal--templates">
            <div className="cq-modal-header">
              <h3 className="cq-modal-title">📋 Quest Templates</h3>
              <button className="cq-modal-close" onClick={() => setShowTemplatePicker(false)}><X size={18} /></button>
            </div>
            <div className="cq-template-list">
              {QUEST_TEMPLATES.map((template, i) => {
                const config = QUEST_TYPE_CONFIG[template.type];
                const diffConfig = DIFFICULTY_CONFIG[template.difficulty];
                return (
                  <button
                    key={i}
                    className="cq-template-card"
                    onClick={() => applyTemplate(template)}
                  >
                    <div className="cq-template-icon">{config.icon}</div>
                    <div className="cq-template-info">
                      <div className="cq-template-name">{template.name}</div>
                      <div className="cq-template-desc">{template.description}</div>
                      <div className="cq-template-meta">
                        <span style={{ color: diffConfig.color }}>{diffConfig.icon} {diffConfig.label}</span>
                        <span>⚡ {template.xp_reward} XP</span>
                        <span>🎯 {template.target} {template.unit}</span>
                      </div>
                    </div>
                    <ChevronRight size={14} style={{ color: '#64748B' }} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE QUEST FORM ────────────────────────────────────── */}
      {showCreateForm && (
        <div className="cq-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreateForm(false); }}>
          <div className="cq-modal">
            <div className="cq-modal-header">
              <h3 className="cq-modal-title">⚔️ Create Collaborative Quest</h3>
              <button className="cq-modal-close" onClick={() => setShowCreateForm(false)}><X size={18} /></button>
            </div>
            <div className="cq-form">
              <label className="cq-label">Quest Name *</label>
              <input className="cq-input" type="text" placeholder="e.g., 10K XP Sprint" value={formName} onChange={e => setFormName(e.target.value)} maxLength={80} />

              <label className="cq-label">Quest Type</label>
              <div className="cq-type-grid">
                {(Object.entries(QUEST_TYPE_CONFIG) as [CollaborativeQuestType, typeof QUEST_TYPE_CONFIG[CollaborativeQuestType]][]).map(([type, config]) => (
                  <button
                    key={type}
                    className={`cq-type-card ${formType === type ? 'cq-type-card--active' : ''}`}
                    onClick={() => setFormType(type)}
                    style={formType === type ? { borderColor: config.color } : {}}
                  >
                    <span className="cq-type-card-icon">{config.icon}</span>
                    <span className="cq-type-card-label">{config.label}</span>
                  </button>
                ))}
              </div>

              <label className="cq-label">Difficulty</label>
              <div className="cq-difficulty-row">
                {(Object.entries(DIFFICULTY_CONFIG) as [QuestDifficulty, typeof DIFFICULTY_CONFIG[QuestDifficulty]][]).map(([diff, config]) => (
                  <button
                    key={diff}
                    className={`cq-diff-btn ${formDifficulty === diff ? 'cq-diff-btn--active' : ''}`}
                    onClick={() => setFormDifficulty(diff)}
                    style={formDifficulty === diff ? { borderColor: config.color, color: config.color } : {}}
                  >
                    {config.icon} {config.label} ({config.xpMultiplier}x)
                  </button>
                ))}
              </div>

              <div className="cq-form-row">
                <div className="cq-form-field">
                  <label className="cq-label">Target *</label>
                  <input className="cq-input" type="number" placeholder="10000" value={formTarget} onChange={e => setFormTarget(e.target.value)} min="1" />
                </div>
                <div className="cq-form-field">
                  <label className="cq-label">Unit</label>
                  <input className="cq-input" type="text" placeholder="XP" value={formUnit} onChange={e => setFormUnit(e.target.value)} maxLength={20} />
                </div>
              </div>

              <div className="cq-form-row">
                <div className="cq-form-field">
                  <label className="cq-label">XP Reward</label>
                  <input className="cq-input" type="number" placeholder="500" value={formXPReward} onChange={e => setFormXPReward(e.target.value)} min="0" />
                </div>
                <div className="cq-form-field">
                  <label className="cq-label">Distribution</label>
                  <select className="cq-input" value={formDistribution} onChange={e => setFormDistribution(e.target.value as XPDistribution)}>
                    <option value="equal">Equal split</option>
                    <option value="proportional">By contribution</option>
                  </select>
                </div>
              </div>

              <label className="cq-label">Deadline (optional)</label>
              <input className="cq-input" type="datetime-local" value={formDeadline} onChange={e => setFormDeadline(e.target.value)} />

              <label className="cq-label">Description</label>
              <textarea className="cq-textarea" placeholder="What's the quest about?" value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={3} maxLength={500} />

              <div className="cq-form-actions">
                <button className="cq-btn-secondary" onClick={() => setShowCreateForm(false)}>Cancel</button>
                <button className="cq-btn-primary" onClick={() => void handleCreate()} disabled={!formName.trim() || !formTarget || creating}>
                  {creating ? 'Creating…' : '🎯 Create Quest'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── QUEST DETAIL MODAL ──────────────────────────────────── */}
      {selectedQuest && (() => {
        const quest = selectedQuest;
        const config = QUEST_TYPE_CONFIG[quest.type];
        const diffConfig = DIFFICULTY_CONFIG[quest.difficulty];
        const progress = getQuestProgress(quest.id);
        const myContrib = getMemberContribution(quest.id, userId);
        const expired = isQuestExpired(quest);

        return (
          <div className="cq-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedQuest(null); }}>
            <div className="cq-modal">
              <div className="cq-modal-header">
                <h3 className="cq-modal-title">{config.icon} {quest.name}</h3>
                <button className="cq-modal-close" onClick={() => setSelectedQuest(null)}><X size={18} /></button>
              </div>

              {/* Status & difficulty */}
              <div className="cq-detail-badges">
                <span className="cq-status-badge" style={{
                  background: quest.status === 'active' ? 'rgba(34,197,94,0.2)' : quest.status === 'completed' ? 'rgba(139,92,246,0.2)' : 'rgba(239,68,68,0.2)',
                  color: quest.status === 'active' ? '#4ADE80' : quest.status === 'completed' ? '#A78BFA' : '#F87171',
                  border: `1px solid ${quest.status === 'active' ? 'rgba(34,197,94,0.3)' : quest.status === 'completed' ? 'rgba(139,92,246,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}>
                  {quest.status}
                </span>
                <span className="cq-diff-badge" style={{ background: `${diffConfig.color}22`, color: diffConfig.color, border: `1px solid ${diffConfig.color}44` }}>
                  {diffConfig.icon} {diffConfig.label}
                </span>
                {expired && <span className="cq-status-badge" style={{ background: 'rgba(239,68,68,0.2)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' }}>⏰ Expired</span>}
              </div>

              {/* Progress bar */}
              <div className="cq-progress-section">
                <div className="cq-progress-bar">
                  <div className="cq-progress-fill" style={{ width: `${progress.percentage}%`, background: `linear-gradient(90deg, ${config.color}, ${diffConfig.color})` }} />
                </div>
                <div className="cq-progress-text">
                  {progress.current} / {progress.target} {quest.unit} ({Math.round(progress.percentage)}%)
                </div>
              </div>

              {/* Description */}
              {quest.description && (
                <p className="cq-detail-desc">{quest.description}</p>
              )}

              {/* Rewards */}
              <div className="cq-rewards-row">
                <div className="cq-reward-item">
                  <Zap size={14} style={{ color: '#FFD700' }} />
                  <span>{quest.xp_reward} XP</span>
                </div>
                <div className="cq-reward-item">
                  <Users size={14} /> {quest.xp_distribution === 'equal' ? 'Equal split' : 'By contribution'}
                </div>
              </div>

              {/* Deadline */}
              {quest.deadline && (
                <div className="cq-deadline">
                  <Clock size={12} /> Deadline: {new Date(quest.deadline).toLocaleDateString()}
                </div>
              )}

              {/* Member contributions */}
              <div className="cq-contributions">
                <div className="cq-contributions-header">Member Contributions</div>
                {quest.contributions.length === 0 ? (
                  <div className="cq-no-contrib">No contributions yet</div>
                ) : (
                  <div className="cq-contrib-list">
                    {quest.contributions
                      .sort((a, b) => b.amount - a.amount)
                      .map((contrib) => (
                        <div key={contrib.user_id} className={`cq-contrib-item ${contrib.user_id === userId ? 'cq-contrib-item--me' : ''}`}>
                          <div className="cq-contrib-avatar">{(memberNames[contrib.user_id] || contrib.user_id).slice(0, 2).toUpperCase()}</div>
                          <div className="cq-contrib-info">
                            <span className="cq-contrib-name">{contrib.user_id === userId ? 'You' : (memberNames[contrib.user_id] || 'Member')}</span>
                            <span className="cq-contrib-amount">{contrib.amount} {quest.unit}</span>
                          </div>
                          {/* Individual bar */}
                          <div className="cq-contrib-bar">
                            <div className="cq-contrib-fill" style={{ width: `${quest.target > 0 ? Math.min(100, (contrib.amount / quest.target) * 100) : 0}%` }} />
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>

              {/* Contribute action */}
              {quest.status === 'active' && (
                <div className="cq-contribute-section">
                  <div className="cq-contribute-label">Your contribution: {myContrib} {quest.unit}</div>
                  <div className="cq-contribute-input-row">
                    <input
                      className="cq-input"
                      type="number"
                      min="1"
                      placeholder="Amount"
                      value={contributeAmount}
                      onChange={e => setContributeAmount(e.target.value)}
                    />
                    <button
                      className="cq-btn-primary"
                      onClick={() => void handleContribute(quest.id)}
                      disabled={!contributeAmount || parseFloat(contributeAmount) <= 0 || contributing}
                    >
                      {contributing ? 'Adding…' : '+ Contribute'}
                    </button>
                  </div>
                </div>
              )}

              {/* Completed celebration */}
              {quest.status === 'completed' && (
                <div className="cq-completed-celebration">
                  <span className="cq-celebration-icon">🎉</span>
                  <span>Quest completed! XP distributed to all contributors!</span>
                </div>
              )}

              {/* Admin actions */}
              {canCreate && quest.status === 'active' && (
                <div className="cq-admin-actions">
                  <button className="cq-btn-danger" onClick={() => { void cancelQuest(quest.id); setSelectedQuest(null); }}>Cancel Quest</button>
                  <button className="cq-btn-danger" onClick={() => { void deleteQuest(quest.id); setSelectedQuest(null); }}>Delete</button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── ACTIVE QUESTS ──────────────────────────────────────── */}
      {!loading && (
        <div className="cq-list">
          {/* Active Quests */}
          {activeQuests.length > 0 && (
            <div className="cq-section">
              <div className="cq-section-title"><Flame size={14} /> Active Quests</div>
              {activeQuests.map(quest => (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  progress={getQuestProgress(quest.id)}
                  onClick={() => setSelectedQuest(quest)}
                />
              ))}
            </div>
          )}

          {/* Completed Quests */}
          {completedQuests.length > 0 && (
            <div className="cq-section">
              <div className="cq-section-title"><Trophy size={14} /> Completed</div>
              {completedQuests.slice(0, 5).map(quest => (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  progress={getQuestProgress(quest.id)}
                  onClick={() => setSelectedQuest(quest)}
                />
              ))}
            </div>
          )}

          {/* Empty */}
          {quests.length === 0 && (
            <div className="cq-empty">
              <span className="cq-empty-icon">🎯</span>
              <p>No quests yet</p>
              {canCreate && <button className="cq-btn-primary" onClick={() => setShowCreateForm(true)}>Create the first quest!</button>}
            </div>
          )}
        </div>
      )}

      {/* Confetti animation styles */}
      <style>{`
        @keyframes cq-confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── QUEST CARD ─────────────────────────────────────────────────────

interface QuestCardProps {
  quest: CollaborativeQuest;
  progress: { current: number; target: number; percentage: number };
  onClick: () => void;
}

function QuestCard({ quest, progress, onClick }: QuestCardProps) {
  const config = QUEST_TYPE_CONFIG[quest.type];
  const diffConfig = DIFFICULTY_CONFIG[quest.difficulty];

  return (
    <div className="cq-card" onClick={onClick}>
      <div className="cq-card-icon" style={{ background: `${config.color}22`, color: config.color }}>
        {config.icon}
      </div>
      <div className="cq-card-content">
        <div className="cq-card-header">
          <span className="cq-card-name">{quest.name}</span>
          <span className="cq-diff-badge-sm" style={{ color: diffConfig.color }}>
            {diffConfig.icon}
          </span>
        </div>
        <div className="cq-card-progress">
          <div className="cq-card-progress-bar">
            <div className="cq-card-progress-fill" style={{ width: `${progress.percentage}%`, background: `linear-gradient(90deg, ${config.color}, ${diffConfig.color})` }} />
          </div>
          <span className="cq-card-progress-text">{Math.round(progress.percentage)}%</span>
        </div>
        <div className="cq-card-meta">
          <span>{progress.current}/{progress.target} {quest.unit}</span>
          <span>·</span>
          <span>⚡ {quest.xp_reward} XP</span>
          <span>·</span>
          <span>{quest.contributions.length} members</span>
        </div>
      </div>
      <ChevronRight size={16} style={{ color: '#64748B', flexShrink: 0 }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════

export const collaborativeQuestsStyles = `
.cq-container { max-width: 600px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; }
.cq-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.cq-header-left { display: flex; align-items: center; gap: 8px; }
.cq-title { font-size: 1.1rem; font-weight: 700; color: white; margin: 0; }
.cq-count { font-size: 0.75rem; background: rgba(34,197,94,0.2); color: #22C55E; padding: 2px 8px; border-radius: 9999px; }
.cq-header-right { display: flex; align-items: center; gap: 8px; }
.cq-template-btn { padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: #94A3B8; font-size: 0.75rem; cursor: pointer; }
.cq-template-btn:hover { background: rgba(255,255,255,0.05); }
.cq-create-btn { display: flex; align-items: center; gap: 4px; padding: 6px 14px; border-radius: 8px; border: 1px solid rgba(34,197,94,0.3); background: rgba(34,197,94,0.1); color: #22C55E; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
.cq-create-btn:hover { background: rgba(34,197,94,0.2); }

/* Filter */
.cq-filter-row { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 12px; }
.cq-filter-chip { font-size: 0.7rem; padding: 4px 10px; border-radius: 9999px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: #94A3B8; cursor: pointer; white-space: nowrap; }
.cq-filter-chip--active { background: rgba(34,197,94,0.15); border-color: rgba(34,197,94,0.3); color: #22C55E; }

/* Sections */
.cq-section { margin-bottom: 16px; }
.cq-section-title { font-size: 0.8rem; font-weight: 600; color: #94A3B8; display: flex; align-items: center; gap: 6px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }

/* Quest cards */
.cq-card { display: flex; align-items: center; gap: 12px; padding: 12px; background: #1e293b; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; cursor: pointer; transition: all 0.15s; margin-bottom: 8px; }
.cq-card:hover { background: #253449; border-color: rgba(255,255,255,0.12); }
.cq-card-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0; }
.cq-card-content { flex: 1; min-width: 0; }
.cq-card-header { display: flex; align-items: center; gap: 6px; }
.cq-card-name { font-size: 0.85rem; font-weight: 600; color: white; }
.cq-diff-badge-sm { font-size: 0.65rem; }
.cq-card-progress { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
.cq-card-progress-bar { flex: 1; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; }
.cq-card-progress-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; }
.cq-card-progress-text { font-size: 0.65rem; color: #94A3B8; font-weight: 600; min-width: 30px; }
.cq-card-meta { font-size: 0.7rem; color: #64748B; display: flex; align-items: center; gap: 4px; margin-top: 2px; }

/* Modals */
.cq-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px; }
.cq-modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; max-height: 85vh; overflow-y: auto; width: 100%; max-width: 520px; padding: 20px; }
.cq-modal--templates { max-width: 480px; }
.cq-modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.cq-modal-title { font-size: 1rem; font-weight: 700; color: white; margin: 0; }
.cq-modal-close { background: none; border: none; color: #94A3B8; cursor: pointer; padding: 4px; }

/* Form */
.cq-form { display: flex; flex-direction: column; gap: 12px; }
.cq-label { font-size: 0.75rem; font-weight: 600; color: #94A3B8; margin-bottom: 4px; }
.cq-input, .cq-textarea { width: 100%; background: #0f172a; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 8px 12px; color: white; font-size: 0.85rem; }
.cq-input:focus, .cq-textarea:focus { outline: none; border-color: rgba(34,197,94,0.5); }
.cq-textarea { resize: vertical; min-height: 60px; }
.cq-form-row { display: flex; gap: 8px; }
.cq-form-field { flex: 1; }

/* Type grid */
.cq-type-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.cq-type-card { padding: 10px; background: #0f172a; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; cursor: pointer; text-align: center; transition: all 0.15s; }
.cq-type-card--active { border-color: rgba(34,197,94,0.5); background: rgba(34,197,94,0.08); }
.cq-type-card-icon { font-size: 1.25rem; display: block; }
.cq-type-card-label { font-size: 0.7rem; font-weight: 600; color: white; display: block; margin-top: 2px; }

/* Difficulty */
.cq-difficulty-row { display: flex; gap: 6px; flex-wrap: wrap; }
.cq-diff-btn { display: flex; align-items: center; gap: 4px; padding: 5px 10px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; background: transparent; color: #94A3B8; font-size: 0.7rem; cursor: pointer; }
.cq-diff-btn--active { background: rgba(34,197,94,0.1); }

/* Buttons */
.cq-form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
.cq-btn-primary { padding: 8px 18px; border-radius: 8px; background: linear-gradient(135deg, #22C55E, #16A34A); color: white; font-size: 0.85rem; font-weight: 600; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; }
.cq-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.cq-btn-secondary { padding: 8px 18px; border-radius: 8px; background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #94A3B8; font-size: 0.85rem; cursor: pointer; }
.cq-btn-danger { padding: 8px 18px; border-radius: 8px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #EF4444; font-size: 0.85rem; cursor: pointer; }

/* Template list */
.cq-template-list { display: flex; flex-direction: column; gap: 8px; }
.cq-template-card { display: flex; align-items: center; gap: 12px; padding: 12px; background: #0f172a; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; cursor: pointer; text-align: left; transition: all 0.15s; }
.cq-template-card:hover { border-color: rgba(255,255,255,0.15); }
.cq-template-icon { font-size: 1.5rem; }
.cq-template-info { flex: 1; }
.cq-template-name { font-size: 0.85rem; font-weight: 600; color: white; }
.cq-template-desc { font-size: 0.7rem; color: #94A3B8; margin-top: 2px; }
.cq-template-meta { display: flex; gap: 8px; font-size: 0.65rem; color: #64748B; margin-top: 4px; }

/* Detail view */
.cq-detail-badges { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
.cq-status-badge { font-size: 0.65rem; padding: 3px 8px; border-radius: 9999px; font-weight: 600; }
.cq-diff-badge { font-size: 0.7rem; padding: 3px 8px; border-radius: 9999px; }

/* Progress */
.cq-progress-section { margin-bottom: 12px; }
.cq-progress-bar { height: 10px; background: rgba(255,255,255,0.08); border-radius: 5px; overflow: hidden; }
.cq-progress-fill { height: 100%; border-radius: 5px; transition: width 0.4s ease; }
.cq-progress-text { font-size: 0.8rem; color: #94A3B8; margin-top: 4px; text-align: center; }
.cq-detail-desc { font-size: 0.85rem; color: #CBD5E1; margin: 8px 0; line-height: 1.5; }

/* Rewards */
.cq-rewards-row { display: flex; gap: 16px; margin: 8px 0; }
.cq-reward-item { display: flex; align-items: center; gap: 4px; font-size: 0.8rem; color: #FFD700; }
.cq-deadline { font-size: 0.75rem; color: #F97316; display: flex; align-items: center; gap: 4px; margin: 4px 0; }

/* Contributions */
.cq-contributions { margin-top: 12px; }
.cq-contributions-header { font-size: 0.8rem; font-weight: 600; color: #94A3B8; margin-bottom: 8px; }
.cq-no-contrib { font-size: 0.75rem; color: #64748B; }
.cq-contrib-list { display: flex; flex-direction: column; gap: 6px; }
.cq-contrib-item { display: flex; align-items: center; gap: 8px; padding: 6px; border-radius: 6px; background: rgba(255,255,255,0.02); }
.cq-contrib-item--me { background: rgba(34,197,94,0.06); border: 1px solid rgba(34,197,94,0.15); }
.cq-contrib-avatar { width: 24px; height: 24px; border-radius: 50%; background: rgba(168,85,247,0.2); color: #A855F7; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; font-weight: 700; }
.cq-contrib-info { flex: 1; display: flex; justify-content: space-between; }
.cq-contrib-name { font-size: 0.75rem; color: #E2E8F0; }
.cq-contrib-amount { font-size: 0.75rem; color: #94A3B8; font-weight: 600; }
.cq-contrib-bar { width: 60px; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; }
.cq-contrib-fill { height: 100%; background: #22C55E; border-radius: 2px; }

/* Contribute section */
.cq-contribute-section { margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); }
.cq-contribute-label { font-size: 0.75rem; color: #94A3B8; margin-bottom: 6px; }
.cq-contribute-input-row { display: flex; gap: 8px; }
.cq-contribute-input-row .cq-input { flex: 1; }

/* Celebration */
.cq-completed-celebration { text-align: center; padding: 16px; background: rgba(234,179,8,0.06); border: 1px solid rgba(234,179,8,0.2); border-radius: 10px; margin-top: 12px; font-size: 0.85rem; color: #FCD34D; }
.cq-celebration-icon { font-size: 2rem; display: block; margin-bottom: 6px; }

/* Admin */
.cq-admin-actions { display: flex; gap: 8px; margin-top: 12px; }

/* Error & empty */
.cq-error { padding: 10px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; color: #F87171; font-size: 0.8rem; margin-bottom: 12px; }
.cq-loading { text-align: center; color: #64748B; padding: 24px; font-size: 0.85rem; }
.cq-empty { text-align: center; padding: 32px; color: #64748B; }
.cq-empty-icon { font-size: 2rem; display: block; margin-bottom: 8px; }
.cq-empty p { font-size: 0.85rem; margin: 0 0 12px; }
`;