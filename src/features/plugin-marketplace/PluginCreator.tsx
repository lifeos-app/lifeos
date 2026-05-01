/**
 * PluginCreator — Plugin creation wizard
 *
 * 5-step wizard: Choose type → Basic info → Content/config → Preview & test → Publish
 * Includes template starters per plugin type and live preview.
 */

import { useState, useMemo } from 'react';
import { usePluginMarketplace } from './usePluginMarketplace';
import { PLUGIN_CATEGORIES, type PluginCategory, type MarketplacePlugin } from '../../stores/marketplaceStore';

// ── STEP CONFIG ───────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Plugin Type', icon: '🎯' },
  { id: 2, label: 'Basic Info', icon: '📝' },
  { id: 3, label: 'Content', icon: '⚙️' },
  { id: 4, label: 'Preview', icon: '👁️' },
  { id: 5, label: 'Publish', icon: '🚀' },
];

// ── TYPE TEMPLATES ───────────────────────────────────────────────────────────

const TYPE_TEMPLATES: Record<PluginCategory, { name: string; description: string; tags: string[]; permissions: string[] }> = {
  junction: {
    name: 'Custom Junction',
    description: 'A structured daily routine or challenge sequence.',
    tags: ['routine', 'challenge', 'daily'],
    permissions: ['habits.write', 'schedule.read'],
  },
  academy: {
    name: 'Academy Course',
    description: 'A guided learning course with lessons and exercises.',
    tags: ['course', 'learning', 'education'],
    permissions: ['journal.write', 'goals.read'],
  },
  widget: {
    name: 'Dashboard Widget',
    description: 'A compact data display for the LifeOS dashboard.',
    tags: ['widget', 'dashboard', 'data'],
    permissions: ['habits.read', 'goals.read'],
  },
  'realm-skin': {
    name: 'Realm Skin',
    description: 'A visual theme that transforms your Realm experience.',
    tags: ['realm', 'skin', 'visual'],
    permissions: ['realm.write'],
  },
  'ai-persona': {
    name: 'AI Persona',
    description: 'A custom AI personality for coaching and conversations.',
    tags: ['ai', 'persona', 'coaching'],
    permissions: ['ai.chat'],
  },
  integration: {
    name: 'Integration Plugin',
    description: 'Connect LifeOS with external services and data sources.',
    tags: ['integration', 'sync', 'external'],
    permissions: ['schedule.read', 'schedule.write'],
  },
  theme: {
    name: 'Custom Theme',
    description: 'A complete visual overhaul for the LifeOS interface.',
    tags: ['theme', 'visual', 'ui'],
    permissions: [],
  },
};

// ── STEP INDICATOR ───────────────────────────────────────────────────────────

function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, i) => (
        <div key={step.id} className="flex items-center">
          <div
            className="w-8 h-8 flex items-center justify-center text-sm font-semibold"
            style={{
              borderRadius: '50%',
              backgroundColor: currentStep >= step.id ? '#00D4FF' : '#1E293B',
              color: currentStep >= step.id ? '#0F172A' : '#64748B',
              border: currentStep === step.id ? '2px solid #00D4FF' : currentStep > step.id ? '2px solid #39FF14' : '2px solid #334155',
              transition: 'all 0.2s ease',
            }}
          >
            {currentStep > step.id ? '✓' : step.id}
          </div>
          {i < totalSteps - 1 && (
            <div
              className="w-8 md:w-16 h-0.5 mx-1"
              style={{
                backgroundColor: currentStep > step.id ? '#39FF14' : '#1E293B',
                transition: 'background-color 0.2s ease',
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── STEP 1: CHOOSE TYPE ──────────────────────────────────────────────────────

function StepChooseType({ selectedType, onSelect }: { selectedType: PluginCategory | null; onSelect: (type: PluginCategory) => void }) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-2" style={{ color: '#F1F5F9' }}>
        What would you like to create?
      </h2>
      <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>
        Choose the type of plugin that best matches your idea.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PLUGIN_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className="p-4 text-left"
            style={{
              backgroundColor: selectedType === cat.id ? `${cat.color}15` : '#111827',
              border: `2px solid ${selectedType === cat.id ? cat.color : '#1E293B'}`,
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onClick={() => onSelect(cat.id)}
            onMouseEnter={(e) => {
              if (selectedType !== cat.id) {
                e.currentTarget.style.borderColor = `${cat.color}60`;
              }
            }}
            onMouseLeave={(e) => {
              if (selectedType !== cat.id) {
                e.currentTarget.style.borderColor = '#1E293B';
              }
            }}
          >
            <div className="text-3xl mb-2">{cat.icon}</div>
            <div className="text-sm font-semibold" style={{ color: selectedType === cat.id ? cat.color : '#F1F5F9' }}>
              {cat.label}
            </div>
            <div className="text-xs mt-1" style={{ color: '#94A3B8' }}>{cat.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── STEP 2: BASIC INFO ────────────────────────────────────────────────────────

function StepBasicInfo({
  form,
  onChange,
}: {
  form: { name: string; description: string; icon: string; longDescription: string; tags: string };
  onChange: (field: string, value: string) => void;
}) {
  const iconOptions = ['🔌', '🎯', '🎓', '📊', '🎨', '🤖', '🔗', '🌙', '✨', '🔥', '💡', '🧘', '🧊', '🏛️', '💰', '🌌', '🦉', '📅', '🕹️', '📈', '💪', '🧪', '🎭', '⚡'];

  return (
    <div>
      <h2 className="text-xl font-bold mb-2" style={{ color: '#F1F5F9' }}>
        Basic Information
      </h2>
      <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>
        Give your plugin a name, description, and visual identity.
      </p>

      <div className="space-y-5">
        {/* Icon picker */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: '#CBD5E1' }}>
            Plugin Icon
          </label>
          <div className="flex flex-wrap gap-2">
            {iconOptions.map(emoji => (
              <button
                key={emoji}
                className="w-10 h-10 flex items-center justify-center text-xl"
                style={{
                  backgroundColor: form.icon === emoji ? 'rgba(0,212,255,0.2)' : '#1E293B',
                  border: `2px solid ${form.icon === emoji ? '#00D4FF' : '#334155'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
                onClick={() => onChange('icon', emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: '#CBD5E1' }}>
            Plugin Name *
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="e.g., Morning Power Routine"
            className="w-full px-3 py-2.5 text-sm"
            style={{
              backgroundColor: '#111827',
              border: '1px solid #1E293B',
              borderRadius: '8px',
              color: '#F1F5F9',
              outline: 'none',
            }}
            onFocus={(e) => e.target.style.borderColor = '#00D4FF'}
            onBlur={(e) => e.target.style.borderColor = '#1E293B'}
          />
        </div>

        {/* Short Description */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: '#CBD5E1' }}>
            Short Description *
          </label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder="A brief one-liner for your plugin"
            className="w-full px-3 py-2.5 text-sm"
            style={{
              backgroundColor: '#111827',
              border: '1px solid #1E293B',
              borderRadius: '8px',
              color: '#F1F5F9',
              outline: 'none',
            }}
            onFocus={(e) => e.target.style.borderColor = '#00D4FF'}
            onBlur={(e) => e.target.style.borderColor = '#1E293B'}
          />
        </div>

        {/* Long Description */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: '#CBD5E1' }}>
            Full Description
          </label>
          <textarea
            value={form.longDescription}
            onChange={(e) => onChange('longDescription', e.target.value)}
            placeholder="Describe your plugin in detail. What does it do? How does it work? What makes it special?"
            rows={6}
            className="w-full px-3 py-2.5 text-sm"
            style={{
              backgroundColor: '#111827',
              border: '1px solid #1E293B',
              borderRadius: '8px',
              color: '#F1F5F9',
              outline: 'none',
              resize: 'vertical',
            }}
            onFocus={(e) => e.target.style.borderColor = '#00D4FF'}
            onBlur={(e) => e.target.style.borderColor = '#1E293B'}
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: '#CBD5E1' }}>
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={form.tags}
            onChange={(e) => onChange('tags', e.target.value)}
            placeholder="e.g., morning, routine, mindfulness"
            className="w-full px-3 py-2.5 text-sm"
            style={{
              backgroundColor: '#111827',
              border: '1px solid #1E293B',
              borderRadius: '8px',
              color: '#F1F5F9',
              outline: 'none',
            }}
            onFocus={(e) => e.target.style.borderColor = '#00D4FF'}
            onBlur={(e) => e.target.style.borderColor = '#1E293B'}
          />
        </div>
      </div>
    </div>
  );
}

// ── STEP 3: CONTENT ──────────────────────────────────────────────────────────

function StepContent({
  pluginType,
  content,
  onChange,
}: {
  pluginType: PluginCategory;
  content: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  // Different configuration fields per plugin type
  const fields: Record<PluginCategory, { key: string; label: string; placeholder: string; multiline?: boolean }[]> = {
    junction: [
      { key: 'steps', label: 'Junction Steps (one per line)', placeholder: 'Step 1: 5 minutes breathing\nStep 2: 10 minutes journaling\nStep 3: 20 minutes exercise', multiline: true },
      { key: 'duration', label: 'Total Duration (minutes)', placeholder: '30' },
      { key: 'frequency', label: 'Frequency', placeholder: 'daily' },
      { key: 'xpReward', label: 'XP Reward per Completion', placeholder: '50' },
    ],
    academy: [
      { key: 'modules', label: 'Course Modules (one per line)', placeholder: 'Module 1: Introduction\nModule 2: Core Concepts\nModule 3: Practice', multiline: true },
      { key: 'duration', label: 'Estimated Course Duration', placeholder: '4 weeks' },
      { key: 'difficulty', label: 'Difficulty Level', placeholder: 'beginner / intermediate / advanced' },
    ],
    widget: [
      { key: 'dataSource', label: 'Data Source', placeholder: 'habits / goals / finances / health' },
      { key: 'layout', label: 'Widget Layout', placeholder: 'card / list / chart / heatmap' },
      { key: 'refreshRate', label: 'Refresh Rate (seconds)', placeholder: '300' },
    ],
    'realm-skin': [
      { key: 'primaryColor', label: 'Primary Color', placeholder: '#0A0A0F' },
      { key: 'accentColor', label: 'Accent Color', placeholder: '#D4AF37' },
      { key: 'animations', label: 'Animation Type', placeholder: 'particles / gradient / pulse' },
    ],
    'ai-persona': [
      { key: 'personality', label: 'Persona Personality', placeholder: 'Calm, wise, measured — asks guiding Socratic questions' },
      { key: 'style', label: 'Communication Style', placeholder: 'Encouraging but direct. Uses analogies and stories.' },
      { key: 'expertise', label: 'Areas of Expertise', placeholder: 'Stoicism, productivity, health optimization' },
    ],
    integration: [
      { key: 'service', label: 'External Service', placeholder: 'Google Calendar / Notion / GitHub' },
      { key: 'syncMode', label: 'Sync Mode', placeholder: 'two-way / one-way-read / one-way-write' },
      { key: 'webhookUrl', label: 'Webhook URL (optional)', placeholder: 'https://...' },
    ],
    theme: [
      { key: 'backgroundColor', label: 'Background Color', placeholder: '#0A0A0F' },
      { key: 'textColor', label: 'Primary Text Color', placeholder: '#F1F5F9' },
      { key: 'accentColor', label: 'Accent Color', placeholder: '#00D4FF' },
      { key: 'fontStyle', label: 'Font Style', placeholder: 'modern / classic / mono' },
    ],
  };

  const activeFields = fields[pluginType] || [];

  return (
    <div>
      <h2 className="text-xl font-bold mb-2" style={{ color: '#F1F5F9' }}>
        Plugin Configuration
      </h2>
      <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>
        Configure the specific settings for your {PLUGIN_CATEGORIES.find(c => c.id === pluginType)?.label ?? 'plugin'}.
      </p>

      <div className="space-y-5">
        {activeFields.map(field => (
          <div key={field.key}>
            <label className="block text-sm font-medium mb-2" style={{ color: '#CBD5E1' }}>
              {field.label}
            </label>
            {field.multiline ? (
              <textarea
                value={content[field.key] || ''}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={4}
                className="w-full px-3 py-2.5 text-sm"
                style={{
                  backgroundColor: '#111827',
                  border: '1px solid #1E293B',
                  borderRadius: '8px',
                  color: '#F1F5F9',
                  outline: 'none',
                  resize: 'vertical',
                }}
                onFocus={(e) => e.target.style.borderColor = '#00D4FF'}
                onBlur={(e) => e.target.style.borderColor = '#1E293B'}
              />
            ) : (
              <input
                type="text"
                value={content[field.key] || ''}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full px-3 py-2.5 text-sm"
                style={{
                  backgroundColor: '#111827',
                  border: '1px solid #1E293B',
                  borderRadius: '8px',
                  color: '#F1F5F9',
                  outline: 'none',
                }}
                onFocus={(e) => e.target.style.borderColor = '#00D4FF'}
                onBlur={(e) => e.target.style.borderColor = '#1E293B'}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── STEP 4: PREVIEW ──────────────────────────────────────────────────────────

function StepPreview({ plugin }: { plugin: Partial<MarketplacePlugin> }) {
  const catConfig = PLUGIN_CATEGORIES.find(c => c.id === plugin.category);
  return (
    <div>
      <h2 className="text-xl font-bold mb-2" style={{ color: '#F1F5F9' }}>
        Preview Your Plugin
      </h2>
      <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>
        This is how your plugin will appear in the Marketplace.
      </p>

      <div
        className="p-6"
        style={{
          backgroundColor: '#111827',
          border: `1px solid ${catConfig?.color ?? '#1E293B'}30`,
          borderRadius: '12px',
        }}
      >
        {/* Simulated card preview */}
        <div className="flex items-start gap-4">
          <div
            className="flex items-center justify-center text-4xl flex-shrink-0"
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '12px',
              backgroundColor: `${catConfig?.color ?? '#64748B'}15`,
              border: `1px solid ${catConfig?.color ?? '#64748B'}30`,
            }}
          >
            {plugin.icon ?? '🔌'}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold" style={{ color: '#F1F5F9' }}>
              {plugin.name ?? 'Untitled Plugin'}
            </h3>
            <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
              {plugin.description ?? 'No description'}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span
                className="px-2 py-0.5 text-xs"
                style={{
                  backgroundColor: `${catConfig?.color ?? '#64748B'}15`,
                  color: catConfig?.color ?? '#64748B',
                  borderRadius: '4px',
                }}
              >
                {catConfig?.label ?? 'Unknown'}
              </span>
              {plugin.tags?.map(tag => (
                <span key={tag} className="text-xs" style={{ color: '#64748B' }}>
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {plugin.longDescription && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid #1E293B' }}>
            <p className="text-sm" style={{ color: '#CBD5E1', whiteSpace: 'pre-wrap' }}>
              {plugin.longDescription}
            </p>
          </div>
        )}

        <div className="mt-4 flex items-center gap-4">
          <span className="text-xs" style={{ color: '#64748B' }}>v1.0.0</span>
          {plugin.permissions && plugin.permissions.length > 0 && (
            <span className="text-xs" style={{ color: '#94A3B8' }}>
              🔒 {plugin.permissions.length} permission{plugin.permissions.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Tips */}
      <div
        className="mt-6 p-4"
        style={{
          backgroundColor: 'rgba(0,212,255,0.05)',
          border: '1px solid rgba(0,212,255,0.2)',
          borderRadius: '8px',
        }}
      >
        <h4 className="text-sm font-semibold mb-2" style={{ color: '#00D4FF' }}>
          💡 Pre-Publish Checklist
        </h4>
        <ul className="space-y-1 text-sm" style={{ color: '#CBD5E1' }}>
          <li className="flex items-center gap-2">
            <span style={{ color: plugin.name ? '#39FF14' : '#F43F5E' }}>{plugin.name ? '✓' : '✗'}</span>
            Plugin has a name
          </li>
          <li className="flex items-center gap-2">
            <span style={{ color: plugin.description ? '#39FF14' : '#F43F5E' }}>{plugin.description ? '✓' : '✗'}</span>
            Plugin has a description
          </li>
          <li className="flex items-center gap-2">
            <span style={{ color: plugin.icon ? '#39FF14' : '#F43F5E' }}>{plugin.icon ? '✓' : '✗'}</span>
            Plugin has an icon
          </li>
          <li className="flex items-center gap-2">
            <span style={{ color: (plugin.tags?.length ?? 0) > 0 ? '#39FF14' : '#FACC15' }}>{(plugin.tags?.length ?? 0) > 0 ? '✓' : '~'}</span>
            Plugin has tags (recommended)
          </li>
        </ul>
      </div>
    </div>
  );
}

// ── STEP 5: PUBLISH ──────────────────────────────────────────────────────────

function StepPublish({ onPublish, isPublishing }: { onPublish: () => void; isPublishing: boolean }) {
  return (
    <div className="text-center">
      <div className="text-6xl mb-4">🚀</div>
      <h2 className="text-xl font-bold mb-2" style={{ color: '#F1F5F9' }}>
        Ready to Publish!
      </h2>
      <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>
        Your plugin will be submitted for review. Once approved, it will be available
        in the Marketplace for all LifeOS users.
      </p>

      <div
        className="p-4 mb-6 text-left"
        style={{
          backgroundColor: '#111827',
          border: '1px solid #1E293B',
          borderRadius: '8px',
        }}
      >
        <h4 className="text-sm font-semibold mb-2" style={{ color: '#F1F5F9' }}>
          What happens next?
        </h4>
        <ul className="space-y-2 text-sm" style={{ color: '#CBD5E1' }}>
          <li className="flex items-start gap-2">
            <span style={{ color: '#00D4FF' }}>1.</span>
            Your plugin is reviewed for quality and security
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: '#00D4FF' }}>2.</span>
            Once approved, it appears in the Marketplace
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: '#00D4FF' }}>3.</span>
            Users can discover, install, and rate your plugin
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: '#00D4FF' }}>4.</span>
            You receive feedback and can publish updates
          </li>
        </ul>
      </div>

      <button
        className="px-8 py-3 text-base font-semibold"
        style={{
          background: isPublishing
            ? '#334155'
            : 'linear-gradient(135deg, #00D4FF, #A855F7)',
          color: '#fff',
          border: 'none',
          borderRadius: '10px',
          cursor: isPublishing ? 'not-allowed' : 'pointer',
          opacity: isPublishing ? 0.7 : 1,
        }}
        disabled={isPublishing}
        onClick={onPublish}
      >
        {isPublishing ? 'Publishing...' : '🚀 Publish to Marketplace'}
      </button>
    </div>
  );
}

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function PluginCreator() {
  const { installPlugin } = usePluginMarketplace();
  const [step, setStep] = useState(1);
  const [isPublishing, setIsPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  const [pluginType, setPluginType] = useState<PluginCategory | null>(null);
  const [basicInfo, setBasicInfo] = useState({
    name: '',
    description: '',
    icon: '🔌',
    longDescription: '',
    tags: '',
  });
  const [content, setContent] = useState<Record<string, string>>({});

  // When type is selected, pre-fill template
  const handleTypeSelect = (type: PluginCategory) => {
    setPluginType(type);
    const template = TYPE_TEMPLATES[type];
    setBasicInfo(prev => ({
      ...prev,
      name: prev.name || template.name,
      description: prev.description || template.description,
      tags: prev.tags || template.tags.join(', '),
    }));
  };

  const handleBasicInfoChange = (field: string, value: string) => {
    setBasicInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleContentChange = (key: string, value: string) => {
    setContent(prev => ({ ...prev, [key]: value }));
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return pluginType !== null;
      case 2: return basicInfo.name.trim() !== '' && basicInfo.description.trim() !== '';
      case 3: return true;
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  };

  const buildPlugin = (): MarketplacePlugin => {
    const now = new Date().toISOString().split('T')[0];
    return {
      id: `custom-${pluginType}-${Date.now()}`,
      name: basicInfo.name,
      description: basicInfo.description,
      longDescription: basicInfo.longDescription || basicInfo.description,
      category: pluginType!,
      author: { name: 'You', avatar: '👤', verified: false },
      version: '1.0.0',
      icon: basicInfo.icon,
      screenshots: [],
      tags: basicInfo.tags.split(',').map(t => t.trim()).filter(Boolean),
      rating: 0,
      ratingCount: 0,
      installCount: 0,
      featured: false,
      updatedAt: now,
      permissions: TYPE_TEMPLATES[pluginType!]?.permissions ?? [],
      dependencies: [],
      changelog: [
        { version: '1.0.0', date: now, changes: ['Initial release'] },
      ],
    };
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    const plugin = buildPlugin();
    await installPlugin(plugin);
    setIsPublishing(false);
    setPublished(true);
  };

  if (published) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1
          className="text-2xl font-bold mb-2"
          style={{
            background: 'linear-gradient(135deg, #39FF14, #00D4FF)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Plugin Published!
        </h1>
        <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>
          Your plugin "{basicInfo.name}" has been created and installed.
          It's now available in your installed plugins list.
        </p>
        <button
          className="px-6 py-2.5 text-sm font-semibold"
          style={{
            background: 'linear-gradient(135deg, #00D4FF, #A855F7)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
          onClick={() => {
            setPublished(false);
            setStep(1);
            setPluginType(null);
            setBasicInfo({ name: '', description: '', icon: '🔌', longDescription: '', tags: '' });
            setContent({});
          }}
        >
          Create Another Plugin
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl md:text-3xl font-bold mb-1"
          style={{
            background: 'linear-gradient(135deg, #39FF14, #00D4FF)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Create a Plugin
        </h1>
        <p className="text-sm" style={{ color: '#94A3B8' }}>
          Build something amazing for the LifeOS community
        </p>
      </div>

      {/* Step indicator */}
      <StepIndicator currentStep={step} totalSteps={STEPS.length} />

      {/* Step content */}
      <div className="mb-6">
        {step === 1 && (
          <StepChooseType selectedType={pluginType} onSelect={handleTypeSelect} />
        )}
        {step === 2 && (
          <StepBasicInfo form={basicInfo} onChange={handleBasicInfoChange} />
        )}
        {step === 3 && pluginType && (
          <StepContent pluginType={pluginType} content={content} onChange={handleContentChange} />
        )}
        {step === 4 && (
          <StepPreview plugin={buildPlugin()} />
        )}
        {step === 5 && (
          <StepPublish onPublish={handlePublish} isPublishing={isPublishing} />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          className="px-4 py-2 text-sm"
          style={{
            color: '#94A3B8',
            background: 'none',
            border: '1px solid #334155',
            borderRadius: '8px',
            cursor: 'pointer',
            visibility: step > 1 ? 'visible' : 'hidden',
          }}
          onClick={() => setStep(Math.max(1, step - 1))}
        >
          ← Back
        </button>
        {step < 5 && (
          <button
            className="px-6 py-2.5 text-sm font-semibold"
            style={{
              background: canProceed()
                ? 'linear-gradient(135deg, #00D4FF, #A855F7)'
                : '#334155',
              color: canProceed() ? '#fff' : '#64748B',
              border: 'none',
              borderRadius: '8px',
              cursor: canProceed() ? 'pointer' : 'not-allowed',
            }}
            disabled={!canProceed()}
            onClick={() => setStep(step + 1)}
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}