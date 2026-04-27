/**
 * JournalEntryList — Previous entries with search, filters, tag browsing, and expandable cards.
 */

import { useState, useRef, lazy, Suspense } from 'react';
import {
  Search, ChevronDown, X, Calendar, Tag, Hash, Loader2, PenLine,
} from 'lucide-react';
import { todayStr } from '../../utils/date';
import { EmptyState } from '../EmptyState';
import { MOODS } from './types';
import type { JournalEntry } from './types';
import { formatDateLabel, groupEntries, getPopularTags, normalizeTags } from './helpers';
import remarkGfm from 'remark-gfm';

const ReactMarkdown = lazy(() => import('react-markdown'));

interface JournalEntryListProps {
  entries: JournalEntry[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onSelectDate: (date: string) => void;
  onDelete: (id: string) => void;
  onSearchChange: (query: string) => void;
  searchQuery: string;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
}

export function JournalEntryList({
  entries, hasMore, loadingMore, onLoadMore,
  onSelectDate, onDelete, onSearchChange, searchQuery,
  dateFrom, dateTo, onDateFromChange, onDateToChange,
}: JournalEntryListProps) {
  const [expandedPrev, setExpandedPrev] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const popularTags = getPopularTags(entries);

  const clearFilters = () => {
    onSearchChange('');
    onDateFromChange('');
    onDateToChange('');
    setTagFilter('');
  };

  // Filter entries by tag if active
  const filteredEntries = tagFilter
    ? entries.filter(e => {
        const entryTags = normalizeTags(e.tags).map(t => t.toLowerCase());
        return entryTags.some(t => t.includes(tagFilter.toLowerCase()));
      })
    : entries;

  const filteredGroupedEntries = groupEntries(filteredEntries);

  return (
    <div className="jnl-previous">
      <div className="jnl-prev-top">
        <h3 className="jnl-prev-title">Previous Entries</h3>
        <button className="jnl-filter-toggle" onClick={() => setShowFilters(!showFilters)}>
          <Search size={13} /> Filter <ChevronDown size={12} className={showFilters ? 'rotated' : ''} />
        </button>
      </div>

      {/* Search & Filter Bar */}
      {showFilters && (
        <div className="jnl-filters">
          <div className="jnl-search-row">
            <Search size={14} />
            <input className="jnl-search-input" placeholder="Search title or content..."
              value={searchQuery} onChange={e => onSearchChange(e.target.value)} />
            {searchQuery && <button className="jnl-filter-clear-btn" aria-label="Clear search" onClick={() => onSearchChange('')}><X size={12} /></button>}
          </div>
          <div className="jnl-filter-row">
            <div className="jnl-date-range">
              <Calendar size={13} />
              <input type="date" className="jnl-filter-date" value={dateFrom} onChange={e => onDateFromChange(e.target.value)} title="From date" />
              <span className="jnl-filter-sep">→</span>
              <input type="date" className="jnl-filter-date" value={dateTo} onChange={e => onDateToChange(e.target.value)} title="To date" />
            </div>
            <div className="jnl-tag-filter">
              <Tag size={13} />
              <input className="jnl-tag-filter-input" placeholder="Filter by tag..."
                value={tagFilter} onChange={e => setTagFilter(e.target.value)} />
              {tagFilter && <button className="jnl-filter-clear-btn" aria-label="Clear tag filter" onClick={() => setTagFilter('')}><X size={12} /></button>}
            </div>
            {(searchQuery || dateFrom || dateTo || tagFilter) && (
              <button className="jnl-clear-all-btn" onClick={clearFilters}>Clear all</button>
            )}
          </div>

          {/* Popular Tags */}
          {popularTags.length > 0 && !tagFilter && (
            <div className="jnl-popular-tags">
              <Hash size={12} />
              <span className="jnl-popular-label">Popular:</span>
              {popularTags.map(({ tag, count }) => (
                <button key={tag} className="jnl-popular-tag" onClick={() => setTagFilter(tag)}>
                  #{tag} <span className="jnl-tag-count">({count})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {filteredEntries.length > 0 ? (
        <div className="jnl-prev-list">
          {Object.entries(filteredGroupedEntries).map(([group, groupEntries]) => {
            if (groupEntries.length === 0) return null;
            return (
              <div key={group} className="jnl-group">
                <div className="jnl-group-header">{group}</div>
                {groupEntries.map(e => {
                  const expanded = expandedPrev === e.id;
                  const moodData = MOODS.find(m => m.value === e.mood);
                  const entryWordCount = e.content.trim() ? e.content.trim().split(/\s+/).length : 0;
                  const preview = e.content.trim().split('\n').filter(Boolean).slice(0, 2).join(' ').slice(0, 120);
                  return (
                    <div key={e.id} className={`jnl-prev-card ${expanded ? 'expanded' : ''}`}
                      style={moodData && !expanded ? {
                        borderLeftColor: moodData.color,
                        borderLeftWidth: '3px',
                      } : expanded && moodData ? {
                        borderColor: moodData.color + '60',
                      } : undefined}>
                      <div className="jnl-prev-card-header" onClick={() => setExpandedPrev(expanded ? null : e.id)}>
                        <div className="jnl-prev-card-top">
                          <div className="jnl-prev-card-left">
                            {moodData && <span className="jnl-prev-mood-emoji">{moodData.emoji}</span>}
                            <div>
                              <div className="jnl-prev-card-title">{e.title || 'Untitled'}</div>
                              <span className="jnl-prev-date">{formatDateLabel(e.date)}</span>
                            </div>
                          </div>
                          <div className="jnl-prev-card-meta">
                            <span className="jnl-prev-word-count">{entryWordCount} words</span>
                          </div>
                        </div>
                        {!expanded && preview && (
                          <div className="jnl-prev-preview">{preview}...</div>
                        )}
                      </div>
                      {expanded && (
                        <div className="jnl-prev-body">
                          <div className="jnl-prev-content-md">
                            <Suspense fallback={<div style={{ padding: '12px', color: '#8BA4BE' }}>Loading...</div>}>
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {e.content || '*No content*'}
                              </ReactMarkdown>
                            </Suspense>
                          </div>
                          {e.tags && (
                            <div className="jnl-tag-pills small">
                              {normalizeTags(e.tags).map((t, i) => (
                                <span key={i} className="jnl-tag-pill">#{t}</span>
                              ))}
                            </div>
                          )}
                          <div className="jnl-prev-actions">
                            <button className="jnl-prev-edit" onClick={() => {
                              onSelectDate(e.date);
                              setExpandedPrev(null);
                              setTimeout(() => {
                                const editor = document.querySelector('.jnl-editor');
                                if (editor) editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }, 150);
                            }}>Edit</button>
                            <button className="jnl-prev-del" onClick={() => onDelete(e.id)}><X size={12} /> Delete</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Load More */}
          {hasMore && (
            <button className="jnl-load-more" onClick={onLoadMore} disabled={loadingMore}>
              {loadingMore ? <><Loader2 size={14} className="spin" /> Loading...</> : 'Load more entries'}
            </button>
          )}
        </div>
      ) : (
        searchQuery || dateFrom || dateTo || tagFilter ? (
          <p className="jnl-prev-empty">No entries match your filters</p>
        ) : (
          <EmptyState
            variant="journal"
            action={{ label: <><PenLine size={16} /> Write Your First Entry</>, onClick: () => onSelectDate(todayStr()) }}
          />
        )
      )}
    </div>
  );
}
