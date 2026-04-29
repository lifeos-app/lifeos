/**
 * FlashCardReview — spaced repetition flashcard review interface.
 * Inspired by Anki's 4-button review but styled for LifeOS.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, RotateCcw, CheckCircle2, XCircle, Minus, Plus } from 'lucide-react';
import { useKnowledgeStore, STUDY_DECKS } from '../../stores/useKnowledgeStore';
import type { SRSCard, Rating } from '../../lib/srs-engine';

interface FlashCardReviewProps {
  deckId: string;
  onClose: () => void;
  onComplete?: (stats: { reviewed: number; again: number; hard: number; good: number; easy: number }) => void;
}

const RATING_CONFIG: Record<Rating, { label: string; color: string; icon: React.ReactNode; subtext: string }> = {
  again:  { label: 'Again',  color: '#F43F5E', icon: <XCircle size={18} />, subtext: '< 1 min' },
  hard:   { label: 'Hard',  color: '#F97316', icon: <Minus size={18} />,   subtext: '1-3 min' },
  good:   { label: 'Good',  color: '#39FF14', icon: <CheckCircle2 size={18} />, subtext: '3-10 min' },
  easy:   { label: 'Easy',  color: '#00D4FF', icon: <Plus size={18} />,    subtext: '4+ days' },
};

const PRINCIPLE_COLORS = ['#A855F7','#06B6D4','#F97316','#EC4899','#39FF14','#FACC15','#D4AF37'];
const PRINCIPLE_NAMES = ['Mentalism','Correspondence','Vibration','Polarity','Rhythm','Cause & Effect','Gender'];

export function FlashCardReview({ deckId, onClose, onComplete }: FlashCardReviewProps) {
  const { cards, reviewCard, getDueCards, getCardsByDeck } = useKnowledgeStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const flipRef = useRef<HTMLDivElement>(null);

  const deck = STUDY_DECKS.find(d => d.id === deckId);
  const dueCards = getDueCards().filter(c => c.deckId === deckId);
  const allCards = getCardsByDeck(deckId);

  useEffect(() => {
    setStartTime(Date.now());
  }, [currentIndex]);

  const currentCard = dueCards[currentIndex] as SRSCard | undefined;

  const handleRate = useCallback(async (rating: Rating) => {
    if (!currentCard) return;
    const durationMs = Date.now() - startTime;
    await reviewCard(currentCard.id, rating, durationMs);
    setRatings(prev => [...prev, rating]);
    
    if (currentIndex + 1 >= dueCards.length) {
      setIsComplete(true);
      const again = ratings.filter(r => r === 'again').length + (rating === 'again' ? 1 : 0);
      const hard = ratings.filter(r => r === 'hard').length + (rating === 'hard' ? 1 : 0);
      const good = ratings.filter(r => r === 'good').length + (rating === 'good' ? 1 : 0);
      const easy = ratings.filter(r => r === 'easy').length + (rating === 'easy' ? 1 : 0);
      onComplete?.({ reviewed: dueCards.length, again, hard, good, easy });
    } else {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    }
  }, [currentCard, startTime, reviewCard, currentIndex, dueCards.length, ratings, onComplete]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isFlipped) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setIsFlipped(true); }
      return;
    }
    switch (e.key) {
      case '1': handleRate('again'); break;
      case '2': handleRate('hard'); break;
      case '3': handleRate('good'); break;
      case '4': handleRate('easy'); break;
    }
  }, [isFlipped, handleRate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ── Complete State ──
  if (isComplete) {
    const again = ratings.filter(r => r === 'again').length;
    const hard = ratings.filter(r => r === 'hard').length;
    const good = ratings.filter(r => r === 'good').length;
    const easy = ratings.filter(r => r === 'easy').length;
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
        <div className="text-6xl mb-4">🎓</div>
        <h2 className="text-2xl font-bold text-white mb-2">Session Complete!</h2>
        <p className="text-[#8BA4BE] mb-6">You reviewed {dueCards.length} card{dueCards.length !== 1 ? 's' : ''}</p>
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="text-center"><div className="text-2xl font-bold" style={{ color: '#F43F5E' }}>{again}</div><div className="text-xs text-[#5A7A9A]">Again</div></div>
          <div className="text-center"><div className="text-2xl font-bold" style={{ color: '#F97316' }}>{hard}</div><div className="text-xs text-[#5A7A9A]">Hard</div></div>
          <div className="text-center"><div className="text-2xl font-bold" style={{ color: '#39FF14' }}>{good}</div><div className="text-xs text-[#5A7A9A]">Good</div></div>
          <div className="text-center"><div className="text-2xl font-bold" style={{ color: '#00D4FF' }}>{easy}</div><div className="text-xs text-[#5A7A9A]">Easy</div></div>
        </div>
        <button onClick={onClose} className="px-6 py-2 rounded-lg bg-[#00D4FF]/20 text-[#00D4FF] hover:bg-[#00D4FF]/30 transition-colors">
          Back to Deck
        </button>
      </div>
    );
  }

  // ── No Due Cards ──
  if (dueCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
        <CheckCircle2 size={48} className="text-[#39FF14] mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">All caught up!</h2>
        <p className="text-[#8BA4BE] mb-6">No cards due for review in this deck.</p>
        <button onClick={onClose} className="px-6 py-2 rounded-lg bg-[#00D4FF]/20 text-[#00D4FF] hover:bg-[#00D4FF]/30 transition-colors">
          Back to Deck
        </button>
      </div>
    );
  }

  const principleColor = currentCard?.hermeticPrinciple != null
    ? PRINCIPLE_COLORS[currentCard.hermeticPrinciple]
    : deck?.color || '#00D4FF';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1A3A5C]">
        <button onClick={onClose} className="flex items-center gap-2 text-[#8BA4BE] hover:text-white transition-colors">
          <ArrowLeft size={18} />
          <span className="text-sm">{deck?.name || 'Study'}</span>
        </button>
        <div className="flex items-center gap-3">
          {currentCard?.hermeticPrinciple != null && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium" 
              style={{ backgroundColor: `${principleColor}20`, color: principleColor, border: `1px solid ${principleColor}40` }}>
              {PRINCIPLE_NAMES[currentCard.hermeticPrinciple]}
            </span>
          )}
          <span className="text-sm text-[#5A7A9A]">
            {currentIndex + 1} of {dueCards.length}
          </span>
        </div>
      </div>

      {/* Card Area */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div
          ref={flipRef}
          onClick={() => !isFlipped && setIsFlipped(true)}
          className="w-full max-w-lg cursor-pointer perspective-[1000px]"
          style={{ minHeight: '280px' }}
        >
          <div
            className="relative w-full transition-transform duration-500"
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* Front */}
            <div className="absolute inset-0 rounded-xl p-6 flex flex-col justify-center items-center text-center"
              style={{
                backgroundColor: '#0F2D4A',
                border: `1px solid ${principleColor}30`,
                backfaceVisibility: 'hidden',
                transform: 'rotateY(0deg)',
              }}>
              <div className="text-[#5A7A9A] text-xs uppercase tracking-wider mb-3">Question</div>
              <div className="text-white text-lg leading-relaxed whitespace-pre-line">{currentCard?.front}</div>
              {!isFlipped && (
                <div className="mt-6 text-[#5A7A9A] text-sm flex items-center gap-1">
                  <RotateCcw size={14} /> Tap or press Space to reveal
                </div>
              )}
            </div>
            {/* Back */}
            <div className="absolute inset-0 rounded-xl p-6 flex flex-col justify-center items-center text-center"
              style={{
                backgroundColor: '#0F2D4A',
                border: `1px solid ${principleColor}60`,
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}>
              <div className="text-[#5A7A9A] text-xs uppercase tracking-wider mb-3">Answer</div>
              <div className="text-white text-lg leading-relaxed whitespace-pre-line">{currentCard?.back}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Rating Buttons */}
      {isFlipped && (
        <div className="flex gap-2 px-4 pb-4 animate-[slideUp_0.2s_ease-out]">
          {(['again', 'hard', 'good', 'easy'] as Rating[]).map((rating) => {
            const cfg = RATING_CONFIG[rating];
            return (
              <button
                key={rating}
                onClick={() => handleRate(rating)}
                className="flex-1 flex flex-col items-center gap-1 py-3 rounded-lg transition-all hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: `${cfg.color}15`,
                  border: `1px solid ${cfg.color}40`,
                  color: cfg.color,
                }}
              >
                {cfg.icon}
                <span className="text-sm font-medium">{cfg.label}</span>
                <span className="text-[10px] opacity-60">{cfg.subtext}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Progress Bar */}
      <div className="px-4 pb-2">
        <div className="h-1 rounded-full bg-[#1A3A5C] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${((currentIndex + 1) / dueCards.length) * 100}%`,
              backgroundColor: principleColor,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default FlashCardReview;