// LifeOS Social — Direct Messaging & Nudge System

import { supabase } from '../supabase';
import type { Message, ConversationPreview, Nudge } from './types';
import { logger } from '../../utils/logger';

/** Upload a chat attachment (image) to Supabase Storage and return public URL */
export async function uploadChatAttachment(userId: string, file: File): Promise<string> {
  // Generate unique filename
  const ext = file.name.split('.').pop() || 'jpg';
  const filename = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  // Upload to Supabase Storage bucket 'chat-attachments'
  const { data, error } = await supabase.storage
    .from('chat-attachments')
    .upload(filename, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    logger.error('[social/messaging] uploadChatAttachment error:', error);
    throw error;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('chat-attachments')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/** Send a direct message */
export async function sendMessage(
  senderId: string,
  receiverId: string,
  content: string,
  type: Message['message_type'] = 'text',
  metadata: Record<string, unknown> = {},
): Promise<Message | null> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      content,
      message_type: type,
      metadata,
    })
    .select()
    .single();

  if (error) {
    logger.error('[social/messaging] sendMessage error:', error);
    return null;
  }
  return data as Message;
}

/** Get a paginated conversation between two users */
export async function getConversation(
  userId: string,
  partnerId: string,
  limit = 50,
  offset = 0,
): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),` +
      `and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`,
    )
    .is('group_id', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logger.error('[social/messaging] getConversation error:', error);
    return [];
  }

  // Return in chronological order for display
  return ((data ?? []) as Message[]).reverse();
}

/** Get all conversations for a user with last message and unread count */
export async function getConversationList(userId: string): Promise<ConversationPreview[]> {
  // Get all DM partners (users I've messaged or who messaged me)
  const { data: sent } = await supabase
    .from('messages')
    .select('receiver_id, created_at')
    .eq('sender_id', userId)
    .is('group_id', null)
    .order('created_at', { ascending: false });

  const { data: received } = await supabase
    .from('messages')
    .select('sender_id, created_at')
    .eq('receiver_id', userId)
    .is('group_id', null)
    .order('created_at', { ascending: false });

  // Collect unique partner IDs
  const partnerSet = new Set<string>();
  (sent ?? []).forEach((m: { receiver_id: string }) => partnerSet.add(m.receiver_id));
  (received ?? []).forEach((m: { sender_id: string }) => partnerSet.add(m.sender_id));

  const partnerIds = Array.from(partnerSet);
  if (partnerIds.length === 0) return [];

  // Fetch partner profiles
  const { data: profiles } = await supabase
    .from('public_profiles')
    .select('*')
    .in('user_id', partnerIds);

  const profileMap = new Map((profiles ?? []).map((p: Record<string, unknown>) => [p.user_id as string, p]));

  // For each partner, get last message + unread count
  const conversations: ConversationPreview[] = await Promise.all(
    partnerIds.map(async (partnerId) => {
      const { data: lastMsgArr } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),` +
          `and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`,
        )
        .is('group_id', null)
        .order('created_at', { ascending: false })
        .limit(1);

      const { count: unreadCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', partnerId)
        .eq('receiver_id', userId)
        .is('read_at', null);

      return {
        partner_id: partnerId,
        partner_profile: (profileMap.get(partnerId) ?? null) as ConversationPreview['partner_profile'],
        last_message: lastMsgArr?.[0] as Message | null,
        unread_count: unreadCount ?? 0,
      };
    }),
  );

  // Sort by last message timestamp
  return conversations.sort((a, b) => {
    const ta = a.last_message?.created_at ?? '0';
    const tb = b.last_message?.created_at ?? '0';
    return tb.localeCompare(ta);
  });
}

/** Mark a message as read */
export async function markAsRead(messageId: string): Promise<void> {
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', messageId);
}

/** Mark all messages from a sender as read */
export async function markConversationAsRead(
  userId: string,
  partnerId: string,
): Promise<void> {
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('sender_id', partnerId)
    .eq('receiver_id', userId)
    .is('read_at', null);
}

/** Get total unread message count for a user */
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .is('read_at', null);

    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/** Send a nudge to a partner */
export async function sendNudge(
  senderId: string,
  receiverId: string,
  nudgeType: Nudge['nudge_type'] = 'encourage',
  message?: string,
): Promise<Nudge | null> {
  const { data, error } = await supabase
    .from('nudges')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      nudge_type: nudgeType,
      message: message ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.error('[social/messaging] sendNudge error:', error);
    return null;
  }

  // Also send a system message so it appears in chat
  await sendMessage(senderId, receiverId, message ?? `You received a ${nudgeType} nudge!`, 'nudge', {
    nudge_type: nudgeType,
  });

  return data as Nudge;
}

/** Subscribe to real-time messages in a conversation (both directions) */
export function subscribeToConversation(
  userId: string,
  partnerId: string,
  onMessage: (msg: Message) => void,
) {
  // We listen for ALL new messages and filter client-side
  // This avoids complex Supabase filter expressions for OR conditions
  const channel = supabase
    .channel(`conversation:${[userId, partnerId].sort().join('-')}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      (payload) => {
        const msg = payload.new as Message;
        const isDM = msg.group_id === null;
        const isThisConvo =
          (msg.sender_id === userId && msg.receiver_id === partnerId) ||
          (msg.sender_id === partnerId && msg.receiver_id === userId);

        if (isDM && isThisConvo) {
          onMessage(msg);
        }
      },
    )
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}

/** Subscribe to ALL incoming messages for a user (for conversation list refresh) */
export function subscribeToInbox(
  userId: string,
  onNewMessage: (msg: Message) => void,
) {
  const channel = supabase
    .channel(`inbox:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${userId}`,
      },
      (payload) => {
        const msg = payload.new as Message;
        if (msg.group_id === null) {
          onNewMessage(msg);
        }
      },
    )
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}

/** Load older messages (pagination — prepend to list) */
export async function getOlderMessages(
  userId: string,
  partnerId: string,
  beforeTimestamp: string,
  limit = 30,
): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),` +
      `and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`,
    )
    .is('group_id', null)
    .lt('created_at', beforeTimestamp)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('[social/messaging] getOlderMessages error:', error);
    return [];
  }

  return ((data ?? []) as Message[]).reverse();
}
