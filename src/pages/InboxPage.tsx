import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { createScheduleEvent } from '../lib/schedule-events';
import { useUserStore } from '../stores/useUserStore';
import {
  Inbox, Plus, Loader2, ChevronDown, ChevronRight, ArrowRight,
  AlertTriangle, X, Check, PartyPopper, ArrowLeft
} from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import './InboxPage.css';

interface InboxItem {
  id: string; user_id: string; content: string; source: string;
  status: string; converted_to_type: string | null; converted_to_id: string | null;
  created_at: string; is_deleted: boolean; sync_status: string;
}

import { genId } from '../utils/date';

type ProcessTarget = 'task' | 'event' | 'goal' | 'note';
function timeAgo(ts: string) {
  const ms = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function InboxPage() {
  const user = useUserStore(s => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showProcessed, setShowProcessed] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase.from('inbox_items').select('*')
      .eq('is_deleted', false).order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);
  useEffect(() => {
    const handler = () => fetchItems();
    window.addEventListener('lifeos-refresh', handler);
    return () => window.removeEventListener('lifeos-refresh', handler);
  }, []);

  const addItem = async () => {
    if (!input.trim()) return;
    setSaving(true); setError('');
    const { error: err } = await supabase.from('inbox_items').insert({
      id: genId(), user_id: user?.id, content: input.trim(), source: 'web',
      status: 'pending', converted_to_type: null, converted_to_id: null,
      is_deleted: false, sync_status: 'synced',
    });
    if (err) { setError(err.message); } else { setInput(''); fetchItems(); }
    setSaving(false);
  };

  const processItem = async (id: string, target: ProcessTarget) => {
    const item = items.find(i => i.id === id);
    if (!item || !user?.id) return;

    let createdId = genId();
    
    // Create the target entity
    if (target === 'task') {
      await supabase.from('tasks').insert({
        id: createdId, user_id: user.id, title: item.content,
        status: 'todo', priority: 'medium',
        is_deleted: false, sync_status: 'synced',
      });
    } else if (target === 'goal') {
      await supabase.from('goals').insert({
        id: createdId, user_id: user.id, title: item.content,
        status: 'active', progress: 0, sort_order: 0,
        is_deleted: false, sync_status: 'synced',
      });
    } else if (target === 'note') {
      await supabase.from('notes').insert({
        id: createdId, user_id: user.id, title: item.content, content: '',
        is_pinned: false, is_deleted: false, sync_status: 'synced',
      });
    } else if (target === 'event') {
      await createScheduleEvent(supabase, {
        userId: user.id,
        title: item.content,
        startTime: new Date().toISOString(),
      });
    }

    // Mark as processed
    await supabase.from('inbox_items').update({
      status: 'processed', converted_to_type: target, converted_to_id: createdId,
    }).eq('id', id);

    setProcessingId(null);
    fetchItems();
  };

  const deleteItem = async (id: string) => {
    await supabase.from('inbox_items').update({ is_deleted: true }).eq('id', id);
    fetchItems();
  };

  const unprocessed = items.filter(i => i.status === 'pending');
  const processed = items.filter(i => i.status === 'processed');
  const showBackButton = location.pathname.startsWith('/reflect/');

  return (
    <div className="inbox-page">
      <div className="ibx-header">
        <div>
          {showBackButton && (
            <button
              onClick={() => navigate('/reflect')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', marginBottom: 8,
                background: 'rgba(15, 45, 74, 0.4)', border: '1px solid rgba(26, 58, 92, 0.6)',
                borderRadius: 8, color: '#8BA4BE', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <ArrowLeft size={14} /> Back to Reflect
            </button>
          )}
          <h1 className="ibx-title"><Inbox size={22} /> Inbox</h1>
          <p className="ibx-sub">{unprocessed.length} unprocessed · {processed.length} processed</p>
        </div>
      </div>

      {/* Quick Capture */}
      <div className="ibx-capture">
        <input className="ibx-capture-input" placeholder="Capture a thought... (press Enter)"
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
          disabled={saving} />
        <button className="ibx-capture-btn" onClick={addItem} disabled={saving || !input.trim()}>
          {saving ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
        </button>
      </div>

      {error && <div className="ibx-error"><AlertTriangle size={14} /> {error}</div>}

      {/* Unprocessed */}
      {loading ? <div className="ibx-empty"><Loader2 size={24} className="spin" /> Loading...</div> : (
        <>
          {unprocessed.length === 0 ? (
            <EmptyState variant="inbox" />
          ) : (
            <div className="ibx-list">
              {unprocessed.map(item => {
                const isProcessing = processingId === item.id;
                return (
                  <div key={item.id} className="ibx-item">
                    <div className="ibx-item-main">
                      <div className="ibx-item-content">
                        <span className="ibx-item-text">{item.content}</span>
                        <span className="ibx-item-time">{timeAgo(item.created_at)}</span>
                      </div>
                      <div className="ibx-item-actions">
                        <button className="ibx-process-btn" onClick={() => setProcessingId(isProcessing ? null : item.id)}>
                          <ArrowRight size={14} /> Process
                        </button>
                        <button className="ibx-delete-btn" onClick={() => deleteItem(item.id)} aria-label="Delete item">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    {isProcessing && (
                      <div className="ibx-process-dropdown">
                        <span className="ibx-process-label">Convert to:</span>
                        {(['task', 'goal', 'note', 'event'] as ProcessTarget[]).map(t => (
                          <button key={t} className={`ibx-process-target ${t}`} onClick={() => processItem(item.id, t)}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Processed */}
          {processed.length > 0 && (
            <div className="ibx-processed-section">
              <button className="ibx-processed-toggle" onClick={() => setShowProcessed(!showProcessed)}>
                {showProcessed ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Processed ({processed.length})
              </button>
              {showProcessed && (
                <div className="ibx-list processed">
                  {processed.map(item => {
                    return (
                      <div key={item.id} className="ibx-item done">
                        <div className="ibx-item-main">
                          <div className="ibx-done-check"><Check size={14} /></div>
                          <div className="ibx-item-content">
                            <span className="ibx-item-text">{item.content}</span>
                            <span className="ibx-item-time">
                              {item.converted_to_type && `→ ${item.converted_to_type}`}
                            </span>
                          </div>
                          <button className="ibx-delete-btn" onClick={() => deleteItem(item.id)} aria-label="Delete item">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
