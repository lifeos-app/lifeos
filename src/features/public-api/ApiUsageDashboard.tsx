/**
 * ApiUsageDashboard — API usage analytics
 *
 * Requests over time chart, endpoints breakdown, status code
 * distribution, top integrations by request volume, rate limit
 * proximity indicator, and error log.
 */

import { useState, useEffect, useMemo } from 'react';
import { usePublicApi } from './usePublicApi';
import type { UsageStats } from '../../stores/apiStore';

export function ApiUsageDashboard() {
  const api = usePublicApi();
  const [selectedPeriod, setSelectedPeriod] = useState<'1d' | '7d' | '30d'>('7d');

  // Refresh usage on mount and period change
  useEffect(() => {
    api.refreshUsage();
  }, [selectedPeriod]);

  const stats = api.usageStats;

  // ── Computed chart data ──────────────────────────────────────────

  const requestsChartData = useMemo(() => {
    if (!stats?.daily) return [];
    return Object.entries(stats.daily)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }, [stats]);

  const endpointsChartData = useMemo(() => {
    if (!stats?.endpoints) return [];
    return Object.entries(stats.endpoints)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .map(([endpoint, count]) => ({ endpoint, count: count as number }));
  }, [stats]);

  const statusCodeData = useMemo(() => {
    if (!stats?.statusCodes) return [];
    return Object.entries(stats.statusCodes)
      .map(([code, count]) => ({
        code,
        count: count as number,
        color: code.startsWith('2') ? '#10B981' : code.startsWith('4') ? '#F59E0B' : '#EF4444',
      }));
  }, [stats]);

  const maxDailyRequests = useMemo(() => {
    if (!requestsChartData.length) return 0;
    return Math.max(...requestsChartData.map(d => d.count), 1);
  }, [requestsChartData]);

  // Rate limit proximity (out of 100/min)
  const rateLimitPercent = Math.min(
    100,
    ((stats?.totalRequests || 0) / 100) * 100
  );

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">API Usage Analytics</h2>
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {(['1d', '7d', '30d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(p)}
              className={`px-3 py-1 rounded text-sm font-medium transition ${
                selectedPeriod === p
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {p === '1d' ? '24h' : p === '7d' ? '7 days' : '30 days'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Requests"
          value={stats?.totalRequests ?? 0}
          icon="📊"
        />
        <SummaryCard
          label="Unique Endpoints"
          value={endpointsChartData.length}
          icon="🎯"
        />
        <SummaryCard
          label="Success Rate"
          value={`${computeSuccessRate(stats)}%`}
          icon="✅"
        />
        <SummaryCard
          label="Active Keys"
          value={api.keys.filter(k => k.enabled).length}
          icon="🔑"
        />
      </div>

      {/* Rate limit proximity */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Rate Limit Proximity</h3>
          <span className="text-xs text-gray-400">100 req/min per key</span>
        </div>
        <div className="w-full bg-black/30 rounded-full h-3">
          <div
            className="h-3 rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(rateLimitPercent, 100)}%`,
              backgroundColor: rateLimitPercent > 80 ? '#EF4444' : rateLimitPercent > 50 ? '#F59E0B' : '#10B981',
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-500">{stats?.totalRequests ?? 0} requests this period</span>
          <span className="text-xs text-gray-500">{rateLimitPercent.toFixed(1)}% of limit</span>
        </div>
      </div>

      {/* Requests over time chart (simple bar chart) */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/10">
        <h3 className="text-sm font-semibold mb-4">Requests Over Time</h3>
        {requestsChartData.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">
            No usage data yet. Start making API requests to see trends.
          </div>
        ) : (
          <div className="flex items-end gap-1 h-40">
            {requestsChartData.map((d, i) => (
              <div
                key={d.date}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div className="text-xs text-gray-500">{d.count}</div>
                <div
                  className="w-full rounded-t bg-[#00D4FF] transition-all duration-300 min-h-[2px]"
                  style={{
                    height: `${(d.count / maxDailyRequests) * 120}px`,
                    opacity: 0.4 + (i / requestsChartData.length) * 0.6,
                  }}
                />
              </div>
            ))}
          </div>
        )}
        {requestsChartData.length > 0 && (
          <div className="flex gap-1 mt-2">
            {requestsChartData.map((d) => (
              <div key={d.date} className="flex-1 text-center">
                <span className="text-[10px] text-gray-600">
                  {d.date.slice(5)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Endpoints breakdown */}
        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
          <h3 className="text-sm font-semibold mb-4">Endpoints Breakdown</h3>
          {endpointsChartData.length === 0 ? (
            <div className="text-sm text-gray-500 py-6 text-center">No data yet</div>
          ) : (
            <div className="space-y-2">
              {endpointsChartData.slice(0, 8).map((ep) => {
                const maxCount = endpointsChartData[0]?.count || 1;
                const percent = (ep.count / maxCount) * 100;
                return (
                  <div key={ep.endpoint}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-300 font-mono truncate">{ep.endpoint}</span>
                      <span className="text-gray-500">{ep.count}</span>
                    </div>
                    <div className="w-full bg-black/30 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-[#A855F7]"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Status code distribution */}
        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
          <h3 className="text-sm font-semibold mb-4">Status Code Distribution</h3>
          {statusCodeData.length === 0 ? (
            <div className="text-sm text-gray-500 py-6 text-center">No data yet</div>
          ) : (
            <div className="space-y-3">
              {statusCodeData.map((sc) => {
                const total = statusCodeData.reduce((s, d) => s + d.count, 0);
                const percent = ((sc.count / total) * 100).toFixed(1);
                return (
                  <div key={sc.code} className="flex items-center gap-3">
                    <div
                      className="w-10 text-center text-sm font-bold rounded px-1 py-0.5"
                      style={{ backgroundColor: sc.color + '20', color: sc.color }}
                    >
                      {sc.code}
                    </div>
                    <div className="flex-1">
                      <div className="w-full bg-black/30 rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{ width: `${percent}%`, backgroundColor: sc.color }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 w-16 text-right">
                      {sc.count} ({percent}%)
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top integrations */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/10">
        <h3 className="text-sm font-semibold mb-4">Top Integrations by Request Volume</h3>
        <div className="space-y-2">
          {[
            { name: 'Strava', icon: '🏃', count: stats?.endpoints?.['/api/v1/webhooks/strava'] || 0 },
            { name: 'Health Apps', icon: '❤️', count: stats?.endpoints?.['/api/v1/webhooks/health'] || 0 },
            { name: 'Calendar', icon: '📅', count: stats?.endpoints?.['/api/v1/webhooks/calendar'] || 0 },
            { name: 'Banking', icon: '🏦', count: stats?.endpoints?.['/api/v1/webhooks/banking'] || 0 },
            { name: 'Direct API', icon: '📡', count: Object.entries(stats?.endpoints || {})
              .filter(([k]) => !k.includes('webhooks'))
              .reduce((sum, [, v]) => sum + (v as number), 0) },
          ].filter(i => i.count > 0)
            .sort((a, b) => b.count - a.count)
            .map((integration) => (
              <div
                key={integration.name}
                className="flex items-center gap-3 bg-black/20 rounded-lg px-4 py-2"
              >
                <span className="text-lg">{integration.icon}</span>
                <span className="text-sm font-medium flex-1">{integration.name}</span>
                <span className="text-sm text-gray-400">{integration.count} requests</span>
              </div>
            ))}
          {(!stats?.totalRequests) && (
            <div className="text-sm text-gray-500 py-6 text-center">
              No integration traffic yet. Set up webhooks to see data here.
            </div>
          )}
        </div>
      </div>

      {/* Error log placeholder */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/10">
        <h3 className="text-sm font-semibold mb-4">Recent Errors</h3>
        <div className="text-sm text-gray-500 py-6 text-center">
          {statusCodeData.find(s => s.code.startsWith('4') || s.code.startsWith('5'))
            ? 'Error entries will appear in a future update with detailed logging.'
            : 'No errors recorded. All requests returning successful responses.'
          }
        </div>
      </div>
    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────────────

function SummaryCard({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function computeSuccessRate(stats: UsageStats | null): string {
  if (!stats?.statusCodes) return '0';
  const total = Object.values(stats.statusCodes).reduce((s: number, v) => s + (v as number), 0);
  if (total === 0) return '0';
  const success = Object.entries(stats.statusCodes)
    .filter(([code]) => code.startsWith('2'))
    .reduce((s, [, v]) => s + (v as number), 0);
  return ((success / total) * 100).toFixed(1);
}

export default ApiUsageDashboard;