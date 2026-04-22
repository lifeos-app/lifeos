import { useState, useEffect, useRef } from 'react';
import { useUserStore } from '../stores/useUserStore';
import { supabase } from '../lib/data-access';
import { Zap, WifiOff, Eye, EyeOff, Apple, Loader2, X } from 'lucide-react';
import './Login.css';
import { getErrorMessage } from '../utils/error';

declare const __IS_TAURI__: boolean;
declare const __IS_ELECTRON__: boolean;
const isTauri = (typeof __IS_TAURI__ !== 'undefined' && __IS_TAURI__) ||
  (typeof __IS_ELECTRON__ !== 'undefined' && __IS_ELECTRON__) ||
  (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window || !!(window as any).electronAPI));

type AuthView = 'login' | 'signup' | 'forgot';

/** Map raw Supabase auth errors to friendly messages */
function friendlyError(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'Wrong email or password. Try again or reset your password.';
  if (/user already registered/i.test(msg)) return 'An account with this email already exists. Try logging in instead.';
  if (/email not confirmed/i.test(msg)) return 'Please check your email and click the verification link.';
  return msg;
}

export function Login() {
  const signIn = useUserStore(s => s.signIn);
  const signUp = useUserStore(s => s.signUp);
  const signInWithGoogle = useUserStore(s => s.signInWithGoogle);
  const [view, setView] = useState<AuthView>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [googlePending, setGooglePending] = useState(false);
  const googleAbortRef = useRef(false);

  const switchView = (v: AuthView) => { setView(v); setError(''); setSuccess(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (view === 'signup' && password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      if (view === 'signup') {
        await signUp(email, password, name.trim() || undefined);
        setSuccess('Check your email to verify your account!');
      } else {
        await signIn(email, password);
      }
    } catch (err: unknown) { setError(friendlyError(getErrorMessage(err))); }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) { setError('Enter your email address'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/app/settings?tab=account`,
      });
      if (resetErr) throw resetErr;
      setSuccess('Reset link sent to your email!');
    } catch (err: unknown) { setError(friendlyError(getErrorMessage(err))); }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setError(''); setLoading(true); setSuccess('');
    const isElectronAuth = !!(window as any).electronAPI?.isElectron;

    if (isElectronAuth) {
      // Show the in-app overlay so the user knows what's happening
      googleAbortRef.current = false;
      setGooglePending(true);
      setLoading(false);
      try {
        await signInWithGoogle();
        // signInWithGoogle resolves when auth is done (or popup closed)
        // If the user cancelled, googleAbortRef.current will be true
      } catch (err: unknown) {
        if (!googleAbortRef.current) {
          setError(friendlyError(getErrorMessage(err)));
        }
      } finally {
        setGooglePending(false);
        googleAbortRef.current = false;
      }
    } else {
      try { await signInWithGoogle(); }
      catch (err: unknown) { setError(friendlyError(getErrorMessage(err))); setLoading(false); }
    }
  };

  const handleCancelGoogle = async () => {
    googleAbortRef.current = true;
    setGooglePending(false);
    setLoading(false);
    // Tell the main process to close the popup window
    await (window as any).electronAPI?.cancelAuthPopup?.();
  };

  const handleAppleSignIn = async () => {
    setError(''); setLoading(true);
    try {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: window.location.origin + '/app/' } });
      if (oauthErr) throw oauthErr;
    } catch (err: unknown) { setError(friendlyError(getErrorMessage(err))); setLoading(false); }
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

      {/* Google sign-in pending overlay */}
      {googlePending && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(5, 14, 26, 0.92)',
          backdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 24,
        }}>
          {/* Spinner */}
          <div style={{ animation: 'spin 1s linear infinite', color: '#00D4FF' }}>
            <Loader2 size={48} />
          </div>

          <div style={{ textAlign: 'center', maxWidth: 320 }}>
            <p style={{
              color: '#fff', fontSize: 18, fontWeight: 600,
              fontFamily: "'Poppins', sans-serif", margin: '0 0 8px',
            }}>
              Complete Google sign-in
            </p>
            <p style={{
              color: '#8BA4BE', fontSize: 14, lineHeight: 1.6,
              fontFamily: "'Poppins', sans-serif", margin: 0,
            }}>
              A sign-in window has opened. Complete authentication there — this screen will update automatically.
            </p>
          </div>

          <button
            onClick={handleCancelGoogle}
            type="button"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 20px',
              background: 'transparent',
              border: '1px solid #1A3A5C',
              color: '#8BA4BE',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            <X size={14} />
            Cancel
          </button>
        </div>
      )}

      {/* Main card */}
      <div className="login-card">
        {/* Logo with glow */}
        <div className="login-logo">
          <span className="login-icon"><Zap size={28} color="#00D4FF" /></span>
          <span className="login-brand">LifeOS</span>
        </div>

        {/* ── Forgot Password View ── */}
        {view === 'forgot' ? (
          <>
            <h1 className="login-title">Reset Password</h1>
            <p className="login-sub">Enter your email and we'll send you a reset link.</p>
            <form onSubmit={handleResetPassword} className="login-form">
              <div className="login-field">
                <label htmlFor="reset-email" className="sr-only">Email</label>
                <input id="reset-email" type="email" placeholder="Email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required className="login-input" autoComplete="email" />
              </div>
              {error && <p className="login-error" role="alert">{error}</p>}
              {success && <p className="login-success" role="status">{success}</p>}
              <button type="submit" className="login-btn" disabled={loading}>{loading ? 'Please wait...' : 'Send Reset Link'}</button>
            </form>
            <p className="login-toggle">
              <button onClick={() => switchView('login')} className="login-link">Back to Sign In</button>
            </p>
          </>
        ) : (
          /* ── Login / Signup View ── */
          <>
            {/* Tab toggle */}
            <div className="login-tabs" role="tablist">
              <button role="tab" aria-selected={view === 'login'} className={`login-tab${view === 'login' ? ' login-tab--active' : ''}`} onClick={() => switchView('login')}>Sign In</button>
              <button role="tab" aria-selected={view === 'signup'} className={`login-tab${view === 'signup' ? ' login-tab--active' : ''}`} onClick={() => switchView('signup')}>Sign Up</button>
            </div>

            <h1 className="login-title">{view === 'signup' ? 'Create Account' : 'Welcome Back'}</h1>
            <p className="login-sub">{view === 'signup' ? 'Start running your life on one system.' : 'Your life system awaits.'}</p>

            {/* Social login buttons */}
            <button onClick={handleGoogleSignIn} disabled={loading} className="social-btn" type="button" aria-label="Continue with Google">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M17.64 9.20454C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20454Z" fill="#4285F4"/>
                <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
                <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
                <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
            <button onClick={handleAppleSignIn} disabled={loading} className="social-btn" type="button" aria-label="Continue with Apple">
              <Apple size={18} />
              Continue with Apple
            </button>

            <div className="login-divider" aria-hidden="true"><span>or continue with email</span></div>

            <form onSubmit={handleSubmit} className="login-form" aria-label={view === 'signup' ? 'Sign up form' : 'Sign in form'}>
              {view === 'signup' && (
                <div className="login-field">
                  <label htmlFor="login-name" className="sr-only">Your name</label>
                  <input id="login-name" type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} required className="login-input" autoComplete="given-name" />
                </div>
              )}
              <div className="login-field">
                <label htmlFor="login-email" className="sr-only">Email</label>
                <input id="login-email" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="login-input" autoComplete="email" autoCapitalize="off" autoCorrect="off" spellCheck="false" />
              </div>
              <div className="login-field login-field--password">
                <label htmlFor="login-password" className="sr-only">Password</label>
                <input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="login-input" autoComplete={view === 'signup' ? 'new-password' : 'current-password'} />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {view === 'signup' && (
                <div className="login-field login-field--password">
                  <label htmlFor="login-confirm-password" className="sr-only">Confirm password</label>
                  <input id="login-confirm-password" type={showPassword ? 'text' : 'password'} placeholder="Confirm password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} className="login-input" autoComplete="new-password" />
                </div>
              )}
              {view === 'login' && (
                <div className="login-extras">
                  <label className="login-remember">
                    <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                    <span>Remember me</span>
                  </label>
                  <button type="button" className="login-link login-forgot" onClick={() => switchView('forgot')}>Forgot password?</button>
                </div>
              )}
              {error && <p id="login-error" className="login-error" role="alert">{error}</p>}
              {success && <p id="login-success" className="login-success" role="status">{success}</p>}
              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? 'Please wait...' : view === 'signup' ? 'Sign Up' : 'Sign In'}
              </button>
            </form>
          </>
        )}
      </div>

      {/* Desktop-only: Use Offline option */}
      {isTauri && (
        <button className="login-offline-btn" onClick={() => { useUserStore.getState().initLocalMode(); }} type="button">
          <WifiOff size={16} />
          Use Offline — local mode
        </button>
      )}

      {/* Bottom tagline */}
      <span className="login-tagline">The operating system for your entire life</span>
    </div>
  );
}