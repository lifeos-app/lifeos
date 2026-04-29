/**
 * ReferralPanel — Referral code display, sharing, and application UI
 *
 * Shows the user's referral code (copyable), share actions, referral stats,
 * and a form to apply someone else's code.
 */

import { useState, useEffect, useCallback, type JSX } from 'react';
import { Gift, Copy, Share2, Users, Check, Loader2, Award, X } from 'lucide-react';
import { useUserStore } from '../stores/useUserStore';
import {
  ReferralTracker,
  getShareLink,
  getShareText,
  getShareContent,
  isValidReferralCodeFormat,
  type ReferralStats,
} from '../lib/referral-system';

// ── TOAST COMPONENT ──

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}): JSX.Element {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgMap = {
    success: 'rgba(34,197,94,0.12)',
    error: 'rgba(244,63,94,0.12)',
    info: 'rgba(0,212,255,0.12)',
  };
  const borderMap = {
    success: 'rgba(34,197,94,0.3)',
    error: 'rgba(244,63,94,0.3)',
    info: 'rgba(0,212,255,0.3)',
  };
  const colorMap = {
    success: '#22C55E',
    error: '#F43F5E',
    info: '#00D4FF',
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      padding: '12px 18px',
      background: bgMap[type],
      border: `1px solid ${borderMap[type]}`,
      borderRadius: 10,
      color: colorMap[type],
      fontSize: 13,
      fontFamily: 'var(--font-body)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      zIndex: 9999,
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      animation: 'fadeInUp 0.2s ease-out',
    }}>
      {type === 'success' && <Check size={14} />}
      {type === 'error' && <X size={14} />}
      {type === 'info' && <Gift size={14} />}
      {message}
    </div>
  );
};

// ── MAIN COMPONENT ──

export function ReferralPanel(): JSX.Element {
  const user = useUserStore(s => s.user);
  const userId = user?.id || '';

  const [tracker, setTracker] = useState<ReferralTracker | null>(null);
  const [myCode, setMyCode] = useState('');
  const [stats, setStats] = useState<ReferralStats>({ totalReferrals: 0, successfulReferrals: 0, earnedXP: 0 });
  const [isTopRef, setIsTopRef] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [appliedCode, setAppliedCode] = useState<string | null>(null);

  // Apply code form
  const [inputCode, setInputCode] = useState('');
  const [applying, setApplying] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  }, []);

  // Initialize tracker
  useEffect(() => {
    if (!userId) return;
    const t = new ReferralTracker(userId);
    setTracker(t);
    setMyCode(t.getMyReferralCode());
    setStats(t.reconcileStats());
    setIsTopRef(t.isTopReferrer());
    setHasApplied(t.hasAppliedReferralCode());
    setAppliedCode(t.getAppliedReferralCode());
  }, [userId]);

  // ── COPY CODE ──
  const copyCode = useCallback(() => {
    if (!myCode) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(myCode);
      } else {
        const ta = document.createElement('textarea');
        ta.value = myCode;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      showToast('Referral code copied!', 'success');
    } catch {
      showToast('Failed to copy code', 'error');
    }
  }, [myCode, showToast]);

  // ── COPY SHARE LINK ──
  const copyShareLink = useCallback(() => {
    if (!myCode) return;
    const { link, text } = getShareContent(myCode);
    const full = `${text}\n${link}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(full);
      } else {
        const ta = document.createElement('textarea');
        ta.value = full;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      showToast('Share link copied to clipboard!', 'success');
    } catch {
      showToast('Failed to copy link', 'error');
    }
  }, [myCode, showToast]);

  // ── WEB SHARE API ──
  const nativeShare = useCallback(async () => {
    if (!myCode || !navigator.share) return;
    const { link, text } = getShareContent(myCode);
    try {
      await navigator.share({ title: 'LifeOS Referral', text, url: link });
    } catch (e: any) {
      // User cancelled share — not an error
      if (e.name !== 'AbortError') {
        showToast('Share failed', 'error');
      }
    }
  }, [myCode, showToast]);

  // ── APPLY REFERRAL CODE ──
  const handleApplyCode = useCallback(async () => {
    if (!tracker || !inputCode.trim()) return;
    setApplying(true);
    try {
      const result = await tracker.applyReferralCode(inputCode.trim());
      if (result.valid) {
        showToast(`Referral applied! You earned ${result.reward} XP!`, 'success');
        setHasApplied(true);
        setAppliedCode(inputCode.trim().toUpperCase());
        setInputCode('');
      } else {
        showToast(result.error || 'Invalid referral code', 'error');
      }
    } catch {
      showToast('Failed to apply referral code', 'error');
    } finally {
      setApplying(false);
    }
  }, [tracker, inputCode, showToast]);

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  if (!userId) {
    return (
      <section className="set-section">
        <div className="set-section-header"><Gift size={18} /><h2>Referrals</h2></div>
        <p className="set-section-desc">Sign in to get your referral code and earn XP.</p>
      </section>
    );
  }

  return (
    <>
      <section className="set-section">
        <div className="set-section-header">
          <Gift size={18} />
          <h2>Referrals</h2>
          {isTopRef && (
            <span className="set-badge" style={{ background: 'rgba(0,212,255,0.15)', color: '#00D4FF' }}>
              <Award size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />
              Top Referrer
            </span>
          )}
        </div>
        <p className="set-section-desc">
          Invite friends to LifeOS. You earn 500 XP and they get 250 XP when they join.
        </p>

        {/* ── REFERRAL CODE DISPLAY ── */}
        <div className="ref-code-card">
          <div className="ref-code-label">Your Referral Code</div>
          <div className="ref-code-value">{myCode}</div>
          <button className="ref-copy-btn" onClick={copyCode} title="Copy code">
            <Copy size={14} /> Copy Code
          </button>
        </div>

        {/* ── SHARE ACTIONS ── */}
        <div className="ref-share-row">
          <button className="ref-share-btn" onClick={copyShareLink}>
            <Copy size={14} /> Copy Share Link
          </button>
          {canNativeShare && (
            <button className="ref-share-btn ref-share-native" onClick={nativeShare}>
              <Share2 size={14} /> Share
            </button>
          )}
        </div>

        {/* ── REFERRAL STATS ── */}
        <div className="ref-stats-grid">
          <div className="ref-stat">
            <Users size={14} className="ref-stat-icon" />
            <div className="ref-stat-value">{stats.successfulReferrals}</div>
            <div className="ref-stat-label">Referrals</div>
          </div>
          <div className="ref-stat">
            <Gift size={14} className="ref-stat-icon" />
            <div className="ref-stat-value">{stats.earnedXP.toLocaleString()}</div>
            <div className="ref-stat-label">XP Earned</div>
          </div>
        </div>

        {/* ── APPLY REFERRAL CODE ── */}
        {!hasApplied ? (
          <div className="ref-apply-section">
            <div className="ref-apply-header">
              <Gift size={14} />
              <span>Enter a Referral Code</span>
            </div>
            <p className="ref-apply-desc">Got a referral code from a friend? Enter it for 250 bonus XP.</p>
            <div className="ref-apply-row">
              <input
                className="ref-apply-input"
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '').slice(0, 8))}
                placeholder="Enter 8-char code"
                maxLength={8}
                disabled={applying}
              />
              <button
                className="ref-apply-btn"
                onClick={handleApplyCode}
                disabled={applying || inputCode.length !== 8}
              >
                {applying ? <Loader2 size={14} className="spin" /> : 'Apply'}
              </button>
            </div>
          </div>
        ) : (
          <div className="ref-applied-info">
            <Check size={14} />
            <span>Referral code applied: <strong>{appliedCode}</strong></span>
          </div>
        )}
      </section>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Inline animation keyframes */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .ref-code-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 20px;
          background: linear-gradient(135deg, rgba(0,212,255,0.06), rgba(139,92,246,0.06));
          border: 1px solid rgba(0,212,255,0.15);
          border-radius: 12px;
          margin-bottom: 12px;
        }
        .ref-code-label {
          font-size: 11px;
          color: rgba(255,255,255,0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 500;
        }
        .ref-code-value {
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 700;
          color: #00D4FF;
          letter-spacing: 4px;
        }
        .ref-copy-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: rgba(0,212,255,0.08);
          border: 1px solid rgba(0,212,255,0.2);
          border-radius: 8px;
          color: #00D4FF;
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }
        .ref-copy-btn:hover {
          background: rgba(0,212,255,0.14);
          border-color: rgba(0,212,255,0.35);
        }

        .ref-share-row {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }
        .ref-share-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(26,58,92,0.25);
          border-radius: 8px;
          color: var(--text-secondary);
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }
        .ref-share-btn:hover {
          background: rgba(0,212,255,0.08);
          border-color: rgba(0,212,255,0.25);
          color: #00D4FF;
        }
        .ref-share-native {
          background: rgba(0,212,255,0.06);
          border-color: rgba(0,212,255,0.15);
          color: #00D4FF;
        }
        .ref-share-native:hover {
          background: rgba(0,212,255,0.12);
        }

        .ref-stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-bottom: 16px;
        }
        .ref-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 14px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(26,58,92,0.15);
          border-radius: 10px;
        }
        .ref-stat-icon {
          color: var(--text-muted);
          margin-bottom: 2px;
        }
        .ref-stat-value {
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .ref-stat-label {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .ref-apply-section {
          padding-top: 12px;
          border-top: 1px solid rgba(26,58,92,0.15);
        }
        .ref-apply-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 6px;
        }
        .ref-apply-header svg { color: var(--text-muted); }
        .ref-apply-desc {
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 10px;
        }
        .ref-apply-row {
          display: flex;
          gap: 8px;
        }
        .ref-apply-input {
          flex: 1;
          padding: 10px 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(26,58,92,0.3);
          border-radius: 8px;
          color: var(--text-primary);
          font-family: var(--font-display);
          font-size: 14px;
          letter-spacing: 2px;
          text-transform: uppercase;
          outline: none;
        }
        .ref-apply-input:focus {
          border-color: rgba(0,212,255,0.4);
        }
        .ref-apply-input::placeholder {
          color: var(--text-muted);
          letter-spacing: 0.5px;
          text-transform: none;
          font-family: var(--font-body);
          font-size: 12px;
        }
        .ref-apply-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 18px;
          background: rgba(0,212,255,0.08);
          border: 1px solid rgba(0,212,255,0.2);
          border-radius: 8px;
          color: #00D4FF;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .ref-apply-btn:hover:not(:disabled) {
          background: rgba(0,212,255,0.14);
          border-color: rgba(0,212,255,0.35);
        }
        .ref-apply-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .ref-applied-info {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 14px;
          background: rgba(34,197,94,0.06);
          border: 1px solid rgba(34,197,94,0.15);
          border-radius: 8px;
          color: #22C55E;
          font-size: 13px;
        }
        .ref-applied-info svg { flex-shrink: 0; }
        .ref-applied-info strong {
          color: #22C55E;
          letter-spacing: 1px;
          font-family: var(--font-display);
        }

        @media (max-width: 480px) {
          .ref-code-value { font-size: 22px; letter-spacing: 3px; }
          .ref-apply-row { flex-direction: column; }
          .ref-apply-btn { width: 100%; justify-content: center; padding: 12px; }
        }
      `}</style>
    </>
  );
}