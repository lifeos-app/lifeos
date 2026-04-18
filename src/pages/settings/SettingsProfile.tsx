/**
 * SettingsProfile — Profile tab with completion card, account age, and form
 */
import { useState, useEffect, type JSX } from 'react';
import { supabase } from '../../lib/data-access';
import { useUserStore } from '../../stores/useUserStore';
import {
  User, Save, Check, Loader2, Sparkles, Edit2, AlertCircle,
  Calendar, Clock, Shield,
} from 'lucide-react';
import {
  CLASS_ICONS, CLASS_NAMES, CLASS_DESCRIPTIONS,
  ROLE_ARCHETYPES, type ClassKey, type RoleKey,
} from '../../lib/gamification/class-quests';
import { ClassRoleSelector } from '../../components/ClassRoleSelector';

interface ProfileData {
  user_id: string;
  display_name: string;
  occupation: string;
  primary_focus: string;
  timezone: string;
  onboarding_complete: boolean;
  preferences: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface SettingsProfileProps {
  onError: (msg: string) => void;
}

// Common timezone list
const TIMEZONES = [
  'Pacific/Auckland', 'Australia/Melbourne', 'Australia/Sydney',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Kolkata',
  'Europe/London', 'Europe/Berlin', 'Europe/Moscow',
  'US/Eastern', 'US/Central', 'US/Mountain', 'US/Pacific',
  'UTC',
];

export function SettingsProfile({ onError }: SettingsProfileProps): JSX.Element {
  const user = useUserStore(s => s.user);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showClassRoleModal, setShowClassRoleModal] = useState(false);

  // Form fields
  const [displayName, setDisplayName] = useState('');
  const [occupation, setOccupation] = useState('');
  const [primaryFocus, setPrimaryFocus] = useState('');
  const [timezone, setTimezone] = useState('');

  // Computed
  const userClass: ClassKey | null = (profile?.preferences as Record<string, unknown> | undefined)?.class as ClassKey || null;
  const userRole: RoleKey | null = (profile?.preferences as Record<string, unknown> | undefined)?.role as RoleKey || null;

  // Profile completion: 3 key fields
  const completionFields = [
    { key: 'display_name', label: 'Display Name', filled: !!displayName.trim() },
    { key: 'timezone', label: 'Timezone', filled: !!timezone.trim() },
    { key: 'occupation', label: 'Occupation', filled: !!occupation.trim() },
  ];
  const completionPct = Math.round(completionFields.filter(f => f.filled).length / completionFields.length * 100);

  // Account age
  const createdAt = profile?.created_at ? new Date(profile.created_at) : null;
  const memberSince = createdAt
    ? createdAt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;
  const daysAsMember = createdAt
    ? Math.floor((Date.now() - createdAt.getTime()) / 86400000)
    : null;

  const fetchProfile = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (data) {
      setProfile(data);
      setDisplayName(data.display_name || '');
      setOccupation(data.occupation || '');
      setPrimaryFocus(data.primary_focus || '');
      setTimezone(data.timezone || '');
    }
  };

  useEffect(() => { fetchProfile(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveProfile = async () => {
    if (!user?.id) return;
    setSaving(true); setSaved(false);
    const payload = {
      display_name: displayName.trim() || null,
      occupation: occupation.trim() || null,
      primary_focus: primaryFocus.trim() || null,
      timezone: timezone.trim() || null,
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
    if (err) { onError(err.message); } else { setSaved(true); setTimeout(() => setSaved(false), 3000); fetchProfile(); }
    setSaving(false);
  };

  const handleClassRoleUpdate = async (classKey: ClassKey, roleKey: RoleKey) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const existingPrefs = profile?.preferences || {};
      await supabase.from('user_profiles').update({
        preferences: { ...existingPrefs, class: classKey, role: roleKey },
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);
      setShowClassRoleModal(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await fetchProfile();
    } catch { onError('Failed to update class/role.'); }
    setSaving(false);
  };

  return (
    <>
      {/* Profile Completion Card */}
      {completionPct < 100 && (
        <div className="set-section" style={{ marginBottom: 16, borderLeft: '3px solid var(--cyan)' }}>
          <div className="set-section-header">
            <AlertCircle size={16} style={{ color: 'var(--cyan)' }} />
            <h2>Complete Your Profile</h2>
            <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: 'var(--cyan)' }}>{completionPct}%</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${completionPct}%`, background: 'var(--cyan)', borderRadius: 4, transition: 'width 0.3s ease' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {completionFields.filter(f => !f.filled).map(f => (
              <button key={f.key} className="set-btn" onClick={() => {
                const el = document.getElementById(`set-${f.key === 'display_name' ? 'display-name' : f.key}`);
                el?.focus();
              }} style={{ textAlign: 'left', width: '100%', justifyContent: 'flex-start' }}>
                <span style={{ color: 'var(--rose)', marginRight: 6 }}>+</span> Add {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Profile Form */}
      <section className="set-section">
        <div className="set-section-header">
          <User size={18} />
          <h2>Profile</h2>
        </div>

        {/* Account Age */}
        {memberSince && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 14px', background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.1)', borderRadius: 8 }}>
            <Clock size={14} style={{ color: 'var(--cyan)' }} />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              Member since {memberSince}
              {daysAsMember !== null && daysAsMember > 0 && (
                <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>· {daysAsMember} days</span>
              )}
            </span>
          </div>
        )}

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
          <div className="set-form-group">
            <label htmlFor="set-timezone">Timezone</label>
            <select id="set-timezone" value={timezone} onChange={e => setTimezone(e.target.value)}
              style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(26,58,92,0.3)', borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none' }}>
              <option value="" style={{ background: '#111827' }}>Select timezone</option>
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz} style={{ background: '#111827' }}>{tz}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Class & Role */}
        <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
              <Sparkles size={14} style={{ marginRight: 6, verticalAlign: 'middle', color: '#00D4FF' }} />
              Character Identity
            </label>
            <button className="set-btn" onClick={() => setShowClassRoleModal(true)} style={{ padding: '6px 12px', fontSize: 13 }}>
              <Edit2 size={12} style={{ marginRight: 4 }} />
              {userClass || userRole ? 'Change' : 'Set'}
            </button>
          </div>
          {(userClass || userRole) ? (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {userRole && ROLE_ARCHETYPES[userRole] && (
                <div style={{ padding: '10px 16px', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{ROLE_ARCHETYPES[userRole].icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{userRole}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{ROLE_ARCHETYPES[userRole].description}</div>
                  </div>
                </div>
              )}
              {userClass && (
                <div style={{ padding: '10px 16px', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{CLASS_ICONS[userClass]}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{CLASS_NAMES[userClass]}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{CLASS_DESCRIPTIONS[userClass]}</div>
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

      {/* Class/Role Modal */}
      {showClassRoleModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowClassRoleModal(false)}>
          <div onClick={e => e.stopPropagation()}>
            <ClassRoleSelector onComplete={handleClassRoleUpdate} initialClass={userClass || undefined} initialRole={userRole || undefined} />
          </div>
        </div>
      )}
    </>
  );
}