/**
 * useKnowledgeStore — Zustand store for Knowledge Cards & SRS review state.
 *
 * Manages flashcard-style knowledge cards with Spaced Repetition Scheduling.
 * Follows the same pattern as useLessonsStore for CRUD + sync.
 *
 * Tables:
 *   knowledge_cards — SRS cards with scheduling metadata
 *   knowledge_reviews — Review logs (rating, duration, etc.)
 */

import { create } from 'zustand';
import { genId } from '../utils/date';
import { localGetAll, localInsert, localUpdate, type TableName } from '../lib/local-db';
import { logger } from '../utils/logger';
import {
  type Rating,
  type SRSCard,
  type CardState,
  type SchedulingOutcome,
  scheduleCard,
  getDueCards as getDueCardsEngine,
  createNewCard,
  isLeech,
  INITIAL_EASE,
} from '../lib/srs-engine';

// ══════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════

const CARDS_TABLE: TableName = 'knowledge_cards';
const REVIEWS_TABLE: TableName = 'knowledge_reviews';
const STALE_MS = 2 * 60 * 1000; // 2 minutes

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

export interface KnowledgeReview {
  id: string;
  card_id: string;
  rating: Rating;
  elapsed_days: number;
  scheduled_days: number;
  review_duration_ms: number;
  reviewed_at: string;
}

export interface StudyDeck {
  id: string;
  name: string;
  description: string;
  hermeticPrinciple?: number;  // links deck to Hermetic principle
  color: string;
  icon: string;  // Lucide icon name
  cardCount: number;
}

export interface DeckStats {
  total: number;
  due: number;
  new: number;
  learning: number;
  review: number;
}

// ══════════════════════════════════════════════════════════════
// Built-in Study Decks
// ══════════════════════════════════════════════════════════════

export const STUDY_DECKS: StudyDeck[] = [
  {
    id: 'hermetic-principles',
    name: 'The Seven Principles',
    description: 'Master the Hermetic principles that govern LifeOS',
    hermeticPrinciple: 0,
    color: '#A855F7',
    icon: 'Sparkles',
    cardCount: 28,
  },
  {
    id: 'system-design',
    name: 'System Design',
    description: 'Scalability, load balancing, databases, caching',
    color: '#00D4FF',
    icon: 'Server',
    cardCount: 40,
  },
  {
    id: 'programming-fundamentals',
    name: 'Code Fundamentals',
    description: 'Algorithms, data structures, patterns',
    color: '#39FF14',
    icon: 'Code',
    cardCount: 50,
  },
];

// ══════════════════════════════════════════════════════════════
// Store Interface
// ══════════════════════════════════════════════════════════════

interface KnowledgeState {
  cards: SRSCard[];
  reviews: KnowledgeReview[];
  loading: boolean;
  lastFetched: number | null;

  fetchAll: () => Promise<void>;
  reviewCard: (cardId: string, rating: Rating, durationMs: number) => Promise<void>;
  addCard: (
    card: Omit<SRSCard, 'id' | 'state' | 'ease' | 'interval' | 'due' | 'lapses' | 'reviews' | 'lastReview' | 'elapsedDays'>,
  ) => Promise<string>;
  getDueCards: () => SRSCard[];
  getDueCount: () => number;
  getCardsByDeck: (deckId: string) => SRSCard[];
  getDeckStats: (deckId: string) => DeckStats;
  invalidate: () => void;
}

// ══════════════════════════════════════════════════════════════
// Store Implementation
// ══════════════════════════════════════════════════════════════

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  cards: [],
  reviews: [],
  loading: false,
  lastFetched: null,

  // ── Fetch All ──

  fetchAll: async () => {
    const { lastFetched, loading } = get();
    if (loading) return;
    if (lastFetched && Date.now() - lastFetched < STALE_MS) return;

    set({ loading: true });
    try {
      const [cardRows, reviewRows] = await Promise.all([
        localGetAll<SRSCard & { is_deleted?: number }>(CARDS_TABLE),
        localGetAll<KnowledgeReview & { is_deleted?: number }>(REVIEWS_TABLE),
      ]);

      const activeCards = cardRows
        .filter(r => !r.is_deleted)
        .map(r => ({
          ...r,
          // Ensure numeric fields are numbers (IndexedDB can return strings)
          ease: typeof r.ease === 'string' ? parseFloat(r.ease) : r.ease,
          interval: typeof r.interval === 'string' ? parseFloat(r.interval) : r.interval,
          due: typeof r.due === 'string' ? parseInt(r.due, 10) : r.due,
          lapses: typeof r.lapses === 'string' ? parseInt(r.lapses, 10) : r.lapses,
          reviews: typeof r.reviews === 'string' ? parseInt(r.reviews, 10) : r.reviews,
          lastReview: typeof r.lastReview === 'string' ? parseInt(r.lastReview, 10) : r.lastReview,
          elapsedDays: typeof r.elapsedDays === 'string' ? parseFloat(r.elapsedDays) : r.elapsedDays,
          tags: Array.isArray(r.tags) ? r.tags : (typeof r.tags === 'string' ? JSON.parse(r.tags as unknown as string) : []),
        }));

      const activeReviews = reviewRows.filter(r => !r.is_deleted);

      set({
        cards: activeCards,
        reviews: activeReviews,
        lastFetched: Date.now(),
      });
    } catch (e) {
      logger.error('[knowledge] fetchAll failed:', e);
    } finally {
      set({ loading: false });
    }
  },

  // ── Review Card ──

  reviewCard: async (cardId: string, rating: Rating, durationMs: number) => {
    const { cards } = get();
    const card = cards.find(c => c.id === cardId);
    if (!card) {
      logger.error('[knowledge] reviewCard: card not found', cardId);
      return;
    }

    const now = Date.now();

    // Calculate elapsed days since last review
    const elapsedDays = card.lastReview > 0
      ? (now - card.lastReview) / 86_400_000
      : 0;

    // Update card with elapsed days before scheduling
    const cardWithElapsed = { ...card, elapsedDays };

    // Get scheduling outcome from the SRS engine
    const outcome: SchedulingOutcome = scheduleCard(cardWithElapsed, rating, now);

    // Determine if this is a lapse (Again on a review card)
    const isLapse = rating === 'again' && card.state === 'review';

    // Build updated card
    const updatedCard: Partial<SRSCard & { isLeech?: boolean }> = {
      state: outcome.state,
      ease: outcome.ease,
      interval: outcome.interval,
      due: outcome.due,
      lapses: isLapse ? card.lapses + 1 : card.lapses,
      reviews: card.reviews + 1,
      lastReview: now,
      elapsedDays,
      isLeech: isLapse && (card.lapses + 1) >= 8, // LEECH_THRESHOLD
    };

    // Create review log entry
    const reviewLog: Partial<KnowledgeReview> & { id: string } = {
      id: genId(),
      card_id: cardId,
      rating,
      elapsed_days: Math.round(elapsedDays * 10) / 10,
      scheduled_days: outcome.interval,
      review_duration_ms: durationMs,
      reviewed_at: new Date(now).toISOString(),
    };

    try {
      await Promise.all([
        localUpdate(CARDS_TABLE, cardId, updatedCard as any),
        localInsert(REVIEWS_TABLE, reviewLog as any),
      ]);

      // Update in-memory state
      set({
        cards: cards.map(c =>
          c.id === cardId
            ? { ...c, ...updatedCard }
            : c
        ),
        reviews: [...get().reviews, reviewLog as KnowledgeReview],
      });
    } catch (e) {
      logger.error('[knowledge] reviewCard failed:', e);
    }
  },

  // ── Add Card ──

  addCard: async (
    cardData: Omit<SRSCard, 'id' | 'state' | 'ease' | 'interval' | 'due' | 'lapses' | 'reviews' | 'lastReview' | 'elapsedDays'>,
  ) => {
    const id = genId();
    const newCard = createNewCard({
      id,
      ...cardData,
    });

    try {
      await localInsert(CARDS_TABLE, newCard as any);
      set({ cards: [...get().cards, newCard] });
      return id;
    } catch (e) {
      logger.error('[knowledge] addCard failed:', e);
      return '';
    }
  },

  // ── Getters ──

  getDueCards: () => {
    const { cards } = get();
    return getDueCardsEngine(cards, Date.now());
  },

  getDueCount: () => {
    const { cards } = get();
    return getDueCardsEngine(cards, Date.now()).length;
  },

  getCardsByDeck: (deckId: string) => {
    const { cards } = get();
    return cards.filter(c => c.deckId === deckId);
  },

  getDeckStats: (deckId: string): DeckStats => {
    const { cards } = get();
    const deckCards = cards.filter(c => c.deckId === deckId);
    const now = Date.now();
    const dueCards = getDueCardsEngine(deckCards, now);

    return {
      total: deckCards.length,
      due: dueCards.length,
      new: deckCards.filter(c => c.state === 'new').length,
      learning: deckCards.filter(c => c.state === 'learning' || c.state === 'relearning').length,
      review: deckCards.filter(c => c.state === 'review').length,
    };
  },

  // ── Invalidate Cache ──

  invalidate: () => {
    set({ lastFetched: null });
  },
}));