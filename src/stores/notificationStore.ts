/**
 * Notification Store — Zustand store with persist for social notifications
 *
 * Manages notification types: new_message, friend_request, friend_accepted,
 * nudge, guild_invite, guild_activity, achievement_unlocked, streak_at_risk,
 * level_up, realm_event
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/data-access';
import { subscribeToInbox } from '../lib/social/messaging';
import { logger } from '../utils/logger';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export type NotificationType =
  | 'new_message'
  | 'friend_request'
  | 'friend_accepted'
  | 'nudge'
  | 'guild_invite'
  | 'guild_activity'
  | 'achievement_unlocked'
  | 'streak_at_risk'
  | 'level_up'
  | 'realm_event';

export type NotificationPriority = 'urgent' | 'normal' | 'low';
export type NotificationCategory = 'social' | 'achievement' | 'warning' | 'event';

export interface SocialNotification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  /** Icon emoji */
  icon: string;
  /** Timestamp (ISO string) */
  createdAt: string;
  /** Whether the user has read it */
  read: boolean;
  /** User ID that triggered this notification (friend, sender, etc.) */
  fromUserId?: string;
  /** Action link — navigate to this path when tapped */
  actionLink?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface NotificationPreferences {
  enabled: boolean;
  types: Record<NotificationType, boolean>;
  /** Push notifications enabled */
  pushEnabled: boolean;
  /** Sound enabled */
  soundEnabled: boolean;
  /** Daily digest enabled */
  digestEnabled: boolean;
}

interface NotificationState {
  notifications: SocialNotification[];
  preferences: NotificationPreferences;

  // Actions
  addNotification: (notification: Omit<SocialNotification, 'id' | 'createdAt' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => void;
  toggleType: (type: NotificationType) => void;

  // Computed
  getUnreadCount: () => number;
  getUnreadByCategory: (category: NotificationCategory) => number;
  getByCategory: (category: NotificationCategory) => SocialNotification[];
  getByType: (type: NotificationType) => SocialNotification[];
  getUrgent: () => SocialNotification[];

  // Real-time subscription
  subscribeToRealtime: (userId: string) => () => void;
}

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

const CATEGORY_MAP: Record<NotificationType, NotificationCategory> = {
  new_message: 'social',
  friend_request: 'social',
  friend_accepted: 'social',
  nudge: 'social',
  guild_invite: 'social',
  guild_activity: 'social',
  achievement_unlocked: 'achievement',
  streak_at_risk: 'warning',
  level_up: 'achievement',
  realm_event: 'event',
};

const PRIORITY_MAP: Record<NotificationType, NotificationPriority> = {
  new_message: 'normal',
  friend_request: 'normal',
  friend_accepted: 'normal',
  nudge: 'low',
  guild_invite: 'normal',
  guild_activity: 'low',
  achievement_unlocked: 'normal',
  streak_at_risk: 'urgent',
  level_up: 'normal',
  realm_event: 'low',
};

const ICON_MAP: Record<NotificationType, string> = {
  new_message: '💬',
  friend_request: '🤝',
  friend_accepted: '🎉',
  nudge: '👆',
  guild_invite: '⚔️',
  guild_activity: '📊',
  achievement_unlocked: '🏆',
  streak_at_risk: '🔥',
  level_up: '⬆️',
  realm_event: '🌌',
};

const ACTION_LINK_MAP: Record<NotificationType, string> = {
  new_message: '/social',
  friend_request: '/social',
  friend_accepted: '/social',
  nudge: '/social',
  guild_invite: '/social',
  guild_activity: '/social',
  achievement_unlocked: '/character',
  streak_at_risk: '/habits',
  level_up: '/character',
  realm_event: '/',
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  types: {
    new_message: true,
    friend_request: true,
    friend_accepted: true,
    nudge: true,
    guild_invite: true,
    guild_activity: true,
    achievement_unlocked: true,
    streak_at_risk: true,
    level_up: true,
    realm_event: true,
  },
  pushEnabled: true,
  soundEnabled: true,
  digestEnabled: false,
};

let notificationCounter = 0;

function generateId(): string {
  return `notif-${Date.now()}-${++notificationCounter}`;
}

// ═══════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      preferences: { ...DEFAULT_PREFERENCES },

      addNotification: (partial) => {
        const type = partial.type;
        const notification: SocialNotification = {
          ...partial,
          id: partial.id || generateId(),
          category: partial.category || CATEGORY_MAP[type],
          priority: partial.priority || PRIORITY_MAP[type],
          icon: partial.icon || ICON_MAP[type],
          actionLink: partial.actionLink || ACTION_LINK_MAP[type],
          createdAt: new Date().toISOString(),
          read: false,
        };

        // Check if this type is enabled in preferences
        const prefs = get().preferences;
        if (!prefs.enabled || !prefs.types[type]) return;

        // Deduplicate: don't add if same type + fromUserId exists unread within 5 min
        const existing = get().notifications;
        const fiveMinAgo = Date.now() - 5 * 60 * 1000;
        const isDuplicate = existing.some(n =>
          n.type === type &&
          n.fromUserId === notification.fromUserId &&
          !n.read &&
          new Date(n.createdAt).getTime() > fiveMinAgo
        );
        if (isDuplicate) return;

        set((state) => ({
          notifications: [notification, ...state.notifications].slice(0, 200), // Max 200
        }));
      },

      markAsRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map(n =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map(n => ({ ...n, read: true })),
        }));
      },

      deleteNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter(n => n.id !== id),
        }));
      },

      clearAll: () => {
        set({ notifications: [] });
      },

      updatePreferences: (prefs) => {
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        }));
      },

      toggleType: (type) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            types: {
              ...state.preferences.types,
              [type]: !state.preferences.types[type],
            },
          },
        }));
      },

      getUnreadCount: () => {
        return get().notifications.filter(n => !n.read).length;
      },

      getUnreadByCategory: (category) => {
        return get().notifications.filter(n => !n.read && n.category === category).length;
      },

      getByCategory: (category) => {
        return get().notifications.filter(n => n.category === category);
      },

      getByType: (type) => {
        return get().notifications.filter(n => n.type === type);
      },

      getUrgent: () => {
        return get().notifications.filter(n => n.priority === 'urgent' && !n.read);
      },

      subscribeToRealtime: (userId) => {
        // Subscribe to incoming messages
        const unsubMessage = subscribeToInbox(userId, (msg) => {
          get().addNotification({
            type: 'new_message',
            title: 'New Message',
            body: `You received a message`,
            fromUserId: msg.sender_id,
            metadata: { messageId: msg.id },
          });
        });

        // Subscribe to partnership changes (friend requests, accepts)
        const partnershipChannel = supabase
          .channel(`notifications:partnerships:${userId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'partnerships',
              filter: `responder_id=eq.${userId}`,
            },
            (payload) => {
              const partnership = payload.new as Record<string, unknown>;
              const status = partnership.status as string;
              const connectionType = partnership.connection_type as string;

              if (status === 'pending') {
                get().addNotification({
                  type: connectionType === 'friend' ? 'friend_request' : 'guild_invite',
                  title: connectionType === 'friend' ? 'Friend Request' : 'Partner Request',
                  body: `Someone wants to be your ${connectionType}!`,
                  fromUserId: partnership.requester_id as string,
                });
              }
            },
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'partnerships',
              filter: `requester_id=eq.${userId}`,
            },
            (payload) => {
              const partnership = payload.new as Record<string, unknown>;
              if (partnership.status === 'accepted') {
                get().addNotification({
                  type: 'friend_accepted',
                  title: 'Request Accepted',
                  body: `Your ${partnership.connection_type} request was accepted!`,
                  fromUserId: partnership.responder_id as string,
                });
              }
            },
          )
          .subscribe();

        return () => {
          unsubMessage();
          void supabase.removeChannel(partnershipChannel);
        };
      },
    }),
    {
      name: 'lifeos-notifications',
      partialize: (state) => ({
        notifications: state.notifications.slice(0, 50), // Only persist last 50
        preferences: state.preferences,
      }),
    },
  ),
);