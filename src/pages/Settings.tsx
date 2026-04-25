import { useState, useEffect } from 'react';
import { supabase } from '../lib/data-access';
import { useUserStore } from '../stores/useUserStore';
import { getErrorMessage } from '../utils/error';
import { logger } from '../utils/logger';
import {
  User, Palette, Database, Shield, Info, Sparkles,
  Loader2, Save, LogOut, Trash2, Download, Check, AlertTriangle, ExternalLink, RotateCcw,
  Navigation, Crown, CreditCard, Globe, Send, Edit2, Link2,
  Settings as SettingsIcon, Mail, Calendar, Github, MessageCircle,
  Target, Zap, CalendarDays, Heart, DollarSign, Swords
} from 'lucide-react';
import { TelegramConnect } from '../components/TelegramConnect';
import '../components/TelegramConnect.css';
import { IntegrationCard } from '../components/settings/IntegrationCard';
import '../components/settings/IntegrationCard.css';
import { useGoogleIntegration } from '../hooks/useGoogleIntegration';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { getAISettings, saveAISettings, type AISettings } from '../lib/intent-engine';
import { resetTours, startTourManually } from '../components/SpotlightTour';
import { useSubscription } from '../hooks/useSubscription';
import { ClassRoleSelector } from '../components/ClassRoleSelector';
import { CLASS_ICONS, CLASS_NAMES, CLASS_DESCRIPTIONS, ROLE_ARCHETYPES, type ClassKey, type RoleKey } from '../lib/gamification/class-quests';
import { PageHeader } from '../components/ui/PageHeader';
import { FamilyPlanSection } from '../components/settings/FamilyPlanSection';
import './Settings.css';

interface UserProfile {
  user_id: string; display_name: string; occupation: string;
  primary_focus: string; onboarding_complete: boolean;
  preferences: Record<string, unknown> | null; created_at: string; updated_at: string;
}

declare const __APP_VERSION__: string;
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';

const THEME_COLORS = [
  { name: 'Deep Space', bg: '#050E1A', accent: '#00D4FF' },
  { name: 'Neon Night', bg: '#0A0A1A', accent: '#39FF14' },
  { name: 'Rose Gold', bg: '#1A0A10', accent: '#F43F5E' },
  { name: 'Royal Purple', bg: '#0F0A1A', accent: '#A855F7' },
];

type TabId = 'profile' | 'theme' | 'ai' | 'telegram' | 'integrations' | 'subscription' | 'data' | 'onboarding' | 'account' | 'tours' | 'about'

const TABS = [
  { id: 'profile' as TabId, label: 'Profile', icon: User },
  { id: 'theme' as TabId, label: 'Theme', icon: Palette },
  { id: 'ai' as TabId, label: 'AI Assistant', icon: Sparkles },
  { id: 'telegram' as TabId, label: 'Telegram', icon: Send },
  { id: 'integrations' as TabId, label: 'Integrations', icon: Link2 },
  { id: 'subscription' as TabId, label: 'Subscription', icon: Crown },
  { id: 'data' as TabId, label: 'Data', icon: Database },
  { id: 'onboarding' as TabId, label: 'Onboarding', icon: RotateCcw },
  { id: 'account' as TabId, label: 'Account', icon: Shield },
  { id: 'tours' as TabId, label: 'Tours & Help', icon: Navigation },
  { id: 'about' as TabId, label: 'About', icon: Info },
]

export function Settings() {
  const user = useUserStore(s => s.user);
  const signOut = useUserStore(s => s.signOut);
  const { tier, expiresAt, loading: subLoading, upgrade, manageSubscription } = useSubscription();
  const googleIntegration = useGoogleIntegration();
  const { eventCount: gcalEventCount, lastSynced: gcalLastSynced, refetch: gcalRefetch } = useGoogleCalendar();
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && TABS.some(t => t.id === tab)) return tab as TabId;
    return 'profile';
  })
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [showRedoConfirm, setShowRedoConfirm] = useState(false);
  const [redoing, setRedoing] = useState(false);
  const [showClassRoleModal, setShowClassRoleModal] = useState(false);

  // Class & Role
  const userClass: ClassKey | null = (profile?.preferences as Record<string, unknown> | undefined)?.class || null;
  const userRole: RoleKey | null = (profile?.preferences as Record<string, unknown> | undefined)?.role || null;

  // Form
  const [displayName, setDisplayName] = useState('');
  const [occupation, setOccupation] = useState('');
  const [primaryFocus, setPrimaryFocus] = useState('');

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

  const fetchProfile = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (data) {
      setProfile(data);
      setDisplayName(data.display_name || '');
      setOccupation(data.occupation || '');
      setPrimaryFocus(data.primary_focus || '');
    }
    setLoading(false);
  };

  useEffect(() => { fetchProfile(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveProfile = async () => {
    if (!user?.id) return;
    setSaving(true); setError(''); setSaved(false);
    const payload = {
      display_name: displayName.trim(),
      occupation: occupation.trim(),
      primary_focus: primaryFocus.trim(),
      updated_at: new Date().toISOString(),
    };
    let err;
    if (profile) {
      const res = await supabase.from('user_profiles').update(payload).eq('user_id', user.id);
      err = res.error;
    } else {
      const res = await supabase.from('user_profiles').insert({
        user_id: user.id, ...payload, onboarding_complete: true,
        created_at: new Date().toISOString(),
      });
      err = res.error;
    }
    if (err) { setError(err.message); } else { setSaved(true); setTimeout(() => setSaved(false), 3000); fetchProfile(); }
    setSaving(false);
  };

  const exportData = async () => {
    if (!user?.id) return;
    setExporting(true);
    try {
      const tables = ['tasks', 'goals', 'schedule_events', 'habits', 'journal_entries', 'notes', 'income', 'expenses', 'bills', 'clients', 'inbox_items'];
      const allData: Record<string, unknown[]> = {};
      for (const table of tables) {
        const { data } = await supabase.from(table).select('*').eq('user_id', user.id).eq('is_deleted', false);
        if (data && data.length > 0) allData[table] = data;
      }
      
      let blob: Blob;
      let filename: string;
      
      if (exportFormat === 'json') {
        blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
        filename = `lifeos-export-${new Date().toISOString().slice(0, 10)}.json`;
      } else {
        // CSV export - create one CSV per table
        let csvContent = '';
        for (const [table, rows] of Object.entries(allData)) {
          if (rows.length === 0) continue;
          csvContent += `\n\n=== ${table.toUpperCase()} ===\n`;
          const headers = Object.keys(rows[0] as Record<string, unknown>);
          csvContent += headers.join(',') + '\n';
          for (const row of rows) {
            const values = headers.map(h => {
              const val = (row as Record<string, unknown>)[h];
              const str = val === null || val === undefined ? '' : String(val);
              return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
            });
            csvContent += values.join(',') + '\n';
          }
        }
        blob = new Blob([csvContent], { type: 'text/csv' });
        filename = `lifeos-export-${new Date().toISOString().slice(0, 10)}.csv`;
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError('Export failed. Please try again.');
    }
    setExporting(false);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleDeleteAccount = async () => {
    if (deleteText !== 'DELETE') return;
    // Soft-delete all user data
    if (!user?.id) return;
    const tables = ['tasks', 'goals', 'events', 'habits', 'journal_entries', 'notes', 'income', 'expenses', 'bills', 'clients', 'inbox_items'];
    for (const table of tables) {
      await supabase.from(table).update({ is_deleted: true }).eq('user_id', user.id);
    }
    await signOut();
  };

  const handleRedoOnboarding = async () => {
    if (!user?.id) return;
    setRedoing(true);
    try {
      // Keep all historical data — only soft-delete future-dated tasks
      const today = new Date().toISOString().split('T')[0];
      await supabase.from('tasks').update({ is_deleted: true })
        .eq('user_id', user.id)
        .gte('due_date', today);

      // Soft-delete active goals and habits (they'll be recreated)
      await supabase.from('goals').update({ is_deleted: true })
        .eq('user_id', user.id)
        .eq('status', 'active');
      await supabase.from('habits').update({ is_deleted: true })
        .eq('user_id', user.id)
        .eq('is_active', true);

      // Reset onboarding flag — keep old preferences as history
      const existingPrefs = profile?.preferences || {};
      await supabase.from('user_profiles').update({
        onboarding_complete: false,
        preferences: {
          _history: [
            ...((existingPrefs as Record<string, unknown> | undefined)?._history || []),
            { redo_at: new Date().toISOString(), previous: existingPrefs }
          ]
        },
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);

      // Redirect to app root — triggers onboarding check
      window.location.href = '/app/';
    } catch (e) {
      setError('Failed to reset onboarding. Please try again.');
      setRedoing(false);
    }
  };

  const handleClassRoleUpdate = async (classKey: ClassKey, roleKey: RoleKey) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const existingPrefs = profile?.preferences || {};
      await supabase.from('user_profiles').update({
        preferences: {
          ...existingPrefs,
          class: classKey,
          role: roleKey,
        },
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);

      setShowClassRoleModal(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await fetchProfile(); // Refresh to show new values
    } catch (e) {
      setError('Failed to update class/role. Please try again.');
    }
    setSaving(false);
  };

  return (
    <div className="settings">
      <PageHeader
        icon={<SettingsIcon size={22} />}
        title="Settings"
        subtitle="Manage your profile and preferences"
      />

      {error && <div className="set-error"><AlertTriangle size={14} /> {error}</div>}

      {loading ? <div className="set-loading"><Loader2 size={24} className="spin" /></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Mobile: horizontal scrollable tabs */}
          <nav className="set-mobile-tabs">
            {TABS.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`set-mobile-tab ${active ? 'active' : ''}`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              )
            })}
          </nav>

          <div style={{ display: 'flex', gap: 24, flexDirection: 'row' }}>
            {/* Desktop: vertical sidebar tabs */}
            <aside className="set-sidebar">
              <nav className="set-sidebar-nav">
                {TABS.map(tab => {
                  const Icon = tab.icon
                  const active = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`set-sidebar-tab ${active ? 'active' : ''}`}
                    >
                      <Icon size={16} />
                      <span>{tab.label}</span>
                      {active && <div className="set-sidebar-indicator" />}
                    </button>
                  )
                })}
              </nav>
            </aside>

            {/* Main content area */}
            <div className="set-content">
              {/* Profile */}
              {activeTab === 'profile' && (
                <section className="set-section">
                  <div className="set-section-header">
                    <User size={18} />
                    <h2>Profile</h2>
                  </div>
                  <div className="set-form-grid">
                    <div className="set-form-group">
                      <label htmlFor="set-display-name">Display Name</label>
                      <input id="set-display-name" type="text" placeholder="Your name" value={displayName}
                        onChange={e => setDisplayName(e.target.value)} />
                    </div>
                    <div className="set-form-group">
                      <label htmlFor="set-email">Email</label>
                      <input id="set-email" type="email" value={user?.email || ''} disabled className="set-readonly" aria-readonly="true" />
                    </div>
                    <div className="set-form-group">
                      <label htmlFor="set-occupation">Occupation</label>
                      <input id="set-occupation" type="text" placeholder="What do you do?" value={occupation}
                        onChange={e => setOccupation(e.target.value)} />
                    </div>
                    <div className="set-form-group">
                      <label htmlFor="set-primary-focus">Primary Focus</label>
                      <input id="set-primary-focus" type="text" placeholder="What drives you?" value={primaryFocus}
                        onChange={e => setPrimaryFocus(e.target.value)} />
                    </div>
                  </div>

                  {/* Class & Role Display */}
                  <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <label style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                        <Sparkles size={14} style={{ marginRight: 6, verticalAlign: 'middle', color: '#00D4FF' }} />
                        Character Identity
                      </label>
                      <button
                        className="set-btn"
                        onClick={() => setShowClassRoleModal(true)}
                        style={{ padding: '6px 12px', fontSize: 13 }}
                      >
                        <Edit2 size={12} style={{ marginRight: 4 }} />
                        {userClass || userRole ? 'Change' : 'Set'}
                      </button>
                    </div>
                    {(userClass || userRole) ? (
                      <div style={{
                        display: 'flex',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}>
                        {userRole && ROLE_ARCHETYPES[userRole] && (
                          <div style={{
                            padding: '10px 16px',
                            background: 'rgba(0,212,255,0.08)',
                            border: '1px solid rgba(0,212,255,0.2)',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}>
                            <span style={{ fontSize: 20 }}>{ROLE_ARCHETYPES[userRole].icon}</span>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{userRole}</div>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                                {ROLE_ARCHETYPES[userRole].description}
                              </div>
                            </div>
                          </div>
                        )}
                        {userClass && (
                          <div style={{
                            padding: '10px 16px',
                            background: 'rgba(0,212,255,0.08)',
                            border: '1px solid rgba(0,212,255,0.2)',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}>
                            <span style={{ fontSize: 20 }}>{CLASS_ICONS[userClass]}</span>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{CLASS_NAMES[userClass]}</div>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                                {CLASS_DESCRIPTIONS[userClass]}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                        Set your RPG character identity — choose a class and role that defines you.
                      </p>
                    )}
                  </div>

                  <button className="set-save-btn" onClick={saveProfile} disabled={saving}>
                    {saving ? <><Loader2 size={14} className="spin" /> Saving...</> :
                     saved ? <><Check size={14} /> Saved!</> :
                     <><Save size={14} /> Save Profile</>}
                  </button>
                </section>
              )}

              {/* Theme */}
              {activeTab === 'theme' && (
                <section className="set-section">
                  <div className="set-section-header">
                    <Palette size={18} />
                    <h2>Theme</h2>
                    <span className="set-badge">Coming Soon</span>
                  </div>
                  <div className="set-theme-grid">
                    {THEME_COLORS.map((t, i) => (
                      <div key={i} className={`set-theme-card ${i === 0 ? 'active' : ''}`}>
                        <div className="set-theme-preview" style={{ background: t.bg }}>
                          <div className="set-theme-accent" style={{ background: t.accent }} />
                          <div className="set-theme-line" style={{ background: t.accent, opacity: 0.2 }} />
                          <div className="set-theme-line short" style={{ background: t.accent, opacity: 0.1 }} />
                        </div>
                        <span className="set-theme-name">{t.name}</span>
                      </div>
                    ))}
                  </div>
                  <p className="set-hint">Custom themes coming soon. Currently using Deep Space.</p>
                </section>
              )}

              {/* AI Assistant */}
              {activeTab === 'ai' && (
                <section className="set-section">
                  <div className="set-section-header">
                    <Sparkles size={18} />
                    <h2>AI Assistant</h2>
                    {aiSaved && <span className="set-badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>Saved</span>}
                  </div>
                  <p className="set-section-desc">
                    Talk naturally and LifeOS will create tasks, log expenses, schedule events, and more. Powered by AI.
                  </p>
                  
                  <div className="set-form-grid">
                    <div className="set-form-group">
                      <label>AI Provider</label>
                      <div className="set-provider-grid">
                        {/* Gemini — active */}
                        <button className="set-provider-btn active" style={{ cursor: 'default' }}>
                          <span className="set-provider-icon"><Globe size={14} /></span>
                          <span className="set-provider-name">Google Gemini</span>
                          <span className="set-model-tier" style={{ color: '#22C55E', marginLeft: 'auto' }}>Free</span>
                        </button>
                        {/* Coming soon providers */}
                        {[
                          { icon: 'anthropic', name: 'Anthropic Claude' },
                          { icon: 'openai', name: 'OpenAI' },
                          { icon: 'openrouter', name: 'OpenRouter' },
                        ].map(p => (
                          <button key={p.name} className="set-provider-btn" style={{ opacity: 0.4, cursor: 'not-allowed' }} disabled>
                            <span className="set-provider-icon"><Globe size={14} /></span>
                            <span className="set-provider-name">{p.name}</span>
                            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Coming Soon</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="set-form-group">
                      <label>
                        AI Enabled
                        <span className="set-form-hint">Toggle the AI chat assistant on/off</span>
                      </label>
                      <button
                        className={`set-toggle ${aiSettings.enabled ? 'on' : 'off'}`}
                        onClick={() => handleAISettingChange('enabled', !aiSettings.enabled)}
                      >
                        <span className="set-toggle-dot" />
                        <span className="set-toggle-label">{aiSettings.enabled ? 'On' : 'Off'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="set-ai-info">
                    <Info size={14} />
                    <span>API keys are stored securely on the server. Your browser never sees them. Use <kbd>⌘J</kbd> to open the AI assistant.</span>
                  </div>
                </section>
              )}

              {/* Telegram */}
              {activeTab === 'telegram' && (
                <section className="set-section">
                  <div className="set-section-header">
                    <Send size={18} />
                    <h2>Telegram</h2>
                  </div>
                  <TelegramConnect />
                </section>
              )}

              {/* Integrations */}
              {activeTab === 'integrations' && (
                <section className="set-section">
                  <div className="set-section-header">
                    <Link2 size={18} />
                    <h2>Integrations</h2>
                  </div>
                  <p className="set-section-desc">
                    Connect external services to supercharge your LifeOS workflow.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                    <IntegrationCard
                      service="Gmail"
                      icon={<Mail size={16} />}
                      connected={googleIntegration.isGmailConnected}
                      loading={googleIntegration.loading}
                      description="See unread counts, important emails, and create tasks from emails"
                      onConnect={() => googleIntegration.connectGoogle()}
                      onDisconnect={() => googleIntegration.disconnectGoogle()}
                    >
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                        <p style={{ margin: '0 0 8px 0' }}>
                          Gmail is connected with read-only access. LifeOS can:
                        </p>
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          <li>Show unread email count on your dashboard</li>
                          <li>Display important/starred emails</li>
                          <li>Create tasks from emails</li>
                        </ul>
                      </div>
                    </IntegrationCard>

                    <IntegrationCard
                      service="Google Calendar"
                      icon={<Calendar size={16} />}
                      connected={googleIntegration.isCalendarConnected}
                      loading={googleIntegration.loading}
                      description="Sync events between LifeOS and Google Calendar"
                      onConnect={() => googleIntegration.connectGoogle()}
                      onDisconnect={() => googleIntegration.disconnectGoogle()}
                    >
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                        <p style={{ margin: '0 0 8px 0' }}>
                          Google Calendar is connected with read-only access. LifeOS can:
                        </p>
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          <li>Show upcoming Google Calendar events on your schedule</li>
                          <li>Include Google events in AI context</li>
                        </ul>
                        {gcalEventCount > 0 && (
                          <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(66,133,244,0.08)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ fontWeight: 600, color: '#4285F4', fontSize: 12 }}>{gcalEventCount} events synced</div>
                              {gcalLastSynced && <div style={{ fontSize: 11, marginTop: 2 }}>Last sync: {gcalLastSynced.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>}
                            </div>
                            <button
                              onClick={gcalRefetch}
                              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(66,133,244,0.3)', background: 'transparent', color: '#4285F4', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                            >
                              Sync Now
                            </button>
                          </div>
                        )}
                      </div>
                    </IntegrationCard>

                    <IntegrationCard
                      service="Flipper Zero"
                      icon={<span style={{ fontSize: 14 }}>🔌</span>}
                      connected={false}
                      description="Auto-trigger game-style check-in when Flipper Zero is plugged in via USB"
                      onConnect={async () => {
                        try {
                          if ('usb' in navigator) {
                            await navigator.usb.requestDevice({ 
                              filters: [{ vendorId: 0x0483, productId: 0x5740 }] 
                            });
                            alert('Flipper Zero connected! Plug it in anytime to trigger quick check-in.');
                          } else {
                            alert('WebUSB not supported in this browser. Try Chrome or Edge.');
                          }
                        } catch (err) {
                          logger.error('Failed to connect Flipper:', err);
                        }
                      }}
                    />

                    <IntegrationCard
                      service="GitHub"
                      icon={<Github size={16} />}
                      connected={false}
                      comingSoon
                      description="Track commits, PRs, and link repos to goals"
                      onConnect={() => {}}
                    />

                    <IntegrationCard
                      service="Slack"
                      icon={<MessageCircle size={16} />}
                      connected={false}
                      comingSoon
                      description="Receive nudges and log tasks from Slack"
                      onConnect={() => {}}
                    />
                  </div>

                  <div className="set-ai-info" style={{ marginTop: 16 }}>
                    <Info size={14} />
                    <span>
                      Google integrations require Gmail API and Calendar API to be enabled in your Google Cloud Console.
                      Your provider tokens are stored securely by Supabase and never exposed to the browser.
                    </span>
                  </div>
                </section>
              )}

              {/* Subscription */}
              {activeTab === 'subscription' && (
                <section className="set-section">
                  <div className="set-section-header">
                    <Crown size={18} />
                    <h2>Subscription</h2>
                    {tier === 'pro' && (
                      <span className="set-badge" style={{ background: 'rgba(0,212,255,0.15)', color: '#00D4FF' }}>
                        Pro
                      </span>
                    )}
                  </div>
                  
                  {subLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0' }}>
                      <Loader2 size={16} className="spin" />
                      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Loading subscription...</span>
                    </div>
                  ) : (
                    <>
                      <div className="set-subscription-status">
                        <div className="set-subscription-tier">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Crown size={20} style={{ color: '#00D4FF' }} />
                            <div>
                              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                                LifeOS Pro — Early Adopter
                              </h3>
                              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                                All Pro features unlocked
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="set-subscription-pro">
                          <div style={{
                            background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(139,92,246,0.08))',
                            border: '1px solid rgba(0,212,255,0.2)',
                            borderRadius: 12,
                            padding: '20px 24px',
                            marginBottom: 16,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                              <Crown size={16} />
                              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#00D4FF' }}>
                                Early Adopter — Pro Unlocked
                              </h4>
                            </div>
                            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                              Thank you for being one of the first to use LifeOS! As an early adopter, you have 
                              full access to all Pro features — 15 AI messages/day, advanced analytics, financial 
                              tracking, weekly reviews, and more. No subscription required.
                            </p>
                            <p style={{ margin: '12px 0 0 0', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                              We&apos;re building something special, and you&apos;re part of it from the beginning.
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </section>

                {/* Family Plan */}
                <FamilyPlanSection />
              )}

              {/* Data */}
              {activeTab === 'data' && (
                <section className="set-section">
                  <div className="set-section-header">
                    <Database size={18} />
                    <h2>Data</h2>
                  </div>
                  <p className="set-section-desc">Export all your data for backup or portability.</p>
                  <div className="set-export-format">
                    <label>Format:</label>
                    <div className="set-format-btns">
                      <button className={`set-format-btn ${exportFormat === 'json' ? 'active' : ''}`} 
                        onClick={() => setExportFormat('json')}>JSON</button>
                      <button className={`set-format-btn ${exportFormat === 'csv' ? 'active' : ''}`} 
                        onClick={() => setExportFormat('csv')}>CSV</button>
                    </div>
                  </div>
                  <button className="set-export-btn" onClick={exportData} disabled={exporting}>
                    {exporting ? <><Loader2 size={14} className="spin" /> Exporting...</> :
                     <><Download size={14} /> Export as {exportFormat.toUpperCase()}</>}
                  </button>
                </section>
              )}

              {/* Onboarding */}
              {activeTab === 'onboarding' && (
                <section className="set-section">
                  <div className="set-section-header">
                    <RotateCcw size={18} />
                    <h2>Onboarding</h2>
                  </div>
                  <p className="set-section-desc">
                    Redo the onboarding process to rebuild your goals, habits, and life system from scratch. This will clear your existing goals, habits, and tasks.
                  </p>
                  {!showRedoConfirm ? (
                    <button className="set-redo-btn" onClick={() => setShowRedoConfirm(true)}>
                      <RotateCcw size={14} /> Redo Onboarding
                    </button>
                  ) : (
                    <div className="set-redo-confirm">
                      <p className="set-redo-warning">
                        <AlertTriangle size={16} /> This will clear all your goals, habits, and tasks and restart the onboarding process.
                      </p>
                      <div className="set-redo-actions">
                        <button className="set-redo-cancel" onClick={() => setShowRedoConfirm(false)}>
                          Cancel
                        </button>
                        <button className="set-redo-confirm-btn" onClick={handleRedoOnboarding} disabled={redoing}>
                          {redoing ? <><Loader2 size={14} className="spin" /> Resetting...</> : 'Yes, redo onboarding'}
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Account */}
              {activeTab === 'account' && (
                <section className="set-section">
                  <div className="set-section-header">
                    <Shield size={18} />
                    <h2>Account</h2>
                  </div>
                  <div className="set-account-actions">
                    <button className="set-signout-btn" onClick={handleSignOut}>
                      <LogOut size={14} /> Sign Out
                    </button>
                    <button className="set-delete-btn" onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}>
                      <Trash2 size={14} /> Delete Account
                    </button>
                  </div>
                  {showDeleteConfirm && (
                    <div className="set-delete-confirm">
                      <p className="set-delete-warning">
                        <AlertTriangle size={16} /> This will soft-delete ALL your data. Type <strong>DELETE</strong> to confirm.
                      </p>
                      <div className="set-delete-input-row">
                        <input type="text" placeholder='Type "DELETE"' value={deleteText}
                          onChange={e => setDeleteText(e.target.value)} />
                        <button className="set-delete-confirm-btn" disabled={deleteText !== 'DELETE'}
                          onClick={handleDeleteAccount}>
                          Confirm Delete
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Tours & Help */}
              {activeTab === 'tours' && (
                <section className="set-section">
                  <div className="set-section-header">
                    <Navigation size={18} />
                    <h2>Tours & Help</h2>
                  </div>
                  <p className="set-section-desc">Replay any guided walkthrough to learn about LifeOS features.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                    <button className="set-btn" onClick={() => { startTourManually('dashboard'); }}>
                      <Sparkles size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Dashboard
                    </button>
                    <button className="set-btn" onClick={() => { startTourManually('goals'); }}>
                      <Target size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Goals
                    </button>
                    <button className="set-btn" onClick={() => { startTourManually('habits'); }}>
                      <Zap size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Habits
                    </button>
                    <button className="set-btn" onClick={() => { startTourManually('schedule'); }}>
                      <CalendarDays size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Schedule
                    </button>
                    <button className="set-btn" onClick={() => { startTourManually('health'); }}>
                      <Heart size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Health
                    </button>
                    <button className="set-btn" onClick={() => { startTourManually('finance'); }}>
                      <DollarSign size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Finance
                    </button>
                    <button className="set-btn" onClick={() => { startTourManually('junction'); }}>
                      <Sparkles size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Junction
                    </button>
                    <button className="set-btn" onClick={() => { startTourManually('gamification'); }}>
                      <Swords size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Character
                    </button>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <button className="set-btn" style={{ width: '100%' }} onClick={() => { resetTours(); window.location.reload(); }}>
                      <RotateCcw size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />Reset All Tours
                    </button>
                  </div>
                </section>
              )}

              {/* About */}
              {activeTab === 'about' && (
                <section className="set-section">
                  <div className="set-section-header">
                    <Info size={18} />
                    <h2>About</h2>
                  </div>
                  <div className="set-about">
                    <div className="set-about-row">
                      <span>Version</span>
                      <span className="set-about-value">{APP_VERSION}</span>
                    </div>
                    <div className="set-about-row">
                      <span>Built with</span>
                      <span className="set-about-value">React + Supabase + Love</span>
                    </div>
                    <div className="set-about-row">
                      <span>Source</span>
                      <a href="https://github.com" className="set-about-link" target="_blank" rel="noopener noreferrer">
                        GitHub <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Class/Role Modal */}
      {showClassRoleModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
          }}
          onClick={() => setShowClassRoleModal(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <ClassRoleSelector
              onComplete={handleClassRoleUpdate}
              initialClass={userClass || undefined}
              initialRole={userRole || undefined}
            />
          </div>
        </div>
      )}
    </div>
  );
}
