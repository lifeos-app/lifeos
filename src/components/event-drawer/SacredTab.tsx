// ═══ EventDrawer — SacredNowTab & JourneyTab ═══

import { useState, useEffect } from 'react';
import {
  Trophy, BookOpen,
  Flame, BarChart3,
  CheckCircle2, ChevronDown,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import { useFasting, formatFastingDuration } from '../../hooks/useFasting';
import { useUserStore } from '../../stores/useUserStore';
import { logger } from '../../utils/logger';
import { formatTime } from './helpers';

// ═══ SACRED NOW TAB ═══
export function SacredNowTab({ completedPrayers, onTogglePrayer }: {
  completedPrayers: Set<string>;
  onTogglePrayer: (id: string) => void;
}) {
  const { prayerTimes } = usePrayerTimes();
  const { currentFast, isFasting, progress: fastProgress } = useFasting();

  // Calculate free time between prayers
  const now = new Date();
  const nextPrayer = prayerTimes.find(p => p.time > now);
  const freeTimeMinutes = nextPrayer ? Math.round((nextPrayer.time.getTime() - now.getTime()) / 60000) : 0;

  // Prayers completed today
  const prayersCompletedToday = Array.from(completedPrayers).filter(id =>
    prayerTimes.some(p => p.id === id)
  ).length;

  // Calculate total free time today (time not in prayer)
  const totalPrayerMinutes = prayerTimes.reduce((sum, p) => sum + p.duration_minutes, 0);
  const totalDayMinutes = 24 * 60;
  const totalFreeMinutes = totalDayMinutes - totalPrayerMinutes;

  return (
    <>
      <div className="ed-seg-now">
        <div className="ed-seg-label">
          <Flame size={11} />
          <span>PRAYERS TODAY</span>
        </div>

        {/* Fasting Status */}
        {currentFast && isFasting && fastProgress && (
          <div className="ed-fasting-card">
            <Flame size={13} />
            <span>Fasting</span>
            <span className="ed-fasting-duration">{formatFastingDuration(fastProgress.remaining)}</span>
          </div>
        )}

        {/* Free Time Info */}
        {nextPrayer && (
          <div style={{ padding: '0 14px 10px', fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
            <div>Next: {nextPrayer.name} in {freeTimeMinutes}m</div>
            <div>Free time: {Math.floor(totalFreeMinutes / 60)}h {totalFreeMinutes % 60}m today</div>
          </div>
        )}

        {/* Prayer Timeline */}
        <div className="ed-prayer-timeline">
          <div className="ed-prayer-header">
            <Flame size={13} />
            <span>Today's Prayers</span>
          </div>
          {prayerTimes.map((prayer, idx) => {
            const prayerTime = new Date(prayer.time);
            const isPast = prayerTime < now;
            const isNext = !isPast && prayerTimes.findIndex(p => p.time > now) === idx;
            const isCompleted = completedPrayers.has(prayer.id);

            return (
              <button
                key={prayer.id}
                className={`ed-prayer-item ${isPast ? 'past' : ''} ${isNext ? 'next' : ''} ${isCompleted ? 'completed' : ''}`}
                onClick={() => onTogglePrayer(prayer.id)}
              >
                <span className="ed-prayer-time">{formatTime(prayerTime)}</span>
                <span className="ed-prayer-icon">{prayer.icon}</span>
                <span className="ed-prayer-name">{prayer.name}</span>
                {isNext && <span className="ed-prayer-badge">NEXT</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="ed-divider" />

      {/* Spiritual Metrics */}
      <div className="ed-seg-pulse">
        <div className="ed-seg-label">
          <BarChart3 size={11} />
          <span>DAILY PULSE</span>
        </div>
        <div className="ed-pulse-strip">
          <div className="ed-pulse-metric">
            <span className="ed-pulse-icon" style={{ color: '#D4A017' }}>
              <Flame size={13} />
            </span>
            <span className="ed-pulse-value" style={{ color: '#D4A017' }}>
              {prayersCompletedToday}/{prayerTimes.length}
            </span>
            <span className="ed-pulse-sub">prayers</span>
          </div>
          <div className="ed-pulse-metric">
            <span className="ed-pulse-icon" style={{ color: '#F59E0B' }}>
              <Flame size={13} />
            </span>
            <span className="ed-pulse-value" style={{ color: '#F59E0B' }}>
              {currentFast ? '1' : '0'}
            </span>
            <span className="ed-pulse-sub">fasting</span>
          </div>
          <div className="ed-pulse-metric">
            <span className="ed-pulse-icon" style={{ color: '#8B5CF6' }}>
              <BookOpen size={13} />
            </span>
            <span className="ed-pulse-value" style={{ color: '#8B5CF6' }}>
              0
            </span>
            <span className="ed-pulse-sub">chapters</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ═══ JOURNEY Tab (Sacred Mode) ═══
export function JourneyTab() {
  const user = useUserStore(s => s.user);
  const [completedQuests, setCompletedQuests] = useState<any[]>([]);
  const [practiceLog, setPracticeLog] = useState<any[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);

  // Fetch completed quests (with error handling)
  useEffect(() => {
    if (!user?.id) return;

    // Fetch completed quests — gracefully handle if table doesn't exist
    supabase
      .from('quests')
      .select('*')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (error) {
          logger.warn('[Journey] quests query error:', error.message);
          setCompletedQuests([]);
        } else {
          setCompletedQuests(data || []);
        }
      });

    // Fetch recent practice logs for this user
    supabase
      .from('user_junction_log')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (error) logger.warn('[Journey] practice log error:', error.message);
        else setPracticeLog(data || []);
      });
  }, [user?.id]);

  // Calculate real progress from practice logs
  const today = new Date().toISOString().slice(0, 10);
  const thisWeekLogs = practiceLog.filter(l => {
    const logDate = new Date(l.date || l.created_at);
    const daysDiff = (Date.now() - logDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7;
  });
  const uniqueDaysThisWeek = new Set(thisWeekLogs.map(l => l.date || new Date(l.created_at).toISOString().slice(0, 10))).size;
  const todayLogs = practiceLog.filter(l => (l.date || new Date(l.created_at).toISOString().slice(0, 10)) === today);
  const totalXPEarned = practiceLog.reduce((sum, l) => sum + (l.xp_earned || 0), 0);

  const progressPct = Math.round((uniqueDaysThisWeek / 7) * 100);

  // Dynamic progression based on actual XP
  const progressionNodes = [
    { id: '1', label: 'Begin Your Journey', state: (totalXPEarned > 0 ? 'completed' : 'active') as 'completed' | 'active' | 'locked' },
    { id: '2', label: '7-Day Practice Streak', state: (uniqueDaysThisWeek >= 7 ? 'completed' : totalXPEarned > 0 ? 'active' : 'locked') as 'completed' | 'active' | 'locked' },
    { id: '3', label: 'Earn 500 XP', state: (totalXPEarned >= 500 ? 'completed' : totalXPEarned >= 100 ? 'active' : 'locked') as 'completed' | 'active' | 'locked' },
    { id: '4', label: 'Master of Practice', state: (totalXPEarned >= 1000 ? 'completed' : totalXPEarned >= 500 ? 'active' : 'locked') as 'completed' | 'active' | 'locked' },
  ];

  return (
    <div className="ed-journey-map">
      <h3 className="ed-journey-title">Spiritual Journey</h3>

      {/* Real stats */}
      <div style={{
        display: 'flex', gap: 12, padding: '0 14px 12px', justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#D4A017' }}>{todayLogs.length}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>today</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#F59E0B' }}>{uniqueDaysThisWeek}/7</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>this week</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#8B5CF6' }}>{totalXPEarned}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>total XP</div>
        </div>
      </div>

      {/* Weekly progress */}
      <div style={{ padding: '0 14px 14px' }}>
        <div className="ed-quest-card active">
          <div className="ed-quest-icon">
            <Flame size={16} />
          </div>
          <div className="ed-quest-info">
            <span className="ed-quest-name">Weekly Practice</span>
            <div className="ed-quest-progress">
              <div className="ed-quest-bar" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="ed-quest-status">{uniqueDaysThisWeek}/7 days this week{uniqueDaysThisWeek === 0 ? ' — tap a prayer to start!' : ''}</span>
          </div>
        </div>
      </div>

      {/* Progression nodes */}
      <div className="ed-progression">
        <div className="ed-prog-line" />
        {progressionNodes.map(node => (
          <div key={node.id} className={`ed-prog-node ${node.state}`}>
            <div className="ed-prog-dot" />
            <span>{node.label}</span>
          </div>
        ))}
      </div>

      {/* Recent Practice Log */}
      {practiceLog.length > 0 && (
        <div className="ed-study-section">
          <h4>Recent Practice</h4>
          {practiceLog.slice(0, 5).map(log => (
            <div key={log.id} className="ed-study-item">
              <CheckCircle2 size={14} style={{ color: '#39FF14' }} />
              <span>{log.notes || 'Practice completed'}</span>
              <span className="ed-study-progress">+{log.xp_earned || 0} XP</span>
            </div>
          ))}
        </div>
      )}

      {/* Completed Quests History */}
      <div className="ed-completed-section">
        <div className="ed-completed-header" onClick={() => setShowCompleted(!showCompleted)}>
          <Trophy size={13} />
          <span>Completed Quests</span>
          <ChevronDown size={13} style={{
            transform: showCompleted ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }} />
        </div>
        {showCompleted && (
          <div className="ed-completed-list">
            {completedQuests.length === 0 ? (
              <div className="ed-completed-empty">
                No completed quests yet. Start your journey!
              </div>
            ) : (
              completedQuests.map(quest => (
                <div key={quest.id} className="ed-completed-item">
                  <div className="ed-completed-dot" />
                  <div className="ed-completed-info">
                    <span className="ed-completed-title">
                      {quest.quest_data?.title || quest.v2_title || 'Quest'}
                    </span>
                    <span className="ed-completed-date">
                      Completed {new Date(quest.completed_at).toLocaleDateString()}
                    </span>
                    <span className="ed-completed-xp">+{quest.reward_xp || 0} XP</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
