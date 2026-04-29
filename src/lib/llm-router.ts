/**
 * LLM Router — Multi-Provider Federation
 *
 * Routes LLM calls across multiple providers with priority-based
 * selection and automatic fallback on failure.
 *
 * Default config preserves backward compatibility: LOCAL_OLLAMA
 * at http://localhost:11434/v1 mirrors the existing llm-proxy setup.
 */

import { callLLMProxy, type LLMProxyOptions, type LLMProxyResponse } from './llm-proxy';

// Re-export for consumer convenience
export type { LLMProxyOptions, LLMProxyResponse };

// ─── Types ─────────────────────────────────────────────────────────────────────

export enum LLMProvider {
  LOCAL_OLLAMA = 'local_ollama',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  CUSTOM = 'custom',
}

export interface LLMProviderConfig {
  id: string;
  name: string;
  type: LLMProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  priority: number;        // 1 = highest priority
  maxTokens: number;
  temperature: number;
}

export interface LLMRouteOptions extends LLMProxyOptions {
  /** Skip the router and call the provider directly by id */
  providerId?: string;
  /** If true, tries all enabled providers in priority order on failure */
  fallback?: boolean;
}

export type ProviderHealthStatus = 'healthy' | 'unhealthy' | 'disabled' | 'unknown';

export interface ProviderHealthResult {
  id: string;
  status: ProviderHealthStatus;
  latencyMs?: number;
  error?: string;
}

// ─── Predefined models per provider type ──────────────────────────────────────

export const PROVIDER_MODELS: Record<LLMProvider, string[]> = {
  [LLMProvider.LOCAL_OLLAMA]: ['gemma4:e2b', 'glm-5.1:cloud'],
  [LLMProvider.OPENAI]: ['gpt-4o', 'gpt-4o-mini'],
  [LLMProvider.ANTHROPIC]: ['claude-sonnet-4'],
  [LLMProvider.GOOGLE]: ['gemini-2.5-flash'],
  [LLMProvider.CUSTOM]: [],
};

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'lifeos_llm_providers';
const API_KEY_PREFIX = 'lifeos_llm_key_';

function loadProvidersFromStorage(): LLMProviderConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LLMProviderConfig[];
  } catch {
    return [];
  }
}

function saveProvidersToStorage(providers: LLMProviderConfig[]): void {
  try {
    // Store API keys separately so they're not in the main config blob
    for (const p of providers) {
      if (p.apiKey) {
        localStorage.setItem(API_KEY_PREFIX + p.id, p.apiKey);
      } else {
        localStorage.removeItem(API_KEY_PREFIX + p.id);
      }
    }
    // Save config without API keys
    const sanitized = providers.map(p => ({ ...p, apiKey: '' }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // Safari private browsing
  }
}

function loadApiKey(providerId: string): string {
  try {
    return localStorage.getItem(API_KEY_PREFIX + providerId) || '';
  } catch {
    return '';
  }
}

// ─── Default provider (matches existing proxy setup) ──────────────────────────

const DEFAULT_PROVIDERS: LLMProviderConfig[] = [
  {
    id: 'local-ollama',
    name: 'Local Ollama',
    type: LLMProvider.LOCAL_OLLAMA,
    baseUrl: 'http://localhost:11434/v1',
    apiKey: '',
    model: 'gemma4:e2b',
    enabled: true,
    priority: 1,
    maxTokens: 4096,
    temperature: 0.7,
  },
];

// ─── LLMRouter ─────────────────────────────────────────────────────────────────

class LLMRouter {
  private providers: Map<string, LLMProviderConfig> = new Map();
  private healthCache: Map<string, ProviderHealthResult> = new Map();

  constructor() {
    this._loadFromStorage();
  }

  /** Register (or replace) a provider config */
  registerProvider(config: LLMProviderConfig): void {
    this.providers.set(config.id, config);
    this._persist();
  }

  /** Remove a provider by id */
  removeProvider(id: string): void {
    this.providers.delete(id);
    this.healthCache.delete(id);
    try {
      localStorage.removeItem(API_KEY_PREFIX + id);
    } catch { /* noop */ }
    this._persist();
  }

  /** Get a single provider config by id */
  getProvider(id: string): LLMProviderConfig | undefined {
    const config = this.providers.get(id);
    if (!config) return undefined;
    // Rehydrate API key from separate storage
    return { ...config, apiKey: loadApiKey(config.id) };
  }

  /** Get all enabled providers sorted by priority (ascending) */
  getActiveProviders(): LLMProviderConfig[] {
    return Array.from(this.providers.values())
      .filter(p => p.enabled)
      .sort((a, b) => a.priority - b.priority)
      .map(p => ({ ...p, apiKey: loadApiKey(p.id) }));
  }

  /** Get all providers (including disabled), sorted by priority */
  getAllProviders(): LLMProviderConfig[] {
    return Array.from(this.providers.values())
      .sort((a, b) => a.priority - b.priority)
      .map(p => ({ ...p, apiKey: loadApiKey(p.id) }));
  }

  /**
   * Route a request to the highest-priority enabled provider.
   * This is the main entry point that replaces direct callLLMProxy calls.
   */
  async routeRequest(
    prompt: string | { role: string; content: string }[],
    options: LLMRouteOptions = {},
  ): Promise<LLMProxyResponse> {
    const { providerId, fallback = false, ...llmOptions } = options;

    // Direct call to specific provider
    if (providerId) {
      return this.callProvider(providerId, prompt, llmOptions);
    }

    // Fallback chain across all enabled providers
    if (fallback) {
      return this.fallbackChain(prompt, llmOptions);
    }

    // Default: route to highest-priority enabled provider via the existing proxy
    // This preserves backward compatibility — calls go through /api/llm-proxy.php
    return callLLMProxy(prompt, llmOptions);
  }

  /**
   * Try providers in priority order. On failure, fall back to the next.
   * Cloud providers call their APIs directly; LOCAL_OLLAMA goes through the server proxy.
   */
  async fallbackChain(
    prompt: string | { role: string; content: string }[],
    options: LLMProxyOptions = {},
  ): Promise<LLMProxyResponse> {
    const active = this.getActiveProviders();
    if (active.length === 0) {
      // No providers configured — fall back to the server proxy (backward compat)
      return callLLMProxy(prompt, options);
    }

    let lastError: Error | null = null;
    for (const provider of active) {
      try {
        return await this._callProviderDirect(provider, prompt, options);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[LLMRouter] Provider "${provider.name}" failed, trying next:`, lastError.message);
      }
    }

    // All providers failed — try the server proxy as last resort
    try {
      return await callLLMProxy(prompt, options);
    } catch (err) {
      throw lastError || err;
    }
  }

  /** Direct call to a specific provider by id */
  async callProvider(
    providerId: string,
    prompt: string | { role: string; content: string }[],
    options: LLMProxyOptions = {},
  ): Promise<LLMProxyResponse> {
    const config = this.getProvider(providerId);
    if (!config) {
      throw new Error(`LLM Router: unknown provider "${providerId}"`);
    }
    if (!config.enabled) {
      throw new Error(`LLM Router: provider "${config.name}" is disabled`);
    }
    return this._callProviderDirect(config, prompt, options);
  }

  /**
   * Check if a provider is reachable.
   * For LOCAL_OLLAMA: ping /api/tags
   * For cloud providers: ping the /models or /v1/models endpoint
   */
  async checkProviderHealth(id: string): Promise<ProviderHealthResult> {
    const config = this.getProvider(id);
    if (!config) {
      return { id, status: 'unknown', error: 'Provider not found' };
    }
    if (!config.enabled) {
      return { id, status: 'disabled' };
    }

    const start = Date.now();
    try {
      const healthUrl = this._getHealthEndpoint(config);
      const headers: Record<string, string> = {};
      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(healthUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const latencyMs = Date.now() - start;
      const result: ProviderHealthResult = {
        id,
        status: res.ok ? 'healthy' : 'unhealthy',
        latencyMs,
        error: res.ok ? undefined : `HTTP ${res.status}`,
      };
      this.healthCache.set(id, result);
      return result;
    } catch (err) {
      const result: ProviderHealthResult = {
        id,
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
      this.healthCache.set(id, result);
      return result;
    }
  }

  /** Get the cached health status for a provider */
  getCachedHealth(id: string): ProviderHealthResult | undefined {
    return this.healthCache.get(id);
  }

  /** Get the number of configured providers */
  get size(): number {
    return this.providers.size;
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  /**
   * Direct call to a provider.
   * LOCAL_OLLAMA uses the server-side proxy for backward compat.
   * Cloud / custom providers call their API directly from the client.
   */
  private async _callProviderDirect(
    config: LLMProviderConfig,
    prompt: string | { role: string; content: string }[],
    options: LLMProxyOptions = {},
  ): Promise<LLMProxyResponse> {
    // For LOCAL_OLLAMA and default: use the existing server proxy
    // This preserves the current auth, rate-limiting, and key-hiding behavior
    if (config.type === LLMProvider.LOCAL_OLLAMA) {
      return callLLMProxy(prompt, {
        ...options,
        provider: 'openrouter', // the proxy routes to the local model
        model: config.model,
      });
    }

    // For cloud providers: call their OpenAI-compatible /chat/completions endpoint
    const messages = typeof prompt === 'string'
      ? [{ role: 'user' as const, content: prompt }]
      : prompt;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const url = this._getChatCompletionsUrl(config);
    const body = JSON.stringify({
      model: config.model,
      messages,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 30000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(`Provider "${config.name}" error: ${res.status} — ${errText}`);
      }

      const data = await res.json();
      // Normalize OpenAI-compatible response format
      const content = data?.choices?.[0]?.message?.content || '';
      const usage = data?.usage;

      return {
        content,
        provider: config.type,
        model: config.model,
        usage: usage
          ? {
              input_tokens: usage.prompt_tokens ?? null,
              output_tokens: usage.completion_tokens ?? null,
            }
          : undefined,
      };
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Provider "${config.name}" timed out`);
      }
      throw err;
    }
  }

  private _getChatCompletionsUrl(config: LLMProviderConfig): string {
    const base = config.baseUrl.replace(/\/+$/, '');
    if (config.type === LLMProvider.ANTHROPIC) {
      return `${base}/v1/messages`;
    }
    return `${base}/chat/completions`;
  }

  private _getHealthEndpoint(config: LLMProviderConfig): string {
    const base = config.baseUrl.replace(/\/+$/, '');
    if (config.type === LLMProvider.LOCAL_OLLAMA) {
      return `${base.replace(/\/v1$/, '')}/api/tags`;
    }
    if (config.type === LLMProvider.ANTHROPIC) {
      return `${base}/v1/models`;
    }
    return `${base}/models`;
  }

  private _loadFromStorage(): void {
    const stored = loadProvidersFromStorage();
    if (stored.length > 0) {
      for (const p of stored) {
        this.providers.set(p.id, { ...p, apiKey: loadApiKey(p.id) });
      }
    } else {
      // First run: seed with default providers
      for (const p of DEFAULT_PROVIDERS) {
        this.providers.set(p.id, p);
      }
      this._persist();
    }
  }

  private _persist(): void {
    saveProvidersToStorage(Array.from(this.providers.values()));
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: LLMRouter | null = null;

export function getLLMRouter(): LLMRouter {
  if (!_instance) {
    _instance = new LLMRouter();
  }
  return _instance;
}

/** Reset the singleton (for tests) */
export function _resetRouter(): void {
  _instance = null;
}

/**
 * Federation-aware LLM call — convenience wrapper over getLLMRouter().routeRequest().
 * Routes to the highest-priority enabled provider, with optional fallback chain.
 *
 * By default (no providerId, no fallback), this behaves identically to callLLMProxy
 * for full backward compatibility. All existing LLM calls continue to work unchanged.
 *
 * Usage:
 *   import { callLLMRouted } from '../lib/llm-router';
 *   const result = await callLLMRouted(prompt);                    // same as callLLMProxy
 *   const result = await callLLMRouted(prompt, { fallback: true }) // tries all providers
 *   const result = await callLLMRouted(prompt, { providerId: 'openai' }) // direct
 */
export async function callLLMRouted(
  input: string | { role: string; content: string }[],
  options: LLMRouteOptions = {},
): Promise<LLMProxyResponse> {
  const router = getLLMRouter();
  return router.routeRequest(input, options);
}