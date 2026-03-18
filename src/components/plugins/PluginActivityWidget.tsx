/**
 * PluginActivityWidget
 *
 * Shows recent plugin activity on the main dashboard.
 * Auto-refreshes every 60 seconds.
 * Entries look like: "Office clean ✅ +35 XP · 3 min ago"
 */

import { useState, useEffect, useCallback } from 'react';
import { Plug, RefreshCw, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useUserStore } from '../../stores/useUserStore';
import type { PluginActivityRow } from '../../lib/plugins/types';

// ── HELPERS ────────────────────────────────────────────────────────────────────

function timeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

const PLUGIN_COLORS: Record<string, string> = {
  tcs:     '#00D4FF',
  shopify: '#96BF48',
  health:  '#F43F5E',
  finance: '#22C55E',
};

function pluginColor(pluginId: string): string {
  return PLUGIN_COLORS[pluginId] ?? '#8BA4BE';
}

// ── COMPONENT ──────────────────────────────────────────────────────────────────

interface PluginActivityWidgetProps {
  /** Maximum entries to display (default: 10) */
  limit?: number;
  /** Called when user clicks "View all" */
  onViewAll?: () => void;
}

export function PluginActivityWidget({
  limit = 10,
  onViewAll,
}: PluginActivityWidgetProps) {
  const user = useUserStore(s => s.user);
  const [activity, setActivity] = useState<PluginActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchActivity = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('plugin_activity')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        setActivity(data as PluginActivityRow[]);
        setLastRefresh(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, limit]);

  // Initial load
  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  // Auto-refresh every 60 s
  useEffect(() => {
    const interval = setInterval(fetchActivity, 60_000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  // Real-time subscription
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`plugin_activity_${user.id}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'plugin_activity',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setActivity(prev => [payload.new as PluginActivityRow, ...prev].slice(0, limit));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, limit]);

  // ── RENDER ──

  const isEmpty = !loading && activity.length === 0;

  return (
    <div style={{
      background:   'rgba(10, 37, 64, 0.6)',
      border:       '1px solid rgba(0, 212, 255, 0.12)',
      borderRadius: 14,
      overflow:     'hidden',
      backdropFilter: 'blur(12px)',
    }}>
      {/* Header */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '14px 18px',
        borderBottom:   '1px solid rgba(0, 212, 255, 0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plug size={15} style={{ color: '#00D4FF' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#E8F0FE', letterSpacing: 0.3 }}>
            Plugin Activity
          </span>
        </div>
        <button
          onClick={fetchActivity}
          title="Refresh"
          style={{
            background: 'none',
            border:     'none',
            cursor:     'pointer',
            color:      '#5A7A9A',
            display:    'flex',
            padding:    4,
            borderRadius: 6,
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#00D4FF')}
          onMouseLeave={e => (e.currentTarget.style.color = '#5A7A9A')}
        >
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '8px 0' }}>
        {loading && activity.length === 0 && (
          <div style={{ padding: '20px 18px', textAlign: 'center', color: '#5A7A9A', fontSize: 13 }}>
            Loading activity...
          </div>
        )}

        {isEmpty && (
          <div style={{ padding: '24px 18px', textAlign: 'center' }}>
            <Plug size={28} style={{ color: '#2A4A6A', marginBottom: 8 }} />
            <p style={{ fontSize: 13, color: '#5A7A9A', margin: 0 }}>
              No plugin activity yet
            </p>
            <p style={{ fontSize: 12, color: '#3A5A7A', margin: '4px 0 0' }}>
              Connect TCS to start seeing events here
            </p>
          </div>
        )}

        {activity.map((entry, i) => (
          <ActivityRow key={entry.id} entry={entry} isLast={i === activity.length - 1} />
        ))}
      </div>

      {/* Footer */}
      {activity.length > 0 && onViewAll && (
        <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(0, 212, 255, 0.06)' }}>
          <button
            onClick={onViewAll}
            style={{
              background: 'none',
              border:     'none',
              cursor:     'pointer',
              color:      '#00D4FF',
              fontSize:   12,
              display:    'flex',
              alignItems: 'center',
              gap:        4,
              padding:    0,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            View all activity <ArrowRight size={12} />
          </button>
        </div>
      )}

      {activity.length > 0 && (
        <div style={{ padding: '4px 18px 8px', fontSize: 10, color: '#3A5A7A' }}>
          Last updated {timeAgo(lastRefresh.toISOString())}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── ACTIVITY ROW ───────────────────────────────────────────────────────────────

function ActivityRow({
  entry,
  isLast,
}: {
  entry: PluginActivityRow;
  isLast: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const color = pluginColor(entry.plugin_id);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:    'flex',
        alignItems: 'center',
        gap:        12,
        padding:    '10px 18px',
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.03)',
        background:   hovered ? 'rgba(0, 212, 255, 0.04)' : 'transparent',
        transition:   'background 0.15s',
        cursor:       'default',
      }}
    >
      {/* Icon bubble */}
      <div style={{
        width:        32,
        height:       32,
        borderRadius: 10,
        background:   `${color}18`,
        border:       `1px solid ${color}30`,
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
        fontSize:     16,
        flexShrink:   0,
      }}>
        {entry.icon ?? '🔌'}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin:    0,
          fontSize:  13,
          color:     '#C5D5E8',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          overflow:   'hidden',
          textOverflow: 'ellipsis',
        }}>
          {entry.title}
        </p>
        {entry.description && (
          <p style={{
            margin:   '2px 0 0',
            fontSize: 11,
            color:    '#5A7A9A',
            whiteSpace: 'nowrap',
            overflow:   'hidden',
            textOverflow: 'ellipsis',
          }}>
            {entry.description}
          </p>
        )}
      </div>

      {/* XP badge + time */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
        {entry.xp_earned > 0 && (
          <span style={{
            fontSize:     11,
            fontWeight:   700,
            color:        '#00D4FF',
            background:   'rgba(0, 212, 255, 0.1)',
            border:       '1px solid rgba(0, 212, 255, 0.2)',
            borderRadius: 6,
            padding:      '1px 6px',
          }}>
            +{entry.xp_earned} XP
          </span>
        )}
        <span style={{ fontSize: 10, color: '#3A5A7A' }}>
          {timeAgo(entry.created_at)}
        </span>
      </div>
    </div>
  );
}
