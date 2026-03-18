// LifeOS — Floating Chat Widget (Intercom-style)
// Accessible from any page, shows unread count, slide-up chat panel

import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, X, ChevronLeft } from 'lucide-react';
import { useUserStore } from '../stores/useUserStore';
import { getUnreadCount, subscribeToInbox } from '../lib/social/messaging';
import { showToast } from './Toast';
import { ConversationList } from './social/ConversationList';
import { ChatPanel } from './social/ChatPanel';
import type { Message } from '../lib/social/types';
import './ChatWidget.css';

interface ActiveChat {
  partnerId: string;
  partnerName: string;
  connectionType?: 'friend' | 'accountability_partner' | null;
}

export function ChatWidget() {
  const user = useUserStore(s => s.user);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  const userId = user?.id;

  // Load unread count
  const refreshUnread = useCallback(() => {
    if (!userId) return;
    getUnreadCount(userId).then(setUnreadCount).catch(() => null);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    refreshUnread();

    // Track whether real-time subscription is active
    let subscriptionActive = false;

    // Only poll if subscription is not connected
    const interval = setInterval(() => {
      if (!subscriptionActive) refreshUnread();
    }, 30_000);

    // Real-time subscription for new messages
    const unsub = subscribeToInbox(userId, (msg: Message) => {
      subscriptionActive = true;
      setUnreadCount(prev => prev + 1);
      setHasNewMessage(true);

      // Show browser notification if tab is backgrounded
      // Guard: Notification API not available on all browsers/contexts
      if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification('New Message', {
            body: msg.content?.slice(0, 60) || 'You have a new message',
            icon: '/icons/icon-192.png',
            tag: 'lifeos-chat',
          });
        } catch { /* iOS PWA doesn't support Notification constructor */ }
      }

      // Play notification sound
      try {
        const audio = new Audio('/notification.wav');
        audio.volume = 0.3;
        audio.play().catch(() => {});
      } catch {}

      // Show in-app toast
      showToast(
        `New message: ${msg.content?.slice(0, 40) || 'New message'}`,
        '💬',
        '#00D4FF',
      );

      // Clear animation after 3 seconds
      setTimeout(() => setHasNewMessage(false), 3000);
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, [userId, refreshUnread]);

  // Request browser notification permission on first open
  useEffect(() => {
    if (open && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [open]);

  if (!userId) return null;

  const handleSelectConvo = (partnerId: string, partnerName: string, connectionType?: 'friend' | 'accountability_partner' | null) => {
    setActiveChat({ partnerId, partnerName, connectionType });
  };

  const handleBack = () => {
    setActiveChat(null);
    refreshUnread(); // Refresh after reading messages
  };

  const handleToggle = () => {
    setOpen(!open);
    if (!open) {
      refreshUnread();
      setHasNewMessage(false);
    }
  };

  return (
    <>
      {/* Chat panel — slide up from bottom-right */}
      {open && (
        <div className="chat-widget-panel">
          <div className="chat-widget-panel__header">
            {activeChat ? (
              <button className="chat-widget-panel__back" onClick={handleBack} aria-label="Go back">
                <ChevronLeft size={18} />
              </button>
            ) : null}
            <span className="chat-widget-panel__title">
              {activeChat ? activeChat.partnerName : 'Messages'}
            </span>
            <button className="chat-widget-panel__close" onClick={() => setOpen(false)} aria-label="Close messages">
              <X size={18} />
            </button>
          </div>
          <div className="chat-widget-panel__body">
            {activeChat ? (
              <ChatPanel
                userId={userId}
                partnerId={activeChat.partnerId}
                partnerName={activeChat.partnerName}
                connectionType={activeChat.connectionType}
                onBack={handleBack}
              />
            ) : (
              <ConversationList
                userId={userId}
                activePartnerId={null}
                onSelect={handleSelectConvo}
              />
            )}
          </div>
        </div>
      )}

      {/* Floating bubble button */}
      <button
        className={`chat-widget-bubble ${hasNewMessage ? 'pulse' : ''} ${open ? 'open' : ''}`}
        onClick={handleToggle}
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        {open ? (
          <X size={22} />
        ) : (
          <>
            <MessageCircle size={22} />
            {unreadCount > 0 && (
              <span className="chat-widget-bubble__badge">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </>
        )}
      </button>
    </>
  );
}
