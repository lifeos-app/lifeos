/**
 * Settings — Central hub for profile, preferences, integrations, and account management
 *
 * Extracted tabs into lazy-loaded components under ./settings/ for maintainability.
 * Shell handles: tab navigation, error banner, loading state.
 */
import { useState, type JSX } from 'react';
import { useUserStore } from '../stores/useUserStore';
import {
  User, Palette, Sparkles, Send, Link2, Crown, Database,
  RotateCcw, Navigation, Info, Settings as SettingsIcon,
  AlertTriangle, Loader2, Shield, Gauge,
} from 'lucide-react';
import { TelegramConnect } from '../components/TelegramConnect';
import { IntegrationCard } from '../components/settings/IntegrationCard';
import { useGoogleIntegration } from '../hooks/useGoogleIntegration';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { getAISettings, saveAISettings, type AISettings } from '../lib/intent-engine';
import { useSubscription } from '../hooks/useSubscription';
import { useAIRateLimit } from '../hooks/useAIRateLimit';
import { getCostCaps } from '../lib/ai-rate-limiter';
import { resetTours, startTourManually } from '../components/SpotlightTour';
import { PageHeader } from '../components/ui/PageHeader';
import { SettingsProfile } from './settings/SettingsProfile';
import { SettingsPreferences } from './settings/SettingsPreferences';
import { SettingsDataPrivacy } from './settings/SettingsDataPrivacy';
import { SettingsAbout } from './settings/SettingsAbout';
import './Settings.css';

type TabId = 'profile' | 'preferences' | 'ai' | 'telegram' | 'integrations' | 'subscription' | 'data' | 'onboarding' | 'tours' | 'about';

const TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'preferences', label: 'Preferences', icon: Palette },
  { id: 'ai', label: 'AI Assistant', icon: Sparkles },
  { id: 'telegram', label: 'Telegram', icon: Send },
  { id: 'integrations', label: 'Integrations', icon: Link2 },
  { id: 'subscription', label: 'Subscription', icon: Crown },
  { id: 'data', label: 'Data & Privacy', icon: Database },
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

            {activeTab === 'ai' && (
              <AISettingsTab aiSettings={aiSettings} aiSaved={aiSaved} onChange={handleAISettingChange} />
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

            {activeTab === 'subscription' && <SubscriptionTab subLoading={subLoading} tier={tier} />}

            {activeTab === 'data' && <SettingsDataPrivacy onError={setError} />}

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
  const rateLimit = useAIRateLimit();
  const costCaps = getCostCaps();
  const tier = rateLimit.messagesLimit <= 5 ? 'Free' : 'Pro';
  const costCapDollars = (rateLimit.costLimitCents / 100).toFixed(2);
  const costUsedDollars = (rateLimit.costUsedCents / 100).toFixed(2);
  const resetTimeStr = rateLimit.resetAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });

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
      </div>

      {/* ── Rate Limit Usage Card ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0,212,255,0.06), rgba(139,92,246,0.06))',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: '16px 20px',
        marginTop: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Gauge size={16} style={{ color: '#00D4FF' }} />
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#00D4FF' }}>Daily Usage</h4>
          <span style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 6,
            background: tier === 'Pro' ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.08)',
            color: tier === 'Pro' ? '#00D4FF' : 'rgba(255,255,255,0.5)',
          }}>{tier}</span>
        </div>

        {/* Message usage bar */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Messages</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontVariantNumeric: 'tabular-nums' }}>
              {rateLimit.messagesUsed} / {rateLimit.messagesLimit}
            </span>
          </div>
          <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, (rateLimit.messagesUsed / Math.max(1, rateLimit.messagesLimit)) * 100)}%`,
              height: '100%',
              background: rateLimit.isLimited ? '#EF4444' : rateLimit.remaining <= 2 ? '#FFD93D' : '#00D4FF',
              borderRadius: 3,
              transition: 'width 0.3s ease, background 0.3s ease',
            }} />
          </div>
        </div>

        {/* Cost usage bar */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Cost</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontVariantNumeric: 'tabular-nums' }}>
              ${costUsedDollars} / ${costCapDollars}
            </span>
          </div>
          <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, (rateLimit.costUsedCents / Math.max(1, rateLimit.costLimitCents)) * 100)}%`,
              height: '100%',
              background: rateLimit.isLimited ? '#EF4444' : rateLimit.costUsedCents >= rateLimit.costLimitCents * 0.8 ? '#FFD93D' : '#8B5CF6',
              borderRadius: 3,
              transition: 'width 0.3s ease, background 0.3s ease',
            }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            Resets at {resetTimeStr}
          </span>
          {rateLimit.isLimited && (
            <span style={{ fontSize: 11, color: '#EF4444', fontWeight: 600 }}>
              Limit reached
            </span>
          )}
        </div>
      </div>

      <div className="set-ai-info">
        <Info size={14} />
        <span>API keys are stored on the server. Use <kbd>Cmd+J</kbd> to open the AI assistant.</span>
      </div>
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