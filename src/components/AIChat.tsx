import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserStore } from '../stores/useUserStore';
import { useSubscription } from '../hooks/useSubscription';
import { useGamificationContext } from '../lib/gamification/context';
import { Sparkles } from 'lucide-react';
import {
  createConversation, saveConversationMessages,
  listConversations, loadConversation, deleteConversation,
  generateTitle,
  type AIConversationMeta,
} from '../lib/ai-memory';
import { loadIntentContext } from '../lib/intent-engine';
import type { IntentContext, RateLimitInfo } from '../lib/intent-engine';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { logger } from '../utils/logger';
import './AIChat.css';

// ─── Extracted hooks & sub-components ─────────────────────────
import {
  type ChatMessage,
  type SuggestionChip,
  loadChatHistory,
  saveChatHistory,
  migrateLegacyChat,
  getChatStorageKey,
} from './ai-chat/helpers';
import { ChatHeader } from './ai-chat/ChatHeader';
import { ChatMessageList } from './ai-chat/ChatMessages';
import { ChatInputArea, SuggestionChips } from './ai-chat/ChatInput';
import { useAIChatSend } from './ai-chat/useAIChatSend';
import { useMessageActions } from './ai-chat/useMessageActions';

export function AIChat() {
  const { awardXP } = useGamificationContext();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [externalInputFocused, setExternalInputFocused] = useState(false);

  // ─── AI Persistent Memory State ─────────────────────────────────
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentConversationTitle, setCurrentConversationTitle] = useState<string | null>(null);
  const [conversations, setConversations] = useState<AIConversationMeta[]>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Broadcast open/close state so VoiceFAB can hide
  useEffect(() => {
    document.dispatchEvent(new Event(open ? 'open-ai-chat' : 'close-ai-chat'));
  }, [open]);

  // Hide FAB when any non-AI-chat input is focused (e.g. Social chat input)
  // This prevents the FAB from covering message input fields on mobile
  useEffect(() => {
    if (open) return; // only matters when FAB is showing
    const isExternalInput = (el: Element | null) =>
      el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement)?.isContentEditable
        ? !el.closest('.ai-chat-panel')
        : false;
    const onFocusIn = (e: FocusEvent) => {
      if (isExternalInput(e.target as Element)) setExternalInputFocused(true);
    };
    const onFocusOut = (e: FocusEvent) => {
      if (isExternalInput(e.target as Element)) setExternalInputFocused(false);
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, [open]);
  const [context, setContext] = useState<IntentContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const userScrolledUpRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUserStore(s => s.user);
  const { tier } = useSubscription();

  // ─── Speech Recognition (mic button in input area) ────────────

  const {
    isListening: isMicListening,
    interimTranscript: micInterim,
    isSupported: micSupported,
    start: micStart,
    stop: micStop,
  } = useSpeechRecognition({
    lang: 'en-AU',
    continuous: false,
    onFinalTranscript: (text: string) => {
      setInput(prev => prev ? prev + ' ' + text : text);
    },
  });

  // Show interim text in input while speaking
  useEffect(() => {
    if (isMicListening && micInterim) {
      setInput(micInterim);
    }
  }, [isMicListening, micInterim]);

  // Load user-specific chat history when user changes
  useEffect(() => {
    migrateLegacyChat(user?.id);
    setMessages(loadChatHistory(user?.id));
    // Also load conversation list from DB (local mode)
    if (user?.id) {
      listConversations(user.id).then(setConversations).catch(() => {});
    } else {
      setConversations([]);
      setCurrentConversationId(null);
      setCurrentConversationTitle(null);
    }
  }, [user?.id]);

  // Persist messages to localStorage when they change (per-user) — always, as fallback
  // Also persist to SQLite via ai-memory if we have a conversation id
  useEffect(() => {
    if (messages.length > 0) {
      saveChatHistory(messages, user?.id);
      // Debounced save to SQLite (avoid saving on every streaming chunk)
      if (currentConversationId && user?.id) {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          saveConversationMessages(currentConversationId, messages);
        }, 1000);
      }
    }
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [messages, user?.id, currentConversationId]);

  // Load context when opening
  useEffect(() => {
    if (open && !context && user?.id) {
      setContextLoading(true);
      loadIntentContext(user.id)
        .then(setContext)
        .catch(err => logger.error('Failed to load context:', err))
        .finally(() => setContextLoading(false));
    }
  }, [open, user?.id, context]);

  // ─── Smart Auto-Scroll ──────────────────────────────────────────
  // Auto-scroll during streaming unless user scrolled up to read history
  const scrollToBottom = useCallback((force = false) => {
    if (!userScrolledUpRef.current || force) {
      const el = messagesEndRef.current;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  // Detect if user has scrolled up
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    // User is "scrolled up" if more than 80px from bottom
    userScrolledUpRef.current = scrollHeight - scrollTop - clientHeight > 80;
  }, []);

  // Scroll to bottom on new messages (non-streaming)
  useEffect(() => {
    if (!streaming) {
      scrollToBottom();
    }
  }, [messages, streaming, scrollToBottom]);

  // During streaming, scroll on each update
  useEffect(() => {
    if (streaming) {
      scrollToBottom();
    }
  });

  // Mobile: size panel to visual viewport so it sits flush on keyboard
  const panelRef = useRef<HTMLDivElement>(null);
  const savedScrollY = useRef(0);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 100);

    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;

    const panel = panelRef.current;

    // Use window.innerHeight which reliably updates on Android keyboard open/close
    savedScrollY.current = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    function resize() {
      if (!panel) return;
      panel.style.height = window.innerHeight + 'px';
    }

    resize();
    window.addEventListener('resize', resize);

    // Also listen to visualViewport as backup
    const vv = window.visualViewport;
    const vvResize = () => { if (panel && vv) panel.style.height = vv.height + 'px'; };
    vv?.addEventListener('resize', vvResize);

    return () => {
      if (panel) panel.style.height = '';
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      window.scrollTo(0, savedScrollY.current);
      window.removeEventListener('resize', resize);
      vv?.removeEventListener('resize', vvResize);
    };
  }, [open]);

  // Keyboard shortcut: Ctrl+J to toggle + custom event from mobile header
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape' && open) setOpen(false);
    };
    const openHandler = () => setOpen(true);
    document.addEventListener('keydown', handler);
    document.addEventListener('open-ai-chat', openHandler);
    return () => {
      document.removeEventListener('keydown', handler);
      document.removeEventListener('open-ai-chat', openHandler);
    };
  }, [open]);

  // ─── Append to conversation helper ──────────────────────────
  const appendToConversation = useCallback(async (msg: string) => {
    if (!user?.id) return;
    const convId = await createConversation(user.id, msg);
    if (convId) {
      setCurrentConversationId(convId);
      setCurrentConversationTitle(generateTitle(msg));
      // Refresh conversation list
      listConversations(user.id).then(setConversations).catch(() => {});
    }
  }, [user?.id]);

  // ─── Extracted hooks ──────────────────────────────────────────
  const { sendMessage, cancelGeneration } = useAIChatSend({
    user,
    messages,
    setMessages,
    loading,
    setLoading,
    streaming,
    setStreaming,
    open,
    appendToConversation,
    intentContext: context,
    setIntentContext: setContext,
    setContextLoading,
    currentConversationId,
    rateLimit,
    setRateLimit,
    tier,
    awardXP,
  });

  const { confirmActions, dismissActions } = useMessageActions({
    messages,
    setMessages,
    awardXP,
  });

  const toggleMic = useCallback(() => {
    if (isMicListening) {
      micStop();
    } else {
      micStart();
    }
  }, [isMicListening, micStart, micStop]);

  // Listen for voice FAB messages that need confirmation / nudge follow-ups
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.message) {
        setOpen(true);
        // Small delay to let the panel animate open before sending
        setTimeout(() => {
          setInput(detail.message);
          sendMessage(detail.message);
        }, 300);
      }
    };
    document.addEventListener('voice-fab-to-chat', handler);
    return () => document.removeEventListener('voice-fab-to-chat', handler);
  }, [sendMessage]);

  const clearChat = () => {
    cancelGeneration(); // Cancel any in-progress generation
    setMessages([]);
    setContext(null); // Force reload context next time
    setShowSuggestions(true);
    // Reset conversation tracking (start fresh, new conversation on next message)
    setCurrentConversationId(null);
    setCurrentConversationTitle(null);
    try { localStorage.removeItem(getChatStorageKey(user?.id)); } catch { /* Safari private */ }
  };

  // ─── AI Persistent Memory: conversation handlers ──────────────────
  const handleSelectConversation = useCallback(async (convId: string) => {
    if (!user?.id) return;
    try {
      const conv = await loadConversation(convId);
      if (conv) {
        cancelGeneration();
        setMessages(conv.messages_json);
        setCurrentConversationId(conv.id);
        setCurrentConversationTitle(conv.title);
        setShowSuggestions(conv.messages_json.length === 0);
      }
    } catch (err) {
      logger.warn('[AIChat] Failed to load conversation:', err);
    }
  }, [user?.id, cancelGeneration]);

  const handleNewConversation = useCallback(() => {
    cancelGeneration();
    setMessages([]);
    setCurrentConversationId(null);
    setCurrentConversationTitle(null);
    setContext(null);
    setShowSuggestions(true);
  }, [cancelGeneration]);

  const handleDeleteConversation = useCallback(async (convId: string) => {
    if (!user?.id) return;
    await deleteConversation(convId);
    // If deleting the current conversation, reset
    if (convId === currentConversationId) {
      setMessages([]);
      setCurrentConversationId(null);
      setCurrentConversationTitle(null);
      setShowSuggestions(true);
    }
    // Refresh list
    listConversations(user.id).then(setConversations).catch(() => {});
  }, [user?.id, currentConversationId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(undefined, input);
      setInput('');
      setShowSuggestions(false);
      userScrolledUpRef.current = false;
    }
  };

  const handleSuggestionClick = (suggestion: SuggestionChip) => {
    if (suggestion.message.endsWith(': ')) {
      // Partial suggestion - fill input and focus
      setInput(suggestion.message);
      inputRef.current?.focus();
    } else {
      // Complete suggestion - send immediately
      sendMessage(suggestion.message);
      setShowSuggestions(false);
      userScrolledUpRef.current = false;
    }
  };

  const handleSendClick = () => {
    sendMessage(undefined, input);
    setInput('');
    setShowSuggestions(false);
    userScrolledUpRef.current = false;
  };

  // Compute whether to show cancel button
  const isGenerating = loading || streaming;

  // ─── Floating Button (desktop only — mobile uses header button) ──
  if (!open) {
    return (
      <button
        className={`ai-chat-fab${externalInputFocused ? ' ai-chat-fab--hidden' : ''}`}
        onClick={() => setOpen(true)}
        title="AI Assistant (⌘J)"
      >
        <Sparkles size={22} />
      </button>
    );
  }

  // ─── Chat Panel with backdrop ─────────────────────────────────
  return (
    <>
    <div className="ai-chat-overlay" onClick={() => setOpen(false)} />
    <div className="ai-chat-panel" ref={panelRef}>
      <ChatHeader
        pathname={location.pathname}
        rateLimit={rateLimit}
        currentConversationId={currentConversationId}
        currentTitle={currentConversationTitle}
        conversations={conversations}
        onClearChat={clearChat}
        onNavigateSettings={() => navigate('/settings')}
        onClose={() => setOpen(false)}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
      />

      <ChatMessageList
        messages={messages}
        loading={loading}
        contextLoading={contextLoading}
        messagesContainerRef={messagesContainerRef as React.RefObject<HTMLDivElement>}
        messagesEndRef={messagesEndRef as React.RefObject<HTMLDivElement>}
        onScroll={handleScroll}
        onConfirmActions={confirmActions}
        onDismissActions={dismissActions}
      />

      <SuggestionChips
        show={showSuggestions}
        messagesEmpty={messages.length === 0}
        loading={loading}
        pathname={location.pathname}
        onChipClick={handleSuggestionClick}
      />

      <ChatInputArea
        input={input}
        onInputChange={setInput}
        onKeyDown={handleKeyDown}
        onSend={handleSendClick}
        onCancel={cancelGeneration}
        onToggleMic={toggleMic}
        inputRef={inputRef as React.RefObject<HTMLTextAreaElement>}
        loading={loading}
        contextLoading={contextLoading}
        isGenerating={isGenerating}
        isMicListening={isMicListening}
        micSupported={micSupported}
        rateLimitExhausted={rateLimit?.remaining === 0 && (rateLimit?.limit ?? 0) < 9999}
        rateLimitResetTime={rateLimit?.resetAt ? new Date(rateLimit.resetAt * 1000).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Australia/Melbourne' }) : undefined}
      />
    </div>
    </>
  );
}