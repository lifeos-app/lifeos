/**
 * VoiceSettings — Voice configuration panel
 *
 * Language selection, auto-confirm, always-on mode,
 * noise threshold, voice speed, wake word, offline support.
 */

import { type VoiceSettings as VoiceSettingsType } from './useVoiceCommand';

// ─── Component ────────────────────────────────────────────────────

interface VoiceSettingsProps {
  settings: VoiceSettingsType;
  onChange: (update: Partial<VoiceSettingsType> | ((prev: VoiceSettingsType) => VoiceSettingsType)) => void;
}

const LANGUAGES = [
  { value: 'en-AU', label: 'English (Australia)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es-ES', label: 'Español' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'zh-CN', label: '中文 (简体)' },
  { value: 'ko-KR', label: '한국어' },
  { value: 'hi-IN', label: 'हिन्दी' },
  { value: 'ar-SA', label: 'العربية' },
];

function Toggle({
  checked,
  onChange,
  label,
  description,
  color = '#00D4FF',
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  description?: string;
  color?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: '#E2E8F0' }}>{label}</p>
        {description && (
          <p className="text-xs mt-0.5" style={{ color: '#8BA4BE' }}>{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className="relative w-11 h-6 rounded-full flex-shrink-0 transition-colors duration-200"
        style={{ background: checked ? color : 'rgba(30,58,91,0.6)' }}
      >
        <div
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200"
          style={{ left: checked ? '22px' : '2px' }}
        />
      </button>
    </div>
  );
}

function Slider({
  value,
  onChange,
  min,
  max,
  step,
  label,
  description,
  formatValue,
  color = '#00D4FF',
}: {
  value: number;
  onChange: (val: number) => void;
  min: number;
  max: number;
  step: number;
  label: string;
  description?: string;
  formatValue?: (v: number) => string;
  color?: string;
}) {
  const percentage = ((value - min) / (max - min)) * 100;
  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium" style={{ color: '#E2E8F0' }}>{label}</p>
        <span className="text-xs font-mono" style={{ color }}>
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      {description && (
        <p className="text-xs mb-2" style={{ color: '#8BA4BE' }}>{description}</p>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} ${percentage}%, rgba(30,58,91,0.6) ${percentage}%)`,
        }}
      />
    </div>
  );
}

export function VoiceSettings({ settings, onChange }: VoiceSettingsProps) {
  return (
    <div className="flex flex-col" style={{ color: '#E2E8F0' }}>
      {/* Header */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(30,58,91,0.3)' }}>
        <h2 className="text-sm font-semibold" style={{ color: '#00D4FF' }}>
          ⚙️ Voice Settings
        </h2>
        <p className="text-xs mt-0.5" style={{ color: '#8BA4BE' }}>
          Configure how LifeOS listens and responds
        </p>
      </div>

      <div className="px-4 py-3 space-y-4 overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin' }}>
        {/* Language */}
        <div>
          <label className="text-sm font-medium block mb-1.5" style={{ color: '#E2E8F0' }}>
            Recognition Language
          </label>
          <select
            value={settings.language}
            onChange={e => onChange({ language: e.target.value })}
            className="w-full text-sm rounded-lg px-3 py-2 appearance-none cursor-pointer"
            style={{
              background: 'rgba(15,23,42,0.8)',
              border: '1px solid rgba(30,58,91,0.4)',
              color: '#E2E8F0',
            }}
          >
            {LANGUAGES.map(lang => (
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>
        </div>

        {/* Divider */}
        <div style={{ borderBottom: '1px solid rgba(30,58,91,0.2)' }} />

        {/* Auto-confirm */}
        <Toggle
          checked={settings.autoConfirm}
          onChange={val => onChange({ autoConfirm: val })}
          label="Auto-confirm"
          description="Skip confirmation for high-confidence commands"
        />

        {settings.autoConfirm && (
          <Slider
            value={settings.autoConfirmThreshold}
            onChange={val => onChange({ autoConfirmThreshold: val })}
            min={0.5}
            max={1.0}
            step={0.05}
            label="Confidence threshold"
            description="Minimum confidence to auto-confirm"
            formatValue={v => `${Math.round(v * 100)}%`}
          />
        )}

        <div style={{ borderBottom: '1px solid rgba(30,58,91,0.2)' }} />

        {/* Always-on mode */}
        <Toggle
          checked={settings.alwaysOn}
          onChange={val => onChange({ alwaysOn: val })}
          label="Always-on mode"
          description="Continuously listen for wake word and commands"
          color="#39FF14"
        />

        {settings.alwaysOn && (
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: '#8BA4BE' }}>
              Wake word
            </label>
            <input
              type="text"
              value={settings.wakeWord}
              onChange={e => onChange({ wakeWord: e.target.value })}
              className="w-full text-sm rounded-lg px-3 py-2"
              style={{
                background: 'rgba(15,23,42,0.8)',
                border: '1px solid rgba(30,58,91,0.4)',
                color: '#E2E8F0',
              }}
              placeholder="e.g. hey LifeOS"
            />
          </div>
        )}

        <div style={{ borderBottom: '1px solid rgba(30,58,91,0.2)' }} />

        {/* Noise threshold */}
        <Slider
          value={settings.noiseThreshold}
          onChange={val => onChange({ noiseThreshold: val })}
          min={0}
          max={1}
          step={0.05}
          label="Noise threshold"
          description="Filter out background noise. Higher = less sensitive"
          formatValue={v => `${Math.round(v * 100)}%`}
        />

        <div style={{ borderBottom: '1px solid rgba(30,58,91,0.2)' }} />

        {/* Voice speed (TTS) */}
        <Slider
          value={settings.voiceSpeed}
          onChange={val => onChange({ voiceSpeed: val })}
          min={0.5}
          max={2.0}
          step={0.1}
          label="Readback speed"
          description="How fast LifeOS speaks confirmations"
          formatValue={v => `${v.toFixed(1)}x`}
        />

        <div style={{ borderBottom: '1px solid rgba(30,58,91,0.2)' }} />

        {/* Offline support */}
        <Toggle
          checked={settings.offlineSupport}
          onChange={val => onChange({ offlineSupport: val })}
          label="Offline commands"
          description="Parse basic commands without internet (limited)"
          color="#FACC15"
        />

        {/* Info footer */}
        <div className="p-3 rounded-lg mt-2" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.1)' }}>
          <p className="text-xs leading-relaxed" style={{ color: '#8BA4BE' }}>
            🎙️ Voice commands work with Web Speech API (Chrome, Edge). Offline mode parses basic patterns without internet. Always-on mode uses more battery.
          </p>
        </div>
      </div>
    </div>
  );
}