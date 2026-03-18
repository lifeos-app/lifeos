// LifeOS Social — Find Accountability Partners (Discovery/Matching)

import { useState, useEffect } from 'react';
import { Search, X, Users, Handshake, Lightbulb } from 'lucide-react';
import { findMatches } from '../../lib/social/matching';
import { getPartnershipStatus, sendPartnerRequest, sendFriendRequest } from '../../lib/social/partnerships';
import { PublicProfileCard } from './PublicProfileCard';
import { ALL_GOAL_CATEGORIES, GOAL_CATEGORY_LABELS } from '../../lib/social/types';
import type { MatchResult, PublicProfile, GoalCategory } from '../../lib/social/types';
import './social.css';

interface FindPartnersProps {
  userId: string;
  onMessage: (partnerId: string, partnerName: string) => void;
}

export function FindPartners({ userId, onMessage }: FindPartnersProps) {
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [partnerOnly, setPartnerOnly] = useState(false);
  const [minLevel, setMinLevel] = useState('');
  const [statuses, setStatuses] = useState<Record<string, 'none' | 'pending' | 'accepted' | 'friend' | 'friend_pending'>>({});
  const [displayCount, setDisplayCount] = useState(20);

  // Request dialog — can be 'friend' or 'partner'
  const [requestTarget, setRequestTarget] = useState<PublicProfile | null>(null);
  const [requestType, setRequestType] = useState<'friend' | 'partner'>('friend');
  const [requestMsg, setRequestMsg] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const results = await findMatches(userId);
      setMatches(results);

      // Check existing partnership statuses
      const statusMap: Record<string, 'none' | 'pending' | 'accepted'> = {};
      await Promise.all(
        results.map(async r => {
          const existing = await getPartnershipStatus(userId, r.profile.user_id);
          if (!existing) statusMap[r.profile.user_id] = 'none';
          else if (existing.status === 'accepted') statusMap[r.profile.user_id] = 'accepted';
          else if (existing.status === 'pending') statusMap[r.profile.user_id] = 'pending';
          else statusMap[r.profile.user_id] = 'none';
        }),
      );
      setStatuses(statusMap);
      setLoading(false);
    };
    void load();
  }, [userId]);

  const filtered = matches.filter(m => {
    if (categoryFilter && !m.profile.goal_categories.includes(categoryFilter)) return false;
    if (partnerOnly && !m.profile.looking_for_partner) return false;
    if (minLevel && m.profile.level < parseInt(minLevel, 10)) return false;
    return true;
  });

  const visibleMatches = filtered.slice(0, displayCount);

  const handleSendFriendRequest = (profile: PublicProfile) => {
    setRequestTarget(profile);
    setRequestType('friend');
    setRequestMsg('');
  };

  const handleSendPartnerRequest = (profile: PublicProfile) => {
    setRequestTarget(profile);
    setRequestType('partner');
    setRequestMsg('');
  };

  const handleConfirmRequest = async () => {
    if (!requestTarget || sendingRequest) return;
    setSendingRequest(true);

    if (requestType === 'friend') {
      await sendFriendRequest(userId, requestTarget.user_id, requestMsg || undefined);
      setStatuses(prev => ({ ...prev, [requestTarget.user_id]: 'friend_pending' }));
    } else {
      await sendPartnerRequest(userId, requestTarget.user_id, requestMsg || undefined);
      setStatuses(prev => ({ ...prev, [requestTarget.user_id]: 'pending' }));
    }

    setSendingRequest(false);
    setRequestTarget(null);
  };

  const calcScorePercent = (score: number) => Math.min(100, Math.round((score / 55) * 100));

  return (
    <div>
      {/* Filters */}
      <div className="find-partners__filters">
        <select
          className="find-partners__filter-select"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {ALL_GOAL_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>
              {GOAL_CATEGORY_LABELS[cat as GoalCategory].icon} {GOAL_CATEGORY_LABELS[cat as GoalCategory].label}
            </option>
          ))}
        </select>

        <select
          className="find-partners__filter-select"
          value={minLevel}
          onChange={e => setMinLevel(e.target.value)}
        >
          <option value="">Any Level</option>
          <option value="5">Level 5+</option>
          <option value="10">Level 10+</option>
          <option value="20">Level 20+</option>
          <option value="30">Level 30+</option>
        </select>

        <button
          className={`find-partners__toggle ${partnerOnly ? 'active' : ''}`}
          onClick={() => setPartnerOnly(!partnerOnly)}
        >
          <Search size={14} />
          Looking for Partner
        </button>

        {(categoryFilter || partnerOnly || minLevel) && (
          <button
            className="find-partners__toggle"
            onClick={() => { setCategoryFilter(''); setPartnerOnly(false); setMinLevel(''); }}
          >
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="find-partners__grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="social-skeleton" style={{ height: 300 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="social-empty">
          <div className="social-empty__icon"><Search size={32} /></div>
          <div className="social-empty__title">No matches found</div>
          <div className="social-empty__sub">
            {matches.length === 0
              ? 'Set up your public profile and goal categories to find matches!'
              : 'Try adjusting the filters above'}
          </div>
        </div>
      ) : (
        <>
          <div className="find-partners__grid find-partners__grid--compact">
            {visibleMatches.map(({ profile, score, shared_categories }) => {
              const status = statuses[profile.user_id] ?? 'none';
              return (
                <PublicProfileCard
                  key={profile.user_id}
                  profile={profile}
                  compatibilityScore={calcScorePercent(score)}
                  sharedCategories={shared_categories}
                  isFriend={status === 'friend'}
                  isPartner={status === 'accepted'}
                  friendRequestPending={status === 'friend_pending'}
                  requestPending={status === 'pending'}
                  onSendFriendRequest={status === 'none' ? handleSendFriendRequest : undefined}
                  onSendPartnerRequest={status === 'none' && profile.looking_for_partner ? handleSendPartnerRequest : undefined}
                  onMessage={() => onMessage(profile.user_id, profile.display_name)}
                />
              );
            })}
          </div>
          {filtered.length > displayCount && (
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button
                className="social-btn social-btn--secondary"
                onClick={() => setDisplayCount(prev => prev + 20)}
              >
                Load More Matches ({filtered.length - displayCount} remaining)
              </button>
            </div>
          )}
        </>
      )}

      {/* Friend / Partner request dialog */}
      {requestTarget && (
        <div className="partner-req-dialog">
          <div className="partner-req-dialog__backdrop" onClick={() => setRequestTarget(null)} />
          <div className="partner-req-dialog__box">
            <div className="partner-req-dialog__title">
              {requestType === 'friend'
                ? <><Users size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Add {requestTarget.display_name} as a friend</>
                : <><Handshake size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Request {requestTarget.display_name} as accountability partner</>
              }
            </div>
            {requestType === 'partner' && (
              <div style={{
                fontSize: 12, color: '#9CA3AF', marginBottom: 12,
                padding: '8px 12px',
                background: 'rgba(168,85,247,0.08)',
                border: '1px solid rgba(168,85,247,0.2)',
                borderRadius: 8,
              }}>
                <Lightbulb size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Accountability partners commit to checking in on each other's goals.
                This is a deliberate partnership — both sides must agree.
              </div>
            )}
            <textarea
              className="partner-req-dialog__textarea"
              placeholder={
                requestType === 'friend'
                  ? "Add a message (optional) — 'Hey, saw your profile! Want to connect?'"
                  : "Add a message (optional) — 'I'm also working on building a business! Let's keep each other accountable.'"
              }
              value={requestMsg}
              onChange={e => setRequestMsg(e.target.value)}
              maxLength={200}
            />
            <div className="partner-req-dialog__actions">
              <button
                className="profile-card__btn profile-card__btn--secondary"
                style={{ padding: '9px 18px' }}
                onClick={() => setRequestTarget(null)}
              >
                Cancel
              </button>
              <button
                className="profile-card__btn profile-card__btn--primary"
                style={{ padding: '9px 18px' }}
                onClick={() => void handleConfirmRequest()}
                disabled={sendingRequest}
              >
                {sendingRequest
                  ? 'Sending…'
                  : requestType === 'friend'
                  ? <><Users size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Send Friend Request</>
                  : <><Handshake size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Send Partner Request</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FindPartners;
