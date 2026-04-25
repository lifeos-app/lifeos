/**
 * FamilyPlanSection — Family Plan upgrade, member management, and invite system
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Users, Crown, Mail, Send, X, Check, RefreshCw,
  Shield, Heart, Target, Eye, Loader2,
} from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';
import {
  createFamilyCheckoutSession,
  getFamilyPlanStatus,
  inviteFamilyMember,
  cancelFamilyInvite,
  resendFamilyInvite,
  getFamilyInvites,
  FAMILY_PLAN_PRICE,
  FAMILY_PLAN_MAX_MEMBERS,
  type FamilyPlanStatus,
  type FamilyInvite,
} from '../../lib/stripe-client';

const FAMILY_FEATURES = [
  { icon: <Crown size={14} />, text: 'All Pro features for every member' },
  { icon: <Users size={14} />, text: 'Shared family guild with challenges' },
  { icon: <Eye size={14} />, text: 'Family dashboard view' },
  { icon: <Shield size={14} />, text: 'Parent controls (age-appropriate content)' },
  { icon: <Target size={14} />, text: 'Shared goals and habits visibility' },
  { icon: <Heart size={14} />, text: 'Family challenges and accountability' },
];

export function FamilyPlanSection() {
  const user = useUserStore(s => s.user);
  const [familyStatus, setFamilyStatus] = useState<FamilyPlanStatus | null>(null);
  const [invites, setInvites] = useState<FamilyInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    getFamilyPlanStatus(user.id).then(status => {
      setFamilyStatus(status);
      setInvites(getFamilyInvites());
      setLoading(false);
    });
  }, [user?.id]);

  const handleUpgrade = useCallback(async () => {
    if (!user?.id || !user?.email) return;
    setCheckoutLoading(true);
    const result = await createFamilyCheckoutSession(user.id, user.email);
    if (result.url) {
      window.location.href = result.url;
    } else {
      // Early access mode — show info
      setCheckoutLoading(false);
    }
  }, [user?.id, user?.email]);

  const handleInvite = useCallback(async () => {
    if (!inviteEmail.trim()) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      setInviteError('Please enter a valid email address.');
      return;
    }

    const existing = getFamilyInvites();
    if (existing.length >= FAMILY_PLAN_MAX_MEMBERS - 1) {
      setInviteError(`Maximum ${FAMILY_PLAN_MAX_MEMBERS} members reached.`);
      return;
    }
    if (existing.some(i => i.email === inviteEmail)) {
      setInviteError('This email has already been invited.');
      return;
    }

    await inviteFamilyMember(inviteEmail.trim());
    setInvites(getFamilyInvites());
    setInviteEmail('');
    setInviteError('');
    setInviteSuccess(`Invite sent to ${inviteEmail.trim()}`);
    setTimeout(() => setInviteSuccess(''), 3000);
  }, [inviteEmail]);

  const handleCancel = useCallback((email: string) => {
    cancelFamilyInvite(email);
    setInvites(getFamilyInvites());
  }, []);

  const handleResend = useCallback((email: string) => {
    resendFamilyInvite(email);
    setInvites(getFamilyInvites());
    setInviteSuccess(`Invite resent to ${email}`);
    setTimeout(() => setInviteSuccess(''), 3000);
  }, []);

  if (loading) {
    return (
      <section className="set-section">
        <div className="set-section-header"><Users size={18} /><h2>Family Plan</h2></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0' }}>
          <Loader2 size={16} className="spin" />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Loading...</span>
        </div>
      </section>
    );
  }

  const isOnFamilyPlan = familyStatus?.active;
  const slotsUsed = 1 + invites.length; // owner + invites
  const slotsRemaining = FAMILY_PLAN_MAX_MEMBERS - slotsUsed;

  return (
    <section className="set-section">
      <div className="set-section-header">
        <Users size={18} />
        <h2>Family Plan</h2>
        {isOnFamilyPlan && (
          <span className="set-badge" style={{ background: 'rgba(57,255,20,0.15)', color: '#39FF14' }}>
            Active
          </span>
        )}
      </div>

      {!isOnFamilyPlan ? (
        <>
          {/* Upgrade CTA */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(212,175,55,0.08))',
            border: '1px solid rgba(139,92,246,0.2)',
            borderRadius: 12,
            padding: '20px 24px',
            marginBottom: 16,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 16,
            }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(212,175,55,0.2))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Users size={20} style={{ color: '#D4AF37' }} />
              </div>
              <div>
                <div style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#fff',
                  fontFamily: "'Poppins', sans-serif",
                }}>
                  LifeOS Family Plan
                </div>
                <div style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.5)',
                }}>
                  {FAMILY_PLAN_PRICE} for up to {FAMILY_PLAN_MAX_MEMBERS} members
                </div>
              </div>
            </div>

            {/* Features list */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginBottom: 20,
            }}>
              {FAMILY_FEATURES.map((feature, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.7)',
                  }}
                >
                  <div style={{ color: '#D4AF37', flexShrink: 0 }}>
                    {feature.icon}
                  </div>
                  {feature.text}
                </div>
              ))}
            </div>

            {/* Upgrade button */}
            <button
              onClick={handleUpgrade}
              disabled={checkoutLoading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 20px',
                background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(212,175,55,0.3))',
                border: '1px solid rgba(212,175,55,0.4)',
                borderRadius: 10,
                color: '#D4AF37',
                fontSize: 14,
                fontWeight: 700,
                cursor: checkoutLoading ? 'wait' : 'pointer',
                transition: 'all 0.2s',
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              {checkoutLoading ? (
                <><Loader2 size={14} className="spin" /> Processing...</>
              ) : (
                <><Crown size={14} /> Upgrade to Family Plan</>
              )}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Active family plan info */}
          <div style={{
            background: 'rgba(57,255,20,0.06)',
            border: '1px solid rgba(57,255,20,0.15)',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 16,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}>
              <Check size={16} style={{ color: '#39FF14' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#39FF14' }}>
                Family Plan Active
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              {slotsUsed}/{FAMILY_PLAN_MAX_MEMBERS} seats used - {slotsRemaining} remaining
            </div>
          </div>
        </>
      )}

      {/* Member management (always shown) */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 16,
      }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.7)',
          marginBottom: 12,
          fontFamily: "'Poppins', sans-serif",
        }}>
          Family Members
        </div>

        {/* Owner */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 0',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'rgba(0,212,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Crown size={12} style={{ color: '#00D4FF' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>
              {user?.email || 'You'}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Owner</div>
          </div>
        </div>

        {/* Invited members */}
        {invites.map(invite => (
          <div
            key={invite.email}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 0',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: invite.status === 'accepted'
                ? 'rgba(57,255,20,0.15)'
                : 'rgba(245,158,11,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Mail size={12} style={{
                color: invite.status === 'accepted' ? '#39FF14' : '#F59E0B',
              }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13,
                color: '#fff',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {invite.email}
              </div>
              <div style={{
                fontSize: 11,
                color: invite.status === 'accepted' ? '#39FF14' : '#F59E0B',
              }}>
                {invite.status === 'accepted' ? 'Active' : 'Pending'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {invite.status === 'pending' && (
                <button
                  onClick={() => handleResend(invite.email)}
                  title="Resend invite"
                  style={{
                    padding: '4px 8px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 6,
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 11,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <RefreshCw size={10} /> Resend
                </button>
              )}
              <button
                onClick={() => handleCancel(invite.email)}
                title="Cancel invite"
                style={{
                  padding: '4px 8px',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.15)',
                  borderRadius: 6,
                  color: '#EF4444',
                  fontSize: 11,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <X size={10} /> Cancel
              </button>
            </div>
          </div>
        ))}

        {/* Invite form */}
        {slotsRemaining > 0 && (
          <div style={{ paddingTop: 12 }}>
            <div style={{
              display: 'flex',
              gap: 8,
            }}>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => {
                  setInviteEmail(e.target.value);
                  setInviteError('');
                }}
                placeholder="Email address"
                onKeyDown={e => { if (e.key === 'Enter') handleInvite(); }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: "'Poppins', sans-serif",
                }}
              />
              <button
                onClick={handleInvite}
                disabled={!inviteEmail.trim()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  background: inviteEmail.trim() ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${inviteEmail.trim() ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 8,
                  color: inviteEmail.trim() ? '#00D4FF' : 'rgba(255,255,255,0.3)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: inviteEmail.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                <Send size={12} /> Invite
              </button>
            </div>

            {inviteError && (
              <div style={{
                marginTop: 6,
                fontSize: 12,
                color: '#EF4444',
              }}>
                {inviteError}
              </div>
            )}

            {inviteSuccess && (
              <div style={{
                marginTop: 6,
                fontSize: 12,
                color: '#39FF14',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <Check size={12} /> {inviteSuccess}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Family Guild info */}
      <div style={{
        marginTop: 12,
        background: 'rgba(139,92,246,0.06)',
        border: '1px solid rgba(139,92,246,0.15)',
        borderRadius: 12,
        padding: '14px 18px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
        }}>
          <Shield size={14} style={{ color: '#8B5CF6' }} />
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#8B5CF6',
            fontFamily: "'Poppins', sans-serif",
          }}>
            Family Guild
          </span>
        </div>
        <div style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.5)',
          lineHeight: 1.6,
        }}>
          A private guild is auto-created for your family. Members can share goals,
          track habits together, and participate in family-only challenges.
          {!isOnFamilyPlan && ' Upgrade to Family Plan to unlock.'}
        </div>
      </div>
    </section>
  );
}
