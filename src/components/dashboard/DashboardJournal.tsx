/**
 * DashboardJournal — Journal card with streak + quick entry link.
 *
 * Streak calculation uses a SINGLE Supabase query instead of 30 sequential ones.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/data-access';
import { localDateStr } from '../../utils/date';
import { normalizeTags } from '../journal/helpers';

const MOODS: Record<number, string> = { 1: '😫', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };

interface DashboardJournalProps {
  selectedDate: string;
}

export function DashboardJournal({ selectedDate }: DashboardJournalProps) {
  const [journalEntry, setJournalEntry] = useState<{ date: string; mood?: number; content?: string; title?: string; tags?: string | string[] } | null>(null);
  const [journalCount, setJournalCount] = useState(0);
  const [journalStreak, setJournalStreak] = useState(0);
  const [, setLoading] = useState(true);

  // Fetch journal entry for selected date
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('journal_entries')
        .select('date,mood,content,title,tags')
        .eq('is_deleted', false)
        .eq('date', selectedDate)
        .maybeSingle();
      setJournalEntry(data || null);
    })();
  }, [selectedDate]);

  // BUG-097: Combine count + streak calculation into a single query
  useEffect(() => {
    (async () => {
      setLoading(true);

      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Single query: get ALL journal dates (not just last 30 days)
      // This gives us both the total count AND the streak data
      const { data: allEntries } = await supabase
        .from('journal_entries')
        .select('date')
        .eq('is_deleted', false)
        .order('date', { ascending: false });

      const entries = allEntries || [];
      
      // Total count from the result
      setJournalCount(entries.length);

      // Build a set of dates that have entries in last 30 days for streak
      const recentDates = entries
        .filter((e: { date: string }) => e.date >= localDateStr(thirtyDaysAgo))
        .map((e: { date: string }) => e.date);
      const entryDates = new Set(recentDates);

      // Count consecutive days from today going backward
      let streak = 0;
      for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const ds = localDateStr(d);
        if (entryDates.has(ds)) {
          streak++;
        } else if (i > 0) {
          break; // streak broken
        }
        // if i === 0 and no entry today, continue checking yesterday
      }
      setJournalStreak(streak);
      setLoading(false);
    })();
  }, []);

  return (
    <section className="dash-card">
      <div className="card-top">
        <h2><BookOpen size={16} /> Journal</h2>
        <Link to="/journal" className="card-link">Write <ChevronRight size={14} /></Link>
      </div>
      <div className="dash-journal">
        {journalEntry ? (
          <div className="dash-journal-today">
            <div className="dash-journal-meta">
              {journalEntry.mood && <span className="dash-journal-mood">{MOODS[journalEntry.mood]}</span>}
              <span className="dash-journal-title">{journalEntry.title || "Today's entry"}</span>
            </div>
            <p className="dash-journal-preview">
              {journalEntry.content?.substring(0, 120)}{(journalEntry.content?.length ?? 0) > 120 ? '...' : ''}
            </p>
            {journalEntry.tags && (
              <div className="dash-journal-tags">
                {normalizeTags(journalEntry.tags).map((t, i) =>
                  <span key={i} className="dash-journal-tag">{t}</span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="dash-journal-empty">
            <p>No entry today</p>
            <Link to="/journal" className="dash-journal-write-btn"><BookOpen size={14} /> Write now</Link>
          </div>
        )}
        <div className="dash-journal-stats">
          <div className="dash-journal-stat">
            <span className="dash-journal-stat-val">{journalCount}</span>
            <span className="dash-journal-stat-lbl">entries</span>
          </div>
          <div className="dash-journal-stat">
            <span className="dash-journal-stat-val">{journalStreak}</span>
            <span className="dash-journal-stat-lbl">day streak</span>
          </div>
        </div>
      </div>
    </section>
  );
}
