import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/useUserStore';
import { useJournalStore } from '../stores/useJournalStore';
import { logUnifiedEvent } from '../lib/events';
import { autoProcessIfEnabled } from '../lib/bookforge';
import { useGamificationContext } from '../lib/gamification/context';
import { localInsert, localUpdate, localDelete, localQuery } from '../lib/local-db';
import {
  BookOpen, Loader2, Check, TrendingUp, ArrowLeft, Flame,
} from 'lucide-react';
import { localDateStr, genId, todayStr, formatDateShort } from '../utils/date';
import { PageHeader } from '../components/ui/PageHeader';
import { JournalSkeleton } from '../components/skeletons';
import { JournalCalendarStrip } from '../components/journal/JournalCalendarStrip';
import { JournalEditor } from '../components/journal/JournalEditor';
import { JournalEntryList } from '../components/journal/JournalEntryList';
import { MOODS, PAGE_SIZE } from '../components/journal/types';
import type { JournalEntry } from '../components/journal/types';
import { calculateStreak, calculateStats, formatDateLabel } from '../components/journal/helpers';
import './Journal.css';
import { logger } from '../utils/logger';

export function Journal() {
  const user = useUserStore(s => s.user);
  const { awardXP } = useGamificationContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [previousEntries, setPreviousEntries] = useState<JournalEntry[]>([]);
  const [entryDates, setEntryDates] = useState<Set<string>>(new Set());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [prevPage, setPrevPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Debounced search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (v: string) => {
    setSearchQuery(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPrevPage(0); }, 400);
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // FETCH
  // ══════════════════════════════════════════════════════════════════════════════
  const fetchEntry = useCallback(async (date: string) => {
    if (!user?.id) return;
    setLoading(true);

    // Ensure store is hydrated
    await useJournalStore.getState().fetchRecent();

    // Get entry from store
    const storeEntry = useJournalStore.getState().getEntryForDate(date);
    if (storeEntry) {
      setEntry(storeEntry);
      setTitle(storeEntry.title || '');
      setContent(storeEntry.content || '');
      setMood(storeEntry.mood);
      setEnergy(storeEntry.energy);
      setTags(storeEntry.tags || '');
      setImageUrl(storeEntry.image_url || null);
    } else {
      setEntry(null); setTitle(''); setContent(''); setMood(null); setEnergy(null); setTags(''); setImageUrl(null);
    }
    setLoading(false);
  }, [user?.id]);

  const fetchPrevious = useCallback(async (page = 0, append = false) => {
    if (!user?.id) return;
    if (page > 0) setLoadingMore(true);

    let query = supabase.from('journal_entries').select('*')
      .eq('user_id', user.id).eq('is_deleted', false)
      .order('date', { ascending: false });

    if (dateFrom) query = query.gte('date', dateFrom);
    if (dateTo) query = query.lte('date', dateTo);
    if (searchQuery.trim()) {
      query = query.or(`title.ilike.%${searchQuery.trim()}%,content.ilike.%${searchQuery.trim()}%`);
    }

    const from = page * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data } = await query;
    const results = data || [];
    setHasMore(results.length === PAGE_SIZE);

    if (append) {
      setPreviousEntries(prev => [...prev, ...results]);
    } else {
      setPreviousEntries(results);
    }
    setPrevPage(page);
    setLoadingMore(false);

    const { count } = await supabase.from('journal_entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('is_deleted', false);

    const { data: allEntries } = await supabase.from('journal_entries')
      .select('date')
      .eq('user_id', user.id).eq('is_deleted', false);
    setEntryDates(new Set(allEntries?.map(e => e.date) || []));
  }, [user?.id, searchQuery, dateFrom, dateTo]);

  useEffect(() => { fetchEntry(selectedDate); }, [selectedDate, fetchEntry]);
  useEffect(() => { setPrevPage(0); fetchPrevious(0, false); }, [fetchPrevious]);

  const loadMore = () => {
    if (hasMore && !loadingMore) fetchPrevious(prevPage + 1, true);
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // SAVE
  // ══════════════════════════════════════════════════════════════════════════════
  const saveEntry = useCallback(async (overrides?: Partial<JournalEntry>) => {
    if (!user?.id) return;
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    
    const payload = {
      date: selectedDate,
      title: overrides?.title ?? title,
      content: overrides?.content ?? content,
      mood: overrides?.mood !== undefined ? overrides.mood : mood,
      energy: overrides?.energy !== undefined ? overrides.energy : energy,
      tags: overrides?.tags ?? tags,
    };

    let entryId = entry?.id;
    let newEntry: JournalEntry | null = null;

    if (entry) {
      // Update existing entry via store
      await useJournalStore.getState().updateEntry(entry.id, payload);
    } else {
      // Create new entry via store
      newEntry = await useJournalStore.getState().addEntry(payload);
      entryId = newEntry?.id;
      if (newEntry) {
        setEntry(newEntry);
        // Log unified event and award XP
        if (user?.id) {
          logUnifiedEvent({
            user_id: user.id,
            timestamp: `${selectedDate}T${new Date().toTimeString().slice(0, 5)}:00`,
            type: 'journal',
            title: payload.title || `Journal — ${selectedDate}`,
            details: { journal_id: newEntry.id, mood: payload.mood, energy: payload.energy, tags: payload.tags },
            module_source: 'journal',
          });
          awardXP('journal_entry', { description: payload.title || `Journal — ${selectedDate}` });
        }
      }
    }

    // Auto-process for BookForge chronicle
    if (user?.id && entryId) {
      autoProcessIfEnabled(user.id, entryId).catch(err => {
        logger.warn('[Journal] Auto-process failed:', err);
      });
    }

    // Generate journal image (background)
    if (entryId && content.trim().length > 50 && !imageUrl) {
      setGeneratingImage(true);
      fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/journal-image.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journal_id: entryId,
          content,
          mood: mood || 3,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      })
        .then(res => res.json())
        .then(data => { if (data.success && data.image_url) setImageUrl(data.image_url); })
        .catch(err => { logger.warn('[Journal] Image generation failed:', err); })
        .finally(() => { setGeneratingImage(false); });
    }

    setSaving(false);
    isSavingRef.current = false;
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    await fetchPrevious(0, false);
    useJournalStore.getState().invalidate();
    if (!entry) {
      setTimeout(() => {
        const prevSection = document.querySelector('.jnl-previous');
        if (prevSection) prevSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [user?.id, selectedDate, entry, title, content, mood, energy, tags, imageUrl, fetchPrevious, awardXP]);

  const debouncedSave = useCallback((overrides?: Partial<JournalEntry>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveEntry(overrides), 2000);
  }, [saveEntry]);

  const handleTitleChange = (v: string) => { setTitle(v); debouncedSave({ title: v }); };
  const handleContentChange = (v: string) => { setContent(v); debouncedSave({ content: v }); };
  const handleTagsChange = (v: string) => { setTags(v); debouncedSave({ tags: v }); };
  const handleMoodChange = (v: number) => { setMood(v); saveEntry({ mood: v }); };
  const handleEnergyChange = (v: number) => { setEnergy(v); saveEntry({ energy: v }); };

  const deleteEntry = async (id: string) => {
    await useJournalStore.getState().deleteEntry(id);
    if (entry?.id === id) {
      setEntry(null); setTitle(''); setContent(''); setMood(null); setEnergy(null); setTags('');
    }
    fetchPrevious(0, false);
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // COMPUTED
  // ══════════════════════════════════════════════════════════════════════════════
  const streak = calculateStreak(previousEntries);
  const stats = calculateStats(previousEntries);

  const recentMoods = [...previousEntries]
    .filter(e => e.mood)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7)
    .reverse()
    .map(e => e.mood!);

  const showBackButton = location.pathname.startsWith('/reflect/');

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="journal">
      {showBackButton && (
        <button onClick={() => navigate('/reflect')} className="jnl-back-btn">
          <ArrowLeft size={14} /> Back to Reflect
        </button>
      )}
      <PageHeader
        icon={<BookOpen size={22} />}
        title="Journal"
        subtitle={
          <div className="jnl-stats-row">
            {streak > 0 && (
              <div className="jnl-streak">
                <Flame size={12} /> <strong>{streak}</strong> day streak
              </div>
            )}
            <div className="jnl-stat"><strong>{stats.totalEntries}</strong> entries</div>
            {stats.avgMood && <div className="jnl-stat">avg mood <strong>{stats.avgMood}</strong></div>}
            <div className="jnl-stat"><strong>{stats.wordsThisMonth}</strong> words this month</div>
          </div>
        }
        actions={
          <>
            {recentMoods.length > 0 && (
              <div className="jnl-sparkline" title={`Last ${recentMoods.length} moods`}>
                <TrendingUp size={12} />
                {recentMoods.map((m, i) => (
                  <span key={i} className="jnl-sparkline-bar"
                    style={{
                      height: `${(m / 5) * 100}%`,
                      backgroundColor: MOODS.find(mood => mood.value === m)?.color || '#94A3B8',
                    }}
                  />
                ))}
              </div>
            )}
            <input type="date" className="jnl-date-picker" value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)} title="Jump to date" />
            <div className="jnl-save-indicator">
              {saving && <><Loader2 size={14} className="spin" /> Saving...</>}
              {saved && !saving && <><Check size={14} /> Saved</>}
            </div>
          </>
        }
      />

      {/* Calendar Strip */}
      <JournalCalendarStrip
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        entryDates={entryDates}
        previousEntries={previousEntries}
      />

      {/* Today's date label */}
      <div className="jnl-date-label">
        {formatDateLabel(selectedDate)}
        {selectedDate === todayStr() && <span className="jnl-today-badge">Today</span>}
        <button className="jnl-goto-today" onClick={() => setSelectedDate(todayStr())}>Go to Today</button>
      </div>

      {/* Editor */}
      {loading ? <JournalSkeleton /> : (
        <JournalEditor
          entry={entry}
          title={title}
          content={content}
          mood={mood}
          energy={energy}
          tags={tags}
          imageUrl={imageUrl}
          generatingImage={generatingImage}
          saving={saving}
          saved={saved}
          onTitleChange={handleTitleChange}
          onContentChange={handleContentChange}
          onMoodChange={handleMoodChange}
          onEnergyChange={handleEnergyChange}
          onTagsChange={handleTagsChange}
          onSave={saveEntry}
          onDelete={deleteEntry}
        />
      )}

      {/* Previous Entries */}
      <JournalEntryList
        entries={previousEntries}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
        onSelectDate={setSelectedDate}
        onDelete={deleteEntry}
        onSearchChange={handleSearchChange}
        searchQuery={searchQuery}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
      />
    </div>
  );
}
