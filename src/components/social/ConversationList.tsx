// LifeOS Social — Conversation Inbox List
// v3: Messenger-style with search, avatars, relative timestamps, unread indicators

import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, Search } from 'lucide-react';
import { getConversationList, subscribeToInbox } from '../../lib/social/messaging';
import { getAllConnections } from '../../lib/social/partnerships';
import type { ConversationPreview, PartnerWithProfile } from '../../lib/social/types';
import './social.css';

interface EnhancedConversation extends ConversationPreview {
  connectionType: 'friend' | 'accountability_partner' | 'other';
}

interface ConversationListProps {
  userId: string;
  activePartnerId?: string | null;
  onSelect: (partnerId: string, partnerName: string, connectionType?: 'friend' | 'accountability_partner' | null) => void;
}

function timeAgo(ts: string): string {
  const ms = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function ConvoItem({
  convo,
  userId,
  active,
  onSelect,
}: {
  convo: EnhancedConversation;
  userId: string;
  active: boolean;
  onSelect: () => void;
}) {
  const prof = convo.partner_profile;
  const name = prof?.display_name ?? 'Unknown';
  const hasUnread = convo.unread_count > 0;

  let preview = convo.last_message?.content ?? '';
  if (convo.last_message?.message_type === 'nudge') preview = '💪 Nudge!';
  if (convo.last_message?.message_type === 'achievement') preview = 'Shared an achievement';
  if (preview.length > 38) preview = preview.slice(0, 38) + '…';

  const isMe = convo.last_message?.sender_id === userId;

  return (
    <div
      className={`convo-item ${active ? 'active' : ''} ${hasUnread ? 'convo-item--unread' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onSelect()}
    >
      <div className="convo-item__avatar-wrap">
        <div className="convo-item__avatar">
          {prof?.avatar_url
            ? <img src={prof.avatar_url} alt="" loading="lazy" decoding="async" />
            : getInitials(name)
          }
        </div>
        {/* Online dot (active in last 10 min) */}
        {prof?.last_seen_at && (Date.now() - new Date(prof.last_seen_at).getTime()) < 600_000 && (
          <div className="convo-item__online-dot" />
        )}
      </div>

      <div className="convo-item__info">
        <div className="convo-item__header-row">
          <span className={`convo-item__name ${hasUnread ? 'convo-item__name--unread' : ''}`}>{name}</span>
          {convo.last_message?.created_at && (
            <span className={`convo-item__time ${hasUnread ? 'convo-item__time--unread' : ''}`}>
              {timeAgo(convo.last_message.created_at)}
            </span>
          )}
        </div>
        <div className="convo-item__preview-row">
          {preview ? (
            <span className={`convo-item__preview ${hasUnread ? 'convo-item__preview--unread' : ''}`}>
              {isMe ? 'You: ' : ''}{preview}
            </span>
          ) : (
            <span className="convo-item__preview convo-item__preview--empty">
              No messages yet
            </span>
          )}
          {hasUnread && (
            <span className="convo-item__unread-dot" />
          )}
        </div>
      </div>
    </div>
  );
}

export function ConversationList({ userId, activePartnerId, onSelect }: ConversationListProps) {
  const [conversations, setConversations] = useState<EnhancedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);

    // Fetch conversation list + all connections in parallel
    const [convos, connections] = await Promise.all([
      getConversationList(userId),
      getAllConnections(userId).catch(() => [] as PartnerWithProfile[]),
    ]);

    // Build a map of partnerId → connection_type
    const connectionTypeMap = new Map<string, 'friend' | 'accountability_partner'>();
    for (const conn of connections) {
      const partnerId = conn.requester_id === userId ? conn.responder_id : conn.requester_id;
      connectionTypeMap.set(partnerId, conn.connection_type ?? 'accountability_partner');
    }

    // Enrich conversations with connection type
    const enhanced: EnhancedConversation[] = convos.map(c => ({
      ...c,
      connectionType: connectionTypeMap.get(c.partner_id) ?? 'other',
    }));

    setConversations(enhanced);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();

    // Real-time: refresh conversation list when new messages arrive
    const unsub = subscribeToInbox(userId, () => {
      void load();
    });

    return unsub;
  }, [userId, load]);

  // Filter conversations by search
  const filtered = searchQuery.trim()
    ? conversations.filter(c => {
        const name = c.partner_profile?.display_name ?? '';
        return name.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : conversations;

  if (loading) {
    return (
      <div className="conversation-list">
        <div className="convo-list__header">
          <span className="convo-list__title">Chats</span>
        </div>
        <div className="convo-list__items">
          {[1, 2, 3].map(i => (
            <div key={i} className="convo-item-skeleton">
              <div className="convo-item-skeleton__avatar" />
              <div className="convo-item-skeleton__lines">
                <div className="convo-item-skeleton__line convo-item-skeleton__line--name" />
                <div className="convo-item-skeleton__line convo-item-skeleton__line--preview" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="conversation-list">
        <div className="convo-list__header">
          <span className="convo-list__title">Chats</span>
        </div>
        <div className="social-empty" style={{ padding: '40px 20px' }}>
          <div className="social-empty__icon"><MessageCircle size={32} /></div>
          <div className="social-empty__title">No messages yet</div>
          <div className="social-empty__sub">
            Find partners or friends and start chatting!
          </div>
        </div>
      </div>
    );
  }

  // Total unread
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  return (
    <div className="conversation-list">
      <div className="convo-list__header">
        <span className="convo-list__title">Chats</span>
        {totalUnread > 0 && (
          <span className="convo-list__unread-badge">{totalUnread}</span>
        )}
      </div>

      {/* Search bar */}
      <div className="convo-list__search">
        <Search size={14} className="convo-list__search-icon" />
        <input
          type="text"
          className="convo-list__search-input"
          placeholder="Search conversations…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="convo-list__items">
        {filtered.length === 0 && searchQuery && (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
            No conversations match "{searchQuery}"
          </div>
        )}
        {filtered.map(convo => {
          const prof = convo.partner_profile;
          const name = prof?.display_name ?? 'Unknown';
          const active = convo.partner_id === activePartnerId;

          return (
            <ConvoItem
              key={convo.partner_id}
              convo={convo}
              userId={userId}
              active={active}
              onSelect={() => onSelect(convo.partner_id, name, convo.connectionType === 'other' ? null : convo.connectionType)}
            />
          );
        })}
      </div>
    </div>
  );
}

export default ConversationList;
