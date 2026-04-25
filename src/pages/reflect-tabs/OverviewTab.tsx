import { useEffect, useState } from 'react';
import {
  FileText, BarChart3, Inbox as InboxIcon, Flame, BookMarked, ChevronRight,
} from 'lucide-react';
import { useJournalStore } from '../../stores/useJournalStore';
import { supabase } from '../../lib/data-access';
import { useUserStore } from '../../stores/useUserStore';
import { GTDReviewPanel } from '../../components/reflect/GTDReviewPanel';
import { DecisionJournal } from '../../components/reflect/DecisionJournal';
import type { ReflectTab } from './types';

interface OverviewTabProps {
  onTabChange: (tab: ReflectTab) => void;
}

export function OverviewTab({ onTabChange }: OverviewTabProps) {
  const user = useUserStore(s => s.user);
  const { entries } = useJournalStore();
  const [reviewScore, setReviewScore] = useState<number | null>(null);
  const [inboxCount, setInboxCount] = useState(0);
  const [storyEntryCount, setStoryEntryCount] = useState(0);

  const calculateStreak = () => {
    if (entries.length === 0) return 0;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const sortedDates = [...new Set(entries.map(e => e.date))].sort().reverse();
    if (sortedDates[0] !== today && sortedDates[0] !== yesterday) return 0;
    let streak = 0;
    let expectedDate = sortedDates[0] === today ? today : yesterday;
    for (const date of sortedDates) {
      if (date === expectedDate) {
        streak++;
        const d = new Date(expectedDate + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        expectedDate = d.toISOString().split('T')[0];
      } else {
        break;
      }
    }
    return streak;
  };

  const journalStreak = calculateStreak();

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('weekly_reviews')
      .select('week_score')
      .eq('user_id', user.id)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setReviewScore(data.week_score);
      });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('inbox_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'unread')
      .then(({ count }) => {
        setInboxCount(count || 0);
      });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const query = supabase
      .from('book_entries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    Promise.resolve(query)
      .then(({ count }) => {
        setStoryEntryCount(count || 0);
      })
      .catch(() => {
        setStoryEntryCount(0);
      });
  }, [user?.id]);

  useEffect(() => {
    useJournalStore.getState().fetchRecent();
  }, []);

  return (
    <>
      {/* Stats Summary */}
      <div className="rh-stats">
        <div className="rh-stat">
          <div className="rh-stat-icon">
            <Flame size={20} style={{ color: '#F97316' }} />
          </div>
          <div className="rh-stat-content">
            <div className="rh-stat-label">Streak</div>
            <div className="rh-stat-value">{journalStreak} day{journalStreak !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div className="rh-stat">
          <div className="rh-stat-icon">
            <BarChart3 size={20} style={{ color: '#A855F7' }} />
          </div>
          <div className="rh-stat-content">
            <div className="rh-stat-label">Review</div>
            <div className="rh-stat-value">{reviewScore !== null ? `${reviewScore}/10` : '—'}</div>
          </div>
        </div>
        <div className="rh-stat">
          <div className="rh-stat-icon">
            <InboxIcon size={20} style={{ color: '#8B5CF6' }} />
          </div>
          <div className="rh-stat-content">
            <div className="rh-stat-label">Unread</div>
            <div className="rh-stat-value">{inboxCount}</div>
          </div>
        </div>
      </div>

      {/* Hub Cards */}
      <div className="rh-cards">
        <button className="rh-card" onClick={() => onTabChange('journal')}>
          <div className="rh-card-header">
            <div className="rh-card-icon" style={{ background: 'rgba(236, 72, 153, 0.1)' }}>
              <FileText size={24} style={{ color: '#EC4899' }} />
            </div>
            <div className="rh-card-title">Journal</div>
          </div>
          <div className="rh-card-body">
            <p className="rh-card-description">Daily reflections & gratitude</p>
            <div className="rh-card-stat">
              {entries.length} entr{entries.length === 1 ? 'y' : 'ies'} • {journalStreak} day streak
            </div>
          </div>
          <div className="rh-card-footer">
            <ChevronRight size={20} style={{ color: '#8BA4BE' }} />
          </div>
        </button>

        <button className="rh-card" onClick={() => onTabChange('review')}>
          <div className="rh-card-header">
            <div className="rh-card-icon" style={{ background: 'rgba(168, 85, 247, 0.1)' }}>
              <BarChart3 size={24} style={{ color: '#A855F7' }} />
            </div>
            <div className="rh-card-title">Review</div>
          </div>
          <div className="rh-card-body">
            <p className="rh-card-description">Weekly progress check-ins</p>
            <div className="rh-card-stat">
              {reviewScore !== null ? `Latest: ${reviewScore}/10` : 'No reviews yet'}
            </div>
          </div>
          <div className="rh-card-footer">
            <ChevronRight size={20} style={{ color: '#8BA4BE' }} />
          </div>
        </button>

        <button className="rh-card" onClick={() => onTabChange('inbox')}>
          <div className="rh-card-header">
            <div className="rh-card-icon" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
              <InboxIcon size={24} style={{ color: '#8B5CF6' }} />
            </div>
            <div className="rh-card-title">Inbox</div>
          </div>
          <div className="rh-card-body">
            <p className="rh-card-description">Thoughts & ideas to process</p>
            <div className="rh-card-stat">
              {inboxCount > 0 ? `${inboxCount} unread` : 'All caught up'}
            </div>
          </div>
          <div className="rh-card-footer">
            <ChevronRight size={20} style={{ color: '#8BA4BE' }} />
          </div>
        </button>

        <button className="rh-card" onClick={() => onTabChange('story')}>
          <div className="rh-card-header">
            <div className="rh-card-icon" style={{ background: 'rgba(201, 168, 76, 0.1)' }}>
              <BookMarked size={24} style={{ color: '#C9A84C' }} />
            </div>
            <div className="rh-card-title">My Story</div>
          </div>
          <div className="rh-card-body">
            <p className="rh-card-description">Your auto-generated chronicle</p>
            <div className="rh-card-stat">
              {storyEntryCount > 0 ? `${storyEntryCount} chapter${storyEntryCount === 1 ? '' : 's'}` : 'No entries yet'}
            </div>
          </div>
          <div className="rh-card-footer">
            <ChevronRight size={20} style={{ color: '#8BA4BE' }} />
          </div>
        </button>
      </div>

      {/* GTD Weekly Review */}
      <GTDReviewPanel />

      {/* Decision Journal */}
      <DecisionJournal />
    </>
  );
}
