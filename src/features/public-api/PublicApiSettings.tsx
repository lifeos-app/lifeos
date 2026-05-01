/**
 * PublicApiSettings — Admin page for managing the LifeOS Public API
 *
 * API key management (generate, view, revoke, rotate), per-key scope
 * configuration, usage stats dashboard, webhook endpoint URLs,
 * integration guides, rate limit status, enable/disable toggle,
 * and API health monitor.
 */

import { useState } from 'react';
import { usePublicApi } from './usePublicApi';
import { IntegrationGuides } from './IntegrationGuides';
import { ApiUsageDashboard } from './ApiUsageDashboard';
import type { ApiKeyScope } from '../../stores/apiStore';

type Tab = 'keys' | 'usage' | 'webhooks' | 'integrations' | 'health';

const SCOPE_LABELS: Record<ApiKeyScope, { label: string; desc: string; color: string }> = {
  read: { label: 'Read', desc: 'View stats, insights, profile', color: '#3B82F6' },
  write: { label: 'Write', desc: 'Create/update data', color: '#10B981' },
  admin: { label: 'Admin', desc: 'Full access including key management', color: '#F59E0B' },
};

export function PublicApiSettings() {
  const api = usePublicApi();
  const [activeTab, setActiveTab] = useState<Tab>('keys');
  const [keyName, setKeyName] = useState('');
  const [keyScopes, setKeyScopes] = useState<ApiKeyScope[]>(['read', 'write']);
  const [showNewKey, setShowNewKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'keys', label: 'API Keys', icon: '🔑' },
    { id: 'usage', label: 'Usage', icon: '📊' },
    { id: 'webhooks', label: 'Webhooks', icon: '🔗' },
    { id: 'integrations', label: 'Integrations', icon: '🔌' },
    { id: 'health', label: 'Health', icon: '💓' },
  ];

  const handleGenerateKey = async () => {
    if (!keyName.trim()) return;
    await api.generateKey(keyName.trim(), keyScopes);
    setKeyName('');
    setShowNewKey(false);
  };

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const healthStatusColor = api.apiHealth.status === 'operational'
    ? '#10B981'
    : api.apiHealth.status === 'degraded'
      ? '#F59E0B'
      : '#EF4444';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/10 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00D4FF] to-[#8B5CF6] flex items-center justify-center text-xl">
              🔌
            </div>
            <div>
              <h1 className="text-xl font-bold">Public API</h1>
              <p className="text-sm text-gray-400">
                Connect external apps to LifeOS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Health badge */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: healthStatusColor + '20', color: healthStatusColor }}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: healthStatusColor }} />
              {api.apiHealth.status === 'operational' ? 'Online' : api.apiHealth.status === 'degraded' ? 'Degraded' : 'Down'}
            </div>

            {/* Enable/disable toggle */}
            <button
              onClick={() => api.setApiEnabled(!api.apiEnabled)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                api.apiEnabled
                  ? 'bg-[#00D4FF]/20 text-[#00D4FF] hover:bg-[#00D4FF]/30'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {api.apiEnabled ? '✓ Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="max-w-5xl mx-auto px-4 mt-4">
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {!api.apiEnabled && activeTab !== 'health' && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">🔒</div>
            <h2 className="text-xl font-bold mb-2">API is Disabled</h2>
            <p className="text-gray-400 mb-4">Enable the API to start connecting external services.</p>
            <button
              onClick={() => api.setApiEnabled(true)}
              className="px-6 py-2 bg-[#00D4FF] text-black rounded-lg font-medium hover:bg-[#00D4FF]/80 transition"
            >
              Enable API
            </button>
          </div>
        )}

        {(api.apiEnabled || activeTab === 'health') && (
          <>
            {/* === Keys Tab === */}
            {activeTab === 'keys' && (
              <div className="space-y-6">
                {/* New key form */}
                <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Generate New Key</h2>
                    <button
                      onClick={() => setShowNewKey(!showNewKey)}
                      className="px-4 py-2 bg-[#00D4FF] text-black rounded-lg text-sm font-medium hover:bg-[#00D4FF]/80 transition"
                    >
                      + New Key
                    </button>
                  </div>

                  {/* Show newly created key (shown once) */}
                  {api.newKeyRaw && (
                    <div className="mb-4 p-4 bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg">
                      <div className="flex items-center gap-2 text-[#10B981] text-sm font-medium mb-2">
                        🔑 New API Key Created — Copy it now!
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-black/30 p-2 rounded text-xs font-mono break-all">
                          {api.newKeyRaw}
                        </code>
                        <button
                          onClick={() => handleCopy(api.newKeyRaw!, 'new')}
                          className="px-3 py-2 bg-[#10B981]/20 text-[#10B981] rounded-lg text-xs font-medium hover:bg-[#10B981]/30 transition shrink-0"
                        >
                          {copiedKey === 'new' ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        This key will not be shown again. Store it securely.
                      </p>
                      <button
                        onClick={() => api.clearNewKey()}
                        className="mt-2 text-xs text-gray-400 hover:text-white transition"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {showNewKey && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Key Name</label>
                        <input
                          type="text"
                          value={keyName}
                          onChange={(e) => setKeyName(e.target.value)}
                          placeholder="e.g., Strava Integration"
                          className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#00D4FF]/50 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Scopes</label>
                        <div className="flex flex-wrap gap-3">
                          {(Object.keys(SCOPE_LABELS) as ApiKeyScope[]).map((scope) => (
                            <label
                              key={scope}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition ${
                                keyScopes.includes(scope)
                                  ? 'border-[#00D4FF]/50 bg-[#00D4FF]/10'
                                  : 'border-white/10 bg-white/5'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={keyScopes.includes(scope)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setKeyScopes([...keyScopes, scope]);
                                  } else {
                                    setKeyScopes(keyScopes.filter(s => s !== scope));
                                  }
                                }}
                                className="sr-only"
                              />
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: SCOPE_LABELS[scope].color }}
                              />
                              <div>
                                <div className="text-sm font-medium">{SCOPE_LABELS[scope].label}</div>
                                <div className="text-xs text-gray-500">{SCOPE_LABELS[scope].desc}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={handleGenerateKey}
                          disabled={!keyName.trim() || keyScopes.length === 0 || api.loading}
                          className="px-6 py-2 bg-[#00D4FF] text-black rounded-lg text-sm font-medium hover:bg-[#00D4FF]/80 transition disabled:opacity-40"
                        >
                          {api.loading ? 'Creating...' : 'Create Key'}
                        </button>
                        <button
                          onClick={() => setShowNewKey(false)}
                          className="px-6 py-2 bg-white/5 text-gray-400 rounded-lg text-sm font-medium hover:bg-white/10 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Key list */}
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold">API Keys</h2>
                  {api.keys.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                      No API keys generated yet. Create one above.
                    </div>
                  ) : (
                    api.keys.map((key) => (
                      <div
                        key={key.id}
                        className={`bg-white/5 rounded-xl p-4 border transition ${
                          key.enabled ? 'border-white/10' : 'border-red-500/20 bg-red-500/5'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${key.enabled ? 'bg-[#10B981]' : 'bg-red-500'}`} />
                            <div>
                              <div className="font-medium">{key.name}</div>
                              <code className="text-xs text-gray-500 font-mono">{key.key}</code>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Scope badges */}
                            {key.scopes.map((s) => (
                              <span
                                key={s}
                                className="px-2 py-0.5 rounded text-xs font-medium"
                                style={{
                                  backgroundColor: SCOPE_LABELS[s]?.color + '20',
                                  color: SCOPE_LABELS[s]?.color,
                                }}
                              >
                                {SCOPE_LABELS[s]?.label || s}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>Created {new Date(key.createdAt).toLocaleDateString()}</span>
                            {key.lastUsedAt && <span>Last used {new Date(key.lastUsedAt).toLocaleDateString()}</span>}
                            <span>{key.requestCount} requests</span>
                          </div>
                          <div className="flex gap-2">
                            {key.enabled && (
                              <>
                                <button
                                  onClick={() => handleCopy(key.key, key.id)}
                                  className="px-3 py-1.5 bg-white/5 text-gray-400 rounded text-xs hover:bg-white/10 transition"
                                >
                                  {copiedKey === key.id ? '✓ Copied' : 'Copy'}
                                </button>
                                <button
                                  onClick={() => api.rotateKey(key.id)}
                                  className="px-3 py-1.5 bg-[#F59E0B]/10 text-[#F59E0B] rounded text-xs hover:bg-[#F59E0B]/20 transition"
                                >
                                  Rotate
                                </button>
                                <button
                                  onClick={() => api.revokeKey(key.id)}
                                  className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded text-xs hover:bg-red-500/20 transition"
                                >
                                  Revoke
                                </button>
                              </>
                            )}
                            {!key.enabled && (
                              <span className="text-xs text-red-400">Revoked</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* === Usage Tab === */}
            {activeTab === 'usage' && (
              <ApiUsageDashboard />
            )}

            {/* === Webhooks Tab === */}
            {activeTab === 'webhooks' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Webhook Endpoints</h2>
                  <p className="text-sm text-gray-400 mb-4">
                    Configure external services to push data to these endpoints.
                    Each endpoint requires an API key sent via Authorization header.
                  </p>
                </div>

                {api.webhookEndpoints.map((ep) => (
                  <div key={ep.path} className="bg-white/5 rounded-xl p-5 border border-white/10">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            ep.method === 'GET' ? 'bg-[#3B82F6]/20 text-[#3B82F6]' : 'bg-[#10B981]/20 text-[#10B981]'
                          }`}>
                            {ep.method}
                          </span>
                          <span className="font-medium">{ep.description}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">Source: {ep.source}</div>
                      </div>
                      <button
                        onClick={() => handleCopy(ep.fullUrl, ep.path)}
                        className="px-3 py-1.5 bg-white/5 text-gray-400 rounded text-xs hover:bg-white/10 transition"
                      >
                        {copiedKey === ep.path ? '✓ Copied' : 'Copy URL'}
                      </button>
                    </div>
                    <div className="bg-black/30 rounded-lg p-3 overflow-x-auto">
                      <code className="text-xs font-mono text-[#00D4FF] break-all">
                        {ep.fullUrl}
                      </code>
                    </div>
                  </div>
                ))}

                {/* Strava verification info */}
                <div className="bg-[#FC4C02]/10 border border-[#FC4C02]/20 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🏃</span>
                    <h3 className="font-semibold">Strava Webhook Setup</h3>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">
                    Strava requires a separate subscription verification step. The GET endpoint
                    at the same URL will handle the hub.challenge verification automatically.
                  </p>
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>1. Go to Strava API Settings → Push Subscriptions</p>
                    <p>2. Set callback URL to: <code className="text-[#00D4FF]">{api.apiBase}/api/v1/webhooks/strava</code></p>
                    <p>3. Set a verify token and configure it in the Strava settings below</p>
                  </div>
                </div>
              </div>
            )}

            {/* === Integrations Tab === */}
            {activeTab === 'integrations' && (
              <IntegrationGuides />
            )}

            {/* === Health Tab === */}
            {activeTab === 'health' && (
              <div className="space-y-6">
                <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                  <h2 className="text-lg font-semibold mb-4">API Health Monitor</h2>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Status */}
                    <div className="bg-black/30 rounded-lg p-4 text-center">
                      <div
                        className="text-3xl font-bold mb-1"
                        style={{ color: healthStatusColor }}
                      >
                        {api.apiHealth.status === 'operational' ? '✓' : api.apiHealth.status === 'degraded' ? '⚠' : '✗'}
                      </div>
                      <div className="text-sm text-gray-400">API Status</div>
                      <div className="text-lg font-medium" style={{ color: healthStatusColor }}>
                        {api.apiHealth.status.charAt(0).toUpperCase() + api.apiHealth.status.slice(1)}
                      </div>
                    </div>

                    {/* Database */}
                    <div className="bg-black/30 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold mb-1">
                        {api.apiHealth.database === 'healthy' ? '💾' : '⚠️'}
                      </div>
                      <div className="text-sm text-gray-400">Database</div>
                      <div className="text-lg font-medium">
                        {api.apiHealth.database === 'healthy' ? 'Healthy' : 'Issues'}
                      </div>
                    </div>

                    {/* Response time */}
                    <div className="bg-black/30 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold mb-1">⚡</div>
                      <div className="text-sm text-gray-400">Response Time</div>
                      <div className="text-lg font-medium">
                        {api.apiHealth.responseTimeMs != null
                          ? `${api.apiHealth.responseTimeMs}ms`
                          : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {api.apiHealth.lastChecked && (
                    <p className="text-xs text-gray-500 mt-4 text-center">
                      Last checked: {new Date(api.apiHealth.lastChecked).toLocaleString()}
                    </p>
                  )}

                  <div className="flex justify-center mt-4">
                    <button
                      onClick={() => api.checkHealth()}
                      className="px-4 py-2 bg-white/5 text-gray-400 rounded-lg text-sm hover:bg-white/10 transition"
                    >
                      🔄 Refresh
                    </button>
                  </div>
                </div>

                {/* Quick test */}
                <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                  <h2 className="text-lg font-semibold mb-4">Quick Connectivity Test</h2>
                  <p className="text-sm text-gray-400 mb-3">
                    Test that the API is reachable and authentication works.
                  </p>
                  <button
                    onClick={async () => {
                      const activeKey = api.keys.find(k => k.enabled);
                      await api.testAllEndpoints(activeKey ? activeKey.key : undefined);
                    }}
                    className="px-6 py-2 bg-[#00D4FF] text-black rounded-lg text-sm font-medium hover:bg-[#00D4FF]/80 transition"
                  >
                    Run Tests
                  </button>
                </div>

                {/* API base URL config */}
                <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                  <h2 className="text-lg font-semibold mb-2">API Base URL</h2>
                  <p className="text-sm text-gray-400 mb-3">
                    Configure the backend URL for API calls. Default: http://localhost:8080
                  </p>
                  <input
                    type="text"
                    value={api.apiBase}
                    onChange={(e) => {
                      localStorage.setItem('lifeos_api_base', e.target.value);
                      window.location.reload();
                    }}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-[#00D4FF]/50 transition"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default PublicApiSettings;