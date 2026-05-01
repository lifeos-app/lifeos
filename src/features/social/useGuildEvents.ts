// LifeOS Social — Guild Events & Calendar Hook
// Manages guild events via Supabase (guild_events table)

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/data-access';
import { logger } from '../../utils/logger';
import { awardXP } from '../../lib/gamification/xp-engine';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export type GuildEventType = 'challenge' | 'competition' | 'meetup' | 'raid' | 'study_group';
export type GuildEventStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';
export type RSVPStatus = 'going' | 'interested' | 'declined';
export type EventRecurrence = 'none' | 'weekly' | 'monthly';

export interface GuildEventRSVP {
  user_id: string;
  status: RSVPStatus;
}

export interface GuildEventResult {
  winners: string[];
  xp_awarded: number;
}

export interface GuildEvent {
  id: string;
  guild_id: string;
  created_by: string;
  name: string;
  description: string;
  type: GuildEventType;
  start_time: string;
  end_time: string;
  recurrence: EventRecurrence;
  max_participants: number;
  rsvps: GuildEventRSVP[];
  results: GuildEventResult | null;
  status: GuildEventStatus;
  created_at: string;
  updated_at: string;
}

export interface GuildAnnouncement {
  id: string;
  guild_id: string;
  author_id: string;
  content: string;
  is_pinned: boolean;
  reactions: Record<string, string[]>; // emoji → user_ids
  mentions: string[]; // @mentioned user_ids
  poll?: GuildPoll | null;
  created_at: string;
  updated_at: string;
}

export interface GuildPoll {
  question: string;
  options: GuildPollOption[];
  expires_at: string | null;
}

export interface GuildPollOption {
  id: string;
  label: string;
  votes: string[]; // user_ids
}

// ═══════════════════════════════════════════════════
// EVENT TYPE CONFIG
// ═══════════════════════════════════════════════════

export const EVENT_TYPE_CONFIG: Record<GuildEventType, { icon: string; label: string; color: string; description: string }> = {
  challenge: {
    icon: '🔥',
    label: 'Habit Challenge',
    color: '#F97316',
    description: 'Everyone logs habits for 7 days',
  },
  competition: {
    icon: '⚔️',
    label: 'Arena Competition',
    color: '#EF4444',
    description: 'Highest XP this week',
  },
  study_group: {
    icon: '📚',
    label: 'Study Group',
    color: '#A855F7',
    description: 'Learn together',
  },
  raid: {
    icon: '🐉',
    label: 'Boss Raid',
    color: '#DC2626',
    description: 'Defeat the Procrastination Dragon as a guild',
  },
  meetup: {
    icon: '🎉',
    label: 'Social Meetup',
    color: '#06B6D4',
    description: 'Hang out and connect',
  },
};

// ═══════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════

interface UseGuildEventsReturn {
  events: GuildEvent[];
  loading: boolean;
  error: string | null;
  createEvent: (event: Omit<GuildEvent, 'id' | 'created_at' | 'updated_at' | 'rsvps' | 'results' | 'status'>) => Promise<GuildEvent | null>;
  updateEvent: (eventId: string, updates: Partial<GuildEvent>) => Promise<boolean>;
  cancelEvent: (eventId: string) => Promise<boolean>;
  deleteEvent: (eventId: string) => Promise<boolean>;
  rsvpEvent: (eventId: string, status: RSVPStatus) => Promise<boolean>;
  completeEvent: (eventId: string, results: GuildEventResult) => Promise<boolean>;
  refreshEvents: () => Promise<void>;
  getUpcomingEvents: () => GuildEvent[];
  getActiveEvents: () => GuildEvent[];
  getPastEvents: () => GuildEvent[];
  getEventCountdown: (eventId: string) => { days: number; hours: number; minutes: number; seconds: number; isPast: boolean } | null;
  announcements: GuildAnnouncement[];
  createAnnouncement: (announcement: Omit<GuildAnnouncement, 'id' | 'created_at' | 'updated_at' | 'reactions' | 'mentions'>) => Promise<GuildAnnouncement | null>;
  updateAnnouncement: (announcementId: string, updates: Partial<GuildAnnouncement>) => Promise<boolean>;
  deleteAnnouncement: (announcementId: string) => Promise<boolean>;
  toggleAnnounceReaction: (announcementId: string, emoji: string) => Promise<boolean>;
  toggleAnnouncePin: (announcementId: string, pinned: boolean) => Promise<boolean>;
  votePoll: (announcementId: string, optionId: string) => Promise<boolean>;
  loadingAnnouncements: boolean;
}

export function useGuildEvents(guildId: string, userId: string): UseGuildEventsReturn {
  const [events, setEvents] = useState<GuildEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<GuildAnnouncement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);

  // ── Load Events ──────────────────────────────────────────────────────
  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('guild_events')
        .select('*')
        .eq('guild_id', guildId)
        .order('start_time', { ascending: true });

      if (fetchError) throw fetchError;
      setEvents((data ?? []) as GuildEvent[]);
    } catch (err: any) {
      logger.error('[useGuildEvents] loadEvents error:', err);
      setError(err.message || 'Failed to load events');
      // Fallback: use empty array so UI still works offline
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  // ── Load Announcements ──────────────────────────────────────────────
  const loadAnnouncements = useCallback(async () => {
    setLoadingAnnouncements(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('guild_announcements')
        .select('*')
        .eq('guild_id', guildId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setAnnouncements((data ?? []) as GuildAnnouncement[]);
    } catch (err: any) {
      logger.error('[useGuildEvents] loadAnnouncements error:', err);
      setAnnouncements([]);
    } finally {
      setLoadingAnnouncements(false);
    }
  }, [guildId]);

  useEffect(() => { void loadEvents(); }, [loadEvents]);
  useEffect(() => { void loadAnnouncements(); }, [loadAnnouncements]);

  // ── Auto-detect event status changes ───────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setEvents(prev => prev.map(event => {
        const now = Date.now();
        const start = new Date(event.start_time).getTime();
        const end = new Date(event.end_time).getTime();

        if (event.status === 'upcoming' && now >= start && now < end) {
          return { ...event, status: 'active' as GuildEventStatus };
        }
        if ((event.status === 'active' || event.status === 'upcoming') && now >= end) {
          return { ...event, status: 'completed' as GuildEventStatus };
        }
        return event;
      }));
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // ── Realtime subscription ──────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`guild_events:${guildId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guild_events', filter: `guild_id=eq.${guildId}` }, () => {
        void loadEvents();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guild_announcements', filter: `guild_id=eq.${guildId}` }, () => {
        void loadAnnouncements();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [guildId, loadEvents, loadAnnouncements]);

  // ── Create Event ────────────────────────────────────────────────────
  const createEvent = useCallback(async (
    eventData: Omit<GuildEvent, 'id' | 'created_at' | 'updated_at' | 'rsvps' | 'results' | 'status'>
  ): Promise<GuildEvent | null> => {
    try {
      const { data, error: insertError } = await supabase
        .from('guild_events')
        .insert({
          ...eventData,
          rsvps: [{ user_id: userId, status: 'going' as RSVPStatus }],
          results: null,
          status: 'upcoming',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Award XP for creating an event
      try {
        await awardXP(supabase, userId, 'guild_contribute', { description: `Created guild event: ${eventData.name}` });
      } catch {
        // XP award failure is non-critical
      }

      setEvents(prev => [...prev, data as GuildEvent].sort((a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      ));
      return data as GuildEvent;
    } catch (err: any) {
      logger.error('[useGuildEvents] createEvent error:', err);
      setError(err.message || 'Failed to create event');
      return null;
    }
  }, [guildId, userId]);

  // ── Update Event ────────────────────────────────────────────────────
  const updateEvent = useCallback(async (eventId: string, updates: Partial<GuildEvent>): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('guild_events')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', eventId);

      if (updateError) throw updateError;
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, ...updates } : e));
      return true;
    } catch (err: any) {
      logger.error('[useGuildEvents] updateEvent error:', err);
      return false;
    }
  }, []);

  // ── Cancel Event ────────────────────────────────────────────────────
  const cancelEvent = useCallback(async (eventId: string): Promise<boolean> => {
    return updateEvent(eventId, { status: 'cancelled' });
  }, [updateEvent]);

  // ── Delete Event ────────────────────────────────────────────────────
  const deleteEvent = useCallback(async (eventId: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('guild_events')
        .delete()
        .eq('id', eventId);

      if (deleteError) throw deleteError;
      setEvents(prev => prev.filter(e => e.id !== eventId));
      return true;
    } catch (err: any) {
      logger.error('[useGuildEvents] deleteEvent error:', err);
      return false;
    }
  }, []);

  // ── RSVP ────────────────────────────────────────────────────────────
  const rsvpEvent = useCallback(async (eventId: string, status: RSVPStatus): Promise<boolean> => {
    try {
      const event = events.find(e => e.id === eventId);
      if (!event) return false;

      const existingRsvp = event.rsvps.find(r => r.user_id === userId);
      let newRsvps: GuildEventRSVP[];

      if (existingRsvp) {
        newRsvps = event.rsvps.map(r => r.user_id === userId ? { ...r, status } : r);
      } else {
        newRsvps = [...event.rsvps, { user_id: userId, status }];
      }

      const { error: rsvpError } = await supabase
        .from('guild_events')
        .update({ rsvps: newRsvps, updated_at: new Date().toISOString() })
        .eq('id', eventId);

      if (rsvpError) throw rsvpError;

      // Award XP for RSVP
      if (status === 'going') {
        try {
          await awardXP(supabase, userId, 'guild_contribute', { description: `RSVP'd to event: ${event.name}` });
        } catch { /* non-critical */ }
      }

      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, rsvps: newRsvps } : e));
      return true;
    } catch (err: any) {
      logger.error('[useGuildEvents] rsvpEvent error:', err);
      return false;
    }
  }, [events, userId]);

  // ── Complete Event (with results) ────────────────────────────────────
  const completeEvent = useCallback(async (eventId: string, results: GuildEventResult): Promise<boolean> => {
    try {
      const { error: completeError } = await supabase
        .from('guild_events')
        .update({
          status: 'completed',
          results,
          updated_at: new Date().toISOString(),
        })
        .eq('id', eventId);

      if (completeError) throw completeError;

      // Award XP to winners
      for (const winnerId of results.winners) {
        try {
          await awardXP(supabase, winnerId, 'guild_contribute', {
            description: `Won guild event! +${results.xp_awarded} XP`,
          });
        } catch { /* non-critical */ }
      }

      // Award participation XP to all who RSVP'd "going"
      const event = events.find(e => e.id === eventId);
      if (event) {
        const goingUserIds = event.rsvps
          .filter(r => r.status === 'going' && !results.winners.includes(r.user_id))
          .map(r => r.user_id);
        for (const participantId of goingUserIds) {
          try {
            await awardXP(supabase, participantId, 'guild_contribute', {
              description: `Participated in guild event: ${event.name}`,
            });
          } catch { /* non-critical */ }
        }
      }

      setEvents(prev => prev.map(e =>
        e.id === eventId ? { ...e, status: 'completed', results } : e
      ));
      return true;
    } catch (err: any) {
      logger.error('[useGuildEvents] completeEvent error:', err);
      return false;
    }
  }, [events]);

  // ── Get filtered events ─────────────────────────────────────────────
  const getUpcomingEvents = useCallback(() => events.filter(e => e.status === 'upcoming'), [events]);
  const getActiveEvents = useCallback(() => events.filter(e => e.status === 'active'), [events]);
  const getPastEvents = useCallback(() => events.filter(e => e.status === 'completed' || e.status === 'cancelled'), [events]);

  // ── Event Countdown ─────────────────────────────────────────────────
  const getEventCountdown = useCallback((eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return null;

    const now = Date.now();
    const start = new Date(event.start_time).getTime();
    const diff = start - now;

    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds, isPast: false };
  }, [events]);

  // ── Refresh ─────────────────────────────────────────────────────────
  const refreshEvents = useCallback(async () => {
    await Promise.all([loadEvents(), loadAnnouncements()]);
  }, [loadEvents, loadAnnouncements]);

  // ── ANNOUNCEMENTS ──────────────────────────────────────────────────

  const createAnnouncement = useCallback(async (
    data: Omit<GuildAnnouncement, 'id' | 'created_at' | 'updated_at' | 'reactions' | 'mentions'>
  ): Promise<GuildAnnouncement | null> => {
    try {
      // Parse @mentions from content
      const mentionRegex = /@(\w+)/g;
      const mentions = Array.from(data.content.matchAll(mentionRegex)).map(m => m[1]);

      const { data: announcement, error: insertError } = await supabase
        .from('guild_announcements')
        .insert({
          ...data,
          reactions: {},
          mentions,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      setAnnouncements(prev => [announcement as GuildAnnouncement, ...prev]);
      return announcement as GuildAnnouncement;
    } catch (err: any) {
      logger.error('[useGuildEvents] createAnnouncement error:', err);
      return null;
    }
  }, [guildId]);

  const updateAnnouncement = useCallback(async (id: string, updates: Partial<GuildAnnouncement>): Promise<boolean> => {
    try {
      // Re-parse mentions if content changed
      if (updates.content) {
        const mentionRegex = /@(\w+)/g;
        updates.mentions = Array.from(updates.content.matchAll(mentionRegex)).map(m => m[1]);
      }
      const { error } = await supabase
        .from('guild_announcements')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
      return true;
    } catch (err: any) {
      logger.error('[useGuildEvents] updateAnnouncement error:', err);
      return false;
    }
  }, []);

  const deleteAnnouncement = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('guild_announcements').delete().eq('id', id);
      if (error) throw error;
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      return true;
    } catch (err: any) {
      logger.error('[useGuildEvents] deleteAnnouncement error:', err);
      return false;
    }
  }, []);

  const toggleAnnounceReaction = useCallback(async (announcementId: string, emoji: string): Promise<boolean> => {
    try {
      const announcement = announcements.find(a => a.id === announcementId);
      if (!announcement) return false;

      const reactions = { ...announcement.reactions };
      const userIds = reactions[emoji] || [];

      if (userIds.includes(userId)) {
        reactions[emoji] = userIds.filter(id => id !== userId);
      } else {
        reactions[emoji] = [...userIds, userId];
      }

      const { error } = await supabase
        .from('guild_announcements')
        .update({ reactions, updated_at: new Date().toISOString() })
        .eq('id', announcementId);
      if (error) throw error;

      setAnnouncements(prev => prev.map(a =>
        a.id === announcementId ? { ...a, reactions } : a
      ));
      return true;
    } catch (err: any) {
      logger.error('[useGuildEvents] toggleAnnounceReaction error:', err);
      return false;
    }
  }, [announcements, userId]);

  const toggleAnnouncePin = useCallback(async (id: string, pinned: boolean): Promise<boolean> => {
    return updateAnnouncement(id, { is_pinned: pinned });
  }, [updateAnnouncement]);

  const votePoll = useCallback(async (announcementId: string, optionId: string): Promise<boolean> => {
    try {
      const announcement = announcements.find(a => a.id === announcementId);
      if (!announcement || !announcement.poll) return false;

      const updatedOptions = announcement.poll.options.map(opt => {
        // Remove user from all options first
        const filtered = opt.votes.filter(id => id !== userId);
        // Add to selected option
        if (opt.id === optionId) {
          return { ...opt, votes: [...filtered, userId] };
        }
        return { ...opt, votes: filtered };
      });

      const updatedPoll = { ...announcement.poll, options: updatedOptions };

      const { error } = await supabase
        .from('guild_announcements')
        .update({
          poll: updatedPoll,
          updated_at: new Date().toISOString(),
        })
        .eq('id', announcementId);
      if (error) throw error;

      setAnnouncements(prev => prev.map(a =>
        a.id === announcementId ? { ...a, poll: updatedPoll } : a
      ));
      return true;
    } catch (err: any) {
      logger.error('[useGuildEvents] votePoll error:', err);
      return false;
    }
  }, [announcements, userId]);

  return {
    events,
    loading,
    error,
    createEvent,
    updateEvent,
    cancelEvent,
    deleteEvent,
    rsvpEvent,
    completeEvent,
    refreshEvents,
    getUpcomingEvents,
    getActiveEvents,
    getPastEvents,
    getEventCountdown,
    announcements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    toggleAnnounceReaction,
    toggleAnnouncePin,
    votePoll,
    loadingAnnouncements,
  };
}