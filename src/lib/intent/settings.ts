/**
 * LifeOS Intent Engine — AI Settings
 *
 * Read/write AI provider settings from localStorage.
 */

import type { AISettings } from './types';

// ─── Settings helpers ────────────────────────────────────────────

const AI_SETTINGS_KEY = 'lifeos-ai-settings';

export const ALLOWED_PROVIDERS = ['ollama', 'openrouter', 'gemini', 'anthropic', 'openai'];

/** Provider-specific defaults */
export const PROVIDER_DEFAULTS: Record<string, { model: string; proxyUrl: string }> = {
  ollama: { model: 'glm-5.1:cloud', proxyUrl: 'http://localhost:11434/v1' },
  openrouter: { model: 'google/gemini-2.0-flash-001', proxyUrl: '/api/llm-proxy.php' },
  gemini: { model: 'google/gemini-2.0-flash-001', proxyUrl: '/api/llm-proxy.php' },
  anthropic: { model: 'claude-3-haiku-20240307', proxyUrl: '/api/llm-proxy.php' },
  openai: { model: 'gpt-4o-mini', proxyUrl: '/api/llm-proxy.php' },
};

export function getAISettings(): AISettings {
  const defaults: AISettings = {
    provider: 'ollama',
    model: 'glm-5.1:cloud',
    proxyUrl: 'http://localhost:11434/v1',
    enabled: true,
  };
  try {
    const stored = localStorage.getItem(AI_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migrate from expired Gemini direct → Ollama
      if (parsed.provider === 'gemini') {
        parsed.provider = 'ollama';
        parsed.model = 'glm-5.1:cloud';
        parsed.proxyUrl = 'http://localhost:11434/v1';
        try { localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(parsed)); } catch { /* Safari private */ }
      }
      // Force provider to Ollama if saved provider isn't configured
      if (!ALLOWED_PROVIDERS.includes(parsed.provider)) {
        parsed.provider = 'ollama';
        parsed.model = 'glm-5.1:cloud';
        parsed.proxyUrl = 'http://localhost:11434/v1';
        try { localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(parsed)); } catch { /* Safari private */ }
      }
      // Ensure provider-specific defaults for model/proxyUrl if switching providers
      const provDefaults = PROVIDER_DEFAULTS[parsed.provider];
      if (provDefaults && !parsed.proxyUrl) {
        parsed.proxyUrl = provDefaults.proxyUrl;
      }
      return { ...defaults, ...parsed };
    }
  } catch { /* ignore */ }
  return defaults;
}

export function saveAISettings(settings: AISettings): void {
  try { localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Safari private */ }
}