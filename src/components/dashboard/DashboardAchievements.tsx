/**
 * DashboardAchievements — Recent achievements display.
 */

import { useState } from 'react';
import { Sparkles, ChevronRight, Swords } from 'lucide-react';
import { useGamificationContext } from '../../lib/gamification/context';
import { useUserStore } from '../../stores/useUserStore';
import { QuestBoard } from '../gamification/QuestBoard';
import { GamificationModal } from '../GamificationModal';
import { showToast } from '../Toast';
import { getAchievement } from '../../lib/gamification/achievements';

export function DashboardQuestBoard() {
  const gam = useGamificationContext();
  const user = useUserStore(s => s.user);
  const [gamModalOpen, setGamModalOpen] = useState(false);

  return (
    <>
      <section className="dash-card">
        <div className="card-top">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Swords size={18} />Quest Board</h2>
          <button
            className="card-link"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => setGamModalOpen(true)}
          >
            All quests <ChevronRight size={14} />
          </button>
        </div>
        {gam.loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 56, marginBottom: 4 }} />
            ))}
          </div>
        ) : (
          <QuestBoard
            dailyQuests={gam.dailyQuests.slice(0, 3)}
            weeklyQuests={gam.weeklyQuests.slice(0, 2)}
            userId={user?.id}
            onQuestComplete={(result) => {
              if (result.xpAwarded > 0) {
                showToast(`+${result.xpAwarded} XP earned!`, 'zap', '#D4AF37');
              }
            }}
          />
        )}
      </section>
      <GamificationModal open={gamModalOpen} onClose={() => setGamModalOpen(false)} />
    </>
  );
}

export function DashboardAchievements() {
  const gam = useGamificationContext();
  const [gamModalOpen, setGamModalOpen] = useState(false);

  if (gam.loading || !gam.achievements?.length) return null;

  return (
    <>
      <section className="dash-card">
        <div className="card-top">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Sparkles size={16} /> Recent Achievements</h2>
          <button
            className="card-link"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => setGamModalOpen(true)}
          >
            View all <ChevronRight size={14} />
          </button>
        </div>
        <div className="dash-achievements">
          {gam.achievements.slice(-3).reverse().map((userAch, idx: number) => {
            const ach = getAchievement(userAch.achievementId);
            if (!ach) return null;
            return (
              <div key={idx} className="dash-achievement-card">
                <div className="dash-achievement-icon" style={{
                  background: ach.rarity === 'legendary' ? 'linear-gradient(135deg, #D4AF37, #FFD700)' :
                    ach.rarity === 'epic' ? 'linear-gradient(135deg, #A855F7, #E879F9)' :
                    ach.rarity === 'rare' ? 'linear-gradient(135deg, #00D4FF, #06B6D4)' :
                    'rgba(255,255,255,0.08)'
                }}>
                  {ach.icon || '🏆'}
                </div>
                <div className="dash-achievement-info">
                  <span className="dash-achievement-title">{ach.title}</span>
                  <span className="dash-achievement-desc">{ach.description}</span>
                  {ach.xp_reward && <span className="dash-achievement-xp">+{ach.xp_reward} XP</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <GamificationModal open={gamModalOpen} onClose={() => setGamModalOpen(false)} />
    </>
  );
}
