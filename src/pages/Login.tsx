import { useState } from 'react';
import { useUserStore } from '../stores/useUserStore';
import { supabase } from '../lib/data-access';
import { Zap, WifiOff } from 'lucide-react';
import './Login.css';
import { getErrorMessage } from '../utils/error';

declare const __IS_TAURI__: boolean;
declare const __IS_ELECTRON__: boolean;
const isTauri = (typeof __IS_TAURI__ !== 'undefined' && __IS_TAURI__) ||
  (typeof __IS_ELECTRON__ !== 'undefined' && __IS_ELECTRON__) ||
  (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window || !!(window as any).electronAPI));

export function Login() {
  const signIn = useUserStore(s => s.signIn);
  const signUp = useUserStore(s => s.signUp);
  const signInWithGoogle = useUserStore(s => s.signInWithGoogle);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password, name.trim() || undefined);
        setSuccess('Check your email to confirm your account!');
      } else {
        await signIn(email, password);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Animated gradient mesh background */}
      <div className="login-mesh" aria-hidden="true">
        <div className="login-mesh-orb" />
        <div className="login-mesh-orb" />
        <div className="login-mesh-orb" />
        <div className="login-mesh-orb" />
      </div>

      {/* Star particles */}
      <div className="login-stars" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="login-star" />
        ))}
      </div>

      {/* Main login card */}
      <div className="login-card">
        <div className="login-logo">
          <span className="login-icon"><Zap size={28} color="#00D4FF" /></span>
          <span className="login-brand">LifeOS</span>
        </div>
        <h1 className="login-title">{isSignUp ? 'Create Account' : 'Welcome Back'}</h1>
        <p className="login-sub">
          {isSignUp ? 'Start running your life on one system.' : 'Your life system awaits.'}
        </p>

        <button 
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="google-btn"
          type="button"
          aria-label="Continue with Google"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M17.64 9.20454C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20454Z" fill="#4285F4"/>
            <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
            <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
            <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="login-divider" aria-hidden="true">
          <span>or continue with email</span>
        </div>

        <form onSubmit={handleSubmit} className="login-form" aria-label={isSignUp ? 'Sign up form' : 'Sign in form'}>
          {isSignUp && (
            <div className="login-field">
              <label htmlFor="login-name" className="sr-only">Your name</label>
              <input
                id="login-name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="login-input"
                autoComplete="given-name"
              />
            </div>
          )}
          <div className="login-field">
            <label htmlFor="login-email" className="sr-only">Email</label>
            <input
              id="login-email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="login-input"
              autoComplete="email"
            />
          </div>
          <div className="login-field">
            <label htmlFor="login-password" className="sr-only">Password</label>
            <input
              id="login-password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="login-input"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
          </div>
          {!isSignUp && (
            <button
              type="button"
              className="login-link login-forgot"
              onClick={async () => {
                if (!email) { setError('Enter your email first'); return; }
                setLoading(true); setError('');
                try {
                  const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/app/settings?tab=account`,
                  });
                  if (error) throw error;
                  setSuccess('Password reset email sent! Check your inbox.');
                } catch (err: unknown) { setError(getErrorMessage(err)); }
                setLoading(false);
              }}
            >
              Forgot password?
            </button>
          )}
          {error && <p className="login-error" role="alert">{error}</p>}
          {success && <p className="login-success" role="status">{success}</p>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <p className="login-toggle">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess(''); }} className="login-link">
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>

      {/* Desktop-only: Use Offline option — Tauri or Electron */}
      {isTauri && (
        <button
          className="login-offline-btn"
          onClick={() => {
            useUserStore.getState().initLocalMode();
          }}
          type="button"
        >
          <WifiOff size={16} />
          Use Offline — no account needed
        </button>
      )}

      {/* Show "Use Offline" for Electron too when Google OAuth isn't set up */}
      {typeof window !== 'undefined' && (window as any).electronAPI && !isTauri && (
        <button
          className="login-offline-btn"
          onClick={() => {
            useUserStore.getState().initLocalMode();
          }}
          type="button"
        >
          <WifiOff size={16} />
          Use Offline — local mode
        </button>
      )}

      {/* Bottom tagline */}
      <span className="login-tagline">The operating system for your entire life</span>
    </div>
  );
}
