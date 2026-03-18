/**
 * QuickJournal — Quick thought text area. Save without leaving dashboard.
 */

import { useState, useRef, useEffect } from 'react';
import { BookOpen, Send } from 'lucide-react';
import { BottomSheet } from '../../BottomSheet';
import { useUserStore } from '../../../stores/useUserStore';
import { useJournalStore } from '../../../stores/useJournalStore';
import { supabase } from '../../../lib/supabase';
import { localDateStr } from '../../../utils/date';
import { showToast } from '../../Toast';
import { localInsert, localUpdate } from '../../../lib/local-db';

interface Props {
  open: boolean;
  onClose: () => void;
}

const MOODS = [
  { value: 1, emoji: '😫' },
  { value: 2, emoji: '😕' },
  { value: 3, emoji: '😐' },
  { value: 4, emoji: '🙂' },
  { value: 5, emoji: '😄' },
];

export function QuickJournal({ open, onClose }: Props) {
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  
  const user = useUserStore(s => s.user);
  const existingEntry = useJournalStore(s => s.getEntryForDate(localDateStr()));
  const invalidateJournal = useJournalStore(s => s.invalidate);

  useEffect(() => {
    if (open) {
      // Pre-fill from existing entry
      if (existingEntry) {
        setContent(existingEntry.content || '');
        setMood(existingEntry.mood);
      }
      setTimeout(() => textRef.current?.focus(), 350);
    } else {
      setContent('');
      setMood(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!content.trim() || !user?.id || saving) return;
    
    setSaving(true);
    const today = localDateStr();
    
    if (existingEntry?.id) {
      // Update existing
      const updatePayload = {
        content: content.trim(),
        mood: mood,
        updated_at: new Date().toISOString(),
      };
      
      const { error } = await supabase.from('journal_entries').update(updatePayload).eq('id', existingEntry.id);
      
      if (!error) {
        // Also update local IndexedDB
        await localUpdate('journal_entries', existingEntry.id, { ...updatePayload, synced: true });
        showToast('Journal updated! 📝', '📝', '#A855F7');
        invalidateJournal();
        onClose();
      } else {
        showToast('Failed to update journal', '❌', '#F43F5E');
      }
    } else {
      // Create new
      const newEntry = {
        user_id: user.id,
        date: today,
        title: `Quick note — ${new Date().toLocaleDateString('en', { month: 'short', day: 'numeric' })}`,
        content: content.trim(),
        mood: mood,
        tags: '',
        is_deleted: false,
        sync_status: 'synced',
      };
      
      const { error, data } = await supabase.from('journal_entries').insert(newEntry).select().single();
      
      if (!error && data) {
        // Also insert into local IndexedDB
        await localInsert('journal_entries', { ...data, synced: true });
        showToast('Thought captured! 📝', '📝', '#A855F7');
        invalidateJournal();
        onClose();
      } else {
        showToast('Failed to save journal entry', '❌', '#F43F5E');
      }
    }
    setSaving(false);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={existingEntry ? 'Edit Journal' : 'Quick Journal'} icon={<BookOpen size={18} />}>
      {/* Mood */}
      <div className="bs-field">
        <label className="bs-label">How are you feeling?</label>
        <div className="bs-emoji-row">
          {MOODS.map(m => (
            <button
              key={m.value}
              className={`bs-emoji-btn ${mood === m.value ? 'bs-emoji-selected' : ''}`}
              onClick={() => setMood(mood === m.value ? null : m.value)}
            >
              {m.emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Journal content */}
      <div className="bs-field">
        <label className="bs-label">What's on your mind?</label>
        <textarea
          ref={textRef}
          className="bs-textarea"
          placeholder="Capture a quick thought, reflection, or gratitude..."
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={4}
          style={{ minHeight: 100 }}
        />
      </div>

      <button
        className="bs-submit"
        onClick={handleSubmit}
        disabled={!content.trim() || saving}
      >
        <Send size={16} />
        {saving ? 'Saving...' : existingEntry ? 'Update Entry' : 'Save Thought'}
      </button>
    </BottomSheet>
  );
}
