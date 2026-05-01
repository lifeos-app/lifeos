/**
 * LifeOS Intent Engine — Main Orchestrator
 *
 * callIntentEngine() sends the user message through:
 * 1. Quick classifier patterns (no LLM)
 * 2. Shorthand parser (no LLM)
 * 3. Direct Ollama call (when provider is 'ollama')
 * 4. Unified Intent API (server-side, for cloud providers)
 * 5. Legacy direct-LLM proxy (fallback)
 */

import { useUserStore } from '../../stores/useUserStore';
import { quickClassify, validateIntentResult } from '../llm/response-patterns';
import { logger } from '../../utils/logger';
import type { IntentResult, IntentContext, RateLimitInfo, IntentAction } from './types';
import { buildSystemPrompt } from './system-prompt';
import { parseShorthand } from './shorthand-parser';
import { searchDatabase } from './action-executor';
import { trackAICall } from '../ai-cost-tracker';

// ─── Proxy Config ────────────────────────────────────────────────

interface ProxyConfig {
  provider: string;
  model?: string;
  proxyUrl: string;
}

const DEFAULT_PROXY_CONFIG: ProxyConfig = {
  provider: 'ollama',
  model: 'glm-5.1:cloud',
  proxyUrl: 'http://localhost:11434/v1',  // Direct Ollama (no PHP proxy)
};

// Legacy config for fallback (PHP proxy — only works on cloud deployments)
const LEGACY_PROXY_CONFIG: ProxyConfig = {
  provider: 'openrouter',
  model: 'google/gemini-2.0-flash-001',
  proxyUrl: '/api/llm-proxy.php',
};

// ─── Ollama Direct Call ──────────────────────────────────────────

const OLLAMA_BASE_URL = 'http://localhost:11434';

/**
 * Call Ollama directly for intent processing (non-streaming).
 * Returns raw text content from Ollama.
 */
async function callOllamaForIntent(
  messages: { role: string; content: string }[],
  model: string,
  signal?: AbortSignal,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
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
        temperature: 0.3,  // Lower temp for structured intent output
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      // Try reading as SSE stream (Ollama sometimes returns streaming even when stream: false)
      // If it's not JSON, try reading the stream
      try {
        const data = JSON.parse(errText);
        throw new Error(data.error?.message || data.error || `Ollama error ${res.status}`);
      } catch {
        // Not JSON — might be streaming response
      }
      throw new Error(`Ollama error (${res.status}): ${errText.slice(0, 200)}`);
    }

    // Try to read as non-streaming first
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream') || contentType.includes('application/json')) {
      // Might be streaming — read as stream
      const reader = res.body?.getReader();
      if (reader) {
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
              // Also check for non-streaming format
              const msg = chunk.choices?.[0]?.message;
              if (msg?.content) {
                fullText = msg.content;
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }
        return fullText;
      }
    }

    // Standard non-streaming response
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && (err.name === 'AbortError' || err.message === 'LLM request timed out')) {
      throw new Error('Intent engine timed out');
    }
    throw err;
  }
}

// ─── Main Entry Point ───────────────────────────────────────────

export async function callIntentEngine(
  userMessage: string,
  context: IntentContext,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  config: Partial<ProxyConfig> = {},
  abortSignal?: AbortSignal,
): Promise<IntentResult> {
  // ── Try pre-classifier patterns first (no LLM needed) ──
  const quick = quickClassify(userMessage, context.userId);
  if (quick) return quick;

  // ── Try shorthand parser (no LLM needed) ──
  const shorthand = parseShorthand(userMessage, context);
  if (shorthand) return shorthand;

  const cfg = { ...DEFAULT_PROXY_CONFIG, ...config };
  const intentStartTime = Date.now();

  // 60-second timeout to prevent indefinite hangs on proxy failure
  const INTENT_TIMEOUT_MS = 60_000;
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), INTENT_TIMEOUT_MS);
  if (abortSignal) {
    abortSignal.addEventListener('abort', () => timeoutController.abort());
  }
  const effectiveSignal = timeoutController.signal;

  try {

  // ─── Direct Ollama Path ────────────────────────────────────
  if (cfg.provider === 'ollama') {
    const systemPrompt = buildSystemPrompt(context);
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user' as const, content: userMessage },
    ];

    const content = await callOllamaForIntent(messages, cfg.model || 'glm-5.1:cloud', effectiveSignal);

    // Parse the JSON response — handle models that wrap JSON in conversational text
    return parseIntentResponse(content, messages, cfg, context, effectiveSignal);
  }

  // ─── Cloud Provider Paths (require auth) ───────────────────
  const { data: { session } } = await useUserStore.getState().getSessionCached();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  // ─── Unified Intent API path ────────────────────────────────
  // Sends message to the shared intent API which builds its own context server-side
  if (cfg.proxyUrl.includes('intent-proxy')) {
    const res = await fetch(cfg.proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        message: userMessage,
        context: { userName: context.userName },
        history: history.slice(-6),  // Last 6 messages for conversation context
      }),
      signal: effectiveSignal,
    });

    if (!res.ok) {
      // Fallback to legacy proxy on unified API failure
      logger.warn('Unified intent API failed, falling back to legacy proxy');
      return callIntentEngine(userMessage, context, history, { ...config, proxyUrl: LEGACY_PROXY_CONFIG.proxyUrl }, abortSignal);
    }

    const result = await res.json();
    // ── Track AI usage (fire-and-forget) ──
    try {
      const model = cfg.model || 'gemini-2.0-flash';
      trackAICall({
        model,
        tokensIn: Math.ceil(userMessage.length / 4),
        tokensOut: Math.ceil((result.reply || '').length / 4),
        source: 'intent',
        latencyMs: Date.now() - intentStartTime,
        userId: context.userId,
      });
    } catch { /* tracking failure must not break intent engine */ }
    return {
      actions: result.actions || [],
      reply: result.reply || 'Done.',
      needs_confirmation: result.needs_confirmation ?? true,
      follow_up: result.follow_up || undefined,
      rateLimit: result._meta ? { remaining: 999, limit: 1000, used: 1, resetAt: 0, resetIn: 0 } : undefined,
    };
  }

  // ─── Legacy direct-LLM path (fallback) ──────────────────────
  const systemPrompt = buildSystemPrompt(context);

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user' as const, content: userMessage },
  ];

  const res = await fetch(cfg.proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      messages,
      provider: cfg.provider,
      model: cfg.model,
    }),
    signal: abortSignal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    // Include full error body (with rateLimit) so caller can extract it
    throw new Error(JSON.stringify(err));
  }

  const llmResponse = await res.json();
  const content = llmResponse.content || '';
  const rateLimitData: RateLimitInfo | undefined = llmResponse.rateLimit || undefined;

  // ── Track AI usage for legacy path (fire-and-forget) ──
  const legacyModel = llmResponse.model || cfg.model || 'gemini-2.0-flash';
  const legacyTokensIn = llmResponse.usage?.input_tokens ?? Math.ceil(messages.map(m => m.content).join('').length / 4);
  const legacyTokensOut = llmResponse.usage?.output_tokens ?? Math.ceil(content.length / 4);
  try {
    trackAICall({
      model: legacyModel,
      tokensIn: legacyTokensIn,
      tokensOut: legacyTokensOut,
      source: 'intent-legacy',
      latencyMs: Date.now() - intentStartTime,
      userId: context.userId,
    });
  } catch { /* tracking failure must not break intent engine */ }

  return parseIntentResponse(content, messages, cfg, context, effectiveSignal, rateLimitData);

  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Intent Response Parser ─────────────────────────────────────

/**
 * Parse LLM response content into an IntentResult.
 * Handles JSON extraction from conversational text and search-then-act flows.
 */
async function parseIntentResponse(
  content: string,
  messages: { role: string; content: string }[],
  cfg: ProxyConfig,
  context: IntentContext,
  signal: AbortSignal,
  rateLimitData?: RateLimitInfo,
): Promise<IntentResult> {
  // Parse the JSON response — handle models that wrap JSON in conversational text
  let jsonContent = content;

  // If content doesn't start with '{', try to extract JSON from within the text
  const trimmed = content.trim();
  if (!trimmed.startsWith('{')) {
    // Try to find a JSON block (with or without markdown fences)
    const fencedMatch = trimmed.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    const rawMatch = trimmed.match(/(\{[\s\S]*"actions"\s*:\s*\[[\s\S]*"reply"\s*:\s*"[\s\S]*\})\s*$/);
    if (fencedMatch) {
      jsonContent = fencedMatch[1];
    } else if (rawMatch) {
      jsonContent = rawMatch[1];
    }
  }

  try {
    const parsed = JSON.parse(jsonContent);
    const result: IntentResult = {
      actions: parsed.actions || [],
      reply: parsed.reply || 'Done.',
      needs_confirmation: parsed.needs_confirmation ?? true,
      follow_up: parsed.follow_up || undefined,
      rateLimit: rateLimitData,
    };

    // ─── Search-then-act: if AI needs to find something ────────
    const searchAction = result.actions.find((a: IntentAction) => a.type === 'search');
    if (searchAction) {
      const { table, query, intent } = searchAction.data as { table: string; query: string; intent: string };
      const searchResults = await searchDatabase(context.userId, table, query);

      if (searchResults.length === 0) {
        return {
          actions: [{ type: 'info', data: { message: `Couldn't find anything matching "${query}".` }, summary: `No results for "${query}"`, confidence: 1 }],
          reply: `I searched your ${table} for "${query}" but didn't find anything. Could you be more specific?`,
          needs_confirmation: false,
        };
      }

      // Second LLM call with search results
      const searchContext = `\n\n## SEARCH RESULTS for "${query}" in ${table}:\n${searchResults.map((r: Record<string, unknown>) => JSON.stringify(r)).join('\n')}\n\nThe user wants to: ${intent}\nNow generate the correct update/delete action using the IDs from these results.`;

      const retryMessages = [
        ...messages,
        { role: 'assistant' as const, content: content },
        { role: 'user' as const, content: searchContext },
      ];

      // For Ollama, call directly; for others, use the proxy
      let retryContent: string;
      if (cfg.provider === 'ollama') {
        retryContent = await callOllamaForIntent(retryMessages, cfg.model || 'glm-5.1:cloud', signal);
      } else {
        const retryRes = await fetch(cfg.proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: retryMessages,
            provider: cfg.provider,
            model: cfg.model,
          }),
          signal,
        });

        if (retryRes.ok) {
          const retryLlm = await retryRes.json();
          retryContent = retryLlm.content || '';
        } else {
          // Retry failed, return original result
          return validateIntentResult(result);
        }
      }

      try {
        let retryJson = retryContent;
        if (!retryContent.trim().startsWith('{')) {
          const fm = retryContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
          const rm = retryContent.match(/(\{[\s\S]*"actions"\s*:\s*\[[\s\S]*"reply"\s*:\s*"[\s\S]*\})\s*$/);
          if (fm) retryJson = fm[1];
          else if (rm) retryJson = rm[1];
        }
        const retryParsed = JSON.parse(retryJson);
        return {
          actions: retryParsed.actions || [],
          reply: retryParsed.reply || 'Done.',
          needs_confirmation: retryParsed.needs_confirmation ?? true,
          follow_up: retryParsed.follow_up || undefined,
        };
      } catch {
        // Strip JSON artifacts from display
        const clean = retryContent
          .replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/g, '')
          .replace(/\{[\s\S]*"actions"\s*:[\s\S]*\}\s*$/g, '')
          .trim();
        return { actions: [], reply: clean || retryContent, needs_confirmation: false };
      }
    }

    return validateIntentResult(result);
  } catch {
    // If LLM didn't return valid JSON, try one more extraction attempt
    // Some models output: "Sure! Here's the result:\n{...json...}"
    try {
      const lastBrace = content.lastIndexOf('}');
      const firstBrace = content.indexOf('{');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        const extracted = content.substring(firstBrace, lastBrace + 1);
        const fallbackParsed = JSON.parse(extracted);
        if (fallbackParsed.reply) {
          return {
            actions: fallbackParsed.actions || [],
            reply: fallbackParsed.reply,
            needs_confirmation: fallbackParsed.needs_confirmation ?? true,
            follow_up: fallbackParsed.follow_up || undefined,
            rateLimit: rateLimitData,
          };
        }
      }
    } catch {
      // Truly not JSON — fall through
    }

    // Strip any JSON-like blocks from display text so users don't see raw JSON
    const cleanContent = content
      .replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/g, '')
      .replace(/\{[\s\S]*"actions"\s*:[\s\S]*"reply"\s*:[\s\S]*\}\s*$/g, '')
      .trim();

    return {
      actions: [{ type: 'info', data: { message: cleanContent || content }, summary: cleanContent || content, confidence: 0.5 }],
      reply: cleanContent || content,
      needs_confirmation: false,
    };
  }
}