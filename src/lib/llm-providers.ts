/**
 * LLM Provider Definitions — Client-side metadata only.
 * Actual API calls go through the server-side proxy (api/llm-proxy.php).
 * No API keys are stored or transmitted from the client.
 */

export interface LLMModel {
  id: string;
  name: string;
  tier: 'free' | 'cheap' | 'standard' | 'premium';
}

export interface LLMProviderInfo {
  id: string;
  name: string;
  icon: string;
  models: LLMModel[];
  defaultModel: string;
}

export const LLM_PROVIDERS: LLMProviderInfo[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '🔷',
    defaultModel: 'gemini-2.5-flash',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tier: 'free' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', tier: 'free' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    icon: '🟠',
    defaultModel: 'claude-haiku-3-5-20241022',
    models: [
      { id: 'claude-haiku-3-5-20241022', name: 'Claude 3.5 Haiku', tier: 'cheap' },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', tier: 'standard' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🟢',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', tier: 'cheap' },
      { id: 'gpt-4o', name: 'GPT-4o', tier: 'standard' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', tier: 'cheap' },
      { id: 'gpt-4.1', name: 'GPT-4.1', tier: 'standard' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: '🌐',
    defaultModel: 'google/gemini-2.0-flash-001',
    models: [
      { id: 'google/gemini-2.0-flash-001', name: 'Gemini Flash (free)', tier: 'free' },
      { id: 'anthropic/claude-haiku-3-5-20241022', name: 'Claude Haiku', tier: 'cheap' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', tier: 'cheap' },
    ],
  },
];

export function getProviderInfo(id: string): LLMProviderInfo | undefined {
  return LLM_PROVIDERS.find(p => p.id === id);
}

export function getDefaultModel(providerId: string): string {
  return getProviderInfo(providerId)?.defaultModel || 'gemini-2.5-flash';
}

export const TIER_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: 'Free', color: '#22C55E' },
  cheap: { label: '$', color: '#FACC15' },
  standard: { label: '$$', color: '#F97316' },
  premium: { label: '$$$', color: '#EF4444' },
};
