import { Scroll } from 'lucide-react';
import { useGamification } from '../../hooks/useGamification';
import { useUserStore } from '../../stores/useUserStore';
import { QuestBoard } from '../../components/gamification/QuestBoard';

export function QuestsTab() {
  const user = useUserStore(s => s.user);
  const { dailyQuests, weeklyQuests, epicQuests, loading } = useGamification();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 20px', color: '#5A7A9A' }}>
        Loading quests...
      </div>
    );
  }

  const hasQuests = dailyQuests.length > 0 || weeklyQuests.length > 0 || epicQuests.length > 0;

  if (!hasQuests) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 20px' }}>
        <Scroll size={40} style={{ color: '#2A3A50', marginBottom: 12 }} />
        <p style={{ color: '#5A7A9A', fontSize: 14, margin: '0 0 4px' }}>No active quests</p>
        <p style={{ color: '#3A5A7A', fontSize: 12 }}>Complete tasks and habits to generate new quests</p>
      </div>
    );
  }

  return (
    <QuestBoard
      dailyQuests={dailyQuests}
      weeklyQuests={weeklyQuests}
      epicQuests={epicQuests}
      showEpic
      userId={user?.id}
    />
  );
}
