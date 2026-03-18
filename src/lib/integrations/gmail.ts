/**
 * Gmail Integration — API scaffolding
 *
 * All calls go through the server-side google-proxy.php endpoint
 * which holds the provider token securely.
 */

import { supabase } from '../supabase';
import { useUserStore } from '../../stores/useUserStore';
import { logger } from '../../utils/logger';

const PROXY_URL = '/api/google-proxy.php';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await useUserStore.getState().getSessionCached();
  if (!session?.access_token) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };
}

async function proxyRequest(action: string, params: Record<string, unknown> = {}) {
  const headers = await getAuthHeaders();
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ service: 'gmail', action, ...params }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `Gmail API error: ${res.status}`);
  }

  return res.json();
}

/**
 * Get unread email count
 */
export async function fetchUnreadCount(): Promise<number> {
  try {
    const data = await proxyRequest('unread_count');
    return data.count || 0;
  } catch (err) {
    logger.error('[Gmail] fetchUnreadCount failed:', err);
    return 0;
  }
}

/**
 * Fetch important/starred emails
 */
export async function fetchImportantEmails(limit = 10): Promise<GmailMessage[]> {
  try {
    const data = await proxyRequest('important_emails', { limit });
    return data.messages || [];
  } catch (err) {
    logger.error('[Gmail] fetchImportantEmails failed:', err);
    return [];
  }
}

/**
 * Convert an email into a LifeOS task
 */
export async function createTaskFromEmail(emailId: string): Promise<boolean> {
  try {
    const data = await proxyRequest('create_task_from_email', { emailId });
    if (data.success) {
      window.dispatchEvent(new Event('lifeos-refresh'));
    }
    return !!data.success;
  } catch (err) {
    logger.error('[Gmail] createTaskFromEmail failed:', err);
    return false;
  }
}

// Types
export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
  isStarred: boolean;
}
