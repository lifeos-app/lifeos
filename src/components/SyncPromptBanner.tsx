import { useState } from 'react';
import { Cloud, X, LogIn, UserPlus } from 'lucide-react';
import { useUserStore } from '../stores/useUserStore';
import { supabase } from '../lib/supabase';
import { getErrorMessage } from '../utils/error';
import './SyncPromptBanner.css';

/**
 * Persistent banner shown when user is in local/offline mode.
 * Encourages signup or login to enable cloud sync.
 * Dismissable per session, but re-appears on next app launch.
 */
export function SyncPromptBanner() {
  const mode = useUserStore(s => s.mode);
  const [dismissed, setDismissed] = useState(false);
  const [showForm, setShowForm] = useState<'login' | 'signup' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Only show in local mode
  if (mode !== 'local' || dismissed) return null;

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError('');
    try {
      await useUserStore.getState().signInWithGoogle();
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (showForm === 'signup') {
        await useUserStore.getState().signUp(email, password, name.trim() || undefined);
        setSuccess('Check your email to confirm!');
      } else {
        await useUserStore.getState().signIn(email, password);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
    setLoading(false);
  };

  return (
    <div className="sync-prompt-banner" role="complementary" aria-label="Cloud sync prompt">
      {/* Collapsed state — single line banner */}
      {!showForm && (
        <div className="spb-row">
          <Cloud size={15} className="spb-icon" />
          <span className="spb-text">
            You're using LifeOS offline.
          </span>
          <button className="spb-action" onClick={() => setShowForm('signup')}>
            <UserPlus size={13} />
            Sign Up
          </button>
          <button className="spb-action spb-action-alt" onClick={() => setShowForm('login')}>
            <LogIn size={13} />
            Log In
          </button>
          <button className="spb-action spb-google" onClick={handleGoogleAuth} disabled={loading}>
            <svg width="13" height="13" viewBox="0 0 18 18" fill="none"><path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.08-1.8 2.72v2.26h2.91c1.7-1.57 2.68-3.87 2.68-6.62Z" fill="#4285F4"/><path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33C2.44 15.98 5.48 18 9 18Z" fill="#34A853"/><path d="M3.96 10.71c-.18-.54-.28-1.12-.28-1.71 0-.59.1-1.17.28-1.71V4.96H.96C.35 6.17 0 7.55 0 9s.35 2.83.96 4.04l3-2.33Z" fill="#FBBC05"/><path d="M9 3.58c1.32 0 2.51.45 3.44.93l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58Z" fill="#EA4335"/></svg>
            Google
          </button>
          <button className="spb-dismiss" onClick={() => setDismissed(true)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Expanded state — inline form */}
      {showForm && (
        <div className="spb-expanded">
          <div className="spb-expanded-header">
            <Cloud size={15} className="spb-icon" />
            <span className="spb-text">
              {showForm === 'signup' ? 'Create account to sync your data across devices' : 'Log in to sync your data'}
            </span>
            <button className="spb-dismiss" onClick={() => { setShowForm(null); setError(''); setSuccess(''); }} aria-label="Close">
              <X size={14} />
            </button>
          </div>

          <form className="spb-form" onSubmit={handleSubmit}>
            <button type="button" className="spb-google-full" onClick={handleGoogleAuth} disabled={loading}>
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.08-1.8 2.72v2.26h2.91c1.7-1.57 2.68-3.87 2.68-6.62Z" fill="#4285F4"/><path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33C2.44 15.98 5.48 18 9 18Z" fill="#34A853"/><path d="M3.96 10.71c-.18-.54-.28-1.12-.28-1.71 0-.59.1-1.17.28-1.71V4.96H.96C.35 6.17 0 7.55 0 9s.35 2.83.96 4.04l3-2.33Z" fill="#FBBC05"/><path d="M9 3.58c1.32 0 2.51.45 3.44.93l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58Z" fill="#EA4335"/></svg>
              Continue with Google
            </button>

            <div className="spb-divider"><span>or</span></div>

            {showForm === 'signup' && (
              <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="spb-input" autoComplete="given-name" />
            )}
            <div className="spb-input-row">
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="spb-input" autoComplete="email" />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="spb-input" autoComplete={showForm === 'signup' ? 'new-password' : 'current-password'} />
              <button type="submit" className="spb-submit" disabled={loading}>
                {loading ? '...' : showForm === 'signup' ? 'Sign Up' : 'Log In'}
              </button>
            </div>
            {error && <p className="spb-error">{error}</p>}
            {success && <p className="spb-success">{success}</p>}
            <p className="spb-toggle">
              {showForm === 'signup' ? 'Have an account?' : 'Need an account?'}{' '}
              <button type="button" onClick={() => { setShowForm(showForm === 'signup' ? 'login' : 'signup'); setError(''); setSuccess(''); }}>
                {showForm === 'signup' ? 'Log In' : 'Sign Up'}
              </button>
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
