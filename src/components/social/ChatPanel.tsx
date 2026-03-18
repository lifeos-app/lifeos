// LifeOS Social — Chat Panel (DM + Group)
// v3: Messenger-style bubbles, grouped messages, reactions, scroll-to-bottom, day separators

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, ArrowLeft, ChevronUp, ChevronDown, Loader2, Dumbbell, Zap, PartyPopper, User, MessageCircle, Users, Handshake, Paperclip, Camera, Image as ImageIcon, X } from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';
import {
  getConversation,
  getOlderMessages,
  sendMessage,
  markConversationAsRead,
  subscribeToConversation,
  uploadChatAttachment,
} from '../../lib/social/messaging';
import type { Message } from '../../lib/social/types';
import { genId } from '../../utils/date';
import './social.css';
import { logger } from '../../utils/logger';

interface ChatPanelProps {
  userId: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar?: string | null;
  connectionType?: 'friend' | 'accountability_partner' | null;
  onBack?: () => void;
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts: string): string {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const REACTION_EMOJIS = ['❤️', '😂', '👍', '😮', '😢', '🔥'];

function NudgeMessageCard({ msg }: { msg: Message }) {
  const nudgeType = (msg.metadata?.nudge_type as string) ?? 'encourage';
  const nudgeIconComponents: Record<string, React.ReactNode> = {
    encourage: <Dumbbell size={20} />,
    challenge: <Zap size={20} />,
    celebrate: <PartyPopper size={20} />,
  };
  const nudgeLabels: Record<string, string> = {
    encourage: 'Encouragement',
    challenge: 'Challenge!',
    celebrate: 'Celebration!',
  };

  return (
    <div className="chat-msg-nudge">
      <div className="chat-msg-nudge__emoji">{nudgeIconComponents[nudgeType] ?? <User size={20} />}</div>
      <div className="chat-msg-nudge__text">{nudgeLabels[nudgeType] ?? 'Nudge'}</div>
      {msg.content && <div className="chat-msg-nudge__msg">{msg.content}</div>}
    </div>
  );
}

function AchievementMessageCard({ msg }: { msg: Message }) {
  const icon = (msg.metadata?.icon as string) ?? 'target';
  const title = (msg.metadata?.title as string) ?? 'Achievement Unlocked!';
  const desc = (msg.metadata?.description as string) ?? msg.content;

  return (
    <div className="chat-msg-achievement">
      <div className="chat-msg-achievement__icon"><CategoryIcon name={icon} size={24} color="#FFD700" /></div>
      <div className="chat-msg-achievement__text">
        <div className="chat-msg-achievement__title">{title}</div>
        <div className="chat-msg-achievement__desc">{desc}</div>
      </div>
    </div>
  );
}

// Determine grouping position for consecutive messages from the same sender
type BubblePosition = 'single' | 'first' | 'middle' | 'last';

function getBubblePosition(messages: Message[], index: number): BubblePosition {
  const msg = messages[index];
  const prev = index > 0 ? messages[index - 1] : null;
  const next = index < messages.length - 1 ? messages[index + 1] : null;

  const sameSenderPrev = prev && prev.sender_id === msg.sender_id && prev.message_type === 'text' && msg.message_type === 'text';
  const sameSenderNext = next && next.sender_id === msg.sender_id && next.message_type === 'text' && msg.message_type === 'text';

  // Also check time proximity (within 2 minutes)
  const closeTimePrev = prev && (new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime()) < 120_000;
  const closeTimeNext = next && (new Date(next.created_at).getTime() - new Date(msg.created_at).getTime()) < 120_000;

  const groupedWithPrev = sameSenderPrev && closeTimePrev;
  const groupedWithNext = sameSenderNext && closeTimeNext;

  if (groupedWithPrev && groupedWithNext) return 'middle';
  if (groupedWithPrev && !groupedWithNext) return 'last';
  if (!groupedWithPrev && groupedWithNext) return 'first';
  return 'single';
}

export function ChatPanel({
  userId,
  partnerId,
  partnerName,
  partnerAvatar,
  connectionType,
  onBack,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [reactionMsgId, setReactionMsgId] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    if (!bottomRef.current) return;
    try {
      if (smooth && 'scrollBehavior' in document.documentElement.style) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      } else {
        bottomRef.current.scrollIntoView(false);
      }
    } catch {
      bottomRef.current?.scrollIntoView();
    }
  }, []);

  // Track scroll position for "scroll to bottom" button
  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 200);
  }, []);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    const msgs = await getConversation(userId, partnerId, 50, 0);
    setMessages(msgs);
    setHasOlder(msgs.length === 50);
    setLoading(false);
    await markConversationAsRead(userId, partnerId);
    setTimeout(() => scrollToBottom(false), 50);
  }, [userId, partnerId, scrollToBottom]);

  useEffect(() => {
    void loadMessages();

    const unsubscribe = subscribeToConversation(userId, partnerId, (msg: Message) => {
      setMessages(prev => {
        const isDup = prev.some(m => m.id === msg.id);
        if (isDup) return prev;
        return [...prev, msg];
      });
      setTimeout(() => scrollToBottom(true), 50);
    });

    return unsubscribe;
  }, [userId, partnerId, loadMessages, scrollToBottom]);

  const handleLoadOlder = async () => {
    if (messages.length === 0 || loadingOlder) return;
    const oldest = messages[0];
    setLoadingOlder(true);

    const savedScrollHeight = scrollAreaRef.current?.scrollHeight ?? 0;
    const older = await getOlderMessages(userId, partnerId, oldest.created_at);
    setLoadingOlder(false);

    if (older.length === 0) {
      setHasOlder(false);
      return;
    }

    setMessages(prev => [...older, ...prev]);
    setHasOlder(older.length === 30);

    requestAnimationFrame(() => {
      if (scrollAreaRef.current) {
        const newHeight = scrollAreaRef.current.scrollHeight;
        scrollAreaRef.current.scrollTop = newHeight - savedScrollHeight;
      }
    });
  };

  const handleSend = async () => {
    const text = input.trim();
    const hasAttachment = attachmentFile !== null;
    
    if ((!text && !hasAttachment) || sending) return;

    setInput('');
    setSending(true);

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    let attachmentUrl: string | null = null;

    // Upload attachment if present
    if (hasAttachment && attachmentFile) {
      setUploading(true);
      try {
        const url = await uploadChatAttachment(userId, attachmentFile);
        attachmentUrl = url;
      } catch (err) {
        logger.error('Failed to upload attachment:', err);
        setSending(false);
        setUploading(false);
        alert('Failed to upload image. Please try again.');
        return;
      }
      setUploading(false);
    }

    const metadata: Record<string, unknown> = {};
    if (attachmentUrl) {
      metadata.attachment_url = attachmentUrl;
      metadata.attachment_type = 'image';
    }

    const optimistic: Message = {
      id: genId(),
      sender_id: userId,
      receiver_id: partnerId,
      group_id: null,
      content: text || '📷 Image',
      message_type: 'text',
      metadata,
      read_at: null,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, optimistic]);
    setTimeout(() => scrollToBottom(true), 50);

    const sent = await sendMessage(userId, partnerId, text || '📷 Image', 'text', metadata);

    if (sent) {
      setMessages(prev => prev.map(m => m.id === optimistic.id ? sent : m));
    }

    // Clear attachment
    setAttachmentPreview(null);
    setAttachmentFile(null);
    setSending(false);
    inputRef.current?.focus();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      alert('Only image files are supported');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be smaller than 5MB');
      return;
    }

    setAttachmentFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (evt) => {
      setAttachmentPreview(evt.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAttachment = () => {
    setAttachmentFile(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  // Long press for reaction picker
  const handleMsgTouchStart = (msgId: string) => {
    longPressTimer.current = setTimeout(() => {
      setReactionMsgId(msgId);
    }, 500);
  };

  const handleMsgTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleReaction = (msgId: string, emoji: string) => {
    setReactions(prev => ({ ...prev, [msgId]: prev[msgId] === emoji ? '' : emoji }));
    setReactionMsgId(null);
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  messages.forEach(msg => {
    const date = formatDate(msg.created_at);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === date) {
      last.messages.push(msg);
    } else {
      groupedMessages.push({ date, messages: [msg] });
    }
  });

  const subtitle = connectionType === 'accountability_partner'
    ? <><Handshake size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Accountability Partner</>
    : connectionType === 'friend'
    ? <><Users size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Friend</>
    : null;

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-panel__header">
        {onBack && (
          <button className="chat-panel__back" onClick={onBack} aria-label="Back">
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="chat-panel__avatar">
          {partnerAvatar
            ? <img src={partnerAvatar} alt="" loading="lazy" decoding="async" />
            : getInitials(partnerName)
          }
        </div>
        <div className="chat-panel__header-info">
          <div className="chat-panel__title">{partnerName}</div>
          {subtitle && (
            <div className="chat-panel__subtitle">{subtitle}</div>
          )}
        </div>
      </div>

      {/* Messages scroll area */}
      <div className="chat-messages" ref={scrollAreaRef} onScroll={handleScroll}>
        {/* Load older button */}
        {hasOlder && !loading && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <button
              className="chat-load-older"
              onClick={() => void handleLoadOlder()}
              disabled={loadingOlder}
            >
              {loadingOlder
                ? <><Loader2 size={12} className="spin" /> Loading…</>
                : <><ChevronUp size={12} /> Load older messages</>
              }
            </button>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', color: '#4B5563', padding: 20, fontSize: 13 }}>
            <Loader2 size={18} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
            Loading messages…
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="chat-empty-state">
            <div className="chat-empty-state__icon"><MessageCircle size={40} color="#374151" /></div>
            <div className="chat-empty-state__title">Start the conversation!</div>
            <div className="chat-empty-state__sub">
              Messages are private between you and {partnerName}.
            </div>
          </div>
        )}

        {groupedMessages.map(group => (
          <div key={group.date}>
            {/* Day separator */}
            <div className="chat-day-separator">
              <span className="chat-day-separator__label">{group.date}</span>
            </div>

            {group.messages.map((msg, idx) => {
              const isMe = msg.sender_id === userId;
              const globalIdx = messages.indexOf(msg);
              const pos = getBubblePosition(messages, globalIdx);

              if (msg.message_type === 'nudge') {
                return (
                  <div key={msg.id} className="chat-special-msg">
                    <NudgeMessageCard msg={msg} />
                    <div className="chat-bubble__time" style={{ textAlign: 'center' }}>
                      {formatTime(msg.created_at)}
                    </div>
                  </div>
                );
              }

              if (msg.message_type === 'achievement' || msg.message_type === 'milestone') {
                return (
                  <div key={msg.id} className="chat-special-msg">
                    <AchievementMessageCard msg={msg} />
                    <div className="chat-bubble__time" style={{ textAlign: 'center' }}>
                      {formatTime(msg.created_at)}
                    </div>
                  </div>
                );
              }

              const showAvatar = !isMe && (pos === 'single' || pos === 'last');
              const showTime = pos === 'single' || pos === 'last';
              const reaction = reactions[msg.id];
              const attachmentUrl = msg.metadata?.attachment_url as string | undefined;
              const hasAttachment = !!attachmentUrl;

              return (
                <div
                  key={msg.id}
                  className={`chat-bubble-row chat-bubble-row--${isMe ? 'me' : 'them'} chat-bubble-row--${pos}`}
                  onTouchStart={() => handleMsgTouchStart(msg.id)}
                  onTouchEnd={handleMsgTouchEnd}
                  onContextMenu={(e) => { e.preventDefault(); setReactionMsgId(msg.id); }}
                >
                  {/* Avatar space for received messages */}
                  {!isMe && (
                    <div className="chat-bubble-row__avatar-slot">
                      {showAvatar && (
                        <div className="chat-bubble__avatar">
                          {partnerAvatar
                            ? <img src={partnerAvatar} alt="" />
                            : getInitials(partnerName)
                          }
                        </div>
                      )}
                    </div>
                  )}

                  <div className="chat-bubble-col">
                    <div className={`chat-bubble chat-bubble--${isMe ? 'me' : 'them'} chat-bubble--${pos}`}>
                      {/* Image attachment */}
                      {hasAttachment && (
                        <div className="chat-bubble__attachment">
                          <img 
                            src={attachmentUrl} 
                            alt="Shared image" 
                            className="chat-bubble__attachment-img"
                            loading="lazy"
                            onClick={() => window.open(attachmentUrl, '_blank')}
                            onError={(e) => {
                              const img = e.currentTarget;
                              img.style.display = 'none';
                              const fallback = document.createElement('div');
                              fallback.className = 'chat-bubble__attachment-error';
                              fallback.textContent = '📷 Image failed to load';
                              img.parentElement?.appendChild(fallback);
                            }}
                          />
                        </div>
                      )}
                      {/* Text content (if present) */}
                      {msg.content && msg.content !== '📷 Image' && (
                        <div className="chat-bubble__content">{msg.content}</div>
                      )}
                    </div>

                    {/* Reaction display */}
                    {reaction && (
                      <div className={`chat-bubble__reaction ${isMe ? 'chat-bubble__reaction--me' : ''}`}>
                        {reaction}
                      </div>
                    )}

                    {/* Reaction picker */}
                    {reactionMsgId === msg.id && (
                      <div className={`chat-reaction-picker ${isMe ? 'chat-reaction-picker--me' : ''}`}>
                        {REACTION_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            className="chat-reaction-picker__btn"
                            onClick={(e) => { e.stopPropagation(); handleReaction(msg.id, emoji); }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {showTime && (
                      <div className={`chat-bubble__meta ${isMe ? 'chat-bubble__meta--me' : ''}`}>
                        <span className="chat-bubble__time">{formatTime(msg.created_at)}</span>
                        {isMe && msg.read_at && (
                          <span className="chat-bubble__status">Seen</span>
                        )}
                        {isMe && !msg.read_at && msg.id.length > 20 && (
                          <span className="chat-bubble__status">Delivered</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          className="chat-scroll-bottom"
          onClick={() => scrollToBottom(true)}
          aria-label="Scroll to bottom"
        >
          <ChevronDown size={20} />
        </button>
      )}

      {/* Click-away for reaction picker */}
      {reactionMsgId && (
        <div
          className="chat-reaction-backdrop"
          onClick={() => setReactionMsgId(null)}
        />
      )}

      {/* Input */}
      <div className="chat-input-area">
        {/* Attachment preview */}
        {attachmentPreview && (
          <div className="chat-input-attachment-preview">
            <img src={attachmentPreview} alt="Preview" className="chat-input-attachment-preview__img" />
            <button 
              className="chat-input-attachment-preview__remove"
              onClick={handleRemoveAttachment}
              aria-label="Remove attachment"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Attach menu popup */}
        {showAttachMenu && (
          <>
            <div className="chat-attach-backdrop" onClick={() => setShowAttachMenu(false)} />
            <div className="chat-attach-menu">
              <button
                className="chat-attach-menu__item"
                onClick={() => { setShowAttachMenu(false); cameraInputRef.current?.click(); }}
              >
                <Camera size={20} />
                <span>Camera</span>
              </button>
              <button
                className="chat-attach-menu__item"
                onClick={() => { setShowAttachMenu(false); fileInputRef.current?.click(); }}
              >
                <ImageIcon size={20} />
                <span>Gallery</span>
              </button>
            </div>
          </>
        )}

        <div className="chat-input-row">
          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          
          {/* Attachment button */}
          <button
            className="chat-attachment-btn"
            onClick={() => setShowAttachMenu(prev => !prev)}
            disabled={sending || uploading}
            aria-label="Attach image or take photo"
            title="Attach image or take photo"
          >
            <Paperclip size={18} />
          </button>

          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder={`Message ${partnerName}…`}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          
          <button
            className={`chat-send-btn ${(input.trim() || attachmentFile) ? 'chat-send-btn--active' : ''}`}
            onClick={() => void handleSend()}
            disabled={(!input.trim() && !attachmentFile) || sending}
            aria-label="Send"
          >
            {uploading || sending ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatPanel;
