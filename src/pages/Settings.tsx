/**
 * Settings — Central hub for profile, preferences, integrations, and account management
 *
 * Extracted tabs into lazy-loaded components under ./settings/ for maintainability.
 * Shell handles: tab navigation, error banner, loading state.
 */
import { useState, useEffect, type JSX } from 'react';
import { useUserStore } from '../stores/useUserStore';
import {
  User, Palette, Sparkles, Send, Link2, Crown, Database,
  RotateCcw, Navigation, Info, Settings as SettingsIcon,
  AlertTriangle, Loader2, Shield, RefreshCw, CheckCircle, XCircle, Server, Activity,
  BarChart3, Volume2, Bell, Puzzle, Cpu, Gift,
} from 'lucide-react';
import { PluginManager } from '../components/PluginManager';
import { NotificationPrefsPanel } from '../components/NotificationPrefsPanel';
import { PushNotificationSetup } from '../components/PushNotificationSetup';
import { TelegramConnect } from '../components/TelegramConnect';
import { IntegrationCard } from '../components/settings/IntegrationCard';
import { useGoogleIntegration } from '../hooks/useGoogleIntegration';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { getAISettings, saveAISettings, PROVIDER_DEFAULTS, ALLOWED_PROVIDERS, type AISettings } from '../lib/intent-engine';
import { checkOllamaConnection, type OllamaStatus } from '../lib/llm-proxy';
import { useSubscription } from '../hooks/useSubscription';
import { resetTours, startTourManually } from '../components/SpotlightTour';
import { PageHeader } from '../components/ui/PageHeader';
import { SettingsProfile } from './settings/SettingsProfile';
import { SettingsPreferences } from './settings/SettingsPreferences';
import { SettingsDataPrivacy } from './settings/SettingsDataPrivacy';
import { SettingsAbout } from './settings/SettingsAbout';
import { FamilyPlanSection } from '../components/settings/FamilyPlanSection';
import { AIUsageStats } from '../components/AIUsageStats';
import { LLMProviderSettings } from '../components/LLMProviderSettings';
import { AuditLogViewer } from '../components/AuditLogViewer';
import { ReferralPanel } from '../components/ReferralPanel';
import { HealthDeviceImport } from '../components/HealthDeviceImport';
import './Settings.css';

type TabId = 'profile' | 'preferences' | 'notifications' | 'ai' | 'ai-providers' | 'ai-usage' | 'audit' | 'telegram' | 'integrations' | 'health-import' | 'subscription' | 'referral' | 'data' | 'onboarding' | 'tours' | 'plugins' | 'about';

const TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'preferences', label: 'Preferences', icon: Palette },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'ai', label: 'AI Assistant', icon: Sparkles },
  { id: 'ai-providers', label: 'AI Providers', icon: Cpu },
  { id: 'ai-usage', label: 'AI Usage', icon: BarChart3 },
  { id: 'audit', label: 'Audit Log', icon: Shield },
  { id: 'telegram', label: 'Telegram', icon: Send },
  { id: 'integrations', label: 'Integrations', icon: Link2 },
  { id: 'health-import', label: 'Health Import', icon: Activity },
  { id: 'subscription', label: 'Subscription', icon: Crown },
  { id: 'referral', label: 'Referrals', icon: Gift },
  { id: 'data', label: 'Data & Privacy', icon: Database },
  { id: 'plugins', label: 'Plugins', icon: Puzzle },
  { id: 'onboarding', label: 'Onboarding', icon: RotateCcw },
  { id: 'tours', label: 'Tours & Help', icon: Navigation },
  { id: 'about', label: 'About', icon: Info },
];

export function Settings() {
  const user = useUserStore(s => s.user);
  const { tier, loading: subLoading } = useSubscription();
  const googleIntegration = useGoogleIntegration();
  const { eventCount: gcalEventCount, lastSynced: gcalLastSynced, refetch: gcalRefetch } = useGoogleCalendar();

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && TABS.some(t => t.id === tab)) return tab as TabId;
    return 'profile';
  });

  const [error, setError] = useState('');

  // AI Settings
  const [aiSettings, setAiSettings] = useState<AISettings>(getAISettings());
  const [aiSaved, setAiSaved] = useState(false);

  const handleAISettingChange = (key: keyof AISettings, value: string | boolean) => {
    const updated = { ...aiSettings, [key]: value };
    setAiSettings(updated);
    saveAISettings(updated);
    setAiSaved(true);
    setTimeout(() => setAiSaved(false), 2000);
  };

  // ── Onboarding tab state ──
  const [showRedoConfirm, setShowRedoConfirm] = useState(false);
  const [redoing, setRedoing] = useState(false);

  const handleRedoOnboarding = async () => {
    if (!user?.id) return;
    setRedoing(true);
    try {
      const { supabase } = await import('../lib/data-access');
      const today = new Date().toISOString().split('T')[0];
      await supabase.from('tasks').update({ is_deleted: true }).eq('user_id', user.id).gte('due_date', today);
      await supabase.from('goals').update({ is_deleted: true }).eq('user_id', user.id).eq('status', 'active');
      await supabase.from('habits').update({ is_deleted: true }).eq('user_id', user.id).eq('is_active', true);
      const { data } = await supabase.from('user_profiles').select('preferences').eq('user_id', user.id).maybeSingle();
      const existingPrefs = (data?.preferences as Record<string, unknown>) || {};
      await supabase.from('user_profiles').update({
        onboarding_complete: false,
        preferences: { _history: [((existingPrefs as any)?._history || []), { redo_at: new Date().toISOString(), previous: existingPrefs }] },
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);
      window.location.href = '/app/';
    } catch {
      setError('Failed to reset onboarding. Please try again.');
      setRedoing(false);
    }
  };

  return (
    <div className="settings">
      <PageHeader
        icon={<SettingsIcon size={22} />}
        title="Settings"
        subtitle="Manage your profile and preferences"
      />

      {error && <div className="set-error"><AlertTriangle size={14} /> {error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Mobile: horizontal scrollable tabs */}
        <nav className="set-mobile-tabs">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`set-mobile-tab ${activeTab === tab.id ? 'active' : ''}`}>
                <Icon size={16} /> {tab.label}
              </button>
            );
          })}
        </nav>

        <div style={{ display: 'flex', gap: 24, flexDirection: 'row' }}>
          {/* Desktop: vertical sidebar */}
          <aside className="set-sidebar">
            <nav className="set-sidebar-nav">
              {TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`set-sidebar-tab ${activeTab === tab.id ? 'active' : ''}`}>
                    <Icon size={16} /> <span>{tab.label}</span>
                    {activeTab === tab.id && <div className="set-sidebar-indicator" />}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Main content */}
          <div className="set-content">
            {activeTab === 'profile' && <SettingsProfile onError={setError} />}
            {activeTab === 'preferences' && <SettingsPreferences />}
            {activeTab === 'notifications' && (
              <>
                <PushNotificationSetup />
                <NotificationPrefsPanel />
              </>
            )}

            {activeTab === 'ai' && (
              <AISettingsTab aiSettings={aiSettings} aiSaved={aiSaved} onChange={handleAISettingChange} />
            )}

            {activeTab === 'ai-providers' && (
              <LLMProviderSettings />
            )}

            {activeTab === 'ai-usage' && (
              <section className="set-section">
                <AIUsageStats />
              </section>
            )}

            {activeTab === 'audit' && (
              <section className="set-section">
                <AuditLogViewer />
              </section>
            )}

            {activeTab === 'telegram' && (
              <section className="set-section">
                <div className="set-section-header"><Send size={18} /><h2>Telegram</h2></div>
                <TelegramConnect />
              </section>
            )}

            {activeTab === 'integrations' && (
              <IntegrationsTab googleIntegration={googleIntegration} gcalEventCount={gcalEventCount}
                gcalLastSynced={gcalLastSynced} gcalRefetch={gcalRefetch} />
            )}

            {activeTab === 'health-import' && <HealthDeviceImport />}

            {activeTab === 'subscription' && <SubscriptionTab subLoading={subLoading} tier={tier} />}

            {activeTab === 'referral' && <ReferralPanel />}

            {activeTab === 'data' && <SettingsDataPrivacy onError={setError} />}

            {activeTab === 'plugins' && (
              <section className="set-section">
                <PluginManager />
              </section>
            )}

            {activeTab === 'onboarding' && (
              <OnboardingTab showRedoConfirm={showRedoConfirm} setShowRedoConfirm={setShowRedoConfirm}
                redoing={redoing} onRedo={handleRedoOnboarding} />
            )}

            {activeTab === 'tours' && <ToursTab />}
            {activeTab === 'about' && <SettingsAbout />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Inline Tab Components (small enough to keep here) ──

function AISettingsTab({ aiSettings, aiSaved, onChange }: {
  aiSettings: AISettings; aiSaved: boolean;
  onChange: (key: keyof AISettings, value: string | boolean) => void;
}): JSX.Element {
  const [ttsEnabled, setTtsEnabled] = useState(() => {
    try { return localStorage.getItem('lifeos:tts-enabled') === 'true'; } catch { return false; }
  });

  const handleTTSToggle = () => {
    const next = !ttsEnabled;
    setTtsEnabled(next);
    try { localStorage.setItem('lifeos:tts-enabled', next ? 'true' : 'false'); } catch { /* Safari private */ }
  };

  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [checking, setChecking] = useState(false);

  const checkConnection = async () => {
    setChecking(true);
    try {
      const status = await checkOllamaConnection();
      setOllamaStatus(status);
    } catch {
      setOllamaStatus({ available: false, models: [], error: 'Failed to check' });
    }
    setChecking(false);
  };

  // Check connection when provider changes to ollama
  useEffect(() => {
    if (aiSettings.provider === 'ollama' && !ollamaStatus) {
      checkConnection();
    }
  }, [aiSettings.provider]);

  const handleProviderChange = (provider: string) => {
    const defaults = PROVIDER_DEFAULTS[provider];
    const updated: AISettings = {
      ...aiSettings,
      provider,
      model: defaults?.model || aiSettings.model,
      proxyUrl: defaults?.proxyUrl || aiSettings.proxyUrl,
    };
    // Directly update all fields via onChange
    Object.entries(updated).forEach(([key, value]) => {
      onChange(key as keyof AISettings, value);
    });
  };

  const providerLabels: Record<string, string> = {
    ollama: 'Ollama (Local)',
    openrouter: 'OpenRouter',
    gemini: 'Google Gemini',
    anthropic: 'Anthropic',
    openai: 'OpenAI',
  };

  return (
    <section className="set-section">
      <div className="set-section-header">
        <Sparkles size={18} /><h2>AI Assistant</h2>
        {aiSaved && <span className="set-badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>Saved</span>}
      </div>
      <p className="set-section-desc">Talk naturally and LifeOS will create tasks, log expenses, and more.</p>
      <div className="set-form-grid">
        <div className="set-form-group">
          <label>AI Enabled<span className="set-form-hint">Toggle the AI chat assistant on/off</span></label>
          <button className={`set-toggle ${aiSettings.enabled ? 'on' : 'off'}`}
            onClick={() => onChange('enabled', !aiSettings.enabled)}>
            <span className="set-toggle-dot" />
            <span className="set-toggle-label">{aiSettings.enabled ? 'On' : 'Off'}</span>
          </button>
        </div>
        <div className="set-form-group">
          <label>Read AI responses aloud<span className="set-form-hint">Use text-to-speech to read AI responses out loud after streaming completes</span></label>
          <button className={`set-toggle ${ttsEnabled ? 'on' : 'off'}`}
            onClick={handleTTSToggle}>
            <span className="set-toggle-dot" />
            <span className="set-toggle-label">{ttsEnabled ? 'On' : 'Off'}</span>
          </button>
        </div>
        <div className="set-form-group">
          <label>Provider<span className="set-form-hint">AI backend to use for intent processing</span></label>
          <select value={aiSettings.provider} onChange={e => handleProviderChange(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14 }}>
            {ALLOWED_PROVIDERS.map(p => (
              <option key={p} value={p} style={{ background: '#1a1a2e' }}>{providerLabels[p] || p}</option>
            ))}
          </select>
        </div>
        <div className="set-form-group">
          <label>Model<span className="set-form-hint">Model name for the selected provider</span></label>
          <input type="text" value={aiSettings.model} onChange={e => onChange('model', e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14 }}
            placeholder={PROVIDER_DEFAULTS[aiSettings.provider]?.model || 'model-name'} />
        </div>
        <div className="set-form-group">
          <label>Proxy URL<span className="set-form-hint">API endpoint URL</span></label>
          <input type="text" value={aiSettings.proxyUrl} onChange={e => onChange('proxyUrl', e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14 }}
            placeholder={PROVIDER_DEFAULTS[aiSettings.provider]?.proxyUrl || '/api/llm-proxy.php'} />
        </div>
      </div>

      {/* Ollama Connection Check */}
      {aiSettings.provider === 'ollama' && (
        <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Server size={16} style={{ color: '#00D4FF' }} />
            <strong style={{ fontSize: 14 }}>Ollama Connection</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <button onClick={checkConnection} disabled={checking}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(0,212,255,0.3)', background: 'rgba(0,212,255,0.1)', color: '#00D4FF', fontSize: 13, cursor: checking ? 'wait' : 'pointer' }}>
              <RefreshCw size={13} className={checking ? 'spin' : ''} />
              {checking ? 'Checking...' : 'Check Connection'}
            </button>
            {ollamaStatus && (
              ollamaStatus.available
                ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#22C55E', fontSize: 13 }}><CheckCircle size={14} /> Connected</span>
                : <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#EF4444', fontSize: 13 }}><XCircle size={14} /> {ollamaStatus.error || 'Not reachable'}</span>
            )}
          </div>
          {ollamaStatus?.available && ollamaStatus.models.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Available models:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {ollamaStatus.models.map(m => (
                  <span key={m} onClick={() => onChange('model', m)}
                    style={{ padding: '3px 8px', borderRadius: 6, background: m === aiSettings.model ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.05)',
                      border: m === aiSettings.model ? '1px solid rgba(0,212,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
                      fontSize: 11, color: m === aiSettings.model ? '#00D4FF' : 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="set-ai-info">
        <Info size={14} />
        <span>{aiSettings.provider === 'ollama'
          ? 'Ollama runs locally — no API key needed. Use ⌘J to open the AI assistant.'
          : 'API keys are stored on the server. Use ⌘J to open the AI assistant.'}</span>
      </div>
      {ttsEnabled && (
        <div className="set-ai-info" style={{ background: 'rgba(0,212,255,0.08)', borderColor: 'rgba(0,212,255,0.2)' }}>
          <Volume2 size={14} style={{ color: '#00D4FF' }} />
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>TTS is active — AI responses will be spoken aloud after they finish generating. Click the <Volume2 size={12} style={{ verticalAlign: 'middle' }} /> button on any message to replay it.</span>
        </div>
      )}
    </section>
  );
}

function IntegrationsTab({ googleIntegration, gcalEventCount, gcalLastSynced, gcalRefetch }: any): JSX.Element {
  return (
    <section className="set-section">
      <div className="set-section-header"><Link2 size={18} /><h2>Integrations</h2></div>
      <p className="set-section-desc">Connect external services to supercharge your LifeOS workflow.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        <IntegrationCard service="Gmail" icon={<User size={16} />} connected={googleIntegration.isGmailConnected}
          loading={googleIntegration.loading} description="See unread counts and create tasks from emails"
          onConnect={() => googleIntegration.connectGoogle()} onDisconnect={() => googleIntegration.disconnectGoogle()} />
        <IntegrationCard service="Google Calendar" icon={<Crown size={16} />} connected={googleIntegration.isCalendarConnected}
          loading={googleIntegration.loading} description="Sync events between LifeOS and Google Calendar"
          onConnect={() => googleIntegration.connectGoogle()} onDisconnect={() => googleIntegration.disconnectGoogle()} />
      </div>
    </section>
  );
}

function SubscriptionTab({ subLoading, tier }: { subLoading: boolean; tier: string }): JSX.Element {
  return (
    <>
      <section className="set-section">
        <div className="set-section-header"><Crown size={18} /><h2>Subscription</h2>
          {tier === 'pro' && <span className="set-badge" style={{ background: 'rgba(0,212,255,0.15)', color: '#00D4FF' }}>Pro</span>}
        </div>
        {subLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0' }}>
            <Loader2 size={16} className="spin" /><span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Loading...</span>
          </div>
        ) : (
          <div style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(139,92,246,0.08))', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Crown size={16} /><h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#00D4FF' }}>Early Adopter — Pro Unlocked</h4>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
              Thank you for being one of the first! Full access to all Pro features — no subscription required.
            </p>
          </div>
        )}
      </section>

      {/* Family Plan */}
      <FamilyPlanSection />
    </>
  );
}

function OnboardingTab({ showRedoConfirm, setShowRedoConfirm, redoing, onRedo }: {
  showRedoConfirm: boolean; setShowRedoConfirm: (v: boolean) => void; redoing: boolean; onRedo: () => void;
}): JSX.Element {
  return (
    <section className="set-section">
      <div className="set-section-header"><RotateCcw size={18} /><h2>Onboarding</h2></div>
      <p className="set-section-desc">Redo the onboarding process to rebuild your goals, habits, and life system from scratch.</p>
      {!showRedoConfirm ? (
        <button className="set-redo-btn" onClick={() => setShowRedoConfirm(true)}><RotateCcw size={14} /> Redo Onboarding</button>
      ) : (
        <div className="set-redo-confirm">
          <p className="set-redo-warning"><AlertTriangle size={16} /> This will clear all your goals, habits, and tasks and restart onboarding.</p>
          <div className="set-redo-actions">
            <button className="set-redo-cancel" onClick={() => setShowRedoConfirm(false)}>Cancel</button>
            <button className="set-redo-confirm-btn" onClick={onRedo} disabled={redoing}>
              {redoing ? <><Loader2 size={14} className="spin" /> Resetting...</> : 'Yes, redo onboarding'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ToursTab(): JSX.Element {
  const tours = [
    { id: 'dashboard', label: 'Dashboard', icon: <Sparkles size={14} /> },
    { id: 'goals', label: 'Goals', icon: <Link2 size={14} /> },
    { id: 'habits', label: 'Habits', icon: <Send size={14} /> },
    { id: 'schedule', label: 'Schedule', icon: <Crown size={14} /> },
    { id: 'health', label: 'Health', icon: <Info size={14} /> },
    { id: 'finance', label: 'Finance', icon: <Crown size={14} /> },
    { id: 'junction', label: 'Junction', icon: <Sparkles size={14} /> },
    { id: 'gamification', label: 'Character', icon: <Shield size={14} /> },
  ];
  return (
    <section className="set-section">
      <div className="set-section-header"><Navigation size={18} /><h2>Tours & Help</h2></div>
      <p className="set-section-desc">Replay any guided walkthrough to learn about LifeOS features.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
        {tours.map(t => (
          <button key={t.id} className="set-btn" onClick={() => startTourManually(t.id as any)}>
            {t.icon}<span style={{ marginLeft: 6 }}>{t.label}</span>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <button className="set-btn" style={{ width: '100%' }} onClick={() => { resetTours(); window.location.reload(); }}>
          <RotateCcw size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />Reset All Tours
        </button>
      </div>
    </section>
  );
}