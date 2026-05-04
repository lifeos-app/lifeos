/**
 * SRSReviewMode — Spaced Repetition review interface for Academy
 *
 * Card flip UI: front shows key points, back reveals content.
 * Four rating buttons: Again (red), Hard (orange), Good (green), Easy (blue).
 * Lucide icons only — no emoji.
 */

import { useState, useMemo } from 'react';
import { Brain, CheckCircle2, ChevronLeft, Clock, Loader2, RotateCw } from 'lucide-react';
import { useAcademyStore2 } from '../../stores/useAcademyStore2';
import { formatInterval } from '../../lib/srs-engine';
import type { CurriculumLesson } from '../../types/academy';
import type { Rating } from '../../lib/srs-engine';

interface Props { goalId: string; onBack: () => void }

const RATING_CFG: { rating: Rating; label: string; color: string; bg: string }[] = [
  { rating: 'again', label: 'Again', color: '#F43F5E', bg: 'rgba(244,63,94,0.12)' },
  { rating: 'hard',  label: 'Hard',  color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  { rating: 'good',  label: 'Good',  color: '#39FF14', bg: 'rgba(57,255,20,0.12)' },
  { rating: 'easy',  label: 'Easy',  color: '#00D4FF', bg: 'rgba(0,212,255,0.12)' },
];

const nextLabel = (dueTs: number) => {
  const diffDays = (dueTs - Date.now()) / 86_400_000;
  return diffDays <= 0 ? 'now' : formatInterval(diffDays);
};

const btnBase = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#8BA4BE', cursor: 'pointer', fontSize: 13 } as const;

export function SRSReviewMode({ goalId, onBack }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nextDue, setNextDue] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  const dueCards = useAcademyStore2(s => s.getCardsDueForReview)(goalId);
  const remaining = dueCards.filter(c => !done.has(c.id));
  const card = remaining[0] ?? null;
  const reviewed = done.size;
  const total = dueCards.length;

  const handleRate = async (rating: Rating) => {
    if (!card || busy) return;
    setBusy(true);
    try {
      await useAcademyStore2.getState().rateLesson(goalId, card.id, rating);
      const nextDate = useAcademyStore2.getState().getNextReviewDate(goalId, card.id);
      if (nextDate) setNextDue(nextLabel(new Date(nextDate).getTime()));
      setDone(prev => new Set([...prev, card.id]));
      setFlipped(false);
    } catch (err) {
      console.error('[SRSReviewMode] rateLesson failed:', err);
    } finally { setBusy(false); }
  };

  // Empty state
  if (total === 0) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <Brain size={48} color="#5A7A9A" style={{ marginBottom: 16 }} />
      <h3 style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 8 }}>No cards due for review</h3>
      <p style={{ fontSize: 14, color: '#8BA4BE', marginBottom: 20 }}>Come back later — spaced repetition will bring cards back when it&apos;s time.</p>
      <button onClick={onBack} style={btnBase}><ChevronLeft size={14} /> Back to Goals</button>
    </div>
  );

  // All done
  if (!card && reviewed > 0) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <CheckCircle2 size={48} color="#39FF14" style={{ marginBottom: 16 }} />
      <h3 style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 8 }}>Review session complete</h3>
      <p style={{ fontSize: 14, color: '#8BA4BE', marginBottom: 20 }}>{reviewed}/{total} cards reviewed. Spaced repetition handles the rest!</p>
      <button onClick={onBack} style={btnBase}><ChevronLeft size={14} /> Back to Goals</button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#8BA4BE', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
          <ChevronLeft size={16} /> Back
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Brain size={16} color="#00D4FF" /> {reviewed}/{total} reviewed
        </span>
        <div style={{ width: 50 }} />
      </div>

      {/* Progress */}
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', marginBottom: 16 }}>
        <div style={{ height: '100%', borderRadius: 2, background: '#00D4FF', width: `${(reviewed / total) * 100}%`, transition: 'width 0.3s' }} />
      </div>

      {/* Card */}
      <div onClick={() => setFlipped(f => !f)} style={{
        flex: 1, minHeight: 0, cursor: 'pointer', background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '24px 28px', overflowY: 'auto',
      }}>
        <div style={{ position: 'absolute', top: 10, right: 14, fontSize: 11, color: '#5A7A9A', display: 'flex', alignItems: 'center', gap: 4 }}>
          <RotateCw size={11} /> Tap to flip
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 12 }}>{card!.title}</h3>
        {!flipped ? (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#D4AF37', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Key Points — try to recall</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {(card!.keyPoints ?? []).map((kp, i) => <li key={i} style={{ fontSize: 14, color: '#C0C0C0', marginBottom: 4 }}>{kp}</li>)}
            </ul>
          </div>
        ) : (
          <div style={{ fontSize: 14, color: '#D0D0D0', lineHeight: 1.7 }}>
            {card!.content?.slice(0, 600)}{card!.content?.length > 600 ? '...' : ''}
          </div>
        )}
      </div>

      {/* Next review label */}
      {nextDue && (
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 13, color: '#8BA4BE', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Clock size={13} /> Next review: {nextDue}
        </div>
      )}

      {/* Rating buttons */}
      {flipped && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {RATING_CFG.map(cfg => (
            <button key={cfg.rating} onClick={() => handleRate(cfg.rating)} disabled={busy} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '10px 0', borderRadius: 8, border: `1px solid ${cfg.color}66`,
              background: cfg.bg, color: cfg.color, fontWeight: 600, fontSize: 13,
              cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1, transition: 'all 0.15s',
            }}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : null}{cfg.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}