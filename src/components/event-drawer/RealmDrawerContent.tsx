// ═══════════════════════════════════════════════════════════
// RealmDrawerContent — 3-tab Realm Command Panel
// Character | Chat | Quests — shown when body.realm-active
// ═══════════════════════════════════════════════════════════

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, MessageCircle, Scroll, ChevronRight, Swords } from 'lucide-react';
import { useGamificationContext } from '../../lib/gamification/context';
import { XPBar } from '../gamification/XPBar';
import { getTierForLevel } from '../../lib/gamification/tier-colors';
import { useCharacterAppearanceStore } from '../../stores/useCharacterAppearanceStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { localDateStr } from '../../utils/date';
import type { ActiveQuest } from '../../lib/gamification/quests';

type RealmTab = 'character' | 'chat' | 'quests';

interface RealmDrawerContentProps {
  onClose: () => void;
}

export function RealmDrawerContent({ onClose }: RealmDrawerContentProps) {
  const [activeTab, setActiveTab] = useState<RealmTab>('character');
  const navigate = useNavigate();

  // Gamification data (may not be in provider)
  let gamification: any = null;
  try { gamification = useGamificationContext(); } catch { /* not in provider */ }

  const level = gamification?.level ?? 1;
  const xp = gamification?.xp ?? 0;
  const xpProgress = gamification?.xpProgress ?? 0;
  const xpToNext = gamification?.xpToNext ?? 100;
  const title = gamification?.title ?? 'Awakened';
  const dailyQuests: ActiveQuest[] = gamification?.dailyQuests ?? [];
  const weeklyQuests: ActiveQuest[] = gamification?.weeklyQuests ?? [];
  const epicQuests: ActiveQuest[] = gamification?.epicQuests ?? [];

  const tier = getTierForLevel(level);

  const tabs: { id: RealmTab; label: string; icon: React.ReactNode }[] = [
    { id: 'character', label: 'Character', icon: <Shield size={13} /> },
    { id: 'chat', label: 'Chat', icon: <MessageCircle size={13} /> },
    { id: 'quests', label: 'Quests', icon: <Scroll size={13} /> },
  ];

  return (
    <div className="realm-cmd-content">
      {/* ── Tab Bar ── */}
      <div className="realm-cmd-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`realm-cmd-tab${activeTab === t.id ? ' realm-cmd-tab--active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="realm-cmd-body">
        {activeTab === 'character' && <CharacterTab level={level} xp={xp} xpProgress={xpProgress} xpToNext={xpToNext} title={title} tier={tier} dailyQuests={dailyQuests} weeklyQuests={weeklyQuests} epicQuests={epicQuests} onClose={onClose} navigate={navigate} />}
        {activeTab === 'chat' && <ChatTab navigate={navigate} onClose={onClose} />}
        {activeTab === 'quests' && <QuestsTab dailyQuests={dailyQuests} weeklyQuests={weeklyQuests} epicQuests={epicQuests} />}
      </div>
    </div>
  );
}

// ═══ Character Tab ═══
function CharacterTab({ level, xp, xpProgress, xpToNext, title, tier, dailyQuests, weeklyQuests, epicQuests, onClose, navigate }: {
  level: number; xp: number; xpProgress: number; xpToNext: number; title: string;
  tier: ReturnType<typeof getTierForLevel>;
  dailyQuests: ActiveQuest[]; weeklyQuests: ActiveQuest[]; epicQuests: ActiveQuest[];
  onClose: () => void; navigate: ReturnType<typeof useNavigate>;
}) {
  const { name, characterClass } = useCharacterAppearanceStore();
  const habits = useHabitsStore(s => s.habits);
  const isHabitDoneForDate = useHabitsStore(s => s.isHabitDoneForDate);
  const today = localDateStr();
  const habitsDoneToday = habits.filter(h => isHabitDoneForDate(h.id, today)).length;

  // Best streak from habits
  const bestStreak = habits.reduce((max, h) => Math.max(max, (h as any).best_streak ?? (h as any).current_streak ?? 0), 0);

  const activeQuestCount = [...dailyQuests, ...weeklyQuests, ...epicQuests].filter(q => !q.completed_at).length;

  return (
    <div className="realm-cmd-char">
      {/* Name + Title */}
      <div className="realm-cmd-char-header">
        <h3 className="realm-cmd-char-name">{name || 'Hero'}</h3>
        <span className="realm-cmd-char-class">{characterClass || 'Adventurer'}</span>
      </div>

      {/* XP Bar */}
      <div className="realm-cmd-xpbar">
        <XPBar level={level} title={title} xpProgress={xpProgress} xpToNext={xpToNext} totalXP={xp} compact />
      </div>

      {/* Tier Badge */}
      <div className="realm-cmd-tier" style={{ '--tier-color': tier.primary, '--tier-glow': tier.glowColor } as React.CSSProperties}>
        <span className="realm-cmd-tier-badge" style={{ background: tier.gradient }}>{tier.name}</span>
      </div>

      {/* Quick Stats */}
      <div className="realm-cmd-stats">
        <div className="realm-cmd-stat">
          <span className="realm-cmd-stat-val">{level}</span>
          <span className="realm-cmd-stat-label">Level</span>
        </div>
        <div className="realm-cmd-stat">
          <span className="realm-cmd-stat-val">{habitsDoneToday}</span>
          <span className="realm-cmd-stat-label">Habits Today</span>
        </div>
        <div className="realm-cmd-stat">
          <span className="realm-cmd-stat-val">{activeQuestCount}</span>
          <span className="realm-cmd-stat-label">Active Quests</span>
        </div>
        {bestStreak > 0 && (
          <div className="realm-cmd-stat">
            <span className="realm-cmd-stat-val">{bestStreak}</span>
            <span className="realm-cmd-stat-label">Best Streak</span>
          </div>
        )}
      </div>

      {/* View Full Profile */}
      <button className="realm-cmd-profile-btn" onClick={() => { navigate('/character'); onClose(); }}>
        <Swords size={14} />
        View Full Profile
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

// ═══ Chat Tab (v1 placeholder) ═══
function ChatTab({ navigate, onClose }: { navigate: ReturnType<typeof useNavigate>; onClose: () => void }) {
  return (
    <div className="realm-cmd-empty">
      <Shield size={40} style={{ color: 'rgba(255, 215, 0, 0.4)' }} />
      <h4>Guild Chat</h4>
      <p>Coming Soon</p>
      <span className="realm-cmd-empty-desc">Chat with friends inside The Realm</span>
      <button className="realm-cmd-profile-btn" onClick={() => { navigate('/social'); onClose(); }}>
        <MessageCircle size={14} />
        Visit Social Hub
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

// ═══ Quests Tab ═══
function QuestsTab({ dailyQuests, weeklyQuests, epicQuests }: {
  dailyQuests: ActiveQuest[]; weeklyQuests: ActiveQuest[]; epicQuests: ActiveQuest[];
}) {
  const activeDaily = dailyQuests.filter(q => !q.completed_at);
  const activeWeekly = weeklyQuests.filter(q => !q.completed_at);
  const activeEpic = epicQuests.filter(q => !q.completed_at);
  const allActive = [...activeDaily, ...activeWeekly, ...activeEpic];

  if (allActive.length === 0) {
    return (
      <div className="realm-cmd-empty">
        <Scroll size={40} style={{ color: 'rgba(255, 215, 0, 0.4)' }} />
        <h4>No Active Quests</h4>
        <span className="realm-cmd-empty-desc">Visit the Quest Board in your Realm</span>
      </div>
    );
  }

  return (
    <div className="realm-cmd-quests">
      {activeDaily.length > 0 && <QuestSection label="Daily" quests={activeDaily} />}
      {activeWeekly.length > 0 && <QuestSection label="Weekly" quests={activeWeekly} />}
      {activeEpic.length > 0 && <QuestSection label="Epic" quests={activeEpic} />}
    </div>
  );
}

function QuestSection({ label, quests }: { label: string; quests: ActiveQuest[] }) {
  return (
    <div className="realm-cmd-quest-section">
      <div className="realm-cmd-quest-section-label">{label}</div>
      {quests.map(q => {
        const pct = q.target > 0 ? Math.min(1, q.progress / q.target) : 0;
        return (
          <div key={q.id} className="realm-cmd-quest-item">
            <span className="realm-cmd-quest-icon">{q.quest_data?.icon || '📜'}</span>
            <div className="realm-cmd-quest-info">
              <span className="realm-cmd-quest-title">{q.quest_data?.title || 'Quest'}</span>
              <div className="realm-cmd-quest-bar-wrap">
                <div className="realm-cmd-quest-bar">
                  <div className="realm-cmd-quest-bar-fill" style={{ width: `${pct * 100}%` }} />
                </div>
                <span className="realm-cmd-quest-progress">{q.progress}/{q.target}</span>
              </div>
            </div>
            <span className="realm-cmd-quest-xp">+{q.reward_xp} XP</span>
          </div>
        );
      })}
    </div>
  );
}
