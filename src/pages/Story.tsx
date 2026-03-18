import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/useUserStore';
import { isComingSoon } from '../lib/feature-gates';
import { ComingSoon } from '../components/ComingSoon';
import {
  BookOpen, Settings, Eye, EyeOff, Link2, Copy, Check,
  Download, Sparkles, ChevronRight, Calendar, Loader2, ArrowLeft
} from 'lucide-react';
import remarkGfm from 'remark-gfm';

// Lazy load markdown renderer (47 KB savings from initial bundle)
const ReactMarkdown = lazy(() => import('react-markdown'));
import { formatDateShort } from '../utils/date';
import './Story.css';
import { EmptyState } from '../components/EmptyState';
import { logger } from '../utils/logger';

interface UserBook {
  id: string;
  user_id: string;
  title: string;
  subtitle: string | null;
  visibility: 'private' | 'secret_link' | 'public';
  share_token: string;
  slug: string | null;
  junction_id: string | null;
  auto_process: boolean;
  created_at: string;
  updated_at: string;
}

interface BookEntry {
  id: string;
  book_id: string;
  user_id: string;
  title: string | null;
  content: string;
  raw_journal_ids: string[];
  entry_date: string;
  entry_time: string | null;
  mood: string | null;
  location: string | null;
  themes: string[];
  junction_id: string | null;
  junction_tradition_name: string | null;
  word_count: number;
  created_at: string;
}

export function Story() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const user = useUserStore(s => s.user);
  
  const [book, setBook] = useState<UserBook | null>(null);
  const [entries, setEntries] = useState<BookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch book and entries
  const fetchBook = useCallback(async () => {
    setLoading(true);
    
    try {
      let query = supabase.from('user_books').select('*');
      
      if (slug) {
        // Public/secret link view
        query = query.eq('slug', slug);
      } else if (user) {
        // Authenticated user viewing their own book
        query = query.eq('user_id', user.id);
      } else {
        setLoading(false);
        return;
      }

      const { data: bookData, error: bookErr } = await query.maybeSingle();

      if (bookErr || !bookData) {
        logger.warn('[Story] No book found');
        setLoading(false);
        return;
      }

      setBook(bookData);

      // Fetch entries
      const { data: entriesData, error: entriesErr } = await supabase
        .from('book_entries')
        .select('*')
        .eq('book_id', bookData.id)
        .order('entry_date', { ascending: false });

      if (!entriesErr && entriesData) {
        setEntries(entriesData);
        if (entriesData.length > 0 && !selectedEntryId) {
          setSelectedEntryId(entriesData[0].id);
        }
      }

    } catch (err) {
      logger.error('[Story] Error fetching:', err);
    } finally {
      setLoading(false);
    }
  }, [user, slug, selectedEntryId]);

  useEffect(() => {
    fetchBook();
  }, [fetchBook]);

  // Update book settings
  const updateBook = async (updates: Partial<UserBook>) => {
    if (!book || !user) return;

    const { error } = await supabase
      .from('user_books')
      .update(updates)
      .eq('id', book.id);

    if (!error) {
      setBook({ ...book, ...updates });
    }
  };

  // Copy share link
  const copyShareLink = () => {
    if (!book) return;
    
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/app.*/, '/app');
    let link = '';

    if (book.visibility === 'public' && book.slug) {
      link = `${baseUrl}/story/${book.slug}`;
    } else if (book.visibility === 'secret_link') {
      link = `${baseUrl}/story/${book.share_token}`;
    }

    if (link) {
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Export as PDF (using browser print)
  const exportPDF = () => {
    window.print();
  };

  const selectedEntry = entries.find(e => e.id === selectedEntryId);
  const isOwner = user && book && user.id === book.user_id;

  if (loading) {
    return (
      <div className="story-loading">
        <Loader2 className="spinner" size={32} />
        <p>Loading your story...</p>
      </div>
    );
  }

  // Coming Soon gate for non-owner users
  const showComingSoon = isComingSoon('story', user?.id);

  if (!book) {
    return (
      <EmptyState
        variant="story"
        action={user ? { label: 'Go to Journal', onClick: () => navigate('/reflect/journal') } : undefined}
      />
    );
  }

  const storyContent = (
    <div className="story-container">
      {/* Sidebar */}
      <aside className="story-sidebar">
        <div className="story-sidebar-header">
          <div className="story-book-badge">
            <BookOpen size={14} />
            <span>My Story</span>
          </div>
          <h1 className="story-book-title">{book.title}</h1>
          {book.subtitle && <p className="story-book-subtitle">{book.subtitle}</p>}
          
          {isOwner && (
            <button 
              className="story-settings-btn"
              onClick={() => setShowSettings(!showSettings)}
              aria-label="Story settings"
            >
              <Settings size={16} />
              Settings
            </button>
          )}
        </div>

        <nav className="story-nav">
          <ul>
            {entries.map((entry, i) => {
              const isLatest = i === 0;
              const isActive = entry.id === selectedEntryId;
              
              return (
                <li 
                  key={entry.id}
                  className={`story-nav-item ${isActive ? 'active' : ''} ${isLatest ? 'latest' : ''}`}
                  onClick={() => setSelectedEntryId(entry.id)}
                >
                  <div className="story-nav-date">
                    {formatDateShort(entry.entry_date)}
                  </div>
                  <div className="story-nav-title">
                    {entry.title || 'Untitled Entry'}
                  </div>
                  {entry.junction_tradition_name && (
                    <div className="story-nav-junction">
                      {entry.junction_tradition_name}
                    </div>
                  )}
                  {isActive && <ChevronRight size={16} className="story-nav-arrow" />}
                </li>
              );
            })}
          </ul>
        </nav>

        {entries.length === 0 && (
          <div className="story-sidebar-empty">
            <p>No entries yet. Start writing in your journal to see them chronicled here.</p>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="story-main">
        {selectedEntry ? (
          <article className="story-entry">
            <header className="story-entry-header">
              <div className="story-entry-meta">
                <Calendar size={14} />
                <time>{new Date(selectedEntry.entry_date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}</time>
                {selectedEntry.junction_tradition_name && (
                  <>
                    <span className="story-meta-sep">•</span>
                    <span className="story-junction-badge">{selectedEntry.junction_tradition_name}</span>
                  </>
                )}
              </div>
              
              {selectedEntry.title && (
                <h1 className="story-entry-title">{selectedEntry.title}</h1>
              )}
            </header>

            <div className="story-entry-content">
              <Suspense fallback={<div style={{ padding: '24px', color: '#8BA4BE', textAlign: 'center' }}>Loading content...</div>}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {selectedEntry.content}
                </ReactMarkdown>
              </Suspense>
            </div>

            <footer className="story-entry-footer">
              <div className="story-entry-stats">
                <span>{selectedEntry.word_count} words</span>
                {selectedEntry.themes && selectedEntry.themes.length > 0 && (
                  <>
                    <span className="story-meta-sep">•</span>
                    <span>{selectedEntry.themes.join(', ')}</span>
                  </>
                )}
              </div>
            </footer>
          </article>
        ) : (
          <div className="story-no-selection">
            <BookOpen size={48} />
            <p>Select an entry from the sidebar to read</p>
          </div>
        )}

        {/* Toolbar */}
        {isOwner && (
          <div className="story-toolbar">
            <button onClick={exportPDF} className="story-toolbar-btn" aria-label="Export story as PDF">
              <Download size={16} />
              Export PDF
            </button>
          </div>
        )}
      </main>

      {/* Settings Modal */}
      {showSettings && isOwner && (
        <div className="story-modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="story-modal" onClick={(e) => e.stopPropagation()}>
            <div className="story-modal-header">
              <h2>Story Settings</h2>
              <button onClick={() => setShowSettings(false)} className="story-modal-close" aria-label="Close settings">
                ×
              </button>
            </div>

            <div className="story-modal-body">
              {/* Title */}
              <div className="story-setting">
                <label>Title</label>
                <input
                  type="text"
                  value={book.title}
                  onChange={(e) => updateBook({ title: e.target.value })}
                  placeholder="My Story"
                />
              </div>

              {/* Subtitle */}
              <div className="story-setting">
                <label>Subtitle</label>
                <input
                  type="text"
                  value={book.subtitle || ''}
                  onChange={(e) => updateBook({ subtitle: e.target.value })}
                  placeholder="Optional subtitle"
                />
              </div>

              {/* Visibility */}
              <div className="story-setting">
                <label>Visibility</label>
                <div className="story-visibility-options">
                  <button
                    className={`story-visibility-btn ${book.visibility === 'private' ? 'active' : ''}`}
                    onClick={() => updateBook({ visibility: 'private' })}
                  >
                    <EyeOff size={16} />
                    Private
                  </button>
                  <button
                    className={`story-visibility-btn ${book.visibility === 'secret_link' ? 'active' : ''}`}
                    onClick={() => updateBook({ visibility: 'secret_link' })}
                  >
                    <Link2 size={16} />
                    Secret Link
                  </button>
                  <button
                    className={`story-visibility-btn ${book.visibility === 'public' ? 'active' : ''}`}
                    onClick={() => updateBook({ visibility: 'public' })}
                  >
                    <Eye size={16} />
                    Public
                  </button>
                </div>
              </div>

              {/* Share Link */}
              {book.visibility !== 'private' && (
                <div className="story-setting">
                  <label>Share Link</label>
                  <div className="story-share-link">
                    <input
                      type="text"
                      readOnly
                      value={
                        book.visibility === 'public' && book.slug
                          ? `${window.location.origin}/app/story/${book.slug}`
                          : `${window.location.origin}/app/story/${book.share_token}`
                      }
                    />
                    <button onClick={copyShareLink} className="story-copy-btn" aria-label={copied ? 'Link copied' : 'Copy share link'}>
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Auto-process */}
              <div className="story-setting">
                <label className="story-toggle-label">
                  <input
                    type="checkbox"
                    checked={book.auto_process}
                    onChange={(e) => updateBook({ auto_process: e.target.checked })}
                  />
                  <div className="story-toggle-content">
                    <div className="story-toggle-title">
                      <Sparkles size={16} />
                      Auto-chronicle journal entries
                    </div>
                    <div className="story-toggle-desc">
                      Automatically process new journal entries into chronicle entries
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (showComingSoon) {
    return <ComingSoon feature="Story & Chronicle">{storyContent}</ComingSoon>;
  }

  return storyContent;
}

export default Story;
