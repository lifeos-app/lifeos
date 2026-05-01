/**
 * usePublicApi — Core hook for API key management and usage tracking
 *
 * Interfaces with the Zustand store and the Flask backend to provide
 * React components with API key CRUD, usage analytics, webhook
 * configuration, and integration setup per service.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  useApiStore,
  type ApiKey,
  type ApiKeyScope,
  type UsageStats,
  type WebhookConfig,
  type IntegrationConfig,
  type ApiHealthStatus,
} from '../../stores/apiStore';

// ── Types ────────────────────────────────────────────────────────────

export interface ApiTestResult {
  endpoint: string;
  method: string;
  status: 'success' | 'error' | 'timeout';
  statusCode?: number;
  responseTimeMs?: number;
  error?: string;
}

export interface WebhookEndpointInfo {
  path: string;
  fullUrl: string;
  method: string;
  description: string;
  source: string;
  authRequired: boolean;
}

// ── Hook ──────────────────────────────────────────────────────────────

export function usePublicApi() {
  const store = useApiStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Computed webhook URLs
  const apiBase = typeof window !== 'undefined'
    ? (localStorage.getItem('lifeos_api_base') || 'http://localhost:8080')
    : 'http://localhost:8080';

  const webhookEndpoints: WebhookEndpointInfo[] = useMemo(() => [
    {
      path: '/api/v1/webhooks/strava',
      fullUrl: `${apiBase}/api/v1/webhooks/strava`,
      method: 'POST',
      description: 'Strava activity push',
      source: 'Strava',
      authRequired: true,
    },
    {
      path: '/api/v1/webhooks/health',
      fullUrl: `${apiBase}/api/v1/webhooks/health`,
      method: 'POST',
      description: 'Apple Health / Google Fit data',
      source: 'Health Apps',
      authRequired: true,
    },
    {
      path: '/api/v1/webhooks/calendar',
      fullUrl: `${apiBase}/api/v1/webhooks/calendar`,
      method: 'POST',
      description: 'Calendar sync (Google, Outlook)',
      source: 'Calendar',
      authRequired: true,
    },
    {
      path: '/api/v1/webhooks/banking',
      fullUrl: `${apiBase}/api/v1/webhooks/banking`,
      method: 'POST',
      description: 'Banking transaction notifications',
      source: 'Banking',
      authRequired: true,
    },
  ], [apiBase]);

  // ── Key Management ──────────────────────────────────────────────────

  const generateKey = useCallback(async (name: string, scopes: ApiKeyScope[]) => {
    setLoading(true);
    setError(null);
    try {
      const result = await store.generateKey(name, scopes);
      if (!result) {
        setError('Failed to generate API key. Is the backend running?');
      }
      return result;
    } catch (e: any) {
      setError(e.message || 'Failed to generate key');
      return null;
    } finally {
      setLoading(false);
    }
  }, [store]);

  const revokeKey = useCallback(async (keyId: string) => {
    setLoading(true);
    setError(null);
    try {
      await store.revokeKey(keyId);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [store]);

  const rotateKey = useCallback(async (keyId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await store.rotateKey(keyId);
      if (!result) {
        setError('Failed to rotate key');
      }
      return result;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [store]);

  // ── API Testing ──────────────────────────────────────────────────

  const testEndpoint = useCallback(async (
    endpoint: string,
    method: string = 'GET',
    body?: any,
    apiKey?: string,
  ): Promise<ApiTestResult> => {
    const start = Date.now();
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const res = await fetch(`${apiBase}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      return {
        endpoint,
        method,
        status: res.ok ? 'success' : 'error',
        statusCode: res.status,
        responseTimeMs: Date.now() - start,
      };
    } catch (e: any) {
      return {
        endpoint,
        method,
        status: 'timeout',
        error: e.message,
        responseTimeMs: Date.now() - start,
      };
    }
  }, [apiBase]);

  const testAllEndpoints = useCallback(async (apiKey?: string): Promise<ApiTestResult[]> => {
    const results: ApiTestResult[] = [];

    // Test status (no auth)
    results.push(await testEndpoint('/api/v1/status'));

    // Test docs (no auth)
    results.push(await testEndpoint('/api/v1/'));

    // Test authenticated endpoints if key provided
    if (apiKey) {
      results.push(await testEndpoint('/api/v1/me', 'GET', undefined, apiKey));
      results.push(await testEndpoint('/api/v1/stats?period=7d', 'GET', undefined, apiKey));
      results.push(await testEndpoint('/api/v1/insights?limit=1', 'GET', undefined, apiKey));
    }

    return results;
  }, [testEndpoint]);

  // ── Usage Tracking ──────────────────────────────────────────────

  const refreshUsage = useCallback(async () => {
    setLoading(true);
    try {
      await store.refreshUsageStats();
    } finally {
      setLoading(false);
    }
  }, [store]);

  // ── Webhook Config ──────────────────────────────────────────────

  const updateWebhook = useCallback((source: keyof WebhookConfig, partial: any) => {
    store.updateWebhookConfig(source, partial);
  }, [store]);

  const updateIntegration = useCallback((service: keyof IntegrationConfig, partial: any) => {
    store.updateIntegrationConfig(service, partial);
  }, [store]);

  // ── Health Check ────────────────────────────────────────────────

  const checkHealth = useCallback(async () => {
    await store.checkApiHealth();
  }, [store]);

  // ── Initialize ──────────────────────────────────────────────────

  useEffect(() => {
    store.loadKeys();
    store.checkApiHealth();
  }, []);

  return {
    // State
    keys: store.keys,
    newKeyRaw: store.newKeyRaw,
    usageStats: store.usageStats,
    webhookConfig: store.webhookConfig,
    integrationConfig: store.integrationConfig,
    apiHealth: store.apiHealth,
    apiEnabled: store.apiEnabled,
    loading,
    error,

    // Key management
    generateKey,
    revokeKey,
    rotateKey,
    clearNewKey: store.clearNewKey,
    setApiEnabled: store.setApiEnabled,

    // Testing
    testEndpoint,
    testAllEndpoints,
    webhookEndpoints,

    // Usage
    refreshUsage,

    // Webhook config
    updateWebhook,
    updateIntegration,

    // Health
    checkHealth,

    // Computed
    activeKeys: store.keys.filter(k => k.enabled),
    inactiveKeys: store.keys.filter(k => !k.enabled),
    apiBase,
  };
}

export default usePublicApi;