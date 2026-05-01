/**
 * API Store — Zustand + Persist
 *
 * Central store for Public API key management, usage tracking,
 * webhook configuration, and integration settings. Persists to localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Types ────────────────────────────────────────────────────────────

export type ApiKeyScope = 'read' | 'write' | 'admin';

export interface ApiKey {
  id: string;
  key: string;           // Masked after creation — full key only shown once
  name: string;
  scopes: ApiKeyScope[];
  enabled: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  requestCount: number;
  rotatedFrom: string | null;
}

export interface UsageEntry {
  keyId: string;
  endpoint: string;
  statusCode: number;
  timestamp: string;
}

export interface UsageStats {
  totalRequests: number;
  endpoints: Record<string, number>;
  statusCodes: Record<string, number>;
  daily: Record<string, number>;
}

export interface WebhookConfig {
  strava: {
    enabled: boolean;
    url: string;
    verifyToken: string;
    lastEventAt: string | null;
  };
  health: {
    enabled: boolean;
    url: string;
    lastEventAt: string | null;
  };
  calendar: {
    enabled: boolean;
    url: string;
    lastEventAt: string | null;
  };
  banking: {
    enabled: boolean;
    url: string;
    lastEventAt: string | null;
  };
}

export interface ApiHealthStatus {
  status: 'operational' | 'degraded' | 'down';
  database: 'healthy' | 'unhealthy';
  lastChecked: string | null;
  responseTimeMs: number | null;
}

export interface IntegrationConfig {
  strava: {
    connected: boolean;
    webhookSubscribed: boolean;
    lastSyncAt: string | null;
  };
  appleHealth: {
    connected: boolean;
    exportMethod: 'webhook' | 'csv' | 'auto-export';
    lastSyncAt: string | null;
  };
  googleFit: {
    connected: boolean;
    lastSyncAt: string | null;
  };
  googleCalendar: {
    connected: boolean;
    twoWaySync: boolean;
    lastSyncAt: string | null;
  };
  banking: {
    connected: boolean;
    method: 'webhook' | 'csv' | 'open-banking';
    lastSyncAt: string | null;
  };
}

// ── Defaults ──────────────────────────────────────────────────────────

const DEFAULT_WEBHOOK_CONFIG: WebhookConfig = {
  strava: {
    enabled: false,
    url: '',
    verifyToken: '',
    lastEventAt: null,
  },
  health: {
    enabled: false,
    url: '',
    lastEventAt: null,
  },
  calendar: {
    enabled: false,
    url: '',
    lastEventAt: null,
  },
  banking: {
    enabled: false,
    url: '',
    lastEventAt: null,
  },
};

const DEFAULT_INTEGRATION_CONFIG: IntegrationConfig = {
  strava: { connected: false, webhookSubscribed: false, lastSyncAt: null },
  appleHealth: { connected: false, exportMethod: 'csv', lastSyncAt: null },
  googleFit: { connected: false, lastSyncAt: null },
  googleCalendar: { connected: false, twoWaySync: false, lastSyncAt: null },
  banking: { connected: false, method: 'csv', lastSyncAt: null },
};

// ── Store Interface ────────────────────────────────────────────────────

interface ApiState {
  // API Keys
  keys: ApiKey[];
  newKeyRaw: string | null;  // Full key shown once after creation

  // Usage
  usageStats: UsageStats | null;
  usageLog: UsageEntry[];

  // Webhooks
  webhookConfig: WebhookConfig;

  // Integration configs
  integrationConfig: IntegrationConfig;

  // API Health
  apiHealth: ApiHealthStatus;

  // Feature toggle
  apiEnabled: boolean;

  // Actions
  generateKey: (name: string, scopes: ApiKeyScope[]) => Promise<ApiKey | null>;
  revokeKey: (keyId: string) => void;
  rotateKey: (keyId: string) => Promise<ApiKey | null>;
  clearNewKey: () => void;
  setApiEnabled: (enabled: boolean) => void;
  updateWebhookConfig: (source: keyof WebhookConfig, partial: Partial<WebhookConfig[keyof WebhookConfig]>) => void;
  updateIntegrationConfig: (service: keyof IntegrationConfig, partial: Partial<IntegrationConfig[keyof IntegrationConfig]>) => void;
  refreshUsageStats: () => Promise<void>;
  checkApiHealth: () => Promise<void>;
  loadKeys: () => Promise<void>;
}

// ── API Base URL ──────────────────────────────────────────────────────

const getApiBase = () => {
  return localStorage.getItem('lifeos_api_base') || 'http://localhost:8080';
};

// ── Store ──────────────────────────────────────────────────────────────

export const useApiStore = create<ApiState>()(
  persist(
    (set, get) => ({
      keys: [],
      newKeyRaw: null,
      usageStats: null,
      usageLog: [],
      webhookConfig: { ...DEFAULT_WEBHOOK_CONFIG },
      integrationConfig: { ...DEFAULT_INTEGRATION_CONFIG },
      apiHealth: {
        status: 'operational',
        database: 'healthy',
        lastChecked: null,
        responseTimeMs: null,
      },
      apiEnabled: true,

      generateKey: async (name: string, scopes: ApiKeyScope[]) => {
        try {
          const base = getApiBase();
          const res = await fetch(`${base}/api/v1/keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, scopes }),
          });
          if (!res.ok) return null;
          const { data } = await res.json();
          // Store the full key for one-time display
          set((state) => ({
            keys: [...state.keys, {
              id: data.id,
              key: data.key,
              name: data.name,
              scopes: data.scopes,
              enabled: data.enabled,
              createdAt: data.created_at,
              lastUsedAt: data.last_used_at,
              requestCount: data.request_count || 0,
              rotatedFrom: data.rotated_from,
            }],
            newKeyRaw: data.key, // Full key — shown once
          }));
          return {
            id: data.id,
            key: data.key,
            name: data.name,
            scopes: data.scopes,
            enabled: data.enabled,
            createdAt: data.created_at,
            lastUsedAt: data.last_used_at,
            requestCount: data.request_count || 0,
            rotatedFrom: data.rotated_from,
          } as ApiKey;
        } catch {
          return null;
        }
      },

      revokeKey: async (keyId: string) => {
        try {
          const base = getApiBase();
          await fetch(`${base}/api/v1/keys/${keyId}`, { method: 'DELETE' });
          set((state) => ({
            keys: state.keys.map((k) =>
              k.id === keyId ? { ...k, enabled: false } : k
            ),
          }));
        } catch {
          // Local fallback
        }
      },

      rotateKey: async (keyId: string) => {
        try {
          const base = getApiBase();
          const res = await fetch(`${base}/api/v1/keys/${keyId}/rotate`, { method: 'POST' });
          if (!res.ok) return null;
          const { data } = await res.json();
          const newKey: ApiKey = {
            id: data.id,
            key: data.key,
            name: data.name,
            scopes: data.scopes,
            enabled: data.enabled,
            createdAt: data.created_at,
            lastUsedAt: data.last_used_at,
            requestCount: 0,
            rotatedFrom: data.rotated_from,
          };
          set((state) => ({
            keys: [
              ...state.keys.map((k) =>
                k.id === keyId ? { ...k, enabled: false } : k
              ),
              newKey,
            ],
            newKeyRaw: data.key,
          }));
          return newKey;
        } catch {
          return null;
        }
      },

      clearNewKey: () => set({ newKeyRaw: null }),

      setApiEnabled: (enabled: boolean) => set({ apiEnabled: enabled }),

      updateWebhookConfig: (source, partial) => {
        set((state) => ({
          webhookConfig: {
            ...state.webhookConfig,
            [source]: { ...state.webhookConfig[source], ...partial },
          },
        }));
      },

      updateIntegrationConfig: (service, partial) => {
        set((state) => ({
          integrationConfig: {
            ...state.integrationConfig,
            [service]: { ...state.integrationConfig[service], ...partial },
          },
        }));
      },

      refreshUsageStats: async () => {
        try {
          const base = getApiBase();
          const res = await fetch(`${base}/api/v1/keys/usage?days=30`);
          if (!res.ok) return;
          const { data } = await res.json();
          set({ usageStats: data });
        } catch {
          // Stats unavailable — keep previous
        }
      },

      checkApiHealth: async () => {
        const start = Date.now();
        try {
          const base = getApiBase();
          const res = await fetch(`${base}/api/v1/status`);
          const elapsed = Date.now() - start;
          if (res.ok) {
            const { data } = await res.json();
            set({
              apiHealth: {
                status: data.status === 'operational' ? 'operational' : 'degraded',
                database: data.database,
                lastChecked: new Date().toISOString(),
                responseTimeMs: elapsed,
              },
            });
          } else {
            set({
              apiHealth: {
                status: 'degraded',
                database: 'unhealthy',
                lastChecked: new Date().toISOString(),
                responseTimeMs: elapsed,
              },
            });
          }
        } catch {
          set({
            apiHealth: {
              status: 'down',
              database: 'unhealthy',
              lastChecked: new Date().toISOString(),
              responseTimeMs: null,
            },
          });
        }
      },

      loadKeys: async () => {
        try {
          const base = getApiBase();
          const res = await fetch(`${base}/api/v1/keys`);
          if (!res.ok) return;
          const { data } = await res.json();
          const keys: ApiKey[] = (data || []).map((k: any) => ({
            id: k.id,
            key: k.key,
            name: k.name,
            scopes: k.scopes,
            enabled: k.enabled,
            createdAt: k.created_at,
            lastUsedAt: k.last_used_at,
            requestCount: k.request_count || 0,
            rotatedFrom: k.rotated_from,
          }));
          set({ keys });
        } catch {
          // Keys unavailable
        }
      },
    }),
    {
      name: 'lifeos-public-api',
      partialize: (state) => ({
        keys: state.keys,
        webhookConfig: state.webhookConfig,
        integrationConfig: state.integrationConfig,
        apiEnabled: state.apiEnabled,
      }),
    }
  )
);