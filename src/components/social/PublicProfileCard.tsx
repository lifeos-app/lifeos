// LifeOS Social — Public Profile Card (MapleStory-style character card)
// v2: Shows ladder class, separate Friend / Partner request buttons, improved design

import { useState } from 'react';
import { Users, MessageCircle, Loader2, UserPlus, Shield, Flame, ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import { StatsRadar } from '../gamification/StatsRadar';
import { getAchievement, RARITY_COLORS } from '../../lib/gamification';
import { xpForLevel } from '../../lib/gamification';
import { getLadder } from '../../lib/gamification/ladder';
import type { LadderKey } from '../../lib/gamification/ladder';
import type { PublicProfile } from '../../lib/social/types';
import type { UserStats } from '../../lib/gamification';
import { ShareCard } from './ShareCard';
import './social.css';

interface PublicProfileCardProps {
  profile: PublicProfile;
  compatibilityScore?: number;
  onSendFriendRequest?: (profile: PublicProfile) => void;
  onSendPartnerRequest?: (profile: PublicProfile) => void;
  /** Legacy: maps to onSendPartnerRequest for backward compat */
  onSendRequest?: (profile: PublicProfile) => void;
  onMessage?: (profile: PublicProfile) => void;
  isFriend?: boolean;
  isPartner?: boolean;
  friendRequestPending?: boolean;
  requestPending?: boolean;
  /** Shared goal categories (for match tooltip) */
  sharedCategories?: string[];
  /** If true, renders a compact version (in partner list) */
  compact?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function calcXPProgress(level: number, totalXp: number): number {
  if (level >= 99) return 1;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  if (next === base) return 1;
  return Math.max(0, Math.min(1, (totalXp - base) / (next - base)));
}

export function PublicProfileCard({
  profile,
  compatibilityScore,
  onSendFriendRequest,
  onSendPartnerRequest,
  onSendRequest,
  onMessage,
  isFriend = false,
  isPartner = false,
  friendRequestPending = false,
  requestPending = false,
  sharedCategories,
  compact = false,
}: PublicProfileCardProps) {
  const [sendingFriend, setSendingFriend] = useState(false);
  const [sendingPartner, setSendingPartner] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const xpProgress = calcXPProgress(profile.level, profile.total_xp);
  const ladder = getLadder(profile.ladder as LadderKey | null);

  const dummyStats: UserStats = {
    productivity: 0,
    consistency: 0,
    health: 0,
    finance: 0,
    knowledge: 0,
    social: 0,
  };

  const handleSendFriend = async () => {
    const handler = onSendFriendRequest ?? onSendRequest;
    if (!handler || sendingFriend) return;
    setSendingFriend(true);
    try { handler(profile); } finally { setSendingFriend(false); }
  };

  const handleSendPartner = async () => {
    if (!onSendPartnerRequest || sendingPartner) return;
    setSendingPartner(true);
    try { onSendPartnerRequest(profile); } finally { setSendingPartner(false); }
  };

  const badgeNodes = profile.featured_badges?.slice(0, 6).map(achId => {
    const def = getAchievement(achId);
    return def ? (
      <div
        key={achId}
        className={`profile-card__badge ${def.rarity}`}
        title={`${def.title}: ${def.description}`}
        style={{ background: `${RARITY_COLORS[def.rarity]}15` }}
      >
        {def.icon}
      </div>
    ) : null;
  });

  // Determine ladder display
  const ladderDisplay = ladder
    ? `${ladder.icon} ${profile.ladder_rank ?? ladder.name}`
    : profile.level >= 2
    ? `Level ${profile.level}`
    : 'Unranked';

  // Card accent colour from ladder
  const cardStyle = ladder ? {
    '--ladder-color': ladder.color,
    '--ladder-glow': ladder.glowColor,
    '--ladder-border': ladder.borderColor,
    borderColor: ladder.borderColor,
  } as React.CSSProperties : {};

  return (
    <div className="profile-card" style={cardStyle}>
      {/* Top gradient accent (ladder colour) */}
      {ladder && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${ladder.color}, transparent)`,
          opacity: 0.8,
        }} />
      )}

      {/* Compatibility badge */}
      {typeof compatibilityScore === 'number' && compatibilityScore > 0 && (
        <div className="profile-card__compat" title={sharedCategories?.length ? `Shared: ${sharedCategories.join(', ')}` : undefined}>
          {compatibilityScore}% match
        </div>
      )}

      {/* Header */}
      <div className="profile-card__header">
        <div
          className="profile-card__avatar"
          style={ladder ? {
            boxShadow: `0 0 20px ${ladder.glowColor}, 0 0 0 2px ${ladder.borderColor}`,
          } : undefined}
        >
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.display_name} loading="lazy" decoding="async" />
          ) : (
            getInitials(profile.display_name)
          )}
        </div>
        <div className="profile-card__info">
          <div className="profile-card__name">{profile.display_name}</div>

          {/* Ladder class title (replaces static "Newcomer") */}
          <div
            className="profile-card__title"
            style={ladder ? { color: ladder.color } : undefined}
          >
            {ladderDisplay}
          </div>

          <div className="profile-card__level-badge">
            {profile.show_level && (
              <div
                className="profile-card__level-pill"
                style={ladder ? {
                  borderColor: ladder.borderColor,
                  color: ladder.color,
                  background: ladder.glowColor,
                } : undefined}
              >
                LV {profile.level > 0 ? profile.level : '—'}
              </div>
            )}
            {profile.show_streak && (profile.current_streak ?? 0) > 0 && (
              <div className="profile-card__streak"><Flame size={12} color="#F97316" style={{ marginRight: 2, verticalAlign: 'middle' }} />{profile.current_streak}d</div>
            )}
            {/* Online indicator */}
            {profile.last_seen_at && (Date.now() - new Date(profile.last_seen_at).getTime()) < 600_000 && (
              <div style={{ fontSize: 11, color: '#39FF14', display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#39FF14', display: 'inline-block' }} />
                Online
              </div>
            )}
          </div>
        </div>
      </div>

      {/* XP bar */}
      {profile.show_level && (
        <div className="profile-card__xp-bar">
          <div
            className="profile-card__xp-fill"
            style={{
              width: `${xpProgress * 100}%`,
              background: ladder
                ? `linear-gradient(90deg, ${ladder.color}80, ${ladder.color})`
                : 'linear-gradient(90deg, #00D4FF, #39FF14)',
            }}
          />
        </div>
      )}

      {/* Compact action row — always visible: Add Friend + expand toggle */}
      <div className="profile-card__compact-actions">
        <div className="profile-card__actions" style={{ flexWrap: 'wrap', gap: 6, flex: 1 }}>
          {/* Add Friend button — always visible on collapsed card */}
          {!isFriend && !isPartner && !friendRequestPending && onSendFriendRequest && (
            <button
              className="profile-card__btn profile-card__btn--primary"
              onClick={(e) => { e.stopPropagation(); handleSendFriend(); }}
              disabled={sendingFriend}
              title="Add as friend"
              style={{ padding: '7px 14px', fontSize: 12 }}
            >
              {sendingFriend ? <Loader2 size={13} className="spin" /> : <UserPlus size={13} />}
              Add Friend
            </button>
          )}

          {/* Legacy "Add Partner" (backward compat) */}
          {!isFriend && !isPartner && !requestPending && !onSendFriendRequest && onSendRequest && (
            <button
              className="profile-card__btn profile-card__btn--primary"
              onClick={(e) => { e.stopPropagation(); handleSendFriend(); }}
              disabled={sendingFriend}
              style={{ padding: '7px 14px', fontSize: 12 }}
            >
              {sendingFriend ? <Loader2 size={13} className="spin" /> : <UserPlus size={13} />}
              Add Friend
            </button>
          )}

          {friendRequestPending && (
            <button className="profile-card__btn profile-card__btn--secondary" disabled style={{ padding: '7px 12px', fontSize: 12 }}>
              Request Sent
            </button>
          )}

          {requestPending && (
            <button className="profile-card__btn profile-card__btn--secondary" disabled style={{ padding: '7px 12px', fontSize: 12 }}>
              Partner Sent
            </button>
          )}

          {isFriend && (
            <div className="profile-card__btn profile-card__btn--secondary" style={{ opacity: 0.7, cursor: 'default', padding: '7px 12px', fontSize: 12 }}>
              <UserPlus size={12} /> Friends
            </div>
          )}

          {isPartner && (
            <div className="profile-card__btn profile-card__btn--secondary" style={{ opacity: 0.7, cursor: 'default', padding: '7px 12px', fontSize: 12 }}>
              <Users size={12} /> Partner
            </div>
          )}

          {onMessage && (
            <button
              className="profile-card__btn profile-card__btn--secondary"
              onClick={(e) => { e.stopPropagation(); onMessage(profile); }}
              style={{ padding: '7px 12px', fontSize: 12 }}
            >
              <MessageCircle size={12} />
            </button>
          )}
        </div>

        {/* Expand/collapse toggle */}
        {!compact && (
          <button
            className="profile-card__expand-btn"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? 'Show less' : 'Show more'}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      {/* Expandable details section */}
      {expanded && !compact && (
        <div className="profile-card__expanded" style={{ marginTop: 12, animation: 'fadeIn 0.2s ease' }}>
          {/* Bio */}
          {profile.bio && (
            <p className="profile-card__bio">{profile.bio}</p>
          )}

          {/* Featured goal */}
          {profile.featured_goal && (
            <div className="profile-card__goal">
              <div className="profile-card__goal-label">Current Mission</div>
              {profile.featured_goal}
            </div>
          )}

          {/* Goal categories */}
          {profile.goal_categories.length > 0 && (
            <div className="profile-card__categories">
              {profile.goal_categories.slice(0, 5).map(cat => (
                <span key={cat} className="profile-card__cat-tag">{cat}</span>
              ))}
            </div>
          )}

          {/* Stats radar */}
          {profile.show_stats && (
            <StatsRadar stats={dummyStats} size={180} />
          )}

          {/* Achievement badges */}
          {badgeNodes && badgeNodes.length > 0 && (
            <div className="profile-card__badges">{badgeNodes}</div>
          )}

          {/* Looking for partner indicator */}
          {profile.looking_for_partner && (
            <div style={{ fontSize: 12, color: '#A855F7', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={12} />
              Looking for accountability partner
            </div>
          )}

          {/* Partner request button (only in expanded view) */}
          {!isPartner && !requestPending && onSendPartnerRequest && profile.looking_for_partner && (
            <button
              className="profile-card__btn profile-card__btn--primary"
              onClick={handleSendPartner}
              disabled={sendingPartner}
              title="Request as accountability partner"
              style={{ width: '100%', marginBottom: 8 }}
            >
              {sendingPartner ? <Loader2 size={13} className="spin" /> : <Users size={13} />}
              Partner Up
            </button>
          )}

          {/* Share profile button */}
          <button
            className="profile-card__btn"
            onClick={() => {
              const text = `${profile.display_name} — Level ${profile.level} ${ladderDisplay} on LifeOS\n${profile.bio || 'Living the quest.'}\nJoin LifeOS: https://teddyscleaning.com.au/lifeos`;
              navigator.clipboard.writeText(text).then(() => {
                const el = document.getElementById(`share-toast-${profile.user_id}`);
                if (el) { el.textContent = 'Copied!'; setTimeout(() => { el.textContent = ''; }, 1500); }
              });
            }}
            title="Share profile"
            style={{ width: '100%', marginBottom: 8, color: '#5A7A9A', borderColor: 'rgba(90,122,154,0.2)' }}
          >
            <Share2 size={13} />
            Share Profile
            <span id={`share-toast-${profile.user_id}`} style={{ marginLeft: 'auto', fontSize: 10, color: '#39FF14' }} />
          </button>

          {/* Canvas-based shareable card image */}
          <ShareCard profile={profile} />

          {/* Block option */}
          {!isFriend && !isPartner && (
            <div style={{ textAlign: 'right' }}>
              <button style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, color: '#4B5563', display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <Shield size={10} />
                Report / Block
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PublicProfileCard;
