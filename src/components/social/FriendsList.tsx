// LifeOS Social — Friends List Component
// Separate from accountability partners — social connections only

import { useState, useEffect } from 'react';
import { MessageCircle, UserMinus, UserCheck, Clock, Shield, Flame } from 'lucide-react';
import {
  getFriends,
  getFriendRequests,
  respondToPartnerRequest,
  removePartner,
  blockUser,
} from '../../lib/social/partnerships';
import type { PartnerWithProfile } from '../../lib/social/types';
import { getLadder } from '../../lib/gamification/ladder';
import type { LadderKey } from '../../lib/gamification/ladder';
import './social.css';

interface FriendsListProps {
  userId: string;
  onMessage: (partnerId: string, partnerName: string, connectionType?: 'friend') => void;
  onRefresh?: () => void;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
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

function isOnline(lastSeen: string | null | undefined): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 600_000; // 10 min
}

export function FriendsList({ userId, onMessage, onRefresh }: FriendsListProps) {
  const [friends, setFriends] = useState<PartnerWithProfile[]>([]);
  const [requests, setRequests] = useState<PartnerWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [f, r] = await Promise.all([
      getFriends(userId),
      getFriendRequests(userId),
    ]);
    setFriends(f);
    setRequests(r);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [userId]);

  const handleRespond = async (requestId: string, accept: boolean) => {
    await respondToPartnerRequest(requestId, accept);
    await load();
    onRefresh?.();
  };

  const handleRemove = async (friendshipId: string) => {
    if (!confirm('Remove this friend?')) return;
    setRemovingId(friendshipId);
    await removePartner(friendshipId);
    setFriends(prev => prev.filter(f => f.id !== friendshipId));
    setRemovingId(null);
  };

  const handleBlock = async (targetId: string) => {
    if (!confirm('Block this user? They won\'t be able to see your profile or message you.')) return;
    await blockUser(userId, targetId);
    await load();
  };

  if (loading) {
    return (
      <div className="partner-list">
        {[1, 2, 3].map(i => <div key={i} className="social-skeleton" style={{ height: 72 }} />)}
      </div>
    );
  }

  return (
    <div>
      {/* Incoming friend requests */}
      {requests.length > 0 && (
        <div className="partner-requests-banner">
          <div style={{
            fontSize: 12, fontWeight: 600, color: '#39FF14',
            marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <UserCheck size={13} />
            Friend Requests ({requests.length})
          </div>
          {requests.map(req => {
            const prof = req.partner_profile;
            const name = prof?.display_name ?? 'Unknown';
            const ladder = getLadder(prof?.ladder as LadderKey | null);

            return (
              <div key={req.id} className="partner-request-item">
                <div className="partner-item__avatar-wrap">
                  <div className="partner-item__avatar" style={{ width: 40, height: 40, fontSize: 13 }}>
                    {prof?.avatar_url
                      ? <img src={prof.avatar_url} alt="" loading="lazy" decoding="async" />
                      : getInitials(name)
                    }
                  </div>
                  {isOnline(prof?.last_seen_at) && (
                    <div className="partner-item__dot partner-item__dot--today" />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#F9FAFB' }}>{name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {prof?.show_level && (
                      <span style={{ color: '#00D4FF', fontWeight: 600 }}>LV {prof.level}</span>
                    )}
                    {ladder && (
                      <span style={{ color: ladder.color }}>
                        {ladder.icon} {prof?.ladder_rank ?? ladder.name}
                      </span>
                    )}
                  </div>
                  {req.message && (
                    <div className="partner-request-item__msg">"{req.message}"</div>
                  )}
                </div>
                <div className="partner-request-item__actions">
                  <button className="prbtn prbtn--accept" onClick={() => handleRespond(req.id, true)}>
                    Accept
                  </button>
                  <button className="prbtn prbtn--decline" onClick={() => handleRespond(req.id, false)}>
                    Decline
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Friends list */}
      {friends.length === 0 ? (
        <div className="social-empty">
          <div className="social-empty__icon">👥</div>
          <div className="social-empty__title">No friends yet</div>
          <div className="social-empty__sub">
            Find people in "Discover" and send a friend request to start connecting!
          </div>
        </div>
      ) : (
        <div className="partner-list">
          {friends.map(f => {
            const prof = f.partner_profile;
            const partnerUserId = f.requester_id === userId ? f.responder_id : f.requester_id;
            const name = prof?.display_name ?? 'Friend';
            const online = isOnline(prof?.last_seen_at);
            const ladder = getLadder(prof?.ladder as LadderKey | null);

            return (
              <div key={f.id} className="friend-item-compact">
                {/* Tight horizontal row: avatar, name, rank */}
                <div className="friend-item-compact__main" onClick={() => onMessage(partnerUserId, name, 'friend')}>
                  <div className="friend-item-compact__avatar-wrap">
                    <div
                      className="friend-item-compact__avatar"
                      style={ladder ? { boxShadow: `0 0 12px ${ladder.glowColor}` } : undefined}
                    >
                      {prof?.avatar_url
                        ? <img src={prof.avatar_url} alt="" loading="lazy" decoding="async" />
                        : getInitials(name)
                      }
                    </div>
                    <div className={`friend-item-compact__dot friend-item-compact__dot--${online ? 'online' : 'offline'}`} />
                  </div>

                  <div className="friend-item-compact__info">
                    <div className="friend-item-compact__name">{name}</div>
                    <div className="friend-item-compact__rank" style={ladder ? { color: ladder.color } : undefined}>
                      {ladder ? `${ladder.icon} ${prof?.ladder_rank ?? ladder.name}` : 'Unranked'}
                      {prof?.show_streak && (prof.current_streak ?? 0) > 0 && (
                        <span style={{ marginLeft: 8, color: '#F97316', display: 'inline-flex', alignItems: 'center', gap: 2 }}><Flame size={12} />{prof.current_streak}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick actions: message, remove, block */}
                <div className="friend-item-compact__actions">
                  <button
                    className="friend-item-compact__action-btn"
                    title="Message"
                    onClick={() => onMessage(partnerUserId, name, 'friend')}
                  >
                    <MessageCircle size={15} />
                  </button>
                  <button
                    className="friend-item-compact__action-btn friend-item-compact__action-btn--danger"
                    title="Remove friend"
                    onClick={() => handleRemove(f.id)}
                    disabled={removingId === f.id}
                  >
                    <UserMinus size={15} />
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

export default FriendsList;
