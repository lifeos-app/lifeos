// LifeOS Social — Partner Activity Feed

import { useState, useEffect } from 'react';
import { Globe, PartyPopper, CheckCircle2 } from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';
import { getPartners } from '../../lib/social/partnerships';
import { getPartnerActivity } from '../../lib/social/partnerships';
import { sendMessage } from '../../lib/social/messaging';
import type { PartnerWithProfile, PartnerActivity } from '../../lib/social/types';
import './social.css';

interface FeedItem {
  partnerId: string;
  partnerName: string;
  partnerAvatar: string | null;
  activity: PartnerActivity;
}

interface PartnerActivityFeedProps {
  userId: string;
}

function timeAgo(ts: string): string {
  const ms = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function PartnerActivityFeed({ userId }: PartnerActivityFeedProps) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [celebrating, setCelebrating] = useState<string | null>(null);
  const [celebrated, setCelebrated] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const partners = await getPartners(userId);

      const allItems: FeedItem[] = [];

      await Promise.all(
        partners.map(async (p: PartnerWithProfile) => {
          const partnerUserId = p.requester_id === userId ? p.responder_id : p.requester_id;
          const prof = p.partner_profile;
          const activities = await getPartnerActivity(partnerUserId);

          activities.slice(0, 5).forEach(act => {
            allItems.push({
              partnerId: partnerUserId,
              partnerName: prof?.display_name ?? 'Partner',
              partnerAvatar: prof?.avatar_url ?? null,
              activity: act,
            });
          });
        }),
      );

      // Sort by timestamp desc
      allItems.sort((a, b) =>
        new Date(b.activity.timestamp).getTime() - new Date(a.activity.timestamp).getTime(),
      );

      setFeed(allItems.slice(0, 30));
      setLoading(false);
    };

    void load();
  }, [userId]);

  const handleCelebrate = async (item: FeedItem) => {
    const key = `${item.partnerId}-${item.activity.timestamp}`;
    if (celebrated.has(key) || celebrating === key) return;

    setCelebrating(key);
    const msgs = ['Amazing work!', 'Crushing it!', 'Keep going!', 'Legend!'];
    const msg = msgs[Math.floor(Math.random() * msgs.length)];

    await sendMessage(userId, item.partnerId, msg, 'text');
    setCelebrated(prev => new Set([...prev, key]));
    setCelebrating(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3].map(i => <div key={i} className="social-skeleton" style={{ height: 60 }} />)}
      </div>
    );
  }

  if (feed.length === 0) {
    return (
      <div className="social-empty">
        <div className="social-empty__icon"><Globe size={32} /></div>
        <div className="social-empty__title">No activity yet</div>
        <div className="social-empty__sub">Your partners' actions will appear here</div>
      </div>
    );
  }

  return (
    <div className="activity-feed">
      {feed.map((item, idx) => {
        const key = `${item.partnerId}-${item.activity.timestamp}-${idx}`;
        const celebKey = `${item.partnerId}-${item.activity.timestamp}`;
        const isCelebrated = celebrated.has(celebKey);

        return (
          <div key={key} className="activity-item">
            {/* Partner avatar */}
            <div className="activity-item__icon" style={{ fontSize: 20, background: 'none' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, #00D4FF, #39FF14)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 900, color: '#0A2540',
                fontFamily: 'Orbitron, monospace',
              }}>
                {item.partnerAvatar
                  ? <img src={item.partnerAvatar} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  : getInitials(item.partnerName)
                }
              </div>
            </div>

            <div className="activity-item__content">
              <div className="activity-item__text" style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <CategoryIcon name={item.activity.icon} size={14} />
                <span className="activity-item__name">{item.partnerName}</span>
                {' '}{item.activity.description}
              </div>
              <div className="activity-item__time">{timeAgo(item.activity.timestamp)}</div>
            </div>

            <button
              className="activity-item__celebrate"
              onClick={() => handleCelebrate(item)}
              disabled={isCelebrated || celebrating === celebKey}
            >
              {isCelebrated ? <><CheckCircle2 size={12} /> Sent!</> : celebrating === celebKey ? '...' : <><PartyPopper size={12} /> Celebrate</>}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default PartnerActivityFeed;
