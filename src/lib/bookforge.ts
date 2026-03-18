// BookForge Integration — Auto-chronicle journal entries

import { supabase } from './supabase';
import { logger } from '../utils/logger';

const BOOKFORGE_API_URL = import.meta.env.VITE_BOOKFORGE_API_URL || '';

interface ProcessJournalParams {
  userId: string;
  journalEntryIds: string[];
  junctionTradition?: {
    id: string;
    name: string;
    slug: string;
    description: string;
    color: string;
  };
}

interface BookForgeResponse {
  success: boolean;
  entry?: any;
  message?: string;
  error?: string;
}

/**
 * Process journal entries into chronicle entries via BookForge API
 */
export async function processJournalEntries(params: ProcessJournalParams): Promise<BookForgeResponse> {
  if (!BOOKFORGE_API_URL) {
    logger.info('[BookForge] API URL not configured — skipping');
    return { success: false, error: 'BookForge API not configured' };
  }
  try {
    const response = await fetch(`${BOOKFORGE_API_URL}/process-journal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: params.userId,
        journal_entry_ids: params.journalEntryIds,
        junction_tradition: params.junctionTradition,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return { success: false, error: errorData.error || 'Failed to process journal entries' };
    }

    const data = await response.json();
    return data;
  } catch (err: any) {
    logger.error('[BookForge] Error processing journal:', err);
    return { success: false, error: err.message || 'Network error' };
  }
}

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
export async function getUserJunction(userId: string) {
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
 * Auto-process a journal entry if conditions are met
 * Call this after saving a journal entry
 */
export async function autoProcessIfEnabled(userId: string, journalEntryId: string) {
  try {
    // Check if auto-process is enabled
    const autoProcess = await shouldAutoProcess(userId);
    if (!autoProcess) return;

    // Get user's junction context
    const junction = await getUserJunction(userId);

    // Process the entry
    const result = await processJournalEntries({
      userId,
      journalEntryIds: [journalEntryId],
      junctionTradition: junction || undefined,
    });

    if (result.success) {
      logger.log('[BookForge] Auto-processed journal entry:', journalEntryId);
    } else {
      logger.warn('[BookForge] Auto-process failed:', result.error);
    }
  } catch (err) {
    logger.error('[BookForge] Auto-process error:', err);
  }
}
