/**
 * LifeOS Intent Engine — AI Settings
 *
 * Read/write AI provider settings from localStorage.
 */

import type { AISettings } from './types';

// ─── Settings helpers ────────────────────────────────────────────

const AI_SETTINGS_KEY = 'lifeos-ai-settings';

const ALLOWED_PROVIDERS = ['openrouter', 'gemini', 'anthropic', 'openai'];

export function getAISettings(): AISettings {
  const defaults: AISettings = {
    provider: 'openrouter',
    model: 'google/gemini-2.0-flash-001',
    proxyUrl: '/api/llm-proxy.php',
    enabled: true,
  };
  try {
    const stored = localStorage.getItem(AI_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migrate from expired Gemini direct → OpenRouter
      if (parsed.provider === 'gemini') {
        parsed.provider = 'openrouter';
        parsed.model = 'google/gemini-2.0-flash-001';
        try { localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(parsed)); } catch { /* Safari private */ }
      }
      // Force provider to OpenRouter if saved provider isn't configured
      if (!ALLOWED_PROVIDERS.includes(parsed.provider)) {
        parsed.provider = 'openrouter';
        parsed.model = 'google/gemini-2.0-flash-001';
        try { localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(parsed)); } catch { /* Safari private */ }
      }
      return { ...defaults, ...parsed };
    }
  } catch { /* ignore */ }
  return defaults;
}

export function saveAISettings(settings: AISettings): void {
  try { localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Safari private */ }
}