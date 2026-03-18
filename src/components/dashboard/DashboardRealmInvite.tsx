/**
 * DashboardRealmInvite — Opt-in invitation to The Realm onboarding
 *
 * Shows after SpotlightTour completes for users who haven't done Realm setup.
 * Dismissable with "Maybe later" — can be re-accessed from Settings.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Castle, Sparkles, X } from 'lucide-react';
import { useCharacterAppearanceStore } from '../../stores/useCharacterAppearanceStore';

const LS_KEY = 'lifeos_realm_onboarding_done';

export function shouldShowRealmInvite(): boolean {
  if (localStorage.getItem(LS_KEY)) return false;
  const { name, level } = useCharacterAppearanceStore.getState();
  if (name !== 'Adventurer' || level > 1) {
    localStorage.setItem(LS_KEY, 'true');
    return false;
  }
  return true;
}

export function markRealmOnboardingDone() {
  localStorage.setItem(LS_KEY, 'true');
}

export function DashboardRealmInvite() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !shouldShowRealmInvite()) return null;

  return (
    <div className="dash-card" style={{
      background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12), rgba(0, 212, 255, 0.08))',
      border: '1px solid rgba(168, 85, 247, 0.25)',
      position: 'relative',
    }}>
      <button
        onClick={() => { markRealmOnboardingDone(); setDismissed(true); }}
        aria-label="Dismiss"
        style={{
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(255,255,255,0.06)', border: 'none',
          borderRadius: 8, width: 28, height: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
        }}
      >
        <X size={14} />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #A855F7, #7C3AED)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Castle size={18} color="#fff" />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#E2E8F0' }}>
            Welcome to The Realm <Sparkles size={14} style={{ verticalAlign: -1, color: '#A855F7' }} />
          </h3>
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
            Your personal RPG adventure awaits
          </p>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, margin: '0 0 16px' }}>
        Create your character, build your town, and turn daily habits into quests.
        The Realm gamifies your productivity journey.
      </p>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => navigate('/character?tab=realm')}
          style={{
            flex: 1, padding: '10px 16px', borderRadius: 10,
            background: 'linear-gradient(135deg, #A855F7, #7C3AED)',
            border: 'none', color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          Enter The Realm
        </button>
        <button
          onClick={() => { markRealmOnboardingDone(); setDismissed(true); }}
          style={{
            padding: '10px 16px', borderRadius: 10,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
