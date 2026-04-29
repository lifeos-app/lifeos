/**
 * PluginManager — P7-011
 *
 * UI for browsing, toggling, and configuring LifeOS plugins.
 * Lives in the Settings page under the "Plugins" tab.
 *
 * Dark theme: bg #050E1A, card #0F2D4A, accent #00D4FF
 * No emoji — Lucide icons only.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Puzzle, ToggleLeft, ToggleRight, Settings, Plus,
  ChevronDown, ChevronRight, Trash2, Version,
} from 'lucide-react';
import {
  pluginRegistry,
  pluginEventBus,
  registerBuiltinPlugins,
  type PluginManifest,
  type SettingDefinition,
} from '../lib/plugin-system';

// ── INIT ──────────────────────────────────────────────────────────────────────

// Register built-in plugins on first import
registerBuiltinPlugins();

// ── COMPONENT ─────────────────────────────────────────────────────────────────

export function PluginManager() {
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);
  const [activeMap, setActiveMap] = useState<Record<string, boolean>>({});
  const [expandedSettings, setExpandedSettings] = useState<Record<string, boolean>>({});
  const [settingsMap, setSettingsMap] = useState<Record<string, Record<string, any>>>({});
  const [installId, setInstallId] = useState('');
  const [installError, setInstallError] = useState('');

  // Reload state from registry
  const refresh = useCallback(() => {
    setPlugins(pluginRegistry.getAllPlugins());
    const map: Record<string, boolean> = {};
    const sMap: Record<string, Record<string, any>> = {};
    for (const p of pluginRegistry.getAllPlugins()) {
      map[p.id] = pluginRegistry.isActive(p.id);
      sMap[p.id] = pluginRegistry.getPluginSettings(p.id);
    }
    setActiveMap(map);
    setSettingsMap(sMap);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Listen for plugin events to keep UI in sync
  useEffect(() => {
    const unsubRegistered = pluginEventBus.on('plugin:registered', refresh);
    const unsubActivated = pluginEventBus.on('plugin:activated', refresh);
    const unsubDeactivated = pluginEventBus.on('plugin:deactivated', refresh);
    const unsubUnregistered = pluginEventBus.on('plugin:unregistered', refresh);
    const unsubSettings = pluginEventBus.on('plugin:settings-updated', refresh);
    return () => {
      unsubRegistered();
      unsubActivated();
      unsubDeactivated();
      unsubUnregistered();
      unsubSettings();
    };
  }, [refresh]);

  const handleToggle = (pluginId: string) => {
    const isActive = activeMap[pluginId];
    if (isActive) {
      pluginRegistry.deactivate(pluginId);
    } else {
      pluginRegistry.activate(pluginId);
    }
    refresh();
  };

  const handleUnregister = (pluginId: string) => {
    pluginRegistry.unregister(pluginId);
    refresh();
  };

  const handleSettingChange = (pluginId: string, key: string, value: any) => {
    pluginRegistry.updatePluginSettings(pluginId, { [key]: value });
    setSettingsMap(prev => ({
      ...prev,
      [pluginId]: { ...prev[pluginId], [key]: value },
    }));
  };

  const toggleSettingsExpand = (pluginId: string) => {
    setExpandedSettings(prev => ({ ...prev, [pluginId]: !prev[pluginId] }));
  };

  const handleInstall = () => {
    const id = installId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!id) {
      setInstallError('Plugin ID cannot be empty.');
      return;
    }
    if (pluginRegistry.isRegistered(id)) {
      setInstallError(`Plugin "${id}" is already registered.`);
      return;
    }

    // Simulated install — register a stub plugin
    pluginRegistry.register({
      id,
      name: id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      version: '0.1.0',
      description: 'Custom plugin installed by ID.',
      author: 'User',
      icon: 'Puzzle',
    });

    setInstallId('');
    setInstallError('');
    refresh();
  };

  // ── RENDER ──────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Puzzle size={20} style={{ color: '#00D4FF' }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#E8F0FE', margin: 0 }}>
            Plugins
          </h3>
        </div>
        <p style={{ fontSize: 13, color: '#5A7A9A', margin: 0, lineHeight: 1.5 }}>
          Extend LifeOS with plugins. Toggle features on or off, configure settings, and register new capabilities.
        </p>
      </div>

      {/* Plugin list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {plugins.map(plugin => (
          <PluginCard
            key={plugin.id}
            plugin={plugin}
            isActive={activeMap[plugin.id] ?? false}
            settings={settingsMap[plugin.id] ?? {}}
            isExpanded={expandedSettings[plugin.id] ?? false}
            onToggle={() => handleToggle(plugin.id)}
            onUnregister={() => handleUnregister(plugin.id)}
            onToggleExpand={() => toggleSettingsExpand(plugin.id)}
            onSettingChange={(key, value) => handleSettingChange(plugin.id, key, value)}
          />
        ))}

        {plugins.length === 0 && (
          <div style={{
            padding: '32px 24px',
            textAlign: 'center',
            background: 'rgba(10, 37, 64, 0.4)',
            border: '1px dashed rgba(0, 212, 255, 0.15)',
            borderRadius: 12,
          }}>
            <Puzzle size={32} style={{ color: '#2A4A6A', marginBottom: 10 }} />
            <p style={{ fontSize: 14, color: '#5A7A9A', margin: 0 }}>
              No plugins registered
            </p>
          </div>
        )}
      </div>

      {/* Install Plugin */}
      <div style={{
        background: '#0F2D4A',
        border: '1px solid rgba(26, 58, 92, 0.4)',
        borderRadius: 12,
        padding: '18px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Plus size={16} style={{ color: '#00D4FF' }} />
          <h4 style={{ fontSize: 14, fontWeight: 600, color: '#E8F0FE', margin: 0 }}>
            Install Plugin
          </h4>
        </div>
        <p style={{ fontSize: 12, color: '#5A7A9A', margin: '0 0 12px', lineHeight: 1.5 }}>
          Enter a plugin ID to register it. This is a simulated install — real marketplace coming soon.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={installId}
            onChange={e => { setInstallId(e.target.value); setInstallError(''); }}
            placeholder="e.g. my-awesome-plugin"
            style={{
              flex: 1,
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(26, 58, 92, 0.4)',
              borderRadius: 8,
              color: '#E8F0FE',
              fontFamily: "'Poppins', sans-serif",
              fontSize: 13,
              outline: 'none',
            }}
            onKeyDown={e => { if (e.key === 'Enter') handleInstall(); }}
          />
          <button
            onClick={handleInstall}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              borderRadius: 8,
              color: '#00D4FF',
              fontFamily: "'Poppins', sans-serif",
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background 0.15s',
            }}
          >
            <Plus size={14} /> Install
          </button>
        </div>
        {installError && (
          <p style={{ fontSize: 12, color: '#F43F5E', margin: '8px 0 0' }}>{installError}</p>
        )}
      </div>
    </div>
  );
}

// ── PLUGIN CARD ──────────────────────────────────────────────────────────────

function PluginCard({
  plugin,
  isActive,
  settings,
  isExpanded,
  onToggle,
  onUnregister,
  onToggleExpand,
  onSettingChange,
}: {
  plugin: PluginManifest;
  isActive: boolean;
  settings: Record<string, any>;
  isExpanded: boolean;
  onToggle: () => void;
  onUnregister: () => void;
  onToggleExpand: () => void;
  onSettingChange: (key: string, value: any) => void;
}) {
  const hasSettings = plugin.settings && plugin.settings.length > 0;

  return (
    <div style={{
      background: '#0F2D4A',
      border: `1px solid ${isActive ? 'rgba(0, 212, 255, 0.25)' : 'rgba(26, 58, 92, 0.4)'}`,
      borderRadius: 12,
      overflow: 'hidden',
      transition: 'border-color 0.3s',
    }}>
      {/* Main row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '16px 18px',
      }}>
        {/* Icon */}
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: isActive ? 'rgba(0, 212, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)',
          border: `1px solid ${isActive ? 'rgba(0, 212, 255, 0.25)' : 'rgba(255, 255, 255, 0.06)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <PluginIcon iconName={plugin.icon} size={20} color={isActive ? '#00D4FF' : '#5A7A9A'} />
        </div>

        {/* Name + description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: isActive ? '#E8F0FE' : '#8BA4BE' }}>
              {plugin.name}
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              color: isActive ? '#22C55E' : '#5A7A9A',
              background: isActive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(90, 122, 154, 0.1)',
              border: `1px solid ${isActive ? 'rgba(34, 197, 94, 0.2)' : 'rgba(90, 122, 154, 0.15)'}`,
              borderRadius: 6,
              padding: '1px 7px',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
            <span style={{
              fontSize: 10,
              color: '#5A7A9A',
              fontFamily: 'monospace',
            }}>
              v{plugin.version}
            </span>
          </div>
          <p style={{ fontSize: 12, color: '#5A7A9A', margin: '3px 0 0', lineHeight: 1.4 }}>
            {plugin.description}
          </p>
          <p style={{ fontSize: 11, color: '#3A5A7A', margin: '4px 0 0' }}>
            by {plugin.author}
            {plugin.route && <span style={{ marginLeft: 8, fontFamily: 'monospace' }}>-- {plugin.route}</span>}
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Settings toggle */}
          {hasSettings && (
            <button
              onClick={onToggleExpand}
              title="Settings"
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isExpanded ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
                border: `1px solid ${isExpanded ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 255, 255, 0.06)'}`,
                borderRadius: 8,
                cursor: 'pointer',
                color: isExpanded ? '#00D4FF' : '#5A7A9A',
                transition: 'all 0.2s',
              }}
            >
              <Settings size={15} />
            </button>
          )}

          {/* Toggle switch */}
          <button
            onClick={onToggle}
            aria-pressed={isActive}
            title={isActive ? 'Deactivate' : 'Activate'}
            style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              background: isActive ? 'rgba(0, 212, 255, 0.3)' : 'rgba(255, 255, 255, 0.08)',
              position: 'relative',
              flexShrink: 0,
              transition: 'background 0.25s',
            }}
          >
            <span style={{
              position: 'absolute',
              top: 3,
              left: isActive ? 23 : 3,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: isActive ? '#00D4FF' : 'rgba(255, 255, 255, 0.4)',
              transition: 'left 0.25s, background 0.25s',
              display: 'block',
            }} />
          </button>
        </div>
      </div>

      {/* Settings panel (expandable) */}
      {hasSettings && isExpanded && (
        <div style={{
          borderTop: '1px solid rgba(26, 58, 92, 0.3)',
          padding: '14px 18px 18px',
          background: 'rgba(5, 14, 26, 0.4)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 12,
          }}>
            <Settings size={13} style={{ color: '#5A7A9A' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#8BA4BE' }}>Settings</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {plugin.settings!.map(s => (
              <SettingControl
                key={s.key}
                definition={s}
                value={settings[s.key] ?? s.default}
                onChange={v => onSettingChange(s.key, v)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── SETTING CONTROL ───────────────────────────────────────────────────────────

function SettingControl({
  definition,
  value,
  onChange,
}: {
  definition: SettingDefinition;
  value: any;
  onChange: (value: any) => void;
}) {
  if (definition.type === 'toggle') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 0',
      }}>
        <span style={{ fontSize: 13, color: '#8BA4BE' }}>{definition.label}</span>
        <button
          onClick={() => onChange(!value)}
          style={{
            width: 40,
            height: 22,
            borderRadius: 11,
            border: 'none',
            cursor: 'pointer',
            background: value ? 'rgba(0, 212, 255, 0.3)' : 'rgba(255, 255, 255, 0.08)',
            position: 'relative',
            flexShrink: 0,
            transition: 'background 0.25s',
          }}
        >
          <span style={{
            position: 'absolute',
            top: 3,
            left: value ? 21 : 3,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: value ? '#00D4FF' : 'rgba(255, 255, 255, 0.4)',
            transition: 'left 0.25s, background 0.25s',
            display: 'block',
          }} />
        </button>
      </div>
    );
  }

  if (definition.type === 'select' && definition.options) {
    return (
      <div style={{ padding: '6px 0' }}>
        <span style={{ fontSize: 13, color: '#8BA4BE', display: 'block', marginBottom: 6 }}>
          {definition.label}
        </span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {definition.options.map(opt => (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: value === opt.value
                  ? '1px solid rgba(0, 212, 255, 0.3)'
                  : '1px solid rgba(26, 58, 92, 0.3)',
                background: value === opt.value
                  ? 'rgba(0, 212, 255, 0.1)'
                  : 'transparent',
                color: value === opt.value ? '#00D4FF' : '#5A7A9A',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (definition.type === 'text') {
    return (
      <div style={{ padding: '6px 0' }}>
        <span style={{ fontSize: 13, color: '#8BA4BE', display: 'block', marginBottom: 6 }}>
          {definition.label}
        </span>
        <input
          type="text"
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(26, 58, 92, 0.4)',
            borderRadius: 8,
            color: '#E8F0FE',
            fontFamily: "'Poppins', sans-serif",
            fontSize: 13,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>
    );
  }

  return null;
}

// ── PLUGIN ICON MAPPER ───────────────────────────────────────────────────────

import {
  Timer, Wind, Quote, Puzzle as PuzzleIcon,
  BookOpen, Brain, Calendar, Zap,
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  Timer,
  Wind,
  Quote,
  Puzzle: PuzzleIcon,
  BookOpen,
  Brain,
  Calendar,
  Zap,
};

function PluginIcon({ iconName, size, color }: { iconName: string; size: number; color: string }) {
  const IconComponent = ICON_MAP[iconName] ?? PuzzleIcon;
  return <IconComponent size={size} color={color} />;
}