/**
 * ai-local.ts — Local AI adapter for LifeOS
 * 
 * Replaces OpenRouter / remote LLM calls with local SentientTeddy Bridge
 * running at localhost:11435 (OpenAI-compatible API).
 * 
 * Features:
 *   - Streaming (SSE) chat completions
 *   - Non-streaming completions
 *   - Embeddings (if supported by bridge)
 *   - Works in both Tauri (via Rust HTTP proxy) and browser (via fetch)
 * 
 * The SentientTeddy Bridge wraps Ollama/local models with an OpenAI-compatible
 * API surface, so this adapter speaks the OpenAI chat format.
 * 
 * Created: 2026-03-27
 */

// ─── Config ──────────────────────────────────────────────────────────

const BRIDGE_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_BRIDGE_URL)
  ? import.meta.env.VITE_AI_BRIDGE_URL
  : 'http://localhost:11435';

const DEFAULT_MODEL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_MODEL)
  ? import.meta.env.VITE_AI_MODEL
  : 'llama3.2:3b';

declare const __IS_TAURI__: boolean;
let _isTauriCached: boolean | null = null;
function isTauriCheck(): boolean {
  if (_isTauriCached !== null) return _isTauriCached;
  if (typeof __IS_TAURI__ !== 'undefined' && __IS_TAURI__) {
    _isTauriCached = true;
    return true;
  }
  _isTauriCached = typeof window !== 'undefined' && (
    '__TAURI_INTERNALS__' in window || '__TAURI__' in window
  );
  return _isTauriCached;
}

// ─── Types ───────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
}

export interface ChatCompletionOptions {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface StreamDelta {
  role?: string;
  content?: string;
}

export interface StreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: StreamDelta;
    finish_reason: string | null;
  }>;
}

export interface EmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// ─── Tauri invoke helper ─────────────────────────────────────────────

let _invoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;

async function getTauriInvoke() {
  if (_invoke) return _invoke;
  if (!isTauriCheck()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    _invoke = invoke;
    return _invoke;
  } catch {
    return null;
  }
}

// ─── HTTP helpers ────────────────────────────────────────────────────

async function aiFetch(endpoint: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${BRIDGE_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Chat Completions (non-streaming) ────────────────────────────────

export async function chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
  const payload = {
    model: options.model || DEFAULT_MODEL,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens,
    top_p: options.top_p,
    frequency_penalty: options.frequency_penalty,
    presence_penalty: options.presence_penalty,
    stop: options.stop,
    stream: false,
  };

  // Try Tauri invoke first (Rust handles the HTTP call — avoids CORS)
  if (isTauriCheck()) {
    try {
      const invoke = await getTauriInvoke();
      if (invoke) {
        const result = await invoke('ai_chat_completion', { payload }) as ChatCompletionResponse;
        return result;
      }
    } catch {
      // Fall through to direct fetch
    }
  }

  const res = await aiFetch('/v1/chat/completions', payload);
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`AI Bridge error (${res.status}): ${err}`);
  }
  return res.json();
}

// ─── Chat Completions (streaming via SSE) ────────────────────────────

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export async function chatCompletionStream(
  options: ChatCompletionOptions,
  callbacks: StreamCallbacks
): Promise<string> {
  const payload = {
    model: options.model || DEFAULT_MODEL,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens,
    top_p: options.top_p,
    frequency_penalty: options.frequency_penalty,
    presence_penalty: options.presence_penalty,
    stop: options.stop,
    stream: true,
  };

  // In Tauri mode, we could route through Rust for CORS-free streaming,
  // but SSE parsing is simpler in JS. Tauri's webview allows localhost fetch.
  // If a Rust streaming command exists, use it; otherwise direct fetch.
  if (isTauriCheck()) {
    try {
      const invoke = await getTauriInvoke();
      if (invoke) {
        // Try Rust-side streaming (returns full text, calls back via events)
        const result = await invoke('ai_chat_stream', { payload }) as string;
        callbacks.onComplete?.(result);
        return result;
      }
    } catch {
      // Fall through to SSE fetch
    }
  }

  const res = await aiFetch('/v1/chat/completions', payload);
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    const error = new Error(`AI Bridge error (${res.status}): ${err}`);
    callbacks.onError?.(error);
    throw error;
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body for streaming');

  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6); // Remove 'data: ' prefix
        if (data === '[DONE]') {
          callbacks.onComplete?.(fullText);
          return fullText;
        }

        try {
          const chunk: StreamChunk = JSON.parse(data);
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            fullText += delta.content;
            callbacks.onToken?.(delta.content);
          }
        } catch {
          // Skip malformed JSON chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  callbacks.onComplete?.(fullText);
  return fullText;
}

// ─── Simple text generation helper ───────────────────────────────────

export async function generate(
  prompt: string,
  options?: Partial<ChatCompletionOptions>
): Promise<string> {
  const result = await chatCompletion({
    messages: [{ role: 'user', content: prompt }],
    ...options,
  });
  return result.choices[0]?.message?.content || '';
}

// ─── Streaming text generation helper ────────────────────────────────

export async function generateStream(
  prompt: string,
  onToken: (token: string) => void,
  options?: Partial<ChatCompletionOptions>
): Promise<string> {
  return chatCompletionStream(
    {
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      ...options,
    },
    { onToken }
  );
}

// ─── Embeddings ──────────────────────────────────────────────────────

export async function createEmbedding(
  input: string | string[],
  model?: string
): Promise<EmbeddingResponse> {
  const payload = {
    model: model || 'nomic-embed-text',
    input: Array.isArray(input) ? input : [input],
  };

  if (isTauriCheck()) {
    try {
      const invoke = await getTauriInvoke();
      if (invoke) {
        return await invoke('ai_embedding', { payload }) as EmbeddingResponse;
      }
    } catch {
      // Fall through
    }
  }

  const res = await aiFetch('/v1/embeddings', payload);
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Embedding error (${res.status}): ${err}`);
  }
  return res.json();
}

// ─── Health check ────────────────────────────────────────────────────

export async function checkBridgeHealth(): Promise<{
  available: boolean;
  models?: string[];
  error?: string;
}> {
  try {
    const res = await fetch(`${BRIDGE_BASE}/v1/models`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { available: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    const models = data.data?.map((m: { id: string }) => m.id) || [];
    return { available: true, models };
  } catch (err: unknown) {
    return { available: false, error: err.message };
  }
}

// ─── Exported config (for UI display) ────────────────────────────────

export const aiConfig = {
  bridgeUrl: BRIDGE_BASE,
  defaultModel: DEFAULT_MODEL,
  get isTauri() { return isTauriCheck(); },
  get backend() { return isTauriCheck() ? 'tauri-rust' as const : 'browser-fetch' as const; },
};

export default {
  chatCompletion,
  chatCompletionStream,
  generate,
  generateStream,
  createEmbedding,
  checkBridgeHealth,
  aiConfig,
};
