// LifeOS Social — Accountability Partner List Component
// (Friends are in FriendsList.tsx — partners are deliberate accountability commitments)

import { useState, useEffect } from 'react';
import { MessageCircle, Bell, UserMinus, Clock, Sparkles, Handshake, Flame } from 'lucide-react';
import {
  getPartners,
  getPartnerRequests,
  respondToPartnerRequest,
  removePartner,
} from '../../lib/social/partnerships';
import { sendNudge } from '../../lib/social/messaging';
import { getLadder } from '../../lib/gamification/ladder';
import type { LadderKey } from '../../lib/gamification/ladder';
import type { PartnerWithProfile } from '../../lib/social/types';
import './social.css';

interface PartnerListProps {
  userId: string;
  onMessage: (partnerId: string, partnerName: string) => void;
  onRefresh?: () => void;
}

function getActivityStatus(lastActive: string | null | undefined): 'today' | 'week' | 'inactive' {
  if (!lastActive) return 'inactive';
  const days = (Date.now() - new Date(lastActive).getTime()) / 86_400_000;
  if (days < 1) return 'today';
  if (days < 7) return 'week';
  return 'inactive';
}

function timeAgo(ts: string): string {
  const ms = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function PartnerList({ userId, onMessage, onRefresh }: PartnerListProps) {
  const [partners, setPartners] = useState<PartnerWithProfile[]>([]);
  const [requests, setRequests] = useState<PartnerWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [nudging, setNudging] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [p, r] = await Promise.all([
      getPartners(userId),
      getPartnerRequests(userId, 'accountability_partner'),
    ]);
    setPartners(p);
    setRequests(r);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [userId]);

  const handleRespond = async (requestId: string, accept: boolean) => {
    await respondToPartnerRequest(requestId, accept);
    await load();
    onRefresh?.();
  };

  const handleRemove = async (partnershipId: string) => {
    if (!confirm('Remove this accountability partner?')) return;
    await removePartner(partnershipId);
    setPartners(prev => prev.filter(p => p.id !== partnershipId));
  };

  const handleNudge = async (partnerId: string) => {
    setNudging(partnerId);
    await sendNudge(userId, partnerId, 'encourage', "Hey! Don't forget to log your progress today!");
    setNudging(null);
  };

  if (loading) {
    return (
      <div className="partner-list">
        {[1, 2, 3].map(i => <div key={i} className="social-skeleton" />)}
      </div>
    );
  }

  return (
    <div>
      {/* Pending requests */}
      {requests.length > 0 && (
        <div className="partner-requests-banner">
          <div style={{ fontSize: 12, fontWeight: 600, color: '#A855F7', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <Sparkles size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Partner Requests ({requests.length})
          </div>
          {requests.map(req => {
            const prof = req.partner_profile;
            return (
              <div key={req.id} className="partner-request-item">
                <div className="partner-item__avatar" style={{ width: 36, height: 36, fontSize: 12 }}>
                  {prof?.avatar_url ? <img src={prof.avatar_url} alt="" loading="lazy" decoding="async" /> : getInitials(prof?.display_name ?? '?')}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#F9FAFB' }}>{prof?.display_name ?? 'Unknown'}</div>
                  {req.message && <div className="partner-request-item__msg">"{req.message}"</div>}
                </div>
                <div className="partner-request-item__actions">
                  <button className="prbtn prbtn--accept" onClick={() => handleRespond(req.id, true)}>Accept</button>
                  <button className="prbtn prbtn--decline" onClick={() => handleRespond(req.id, false)}>Decline</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Partner list */}
      {partners.length === 0 ? (
        <div className="social-empty">
          <div className="social-empty__icon"><Handshake size={32} /></div>
          <div className="social-empty__title">No partners yet</div>
          <div className="social-empty__sub">Find accountability partners in the "Find Partners" tab</div>
        </div>
      ) : (
        <div className="partner-list">
          {partners.map(p => {
            const prof = p.partner_profile;
            const partnerUserId = p.requester_id === userId ? p.responder_id : p.requester_id;
            const activityStatus = getActivityStatus(prof?.last_active_at);
            const ladder = getLadder(prof?.ladder as LadderKey | null);

            return (
              <div key={p.id} className="partner-item">
                {/* Avatar + status dot */}
                <div className="partner-item__avatar-wrap">
                  <div
                    className="partner-item__avatar"
                    style={ladder ? { boxShadow: `0 0 16px ${ladder.glowColor}, 0 0 0 2px ${ladder.borderColor}` } : undefined}
                  >
                    {prof?.avatar_url ? (
                      <img src={prof.avatar_url} alt="" loading="lazy" decoding="async" />
                    ) : (
                      getInitials(prof?.display_name ?? '?')
                    )}
                  </div>
                  <div className={`partner-item__dot partner-item__dot--${activityStatus}`} />
                </div>

                {/* Info */}
                <div className="partner-item__info">
                  <div className="partner-item__name">{prof?.display_name ?? 'Partner'}</div>
                  <div className="partner-item__meta">
                    {prof?.show_level && (
                      <span className="partner-item__level">LV {prof.level}</span>
                    )}
                    {ladder && (
                      <span className="partner-item__ladder" style={{ color: ladder.color }}>
                        {ladder.icon} {prof?.ladder_rank ?? ladder.name}
                      </span>
                    )}
                    {prof?.show_streak && (prof.current_streak ?? 0) > 0 && (
                      <span className="partner-item__streak"><Flame size={10} color="#F97316" style={{ marginRight: 2, verticalAlign: 'middle' }} />{prof.current_streak}d</span>
                    )}
                    {prof?.last_active_at && (
                      <span className="partner-item__quests">
                        <Clock size={10} style={{ display: 'inline', marginRight: 2 }} />
                        {timeAgo(prof.last_active_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="partner-item__actions">
                  <button
                    className="partner-item__action-btn"
                    title="Nudge partner"
                    disabled={nudging === partnerUserId}
                    onClick={() => handleNudge(partnerUserId)}
                  >
                    <Bell size={14} />
                  </button>
                  <button
                    className="partner-item__action-btn"
                    title="Message"
                    onClick={() => onMessage(partnerUserId, prof?.display_name ?? 'Partner')}
                  >
                    <MessageCircle size={14} />
                  </button>
                  <button
                    className="partner-item__action-btn"
                    title="Remove partner"
                    onClick={() => handleRemove(p.id)}
                    style={{ color: '#F43F5E' }}
                  >
                    <UserMinus size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PartnerList;
