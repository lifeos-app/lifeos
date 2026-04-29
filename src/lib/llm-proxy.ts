/**
 * LLM Proxy Client — ALL LLM calls go through the server-side proxy.
 * 
 * This ensures:
 * 1. API keys stay server-side (never exposed in client JS)
 * 2. Referer-restricted keys work regardless of which domain the user is on
 * 3. Rate limiting is enforced server-side
 * 4. Single point of configuration for provider/model changes
 */

import { supabase } from './data-access';
import { useUserStore } from '../stores/useUserStore';
import { getErrorMessage, isAbortError } from '../utils/error';
import { trackAICall } from './ai-cost-tracker';

const PROXY_URL = '/api/llm-proxy.php';
const DEFAULT_TIMEOUT_MS = 30000;

export interface LLMProxyOptions {
  provider?: string;
  model?: string;
  timeoutMs?: number;
  /** If true, skips Supabase auth token (for unauthenticated flows) */
  skipAuth?: boolean;
  /** Response format: 'text' (default) or 'json'. Controls provider-level JSON mode. */
  format?: 'text' | 'json';
  /** Source label for AI usage tracking (e.g. 'zeroclaw', 'intent', 'oracle') */
  _source?: string;
}

export interface LLMProxyResponse {
  content: string;
  provider: string;
  model: string;
  usage?: { input_tokens: number | null; output_tokens: number | null };
  rateLimit?: { remaining: number; limit: number; used: number; resetAt: number; resetIn: number };
}

/**
 * Call the LLM via the server-side proxy.
 * Accepts either a simple prompt string or structured messages.
 */
async function _callLLMProxyOnce(
  input: string | { role: string; content: string }[],
  options: LLMProxyOptions = {},
): Promise<LLMProxyResponse> {
  const {
    provider = 'openrouter',
    model,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    skipAuth = false,
    format = 'text',
  } = options;

  // Build messages array
  const messages = typeof input === 'string'
    ? [{ role: 'user', content: input }]
    : input;

  // Get auth token if needed
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!skipAuth) {
    const { data: { session } } = await useUserStore.getState().getSessionCached();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages, provider, model, format, ...(skipAuth ? { skipAuth: true } : {}) }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      const errMsg = err.error || `Proxy error: ${res.status}`;

      // On 401 (token expired), force-refresh the Supabase session and retry once
      if (res.status === 401 && !skipAuth) {
        try {
          const { data: refreshData } = await supabase.auth.refreshSession();
          if (refreshData.session?.access_token) {
            // Retry with fresh token
            const retryHeaders = { ...headers, Authorization: `Bearer ${refreshData.session.access_token}` };
            const retryController = new AbortController();
            const retryTimeout = setTimeout(() => retryController.abort(), timeoutMs);
            try {
              const retryRes = await fetch(PROXY_URL, {
                method: 'POST',
                headers: retryHeaders,
                body: JSON.stringify({ messages, provider, model, format }),
                signal: retryController.signal,
              });
              clearTimeout(retryTimeout);
              if (retryRes.ok) return await retryRes.json();
            } catch {
              clearTimeout(retryTimeout);
            }
          }
        } catch {
          // Refresh failed — fall through to throw original error
        }
      }

      throw new Error(errMsg);
    }

    return await res.json();
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (isAbortError(err)) {
      throw new Error('LLM request timed out');
    }
    throw err;
  }
}

export async function callLLMProxy(
  input: string | { role: string; content: string }[],
  options: LLMProxyOptions = {},
): Promise<LLMProxyResponse> {
  const startTime = Date.now();
  try {
    const result = await _callLLMProxyOnce(input, options);
    // ── Track AI usage (fire-and-forget) ──
    const latency = Date.now() - startTime;
    const promptStr = typeof input === 'string' ? input : input.map(m => m.content).join('');
    const tokensIn = result.usage?.input_tokens ?? Math.ceil(promptStr.length / 4);
    const tokensOut = result.usage?.output_tokens ?? Math.ceil((result.content || '').length / 4);
    const userId = useUserStore.getState().user?.id || '';
    try {
      trackAICall({
        model: result.model || options.model || 'unknown',
        tokensIn,
        tokensOut,
        source: options._source || 'unknown',
        latencyMs: latency,
        userId,
      });
    } catch { /* tracking failure must not break LLM calls */ }
    return result;
  } catch (err) {
    // Don't retry timeouts (abort errors) — they're intentional
    if (err instanceof Error && err.message === 'LLM request timed out') throw err;
    // Wait 2s then retry once
    await new Promise(r => setTimeout(r, 2000));
    const startTime2 = Date.now();
    const result = await _callLLMProxyOnce(input, options);
    // ── Track AI usage on retry success (fire-and-forget) ──
    const latency = Date.now() - startTime2;
    const promptStr = typeof input === 'string' ? input : input.map(m => m.content).join('');
    const tokensIn = result.usage?.input_tokens ?? Math.ceil(promptStr.length / 4);
    const tokensOut = result.usage?.output_tokens ?? Math.ceil((result.content || '').length / 4);
    const userId = useUserStore.getState().user?.id || '';
    try {
      trackAICall({
        model: result.model || options.model || 'unknown',
        tokensIn,
        tokensOut,
        source: options._source || 'unknown',
        latencyMs: latency,
        userId,
      });
    } catch { /* tracking failure must not break LLM calls */ }
    return result;
  }
}

/**
 * Simple helper: send a prompt, get back the text content.
 * Handles JSON parsing if the response is JSON.
 */
export async function callLLMSimple(
  prompt: string,
  options: LLMProxyOptions = {},
): Promise<string> {
  const response = await callLLMProxy(prompt, options);
  return response.content;
}

/**
 * Helper: send a prompt and parse the response as JSON.
 * The proxy requests responseMimeType: application/json from Gemini.
 */
export async function callLLMJson<T = any>(
  prompt: string,
  options: LLMProxyOptions = {},
): Promise<T> {
  const response = await callLLMProxy(prompt, { ...options, format: 'json' });
  const text = response.content;

  // Try to parse JSON — handle markdown code fences
  let jsonStr = text.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  return JSON.parse(jsonStr);
}
