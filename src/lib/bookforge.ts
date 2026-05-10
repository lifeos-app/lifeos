// BookForge — AI-powered chronicle generation from journal entries
// Uses the app's LLM proxy (callLLMProxy) for all AI calls.

import { supabase } from './data-access';
import { callLLMProxy } from './llm-proxy';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────

interface JournalEntryInput {
  id: string;
  content: string;
  mood: number | null;
  themes: string[];
  entry_date: string;
}

interface TraditionContext {
  id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
}

export interface ChronicleEntryResult {
  title: string;
  content: string;
  themes: string[];
  mood_summary: string;
}

export interface BookSummaryResult {
  summary: string;
  key_themes: string[];
  arc_description: string;
}

export interface ConnectionSuggestion {
  pattern: string;
  entries_involved: string[];
  insight: string;
}

// ─── Core AI Functions ─────────────────────────────────────────────────

/**
 * Generate a literary chronicle entry from journal data.
 * Transforms raw journal entries into a polished narrative.
 */
export async function generateChronicleEntry(
  journalEntries: JournalEntryInput[],
  tradition?: TraditionContext | null,
): Promise<ChronicleEntryResult> {
  if (!journalEntries.length) {
    throw new Error('No journal entries provided for chronicle generation');
  }

  const traditionNote = tradition
    ? `The author follows the "${tradition.name}" tradition: ${tradition.description}. Weave subtle references to this tradition's themes and language into the narrative where natural.`
    : '';

  const entriesText = journalEntries
    .map((e, i) => {
      const moodLabel = e.mood ? ` (mood: ${e.mood}/5)` : '';
      const themesLabel = e.themes.length ? ` [themes: ${e.themes.join(', ')}]` : '';
      return `--- Entry ${i + 1} (${e.entry_date})${moodLabel}${themesLabel} ---\n${e.content}`;
    })
    .join('\n\n');

  const prompt = `You are a literary chronicle writer. Transform these journal entries into a single, compelling chronicle entry — a polished narrative that captures the human experience within them.

Rules:
- Write in third person, literary style — like a biographer crafting someone's life story
- Preserve the emotional truth and key events from the source entries
- Create evocative, specific prose — no clichés or platitudes
- Include a fitting title that captures the essence
- Extract 2-5 themes as short lowercase labels (e.g. "growth", "loss", "renewal")
- Summarize the prevailing mood in one short phrase
- Keep the content 200-500 words
${traditionNote}

Journal entries:
${entriesText}

Respond with JSON:
{
  "title": "...",
  "content": "... (markdown narrative) ...",
  "themes": ["theme1", "theme2"],
  "mood_summary": "short mood phrase"
}`;

  try {
    const response = await callLLMProxy(
      [{ role: 'user', content: prompt }],
      { service: 'bookforge', format: 'json', timeoutMs: 45000 },
    );

    // Parse the JSON response — handle possible code fences
    let jsonStr = response.content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(jsonStr);

    return {
      title: parsed.title || 'Untitled Chronicle',
      content: parsed.content || '',
      themes: Array.isArray(parsed.themes) ? parsed.themes : [],
      mood_summary: parsed.mood_summary || '',
    };
  } catch (err) {
    logger.error('[BookForge] Chronicle generation failed:', err);
    throw err;
  }
}

/**
 * Generate a chapter-level summary of multiple chronicle entries.
 * Used to summarize a period of someone's life.
 */
export async function generateBookSummary(
  entries: { title: string; content: string; entry_date: string; themes: string[] }[],
): Promise<BookSummaryResult> {
  if (!entries.length) {
    throw new Error('No entries provided for summary generation');
  }

  const entriesText = entries
    .map((e, i) => `--- ${e.entry_date}: ${e.title} [${e.themes.join(', ')}] ---\n${e.content.slice(0, 500)}`)
    .join('\n\n');

  const prompt = `You are summarizing a sequence of chronicle entries from someone's life. Create a chapter-level summary that captures the narrative arc.

Chronicle entries:
${entriesText}

Respond with JSON:
{
  "summary": "... (2-4 paragraph overview of this period) ...",
  "key_themes": ["theme1", "theme2", "theme3"],
  "arc_description": "A short sentence describing the emotional/narrative arc (e.g. 'From uncertainty to quiet resolve')"
}`;

  try {
    const response = await callLLMProxy(
      [{ role: 'user', content: prompt }],
      { service: 'bookforge', format: 'json', timeoutMs: 30000 },
    );

    let jsonStr = response.content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(jsonStr);

    return {
      summary: parsed.summary || '',
      key_themes: Array.isArray(parsed.key_themes) ? parsed.key_themes : [],
      arc_description: parsed.arc_description || '',
    };
  } catch (err) {
    logger.error('[BookForge] Summary generation failed:', err);
    throw err;
  }
}

/**
 * Find thematic patterns and connections across journal entries.
 * Returns suggestions for connections the reader might not notice.
 */
export async function suggestConnections(
  journalEntries: JournalEntryInput[],
): Promise<ConnectionSuggestion[]> {
  if (journalEntries.length < 2) {
    return [];
  }

  const entriesText = journalEntries
    .map((e, i) => `--- Entry ${i + 1} (${e.entry_date}) [themes: ${e.themes.join(', ')}] [mood: ${e.mood || '?'}] ---\n${e.content.slice(0, 300)}`)
    .join('\n\n');

  const prompt = `Analyze these journal entries and find thematic connections, recurring motifs, or emotional patterns across them. Look for things a person might not notice on their own — echoes, contrasts, hidden threads.

Journal entries:
${entriesText}

Respond with a JSON array of 1-5 connection objects:
[
  {
    "pattern": "Short name for the pattern (e.g. 'Recurring doubt before breakthroughs')",
    "entries_involved": ["entry number references like '1,3'"],
    "insight": "1-2 sentence insight about this pattern"
  }
]`;

  try {
    const response = await callLLMProxy(
      [{ role: 'user', content: prompt }],
      { service: 'bookforge', format: 'json', timeoutMs: 25000 },
    );

    let jsonStr = response.content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(jsonStr);

    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logger.error('[BookForge] Connection suggestion failed:', err);
    throw err;
  }
}

// ─── Supabase Helpers ──────────────────────────────────────────────────

/**
 * Check if user has auto-process enabled for their book
 */
export async function shouldAutoProcess(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_books')
      .select('auto_process')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return false;
    return data.auto_process === true;
  } catch {
    return false;
  }
}

/**
 * Get user's current junction for chronicle voice shaping
 */
export async function getUserJunction(userId: string): Promise<TraditionContext | null> {
  try {
    const { data: userJunction } = await supabase
      .from('user_junction')
      .select('tradition_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (!userJunction?.tradition_id) return null;

    const { data: tradition } = await supabase
      .from('junction_traditions')
      .select('id, name, slug, description, color')
      .eq('id', userJunction.tradition_id)
      .single();

    return tradition || null;
  } catch {
    return null;
  }
}

/**
 * Fetch journal entries by their IDs for chronicle generation.
 */
export async function fetchJournalEntriesForChronicle(
  userId: string,
  entryIds: string[],
): Promise<JournalEntryInput[]> {
  try {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('id, content, mood, tags, date')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .in('id', entryIds);

    if (error || !data) return [];

    return data.map((e: any) => ({
      id: e.id,
      content: e.content || '',
      mood: e.mood,
      themes: Array.isArray(e.tags) ? e.tags : (typeof e.tags === 'string' ? e.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []),
      entry_date: e.date,
    }));
  } catch (err) {
    logger.error('[BookForge] Failed to fetch journal entries:', err);
    return [];
  }
}

/**
 * Save a generated chronicle entry to the book_entries table.
 */
export async function saveChronicleEntry(
  bookId: string,
  userId: string,
  result: ChronicleEntryResult,
  rawJournalIds: string[],
  junctionId?: string | null,
  junctionTraditionName?: string | null,
): Promise<string | null> {
  try {
    const wordCount = result.content.split(/\s+/).filter(Boolean).length;
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('book_entries')
      .insert({
        book_id: bookId,
        user_id: userId,
        title: result.title,
        content: result.content,
        raw_journal_ids: rawJournalIds,
        entry_date: today,
        mood: result.mood_summary,
        themes: result.themes,
        junction_id: junctionId || null,
        junction_tradition_name: junctionTraditionName || null,
        word_count: wordCount,
        ai_generated: true,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('[BookForge] Failed to save chronicle entry:', error);
      return null;
    }
    return data?.id || null;
  } catch (err) {
    logger.error('[BookForge] Save chronicle entry error:', err);
    return null;
  }
}

/**
 * Auto-process a journal entry if conditions are met.
 * Call this after saving a journal entry.
 */
export async function autoProcessIfEnabled(userId: string, journalEntryId: string): Promise<void> {
  try {
    // Check if auto-process is enabled
    const autoProcess = await shouldAutoProcess(userId);
    if (!autoProcess) return;

    // Get user's junction context
    const junction = await getUserJunction(userId);

    // Fetch the journal entry
    const entries = await fetchJournalEntriesForChronicle(userId, [journalEntryId]);
    if (!entries.length) {
      logger.warn('[BookForge] No journal entry found for auto-process:', journalEntryId);
      return;
    }

    // Generate chronicle entry
    const result = await generateChronicleEntry(entries, junction);

    // Find or create the user's book
    const { data: bookData } = await supabase
      .from('user_books')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!bookData?.id) {
      logger.warn('[BookForge] No book found for auto-process, user:', userId);
      return;
    }

    // Save the chronicle entry
    const entryId = await saveChronicleEntry(
      bookData.id,
      userId,
      result,
      [journalEntryId],
      junction?.id,
      junction?.name,
    );

    if (entryId) {
      logger.log('[BookForge] Auto-processed journal entry:', journalEntryId);
    } else {
      logger.warn('[BookForge] Auto-process save failed for:', journalEntryId);
    }
  } catch (err) {
    logger.error('[BookForge] Auto-process error:', err);
  }
}