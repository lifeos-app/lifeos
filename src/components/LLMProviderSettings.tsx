/**
 * LLM Provider Settings — Configure AI providers for the multi-LLM federation
 *
 * Allows users to add, remove, reorder, enable/disable, and test
 * connections to multiple LLM providers.
 */

import { useState, useCallback, type JSX } from 'react';
import {
  Cpu, Plus, ArrowUp, ArrowDown, Eye, EyeOff,
  Trash2, Plug, Unplug, Loader2, AlertTriangle,
  Check, X, RefreshCw,
} from 'lucide-react';
import {
  getLLMRouter,
  LLMProvider,
  PROVIDER_MODELS,
  type LLMProviderConfig,
  type ProviderHealthResult,
} from '../lib/llm-router';

// ─── Provider type options ────────────────────────────────────────────────────

const PROVIDER_TYPE_OPTIONS: { value: LLMProvider; label: string }[] = [
  { value: LLMProvider.LOCAL_OLLAMA, label: 'Local Ollama' },
  { value: LLMProvider.OPENAI, label: 'OpenAI' },
  { value: LLMProvider.ANTHROPIC, label: 'Anthropic' },
  { value: LLMProvider.GOOGLE, label: 'Google AI' },
  { value: LLMProvider.CUSTOM, label: 'Custom (OpenAI-compatible)' },
];

const DEFAULT_URLS: Record<string, string> = {
  [LLMProvider.LOCAL_OLLAMA]: 'http://localhost:11434/v1',
  [LLMProvider.OPENAI]: 'https://api.openai.com/v1',
  [LLMProvider.ANTHROPIC]: 'https://api.anthropic.com',
  [LLMProvider.GOOGLE]: 'https://generativelanguage.googleapis.com/v1beta',
  [LLMProvider.CUSTOM]: '',
};

function getDefaultModel(type: LLMProvider): string {
  const models = PROVIDER_MODELS[type];
  return models[0] || '';
}

// ─── Health status indicator ──────────────────────────────────────────────────

function HealthDot({ status }: { status: ProviderHealthResult['status'] }): JSX.Element {
  const colors: Record<string, string> = {
    healthy: '#22C55E',
    unhealthy: '#F43F5E',
    disabled: '#64748B',
    unknown: '#64748B',
  };
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: colors[status] || colors.unknown,
        flexShrink: 0,
      }}
      title={status}
    />
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function LLMProviderSettings(): JSX.Element {
  const router = getLLMRouter();
  const [providers, setProviders] = useState<LLMProviderConfig[]>(() => router.getAllProviders());
  const [showAddForm, setShowAddForm] = useState(false);
  const [healthResults, setHealthResults] = useState<Record<string, ProviderHealthResult>>({});
  const [testingId, setTestingId] = useState<string | null>(null);

  const refreshProviders = useCallback(() => {
    setProviders(router.getAllProviders());
  }, [router]);

  // ── Toggle enabled ──
  const handleToggleEnabled = useCallback((id: string) => {
    const p = router.getProvider(id);
    if (!p) return;
    router.registerProvider({ ...p, enabled: !p.enabled });
    refreshProviders();
  }, [router, refreshProviders]);

  // ── Remove provider ──
  const handleRemove = useCallback((id: string) => {
    router.removeProvider(id);
    refreshProviders();
  }, [router, refreshProviders]);

  // ── Move priority ──
  const handleMoveUp = useCallback((id: string) => {
    const sorted = router.getAllProviders();
    const idx = sorted.findIndex(p => p.id === id);
    if (idx <= 0) return;
    const current = sorted[idx];
    const above = sorted[idx - 1];
    router.registerProvider({ ...above, priority: current.priority });
    router.registerProvider({ ...current, priority: above.priority });
    refreshProviders();
  }, [router, refreshProviders]);

  const handleMoveDown = useCallback((id: string) => {
    const sorted = router.getAllProviders();
    const idx = sorted.findIndex(p => p.id === id);
    if (idx < 0 || idx >= sorted.length - 1) return;
    const current = sorted[idx];
    const below = sorted[idx + 1];
    router.registerProvider({ ...below, priority: current.priority });
    router.registerProvider({ ...current, priority: below.priority });
    refreshProviders();
  }, [router, refreshProviders]);

  // ── Test connection ──
  const handleTestConnection = useCallback(async (id: string) => {
    setTestingId(id);
    try {
      const result = await router.checkProviderHealth(id);
      setHealthResults(prev => ({ ...prev, [id]: result }));
    } catch {
      setHealthResults(prev => ({
        ...prev,
        [id]: { id, status: 'unhealthy', error: 'Health check failed' },
      }));
    } finally {
      setTestingId(null);
    }
  }, [router]);

  // ── Reveal API keys ──
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const toggleKeyReveal = (id: string) => {
    setRevealedKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="set-section">
      <div className="set-section-header">
        <Cpu size={18} />
        <h2>AI Providers</h2>
        <span className="set-badge" style={{ background: 'rgba(0,212,255,0.15)', color: '#00D4FF', marginLeft: 'auto' }}>
          {providers.filter(p => p.enabled).length}/{providers.length} active
        </span>
      </div>
      <p className="set-section-desc">
        Configure multiple LLM providers. Requests route to the highest-priority enabled provider
        and fall back automatically on failure.
      </p>

      {/* Warning banner about API key storage */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        background: 'rgba(244,63,94,0.06)',
        border: '1px solid rgba(244,63,94,0.15)',
        borderRadius: 8,
        marginBottom: 16,
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
      }}>
        <AlertTriangle size={14} style={{ color: '#F43F5E', flexShrink: 0 }} />
        <span>API keys are stored in your browser's localStorage. They are never sent to our servers,
          but browser storage is accessible to browser extensions and anyone with device access.
          Use API keys with limited scope when possible.</span>
      </div>

      {/* Provider list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {providers.map((provider) => {
          const health = healthResults[provider.id];
          const isTesting = testingId === provider.id;
          const keyRevealed = revealedKeys.has(provider.id);
          const maskedKey = provider.apiKey
            ? provider.apiKey.slice(0, 4) + '...' + provider.apiKey.slice(-4)
            : '(none)';

          return (
            <div key={provider.id} style={{
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${provider.enabled ? 'rgba(26,58,92,0.3)' : 'rgba(26,58,92,0.1)'}`,
              borderRadius: 10,
              padding: '12px 16px',
              opacity: provider.enabled ? 1 : 0.5,
            }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <HealthDot status={health?.status || (provider.enabled ? 'unknown' : 'disabled')} />
                <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{provider.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Priority {provider.priority}</span>

                {/* Priority arrows */}
                <button
                  onClick={() => handleMoveUp(provider.id)}
                  style={iconBtnStyle}
                  title="Move up"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  onClick={() => handleMoveDown(provider.id)}
                  style={iconBtnStyle}
                  title="Move down"
                >
                  <ArrowDown size={12} />
                </button>

                {/* Enable/disable toggle */}
                <button
                  onClick={() => handleToggleEnabled(provider.id)}
                  style={iconBtnStyle}
                  title={provider.enabled ? 'Disable' : 'Enable'}
                >
                  {provider.enabled ? <Plug size={12} /> : <Unplug size={12} />}
                </button>

                {/* Test connection */}
                <button
                  onClick={() => handleTestConnection(provider.id)}
                  disabled={isTesting || !provider.enabled}
                  style={iconBtnStyle}
                  title="Test connection"
                >
                  {isTesting
                    ? <Loader2 size={12} className="spin" />
                    : <RefreshCw size={12} />}
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleRemove(provider.id)}
                  style={{ ...iconBtnStyle, color: '#F43F5E' }}
                  title="Remove provider"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Details row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                <span>Type: {PROVIDER_TYPE_OPTIONS.find(o => o.value === provider.type)?.label || provider.type}</span>
                <span>Model: {provider.model}</span>
                <span>Base: {provider.baseUrl}</span>
                {provider.apiKey && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    Key: {keyRevealed ? provider.apiKey : maskedKey}
                    <button
                      onClick={() => toggleKeyReveal(provider.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                    >
                      {keyRevealed ? <EyeOff size={10} /> : <Eye size={10} />}
                    </button>
                  </span>
                )}
              </div>

              {/* Health result */}
              {health && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 6,
                  fontSize: 11,
                  color: health.status === 'healthy' ? '#22C55E' : '#F43F5E',
                }}>
                  {health.status === 'healthy' ? <Check size={12} /> : <X size={12} />}
                  <span>{health.status === 'healthy' ? `Healthy (${health.latencyMs}ms)` : `Unhealthy: ${health.error || 'connection failed'}`}</span>
                </div>
              )}
            </div>
          );
        })}

        {providers.length === 0 && (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
            No providers configured. Add one below.
          </div>
        )}
      </div>

      {/* Add provider button / form */}
      {!showAddForm ? (
        <button
          className="set-save-btn"
          onClick={() => setShowAddForm(true)}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          <Plus size={14} /> Add Provider
        </button>
      ) : (
        <AddProviderForm
          onAdd={(config) => {
            router.registerProvider(config);
            refreshProviders();
            setShowAddForm(false);
          }}
          onCancel={() => setShowAddForm(false)}
          nextPriority={providers.length + 1}
        />
      )}
    </section>
  );
}

// ─── Add provider form ────────────────────────────────────────────────────────

function AddProviderForm({
  onAdd,
  onCancel,
  nextPriority,
}: {
  onAdd: (config: LLMProviderConfig) => void;
  onCancel: () => void;
  nextPriority: number;
}): JSX.Element {
  const [name, setName] = useState('');
  const [type, setType] = useState<LLMProvider>(LLMProvider.OPENAI);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_URLS[LLMProvider.OPENAI]);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(getDefaultModel(LLMProvider.OPENAI));
  const [maxTokens, setMaxTokens] = useState(4096);
  const [temperature, setTemperature] = useState(0.7);
  const [showKey, setShowKey] = useState(false);

  const handleTypeChange = (newType: LLMProvider) => {
    setType(newType);
    setBaseUrl(DEFAULT_URLS[newType] || '');
    setModel(getDefaultModel(newType));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = `provider-${Date.now()}`;
    onAdd({
      id,
      name: name || PROVIDER_TYPE_OPTIONS.find(o => o.value === type)?.label || 'Provider',
      type,
      baseUrl,
      apiKey,
      model,
      enabled: true,
      priority: nextPriority,
      maxTokens,
      temperature,
    });
  };

  const models = PROVIDER_MODELS[type];

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(26,58,92,0.3)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
    width: '100%',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--text-muted)',
    fontWeight: 500,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: 4,
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(26,58,92,0.3)',
        borderRadius: 10,
        padding: 16,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Name */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={labelStyle}>Name</label>
          <input
            style={inputStyle}
            placeholder="My OpenAI"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        {/* Type */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={labelStyle}>Provider Type</label>
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={type}
            onChange={e => handleTypeChange(e.target.value as LLMProvider)}
          >
            {PROVIDER_TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Base URL */}
        <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Base URL</label>
          <input
            style={inputStyle}
            placeholder="https://api.openai.com/v1"
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
          />
        </div>

        {/* API Key */}
        <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
          <label style={labelStyle}>API Key</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              style={{ ...inputStyle, paddingRight: 36 }}
              type={showKey ? 'text' : 'password'}
              placeholder="sk-..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              style={{
                position: 'absolute',
                right: 8,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 0,
              }}
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {/* Model */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={labelStyle}>Model</label>
          {models.length > 0 ? (
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={model}
              onChange={e => setModel(e.target.value)}
            >
              {models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : (
            <input
              style={inputStyle}
              placeholder="model-name"
              value={model}
              onChange={e => setModel(e.target.value)}
            />
          )}
        </div>

        {/* Max Tokens */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={labelStyle}>Max Tokens</label>
          <input
            style={inputStyle}
            type="number"
            min={256}
            max={128000}
            value={maxTokens}
            onChange={e => setMaxTokens(Number(e.target.value))}
          />
        </div>

        {/* Temperature */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={labelStyle}>Temperature ({temperature.toFixed(1)})</label>
          <input
            style={{ ...inputStyle, padding: '6px 10px' }}
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            onChange={e => setTemperature(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="set-redo-cancel"
          onClick={onCancel}
          style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(26,58,92,0.3)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="set-save-btn"
          style={{ padding: '8px 16px' }}
        >
          <Plus size={12} /> Add Provider
        </button>
      </div>
    </form>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const iconBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(26,58,92,0.2)',
  borderRadius: 6,
  color: 'var(--text-muted)',
  cursor: 'pointer',
  padding: 0,
  fontSize: 12,
  transition: 'background 0.15s',
};