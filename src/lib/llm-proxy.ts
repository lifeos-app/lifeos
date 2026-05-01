/**
 * LLM Proxy Client — Routes LLM calls through the configured provider.
 * 
 * When provider is 'ollama', calls Ollama directly at localhost:11434/v1
 * with SSE streaming support for real-time token delivery.
 * 
 * For other providers (openrouter, gemini, anthropic, openai), falls back
 * to the server-side PHP proxy for API key security.
 */

import { supabase } from './data-access';
import { useUserStore } from '../stores/useUserStore';
import { getErrorMessage, isAbortError } from '../utils/error';
import { trackAICall } from './ai-cost-tracker';

const PROXY_URL = '/api/llm-proxy.php';
const DEFAULT_TIMEOUT_MS = 60000;

// Ollama direct config
const OLLAMA_BASE_URL = 'http://localhost:11434';

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
  /** Optional streaming callback — receives tokens as they arrive (Ollama only) */
  onStreamToken?: (token: string) => void;
  /** Optional abort signal for cancelling requests */
  signal?: AbortSignal;
}

export interface LLMProxyResponse {
  content: string;
  provider: string;
  model: string;
  usage?: { input_tokens: number | null; output_tokens: number | null };
  rateLimit?: { remaining: number; limit: number; used: number; resetAt: number; resetIn: number };
}

// ─── Direct Ollama Call (SSE Streaming) ─────────────────────────────

/**
 * Call Ollama directly with SSE streaming support.
 * Reuses the streaming pattern from Sage.tsx.
 */
async function callOllamaDirect(
  input: string | { role: string; content: string }[],
  options: LLMProxyOptions = {},
): Promise<LLMProxyResponse> {
  const {
    model = 'glm-5.1:cloud',
    timeoutMs = DEFAULT_TIMEOUT_MS,
    onStreamToken,
    signal,
  } = options;

  // Build messages array
  const messages = typeof input === 'string'
    ? [{ role: 'user', content: input }]
    : input;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // Link external signal if provided
  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        stream: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`Ollama error (${res.status}): ${errText}`);
    }

    // If no streaming callback, fall back to non-streaming parse
    if (!onStreamToken) {
      // Read full response — Ollama still streams, but we collect it all
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream from Ollama');

      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') break;

          try {
            const chunk = JSON.parse(data);
            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
              fullText += delta.content;
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }

      return {
        content: fullText,
        provider: 'ollama',
        model,
        usage: { input_tokens: null, output_tokens: null },
      };
    }

    // SSE streaming path — feed tokens to callback as they arrive
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response stream from Ollama');

    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') break;

        try {
          const chunk = JSON.parse(data);
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            fullText += delta.content;
            // Use requestAnimationFrame for smooth UI updates
            const token = delta.content;
            await new Promise<void>(resolve => {
              requestAnimationFrame(() => {
                onStreamToken(token);
                resolve();
              });
            });
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }

    return {
      content: fullText,
      provider: 'ollama',
      model,
      usage: { input_tokens: null, output_tokens: null },
    };
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (isAbortError(err) || (err instanceof Error && err.name === 'AbortError')) {
      throw new Error('LLM request timed out');
    }
    throw err;
  }
}

// ─── PHP Proxy Path (OpenRouter/Gemini/Anthropic/OpenAI) ────────────

/**
 * Call the LLM via the server-side PHP proxy.
 * Accepts either a simple prompt string or structured messages.
 */
async function _callLLMProxyOnce(
  input: string | { role: string; content: string }[],
  options: LLMProxyOptions = {},
): Promise<LLMProxyResponse> {
  const {
    provider = 'ollama',
    model,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    skipAuth = false,
    format = 'text',
  } = options;

  // ── Direct Ollama path ──
  if (provider === 'ollama') {
    return callOllamaDirect(input, options);
  }

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
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

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
    // Don't retry Ollama errors — they're local and fast to re-try from caller
    if (options.provider === 'ollama') throw err;
    // Wait 2s then retry once for proxy errors
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

// ─── Ollama Health Check ────────────────────────────────────────────

export interface OllamaStatus {
  available: boolean;
  models: string[];
  error?: string;
}

/**
 * Check if Ollama is running and list available models.
 * Hits localhost:11434/v1/models.
 */
export async function checkOllamaConnection(): Promise<OllamaStatus> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/v1/models`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { available: false, models: [], error: `HTTP ${res.status}` };
    const data = await res.json();
    const models = data.data?.map((m: { id: string }) => m.id) || [];
    return { available: true, models };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { available: false, models: [], error: msg };
  }
}