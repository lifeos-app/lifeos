/**
 * AI Persistent Memory — stores AI conversations in local SQLite via electronAPI.
 *
 * In Electron (local) mode, conversations are persisted in the `ai_conversations` table.
 * In cloud/other modes, falls back to localStorage (existing behavior).
 *
 * Table schema (see electron/schema.sql):
 *   ai_conversations (id, user_id, title, messages_json, created_at, updated_at)
 */

import { db, getEnvironment } from './data-access';
import { logger } from '../utils/logger';
import type { ChatMessage } from '../components/ai-chat/helpers';

// ─── Types ──────────────────────────────────────────────────────

export interface AIConversationMeta {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AIConversation extends AIConversationMeta {
  messages_json: ChatMessage[];
}

// ─── Helpers ────────────────────────────────────────────────────

function isLocalMode(): boolean {
  return getEnvironment() === 'electron' || getEnvironment() === 'tauri';
}

/** Generate a short title from the first user message */
export function generateTitle(message: string): string {
  // Take the first line, truncate to 50 chars
  const firstLine = message.split('\n')[0].trim();
  if (firstLine.length <= 50) return firstLine;
  return firstLine.slice(0, 47) + '...';
}

/** Serialize ChatMessage[] for storage (strip transient fields) */
function serializeMessages(messages: ChatMessage[]): string {
  const clean = messages.map(m => {
    // Strip runtime-only flags that shouldn't be persisted
    const { isStreaming, orchestratorLoading, agentLoading, ...rest } = m as any;
    // Ensure timestamp is a string
    return {
      ...rest,
      timestamp: rest.timestamp instanceof Date
        ? rest.timestamp.toISOString()
        : rest.timestamp,
    };
  });
  return JSON.stringify(clean);
}

/** Deserialize stored messages back to ChatMessage[] */
function deserializeMessages(json: string | any[]): ChatMessage[] {
  try {
    // If already parsed (by database.js parseRow for JSON_FIELDS), use directly
    const raw = Array.isArray(json) ? json
      : (typeof json === 'string' ? JSON.parse(json) : json);
    if (!Array.isArray(raw)) return [];
    return raw.map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp),
      isStreaming: false,
      orchestratorLoading: false,
      agentLoading: false,
    }));
  } catch {
    return [];
  }
}

// ─── CRUD Operations ────────────────────────────────────────────

/**
 * Create a new conversation in the database.
 * Returns the conversation id.
 */
export async function createConversation(
  userId: string,
  firstUserMessage: string,
): Promise<string | null> {
  if (!isLocalMode()) return null;

  try {
    const id = crypto.randomUUID();
    const title = generateTitle(firstUserMessage);
    const now = new Date().toISOString();

    const { error } = await db
      .from('ai_conversations')
      .insert({
        id,
        user_id: userId,
        title,
        messages_json: '[]', // Will be updated on save
        created_at: now,
        updated_at: now,
      });

    if (error) {
      logger.warn('[ai-memory] createConversation error:', error.message);
      return null;
    }

    return id;
  } catch (err) {
    logger.warn('[ai-memory] createConversation exception:', err);
    return null;
  }
}

/**
 * Save / update messages for an existing conversation.
 */
export async function saveConversationMessages(
  conversationId: string,
  messages: ChatMessage[],
): Promise<boolean> {
  if (!isLocalMode() || !conversationId) return false;

  try {
    const now = new Date().toISOString();
    const serialized = serializeMessages(messages);

    const { error } = await db
      .from('ai_conversations')
      .update({
        messages_json: serialized,
        updated_at: now,
      })
      .eq('id', conversationId);

    if (error) {
      logger.warn('[ai-memory] saveConversationMessages error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    logger.warn('[ai-memory] saveConversationMessages exception:', err);
    return false;
  }
}

/**
 * Update the title of a conversation.
 */
export async function updateConversationTitle(
  conversationId: string,
  title: string,
): Promise<boolean> {
  if (!isLocalMode() || !conversationId) return false;

  try {
    const { error } = await db
      .from('ai_conversations')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    if (error) {
      logger.warn('[ai-memory] updateConversationTitle error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    logger.warn('[ai-memory] updateConversationTitle exception:', err);
    return false;
  }
}

/**
 * List all conversations for a user (metadata only, no messages).
 * Ordered by most recently updated first.
 */
export async function listConversations(
  userId: string,
): Promise<AIConversationMeta[]> {
  if (!isLocalMode()) return [];

  try {
    const { data, error } = await db
      .from('ai_conversations')
      .select('id, user_id, title, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      logger.warn('[ai-memory] listConversations error:', error.message);
      return [];
    }

    return (data as AIConversationMeta[]) || [];
  } catch (err) {
    logger.warn('[ai-memory] listConversations exception:', err);
    return [];
  }
}

/**
 * Load a full conversation including messages.
 */
export async function loadConversation(
  conversationId: string,
): Promise<AIConversation | null> {
  if (!isLocalMode()) return null;

  try {
    const { data, error } = await db
      .from('ai_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (error || !data) {
      logger.warn('[ai-memory] loadConversation error:', error?.message);
      return null;
    }

    const row = data as any;
    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      messages_json: deserializeMessages(row.messages_json),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  } catch (err) {
    logger.warn('[ai-memory] loadConversation exception:', err);
    return null;
  }
}

/**
 * Delete a conversation.
 */
export async function deleteConversation(
  conversationId: string,
): Promise<boolean> {
  if (!isLocalMode()) return false;

  try {
    const { error } = await db
      .from('ai_conversations')
      .delete()
      .eq('id', conversationId);

    if (error) {
      logger.warn('[ai-memory] deleteConversation error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    logger.warn('[ai-memory] deleteConversation exception:', err);
    return false;
  }
}