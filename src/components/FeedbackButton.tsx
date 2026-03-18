/**
 * Floating Feedback Button + Modal
 * Accessible from any page. Submits to Supabase feedback table.
 */
import { useState, useEffect } from 'react';
import { X, Send, Bug, Lightbulb, Heart, HelpCircle, Loader2, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/useUserStore';
import './FeedbackButton.css';
import { logger } from '../utils/logger';

const TYPES = [
  { id: 'bug', label: 'Bug', icon: Bug, color: '#F43F5E' },
  { id: 'feature', label: 'Feature', icon: Lightbulb, color: '#FFD93D' },
  { id: 'praise', label: 'Love it', icon: Heart, color: '#F43F5E' },
  { id: 'other', label: 'Other', icon: HelpCircle, color: '#8BA4BE' },
] as const;

export function FeedbackButton() {
  const user = useUserStore(s => s.user);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>('bug');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!user || !message.trim()) return;
    setSending(true);

    try {
      await supabase.from('feedback').insert({
        user_id: user.id,
        type,
        message: message.trim(),
        page: window.location.pathname,
        rating: rating || null,
        metadata: {
          userAgent: navigator.userAgent,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          timestamp: new Date().toISOString(),
        },
      });

      setSent(true);
      setTimeout(() => {
        setOpen(false);
        setSent(false);
        setMessage('');
        setRating(0);
        setType('bug');
      }, 1500);
    } catch (err) {
      logger.error('Feedback error:', err);
    }

    setSending(false);
  };

  // Listen for sidebar trigger
  useEffect(() => {
    const handler = () => setOpen(true);
    document.addEventListener('open-feedback', handler);
    return () => document.removeEventListener('open-feedback', handler);
  }, []);

  if (!user) return null;

  return (
    <>
      {/* Modal overlay — triggered from sidebar */}
      {open && (
        <div className="fb-overlay" onClick={() => setOpen(false)}>
          <div className="fb-modal" onClick={e => e.stopPropagation()}>
            {sent ? (
              <div className="fb-sent">
                <Check size={32} style={{ color: '#4ECB71' }} />
                <p>Thanks for your feedback!</p>
              </div>
            ) : (
              <>
                <div className="fb-header">
                  <h3>Send Feedback</h3>
                  <button className="fb-close" onClick={() => setOpen(false)} aria-label="Close feedback">
                    <X size={16} />
                  </button>
                </div>

                {/* Type selector */}
                <div className="fb-types">
                  {TYPES.map(t => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        className={`fb-type ${type === t.id ? 'active' : ''}`}
                        onClick={() => setType(t.id)}
                        style={{
                          borderColor: type === t.id ? t.color : undefined,
                          background: type === t.id ? `${t.color}12` : undefined,
                          color: type === t.id ? t.color : undefined,
                        }}
                      >
                        <Icon size={14} />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Message */}
                <textarea
                  className="fb-textarea"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={
                    type === 'bug' ? 'What went wrong? What did you expect?'
                    : type === 'feature' ? 'What feature would you love to see?'
                    : type === 'praise' ? 'What do you love about LifeOS?'
                    : 'Tell us anything...'
                  }
                  rows={4}
                  autoFocus
                />

                {/* Rating */}
                {type === 'praise' && (
                  <div className="fb-rating">
                    <span className="fb-rating-label">Rate your experience:</span>
                    <div className="fb-stars">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          className={`fb-star ${n <= rating ? 'active' : ''}`}
                          onClick={() => setRating(n)}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Submit */}
                <button
                  className="fb-submit"
                  onClick={submit}
                  disabled={!message.trim() || sending}
                >
                  {sending ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                  {sending ? 'Sending...' : 'Send Feedback'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
