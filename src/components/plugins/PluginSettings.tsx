/**
 * PluginSettings
 *
 * Plugin management panel for the Settings page.
 * Lists available plugins with on/off toggles, webhook URLs, and status indicators.
 */

import { useState, useEffect, useCallback } from 'react';
import { Plug, Copy, Check, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useUserStore } from '../../stores/useUserStore';
import { listPlugins, type PluginConfig } from '../../lib/plugins';
import { logger } from '../../utils/logger';

// ── HELPERS ────────────────────────────────────────────────────────────────────

/** The public webhook URL for this LifeOS instance */
function getWebhookUrl(pluginId: string): string {
  const base = window.location.origin;
  return `${base}/api/webhooks/${pluginId}`;
}

// ── COMPONENT ──────────────────────────────────────────────────────────────────

export function PluginSettings() {
  const user = useUserStore(s => s.user);
  const [plugins, setPlugins] = useState<PluginConfig[]>([]);
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // Load registered plugins + user-specific enabled states from Supabase
  const load = useCallback(async () => {
    const registered = listPlugins();
    setPlugins(registered);

    if (!user?.id) return;

    const { data } = await supabase
      .from('plugins')
      .select('id, enabled')
      .eq('user_id', user.id);

    const map: Record<string, boolean> = {};
    // Defaults from plugin config
    registered.forEach(p => { map[p.id] = p.enabled; });
    // Override with DB values
    (data ?? []).forEach((row: { id: string; enabled: boolean }) => {
      map[row.id] = row.enabled;
    });
    setEnabledMap(map);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const togglePlugin = useCallback(async (pluginId: string, enabled: boolean) => {
    if (!user?.id) return;
    setSaving(pluginId);

    // Optimistic UI
    setEnabledMap(prev => ({ ...prev, [pluginId]: enabled }));

    const { error } = await supabase
      .from('plugins')
      .upsert({
        id:      pluginId,
        enabled,
        user_id: user.id,
        name:    plugins.find(p => p.id === pluginId)?.name ?? pluginId,
      }, { onConflict: 'user_id, id' });

    if (error) {
      // Revert on failure
      setEnabledMap(prev => ({ ...prev, [pluginId]: !enabled }));
      logger.error('[PluginSettings] toggle failed:', error.message);
    }

    setSaving(null);
  }, [user?.id, plugins]);

  // ── RENDER ──

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#E8F0FE', margin: '0 0 6px' }}>
          Plugin Integrations
        </h3>
        <p style={{ fontSize: 13, color: '#5A7A9A', margin: 0, lineHeight: 1.5 }}>
          Connect external apps to automatically award XP, log income, and create quests when
          real-world events happen.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {plugins.map(plugin => (
          <PluginCard
            key={plugin.id}
            plugin={plugin}
            enabled={enabledMap[plugin.id] ?? plugin.enabled}
            saving={saving === plugin.id}
            onToggle={enabled => togglePlugin(plugin.id, enabled)}
          />
        ))}

        {plugins.length === 0 && (
          <div style={{
            padding:      '32px 24px',
            textAlign:    'center',
            background:   'rgba(10, 37, 64, 0.4)',
            border:       '1px dashed rgba(0, 212, 255, 0.15)',
            borderRadius: 12,
          }}>
            <Plug size={32} style={{ color: '#2A4A6A', marginBottom: 10 }} />
            <p style={{ fontSize: 14, color: '#5A7A9A', margin: 0 }}>
              No plugins registered
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PLUGIN CARD ────────────────────────────────────────────────────────────────

function PluginCard({
  plugin,
  enabled,
  saving,
  onToggle,
}: {
  plugin: PluginConfig;
  enabled: boolean;
  saving: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);

  const webhookUrl = getWebhookUrl(plugin.id);

  const copyWebhook = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(webhookUrl);
      } else {
        // Fallback for older browsers / non-secure contexts
        const ta = document.createElement('textarea');
        ta.value = webhookUrl;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    } catch { /* clipboard not available */ }
  };

  const supportedEvents = Object.keys(plugin.event_handlers);

  return (
    <div style={{
      background:   'rgba(10, 37, 64, 0.5)',
      border:       `1px solid ${enabled ? `${plugin.color}30` : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 12,
      overflow:     'hidden',
      transition:   'border-color 0.3s',
    }}>
      {/* Main row */}
      <div style={{
        display:    'flex',
        alignItems: 'center',
        gap:        14,
        padding:    '16px 18px',
      }}>
        {/* Icon */}
        <div style={{
          width:          40,
          height:         40,
          borderRadius:   12,
          background:     `${plugin.color}18`,
          border:         `1px solid ${plugin.color}30`,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontSize:       20,
          flexShrink:     0,
        }}>
          {plugin.icon}
        </div>

        {/* Name + desc */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#E8F0FE' }}>
              {plugin.name}
            </span>
            <StatusBadge enabled={enabled} />
          </div>
          <p style={{ fontSize: 12, color: '#5A7A9A', margin: '3px 0 0', lineHeight: 1.4 }}>
            {plugin.description}
          </p>
        </div>

        {/* Toggle */}
        <Toggle
          checked={enabled}
          onChange={onToggle}
          disabled={saving}
          color={plugin.color}
        />
      </div>

      {/* Events list + webhook (collapsible) */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.04)',
        padding:   '12px 18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {supportedEvents.map(evt => (
              <span
                key={evt}
                style={{
                  fontSize:     11,
                  color:        plugin.color,
                  background:   `${plugin.color}14`,
                  border:       `1px solid ${plugin.color}25`,
                  borderRadius: 6,
                  padding:      '2px 8px',
                  fontFamily:   'monospace',
                }}
              >
                {evt}
              </span>
            ))}
          </div>

          <button
            onClick={() => setShowWebhook(v => !v)}
            style={{
              fontSize:     11,
              color:        '#5A7A9A',
              background:   'none',
              border:       '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6,
              padding:      '3px 10px',
              cursor:       'pointer',
              transition:   'color 0.2s, border-color 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#00D4FF';
              e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = '#5A7A9A';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
            }}
          >
            {showWebhook ? 'Hide' : 'Webhook URL'}
          </button>
        </div>

        {/* Webhook URL panel */}
        {showWebhook && (
          <div style={{
            marginTop:    8,
            background:   'rgba(0, 212, 255, 0.04)',
            border:       '1px solid rgba(0, 212, 255, 0.12)',
            borderRadius: 8,
            padding:      '10px 12px',
          }}>
            <div style={{ fontSize: 11, color: '#5A7A9A', marginBottom: 6 }}>
              Send events to this URL using HMAC-SHA256 signature in{' '}
              <code style={{ color: '#00D4FF', fontSize: 10 }}>X-LifeOS-Signature</code>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{
                fontSize:     11,
                color:        '#C5D5E8',
                flex:         1,
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
                fontFamily:   'monospace',
              }}>
                {webhookUrl}
              </code>
              <button
                onClick={copyWebhook}
                title="Copy"
                style={{
                  background:   copiedWebhook ? 'rgba(57, 255, 20, 0.1)' : 'rgba(0, 212, 255, 0.1)',
                  border:       'none',
                  borderRadius: 6,
                  cursor:       'pointer',
                  color:        copiedWebhook ? '#39FF14' : '#00D4FF',
                  display:      'flex',
                  padding:      '4px 8px',
                  transition:   'all 0.2s',
                }}
              >
                {copiedWebhook ? <Check size={13} /> : <Copy size={13} />}
              </button>
              <a
                href={`https://docs.lifeos.app/plugins/${plugin.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#5A7A9A', display: 'flex' }}
                title="Docs"
              >
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SUB-COMPONENTS ─────────────────────────────────────────────────────────────

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span style={{
      display:    'flex',
      alignItems: 'center',
      gap:        4,
      fontSize:   10,
      fontWeight: 600,
      color:      enabled ? '#22C55E' : '#5A7A9A',
      background: enabled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(90, 122, 154, 0.1)',
      border:     `1px solid ${enabled ? 'rgba(34, 197, 94, 0.25)' : 'rgba(90, 122, 154, 0.2)'}`,
      borderRadius: 6,
      padding:    '2px 7px',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    }}>
      {enabled
        ? <CheckCircle2 size={9} />
        : <AlertCircle size={9} />}
      {enabled ? 'Active' : 'Inactive'}
    </span>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  color,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
  color: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      disabled={disabled}
      aria-pressed={checked}
      style={{
        width:        44,
        height:       24,
        borderRadius: 12,
        border:       'none',
        cursor:       disabled ? 'not-allowed' : 'pointer',
        background:   checked ? color : 'rgba(255,255,255,0.1)',
        position:     'relative',
        flexShrink:   0,
        transition:   'background 0.25s',
        opacity:      disabled ? 0.6 : 1,
      }}
    >
      <span style={{
        position:     'absolute',
        top:          3,
        left:         checked ? 23 : 3,
        width:        18,
        height:       18,
        borderRadius: '50%',
        background:   '#fff',
        transition:   'left 0.25s',
        display:      'block',
      }} />
    </button>
  );
}
