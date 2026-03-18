import { todayStr, localDateStr, formatDateShort } from '../../utils/date';
import type { JournalEntry } from './types';

export const formatDateLabel = (d: string) => formatDateShort(d);

/** Group entries by date categories */
export const groupEntries = (entries: JournalEntry[]) => {
  const today = todayStr();
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return localDateStr(d); })();
  const weekAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return localDateStr(d); })();

  const groups = {
    'Today': [] as JournalEntry[],
    'Yesterday': [] as JournalEntry[],
    'This Week': [] as JournalEntry[],
    'Older': [] as JournalEntry[],
  };

  entries.forEach(e => {
    if (e.date === today) groups['Today'].push(e);
    else if (e.date === yesterday) groups['Yesterday'].push(e);
    else if (e.date > weekAgo) groups['This Week'].push(e);
    else groups['Older'].push(e);
  });

  return groups;
};

/** Calculate writing streak */
export const calculateStreak = (entries: JournalEntry[]) => {
  if (entries.length === 0) return 0;
  const sortedDates = [...new Set(entries.map(e => e.date))].sort().reverse();
  let streak = 0;
  const today = todayStr();
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return localDateStr(d); })();
  
  if (sortedDates[0] !== today && sortedDates[0] !== yesterday) return 0;
  
  let expectedDate = sortedDates[0] === today ? today : yesterday;
  for (const date of sortedDates) {
    if (date === expectedDate) {
      streak++;
      const d = new Date(expectedDate + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      expectedDate = localDateStr(d);
    } else {
      break;
    }
  }
  return streak;
};

/** Calculate stats */
export const calculateStats = (entries: JournalEntry[]) => {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthEntries = entries.filter(e => e.date.startsWith(thisMonth));
  const avgMood = entries.filter(e => e.mood).length > 0
    ? entries.filter(e => e.mood).reduce((sum, e) => sum + (e.mood || 0), 0) / entries.filter(e => e.mood).length
    : 0;
  const wordsThisMonth = thisMonthEntries.reduce((sum, e) => {
    const wordCount = e.content.trim() ? e.content.trim().split(/\s+/).length : 0;
    return sum + wordCount;
  }, 0);

  return {
    totalEntries: entries.length,
    avgMood: avgMood > 0 ? avgMood.toFixed(1) : null,
    wordsThisMonth,
  };
};

/** Get popular tags */
export const getPopularTags = (entries: JournalEntry[], limit = 8) => {
  const tagCounts: Record<string, number> = {};
  entries.forEach(e => {
    if (!e.tags) return;
    e.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  return Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
};
