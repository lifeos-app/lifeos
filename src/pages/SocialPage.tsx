// LifeOS Social Hub — /social
// v4: Fullscreen immersive mode via FullscreenPage

import { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Search, Globe, MessageCircle, UserCircle, UserPlus, Lock, User, Handshake, Crown, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUserStore } from '../stores/useUserStore';
import { PartnerList } from '../components/social/PartnerList';
import { FriendsList } from '../components/social/FriendsList';
import { PartnerActivityFeed } from '../components/social/PartnerActivityFeed';
import { FindPartners } from '../components/social/FindPartners';
import { GuildsTab } from '../components/social/GuildsTab';
import { LeaderboardTab } from '../components/social/LeaderboardTab';
import { ConversationList } from '../components/social/ConversationList';
import { ChatPanel } from '../components/social/ChatPanel';
import { KingdomView } from '../components/social/KingdomView';
import { getUnreadCount } from '../lib/social/messaging';
import { getPublicProfile } from '../lib/social/profiles';
import { getLadder } from '../lib/gamification/ladder';
import type { LadderKey } from '../lib/gamification/ladder';
import { FullscreenPage } from '../components/FullscreenPage';
import { logger } from '../utils/logger';
import '../components/social/social.css';

type Tab = 'friends' | 'find' | 'guilds' | 'leaderboard' | 'kingdom' | 'messages';

const SOCIAL_TABS = [
  { id: 'friends',  label: 'Friends',  icon: UserPlus,      color: '#39FF14' },
  { id: 'find',     label: 'Discover', icon: Search,        color: '#00D4FF' },
  { id: 'guilds',   label: 'Guilds',   icon: Globe,         color: '#A855F7' },
  { id: 'leaderboard', label: 'Ranks', icon: Trophy,       color: '#FFD700' },
  { id: 'kingdom',  label: 'Kingdom',  icon: Crown,         color: '#FFD700' },
  { id: 'messages', label: 'Messages', icon: MessageCircle, color: '#F97316' },
];

const VALID_TABS: Tab[] = ['friends', 'find', 'guilds', 'leaderboard', 'kingdom', 'messages'];

interface ActiveChat {
  partnerId: string;
  partnerName: string;
  connectionType?: 'friend' | 'accountability_partner' | null;
}

export function SocialPage() {
  const user = useUserStore(s => s.user);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as Tab | null;
  const initialTab = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'friends';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [userLadder, setUserLadder] = useState<ReturnType<typeof getLadder>>(null);
  const [partnersExpanded, setPartnersExpanded] = useState(false);
  const prevTabIndex = useRef(VALID_TABS.indexOf(initialTab));
  const [slideDir, setSlideDir] = useState<'left' | 'right' | 'none'>('none');

  // Chat state
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);

  const userId = user?.id;

  const handleTabChange = useCallback((tabId: string) => {
    const tab = tabId as Tab;
    const newIndex = VALID_TABS.indexOf(tab);
    const oldIndex = prevTabIndex.current;
    setSlideDir(newIndex > oldIndex ? 'right' : newIndex < oldIndex ? 'left' : 'none');
    prevTabIndex.current = newIndex;
    setActiveTab(tab);
    if (tab !== 'messages') setActiveChat(null);
  }, []);

  // Sync tab from URL
  useEffect(() => {
    if (tabFromUrl && VALID_TABS.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      handleTabChange(tabFromUrl);
    }
  }, [tabFromUrl]);

  useEffect(() => {
    if (!userId) return;
    getUnreadCount(userId).then(setUnreadCount).catch(e => logger.error('[Social] Unread count:', e));
    getPublicProfile(userId).then(p => {
      setHasProfile(!!p);
      if (p?.ladder) setUserLadder(getLadder(p.ladder as LadderKey));
    }).catch(() => setHasProfile(false));
    const interval = setInterval(() => {
      getUnreadCount(userId).then(setUnreadCount).catch(() => null);
    }, 30_000);
    return () => clearInterval(interval);
  }, [userId]);

  if (!userId) {
    return (
      <div className="social-empty" style={{ marginTop: 80 }}>
        <div className="social-empty__icon"><Lock size={32} /></div>
        <div className="social-empty__title">Sign in to access Social</div>
      </div>
    );
  }

  const openChat = (
    partnerId: string,
    partnerName: string,
    connectionType?: 'friend' | 'accountability_partner' | null,
  ) => {
    setActiveChat({ partnerId, partnerName, connectionType });
    setActiveTab('messages');
  };

  const activeColor = SOCIAL_TABS.find(t => t.id === activeTab)?.color || '#39FF14';

  const pageContent = (
    <FullscreenPage
      title="Community"
      titleIcon={userLadder ? <span style={{ fontSize: 16 }}>{userLadder.icon}</span> : <Users size={16} />}
      tabs={SOCIAL_TABS}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      slideDir={slideDir}
      activeColor={activeColor}
      headerExtra={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 6,
            background: 'rgba(57,255,20,0.08)',
            border: '1px solid rgba(57,255,20,0.2)',
            color: '#39FF14', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            Live
          </span>
        <button
          onClick={() => navigate('/social/profile')}
          aria-label={hasProfile ? 'View profile' : 'Setup profile'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
            background: hasProfile
              ? (userLadder ? userLadder.glowColor : 'rgba(57,255,20,0.1)')
              : 'rgba(0,212,255,0.1)',
            border: hasProfile
              ? `1px solid ${userLadder ? userLadder.borderColor : 'rgba(57,255,20,0.25)'}`
              : '1px solid rgba(0,212,255,0.3)',
            color: hasProfile
              ? (userLadder ? userLadder.color : '#39FF14')
              : '#00D4FF',
            fontSize: 11, fontWeight: 600, flexShrink: 0,
          }}
        >
          <UserCircle size={13} />
          {hasProfile ? 'Profile' : 'Setup'}
        </button>
        </div>
      }
    >
      {/* Profile prompt */}
      {hasProfile === false && (
        <div style={{
          background: 'rgba(0,212,255,0.07)',
          border: '1px solid rgba(0,212,255,0.2)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <User size={24} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#F9FAFB', marginBottom: 2 }}>
              Set up your public profile
            </div>
            <div style={{ fontSize: 13, color: '#6B7280' }}>
              Create a profile to connect with friends, find accountability partners,
              and show your ladder class.
            </div>
          </div>
          <button
            className="profile-card__btn profile-card__btn--primary"
            style={{ width: 'auto', padding: '8px 16px', flexShrink: 0 }}
            onClick={() => navigate('/social/profile')}
          >
            Get Started
          </button>
        </div>
      )}

      {/* ── FRIENDS TAB ── */}
      {activeTab === 'friends' && (
        <div>
          <div style={{
            background: 'rgba(168,85,247,0.04)',
            border: '1px solid rgba(168,85,247,0.15)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            <button
              onClick={() => setPartnersExpanded(!partnersExpanded)}
              aria-expanded={partnersExpanded}
              aria-label={partnersExpanded ? 'Collapse accountability partners' : 'Expand accountability partners'}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', padding: '14px 18px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#A855F7', fontSize: 14, fontWeight: 600, letterSpacing: '0.02em',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Handshake size={16} /> Accountability Partners
              </span>
              {partnersExpanded
                ? <ChevronUp size={18} style={{ color: '#A855F7' }} />
                : <ChevronDown size={18} style={{ color: '#A855F7' }} />
              }
            </button>
            {partnersExpanded && (
              <div style={{ padding: '0 18px 18px' }}>
                <div style={{
                  fontSize: 12, color: '#6B7280', marginBottom: 14, padding: '8px 12px',
                  background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.12)',
                  borderRadius: 8,
                }}>
                  <Handshake size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  Partners are deliberate commitments — both sides must agree.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 20 }} className="social-partners-layout">
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#A855F7', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Users size={13} /> Your Partners
                    </div>
                    <PartnerList userId={userId} onMessage={(pid, name) => openChat(pid, name, 'accountability_partner')} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#00D4FF', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Partner Activity
                    </div>
                    <PartnerActivityFeed userId={userId} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 20 }} className="social-partners-layout">
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#39FF14', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserPlus size={13} /> Your Friends
              </div>
              <FriendsList userId={userId} onMessage={(pid, name, type) => openChat(pid, name, type)} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#00D4FF', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Friend Activity
              </div>
              <PartnerActivityFeed userId={userId} />
            </div>
          </div>
        </div>
      )}

      {/* ── DISCOVER TAB ── */}
      {activeTab === 'find' && <FindPartners userId={userId} onMessage={openChat} />}

      {/* ── GUILDS TAB ── */}
      {activeTab === 'guilds' && <GuildsTab userId={userId} onOpenDM={(partnerId) => openChat(partnerId, 'Guild Member', null)} />}
      {activeTab === 'leaderboard' && <LeaderboardTab />}

      {/* ── KINGDOM TAB ── */}
      {activeTab === 'kingdom' && <KingdomView />}

      {/* ── MESSAGES TAB ── */}
      {activeTab === 'messages' && (
        <div className={`messages-layout ${activeChat ? 'messages-layout--chat-open' : ''}`}>
          <div className="messages-sidebar">
            <ConversationList
              userId={userId}
              activePartnerId={activeChat?.partnerId}
              onSelect={(pid, name, ctype) => setActiveChat({ partnerId: pid, partnerName: name, connectionType: ctype })}
            />
          </div>
          <div className={`messages-main ${!activeChat ? 'messages-main--empty' : ''}`}>
            {activeChat ? (
              <ChatPanel
                userId={userId}
                partnerId={activeChat.partnerId}
                partnerName={activeChat.partnerName}
                connectionType={activeChat.connectionType}
                onBack={() => setActiveChat(null)}
              />
            ) : (
              <div className="messages-empty-state">
                <div className="messages-empty-state__icon"><MessageCircle size={48} /></div>
                <div className="messages-empty-state__title">Your Messages</div>
                <div className="messages-empty-state__sub">
                  Select a conversation to start chatting, or{' '}
                  <button onClick={() => handleTabChange('find')} className="messages-empty-state__link">find someone new</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </FullscreenPage>
  );

  return pageContent;
}

export default SocialPage;
