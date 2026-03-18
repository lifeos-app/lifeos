/**
 * Quest Board — The Realm
 *
 * Parchment-styled modal showing active goals as pinned quest notes.
 */

interface Goal {
  id: string;
  title: string;
  status: string;
  progress: number;
  target_date?: string | null;
  icon?: string | null;
  color?: string | null;
}

interface QuestBoardProps {
  goals: Goal[];
  onClose: () => void;
}

export function QuestBoard({ goals, onClose }: QuestBoardProps) {
  const activeGoals = goals.filter(g => g.status === 'active' || g.status === 'in_progress');
  const completedGoals = goals.filter(g => g.status === 'completed').slice(0, 5);

  return (
    <div className="realm-dialogue-backdrop" onClick={onClose}>
      <div
        className="realm-dialogue-box realm-quest-board"
        onClick={e => e.stopPropagation()}
      >
        <div className="realm-dialogue-name">📋 Quest Board</div>

        {activeGoals.length === 0 && completedGoals.length === 0 && (
          <div className="realm-dialogue-text" style={{ color: '#5A7A9A' }}>
            No quests posted. Create a goal in LifeOS to see it here.
          </div>
        )}

        {activeGoals.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: '#FFD700', fontSize: 11, marginBottom: 8, fontFamily: 'monospace' }}>
              ACTIVE QUESTS
            </div>
            {activeGoals.map(goal => (
              <div key={goal.id} className="realm-quest-note">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#C8D6E5', fontFamily: 'monospace', fontSize: 12 }}>
                    {goal.icon || '⚔️'} {goal.title}
                  </span>
                  <span style={{ color: '#5A7A9A', fontFamily: 'monospace', fontSize: 10 }}>
                    {Math.round(goal.progress * 100)}%
                  </span>
                </div>
                <div style={{
                  marginTop: 4,
                  height: 4,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, goal.progress * 100)}%`,
                    background: goal.color || '#FFD700',
                    borderRadius: 2,
                  }} />
                </div>
                {goal.target_date && (
                  <div style={{ color: '#5A7A9A', fontFamily: 'monospace', fontSize: 9, marginTop: 2 }}>
                    Due: {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(goal.target_date))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {completedGoals.length > 0 && (
          <div>
            <div style={{ color: '#5A7A9A', fontSize: 11, marginBottom: 8, fontFamily: 'monospace' }}>
              COMPLETED
            </div>
            {completedGoals.map(goal => (
              <div key={goal.id} className="realm-quest-note" style={{ opacity: 0.6 }}>
                <span style={{ color: '#888', fontFamily: 'monospace', fontSize: 12 }}>
                  {goal.icon || '✓'} {goal.title}
                </span>
                <span className="realm-quest-stamp">DONE</span>
              </div>
            ))}
          </div>
        )}

        <div className="realm-dialogue-hint">tap outside to close</div>
      </div>
    </div>
  );
}
