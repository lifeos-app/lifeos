import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserStore } from '../stores/useUserStore';
import { useSubscription } from '../hooks/useSubscription';
import { useGamificationContext } from '../lib/gamification/context';
import { Sparkles } from 'lucide-react';
import { getErrorMessage } from '../utils/error';
import { agentChatStream, type AgentChatResponse } from '../lib/zeroclaw-client';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import {
  callIntentEngine, executeActions, loadIntentContext,
  getAISettings,
  type IntentResult, type IntentContext, type RateLimitInfo,
} from '../lib/intent-engine';
import { executeTool, detectToolIntent, type OrchestratorToolName } from '../lib/llm/orchestrator';
import { supabase } from '../lib/supabase';
import { streamText, type StreamController } from '../lib/streaming';
import { genId } from '../utils/date';
import { safeScrollIntoView } from '../utils/scroll';
import './AIChat.css';
import { logger } from '../utils/logger';

// ─── Sub-components ──────────────────────────────────────────────
import {
  type ChatMessage,
  type SuggestionChip,
  loadChatHistory,
  saveChatHistory,
  migrateLegacyChat,
  getChatStorageKey,
  getPageContext,
} from './ai-chat/helpers';
import { ChatHeader } from './ai-chat/ChatHeader';
import { ChatMessageList } from './ai-chat/ChatMessages';
import { ChatInputArea, SuggestionChips } from './ai-chat/ChatInput';

export function AIChat() {
  const { awardXP } = useGamificationContext();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const agentAbortRef = useRef<AbortController | null>(null);
  const [externalInputFocused, setExternalInputFocused] = useState(false);

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
  const streamControllerRef = useRef<StreamController | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const userScrolledUpRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUserStore(s => s.user);
  const { tier } = useSubscription();

  // ─── Speech Recognition (mic button in input area) ────────────
  const voiceAutoSendRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  }, [user?.id]);

  // Persist messages to localStorage when they change (per-user)
  useEffect(() => {
    if (messages.length > 0) saveChatHistory(messages, user?.id);
  }, [messages, user?.id]);

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
      safeScrollIntoView(messagesEndRef.current, { behavior: 'smooth' });
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

  // ─── Cancel Generation ──────────────────────────────────────────
  const cancelGeneration = useCallback(() => {
    // Cancel the fetch
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    // Cancel agent streaming
    agentAbortRef.current?.abort();
    agentAbortRef.current = null;

    // Cancel the streaming animation
    streamControllerRef.current?.cancel();
    streamControllerRef.current = null;

    setLoading(false);
    setStreaming(false);

    // Mark the streaming message as complete (with whatever text was revealed)
    setMessages(prev => prev.map(m =>
      m.isStreaming || m.agentLoading
        ? { ...m, isStreaming: false, agentLoading: false }
        : m
    ));
  }, []);

  // Ref to avoid stale closure in callServerAgent
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // ─── Deep Think Detection ────────────────────────────────────
  // Patterns that suggest the user wants deeper analysis
  const DEEP_QUERY_PATTERNS = [
    /\bplan\s+(my|the)\s+(week|month|day|schedule)\b/i,
    /\banalyze\s+(my|the)?\s*(goals?|habits?|progress|life|balance)\b/i,
    /\bwhat\s+should\s+i\s+focus\b/i,
    /\breflect\b/i,
    /\bdeep\s*(ly|er)?\b/i,
    /\bstrateg(y|ize|ic)\b/i,
    /\bprioritize\b/i,
    /\bbig\s+picture\b/i,
    /\blife\s+audit\b/i,
    /\bbreakdown\b/i,
    /\badvice\b/i,
    /\bwhy\s+am\s+i\b/i,
    /\bhow\s+can\s+i\s+improve\b/i,
    /\bcoach\s+me\b/i,
    /\bhelp\s+me\s+(think|plan|decide)\b/i,
  ];

  const isDeepQuery = useCallback((msg: string): boolean => {
    return DEEP_QUERY_PATTERNS.some(p => p.test(msg));
  }, []);

  // Call server agent (streaming) for auto-enhancement
  const callServerAgent = useCallback((
    msgId: string,
    userMessage: string,
    existingContent: string,
  ) => {
    if (!user?.id) return;

    // Mark message as agent-loading
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, agentLoading: true, isEnhanced: true } : m
    ));

    const history = messagesRef.current.slice(-10).map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    try {
      const controller = agentChatStream(
        {
          userId: user.id,
          message: userMessage,
          context: { currentPage: location.pathname },
          conversationHistory: history,
        },
        // onChunk — append streaming text
        (chunk) => {
          try {
            if (agentAbortRef.current?.signal.aborted) return;
            setMessages(prev => prev.map(m =>
              m.id === msgId
                ? { ...m, content: (m.content || '') + chunk, agentLoading: false, isEnhanced: true }
                : m
            ));
          } catch (e) {
            logger.warn('[Agent] onChunk error:', e);
          }
        },
        // onDone — finalize
        (response: AgentChatResponse) => {
          try {
            if (agentAbortRef.current?.signal.aborted) return;
            setMessages(prev => prev.map(m =>
              m.id === msgId
                ? {
                    ...m,
                    content: response.message || m.content,
                    agentThinking: response.thinking,
                    agentToolsUsed: response.toolsUsed,
                    agentLoading: false,
                    isEnhanced: true,
                    isStreaming: false,
                  }
                : m
            ));
          } catch (e) {
            logger.warn('[Agent] onDone error:', e);
          }
          setStreaming(false);
          agentAbortRef.current = null;
        },
        // onError — silently fall back (auto-enhancement is best-effort)
        (error) => {
          logger.warn('[Agent] Stream error (auto-enhance):', error);
          setMessages(prev => prev.map(m =>
            m.id === msgId
              ? {
                  ...m,
                  content: m.content || existingContent || '',
                  agentLoading: false,
                  isStreaming: false,
                }
              : m
          ));
          setStreaming(false);
          agentAbortRef.current = null;
        },
      );

      agentAbortRef.current = controller;
    } catch (e) {
      // Agent unavailable — silently no-op
      logger.warn('[Agent] Failed to start stream:', e);
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, agentLoading: false, isStreaming: false } : m
      ));
      setStreaming(false);
    }
  }, [user?.id, location.pathname]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading || streaming) return;
    if (!text) setInput('');
    setShowSuggestions(false); // Hide suggestions after first message
    userScrolledUpRef.current = false; // Reset scroll state for new message

    // If context isn't loaded yet, load it now
    let ctx = context;
    if (!ctx && user?.id) {
      try {
        setContextLoading(true);
        ctx = await loadIntentContext(user.id);
        setContext(ctx);
        setContextLoading(false);
      } catch (err: unknown) {
        setContextLoading(false);
        const errorMsg: ChatMessage = {
          id: genId(),
          role: 'assistant',
          content: `Couldn't load your data: ${getErrorMessage(err)}. Try again.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMsg]);
        return;
      }
    }
    if (!ctx) return;

    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      content: msg,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    setLoading(true);

    // Create abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const settings = getAISettings();

      // Build conversation history (last 10 messages for context)
      const history = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.role === 'assistant'
          ? m.content + (m.actions?.length
            ? '\n[Actions: ' + m.actions.map(a => a.summary).join(', ') + ']'
            : '')
          : m.content,
      }));

      // Add page context to the user message
      const pageContext = getPageContext(location.pathname);
      const contextualMsg = `[User is on: ${pageContext}]\n\n${msg}`;

      const result: IntentResult = await callIntentEngine(
        contextualMsg, ctx, history,
        { provider: settings.provider, model: settings.model, proxyUrl: settings.proxyUrl },
        abortController.signal,
      );

      // Check if cancelled during fetch
      if (abortController.signal.aborted) return;

      // Update rate limit from response
      if (result.rateLimit) setRateLimit(result.rateLimit);

      // Create the assistant message shell (content will stream in)
      const assistantMsgId = genId();
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '', // Start empty, will fill via streaming
        actions: result.actions.filter(a => a.type !== 'info'),
        needs_confirmation: result.needs_confirmation,
        follow_up: result.follow_up,
        timestamp: new Date(),
        isStreaming: true,
      };

      // Handle navigation actions immediately
      const navAction = result.actions.find(a => a.type === 'navigate');
      if (navAction?.data?.path) {
        const path = navAction.data.path as string;
        const tab = navAction.data.tab as string | undefined;
        const url = tab ? `${path}?tab=${tab}` : path;
        navigate(url);
      }

      // Award XP for AI conversation
      awardXP('ai_message', { description: 'AI conversation' });

      // Switch from loading (waiting for API) to streaming (revealing text)
      setLoading(false);
      setStreaming(true);

      // Add the message to the list
      setMessages(prev => [...prev, assistantMsg]);

      // ─── Stream the reply text word-by-word ─────────────────
      const streamCtrl = streamText(result.reply, {
        onChunk: (revealedText) => {
          setMessages(prev => prev.map(m =>
            m.id === assistantMsgId
              ? { ...m, content: revealedText }
              : m
          ));
        },
        onDone: async () => {
          // Streaming complete — now handle actions
          setStreaming(false);
          streamControllerRef.current = null;

          // ── Check for orchestrator tool actions first ──
          const orchAction = result.actions.find(a => a.type === 'orchestrator_tool');
          if (orchAction) {
            const toolName = orchAction.data.tool as OrchestratorToolName;
            const toolParams = orchAction.data.params as Record<string, unknown> | undefined;

            // Show loading state for orchestrator
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId
                ? { ...m, isStreaming: false, orchestratorLoading: true }
                : m
            ));

            try {
              const toolResult = await executeTool(
                toolName,
                user?.id || '',
                supabase,
                (tier || 'pro') as 'free' | 'pro',
                toolParams,
              );

              // Update message with orchestrator result
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      orchestratorLoading: false,
                      orchestratorData: toolResult,
                      // Enrich the reply with tool summary if the original reply was brief
                      content: m.content.length < 50 && toolResult.success
                        ? toolResult.summary.slice(0, 300)
                        : m.content,
                    }
                  : m
              ));
            } catch (err) {
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      orchestratorLoading: false,
                      content: m.content + '\n\n⚠️ Tool analysis failed: ' + getErrorMessage(err),
                    }
                  : m
              ));
            }
            return;
          }

          // ── Also check for client-side tool detection (fallback) ──
          // If the LLM didn't emit an orchestrator_tool action but the message
          // clearly matched a tool intent, run the tool anyway
          const userMsgContent = userMsg.content.toLowerCase();
          const detectedTool = detectToolIntent(userMsgContent);
          if (detectedTool && !result.actions.some(a => a.type === 'orchestrator_tool')) {
            // Only auto-invoke if the result has no meaningful DB actions
            const hasDbActions = result.actions.some(a =>
              !['navigate', 'info', 'orchestrator_tool'].includes(a.type)
            );
            if (!hasDbActions) {
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId
                  ? { ...m, isStreaming: false, orchestratorLoading: true }
                  : m
              ));

              try {
                const toolResult = await executeTool(
                  detectedTool,
                  user?.id || '',
                  supabase,
                  (tier || 'pro') as 'free' | 'pro',
                );

                setMessages(prev => prev.map(m =>
                  m.id === assistantMsgId
                    ? { ...m, orchestratorLoading: false, orchestratorData: toolResult }
                    : m
                ));
              } catch {
                setMessages(prev => prev.map(m =>
                  m.id === assistantMsgId
                    ? { ...m, orchestratorLoading: false }
                    : m
                ));
              }
              return;
            }
          }

          // Auto-execute if no confirmation needed and no financial actions
          if (!result.needs_confirmation && result.actions.length > 0) {
            const dbActions = result.actions.filter(a =>
              !['navigate', 'info', 'orchestrator_tool'].includes(a.type)
            );
            if (dbActions.length > 0) {
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId
                  ? { ...m, executing: true, isStreaming: false }
                  : m
              ));
              const execResult = await executeActions(dbActions);
              setMessages(prev => prev.map(m => {
                if (m.id === assistantMsgId) {
                  let updatedContent = m.content;
                  // Append failures to message content if any
                  if (execResult.failures && execResult.failures.length > 0) {
                    updatedContent = updatedContent + '\n\n⚠️ **Action Failures:**\n' + execResult.failures.map(f => `- ${f}`).join('\n');
                  }
                  return { ...m, content: updatedContent, executing: false, executed: true, executionResults: execResult, isStreaming: false };
                }
                return m;
              }));
              window.dispatchEvent(new Event('lifeos-refresh'));
              // Second refresh after a short delay to catch async companion events
              setTimeout(() => window.dispatchEvent(new Event('lifeos-refresh')), 1500);
            } else {
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId
                  ? { ...m, isStreaming: false }
                  : m
              ));
            }
          } else {
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId
                ? { ...m, isStreaming: false }
                : m
            ));
          }

          // ── Auto-enhance with server agent for deep queries ──
          // If the intent response is thin (short, no actions, no orchestrator),
          // and the query looks like it needs deeper analysis, call the agent
          const hasActions = result.actions.some(a =>
            !['navigate', 'info'].includes(a.type)
          );
          const isThinResponse = !hasActions && result.reply.length < 200;
          if (isThinResponse && isDeepQuery(userMsg.content)) {
            // Create an enhanced message below the intent response
            const deepMsgId = genId();
            const deepMsg: ChatMessage = {
              id: deepMsgId,
              role: 'assistant',
              content: '',
              timestamp: new Date(),
              isStreaming: true,
              isEnhanced: true,
              agentLoading: true,
            };
            setMessages(prev => [...prev, deepMsg]);
            setStreaming(true);
            callServerAgent(deepMsgId, userMsg.content, '');
          }
        },
        onCancel: () => {
          setStreaming(false);
          streamControllerRef.current = null;
          // Keep whatever text was revealed so far
          setMessages(prev => prev.map(m =>
            m.id === assistantMsgId
              ? { ...m, isStreaming: false }
              : m
          ));
        },
      });

      streamControllerRef.current = streamCtrl;

    } catch (err: unknown) {
      // If aborted, don't show error
      if (abortController.signal.aborted) {
        setLoading(false);
        return;
      }

      const rawMsg = getErrorMessage(err);
      // Try to parse structured error body (JSON from our proxy)
      let errBody: any = null;
      try { errBody = JSON.parse(rawMsg); } catch { /* not JSON */ }
      
      // Extract rateLimit from error body if present
      if (errBody?.rateLimit) setRateLimit(errBody.rateLimit);
      
      let friendlyMsg = `Sorry, something went wrong: ${errBody?.error || rawMsg}`;
      const isDailyLimit = errBody?.error?.includes('Daily limit') || rawMsg.includes('Daily limit');
      const isRateLimit = isDailyLimit || rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('Rate limit') || errBody?.error?.includes('limit');
      
      if (isRateLimit) {
        const rl = errBody?.rateLimit || rateLimit;
        if (rl) {
          setRateLimit(rl);
          const resetMin = rl.resetIn ? Math.ceil(rl.resetIn / 60) : null;
          friendlyMsg = resetMin
            ? `⏳ You've used all ${rl.limit} messages for today. Resets in ${resetMin} min.`
            : `⏳ Daily message limit reached. Try again later.`;
        } else {
          friendlyMsg = '⏳ AI message limit reached. Try again later.';
        }
      } else if (rawMsg.includes('401') || rawMsg.includes('token') || errBody?.error?.includes('token')) {
        friendlyMsg = 'Session expired. Please refresh the page and log in again.';
      } else if (rawMsg.includes('502') || rawMsg.includes('503')) {
        friendlyMsg = 'AI service temporarily unavailable. Try again in a moment.';
      }
      const errorMsg: ChatMessage = {
        id: genId(),
        role: 'assistant',
        content: friendlyMsg,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
      setLoading(false);
      setStreaming(false);
    }
  }, [input, loading, streaming, context, messages, navigate, location.pathname, user?.id, tier, rateLimit, callServerAgent, isDeepQuery]);

  const confirmActions = useCallback(async (msgId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      return { ...m, executing: true };
    }));

    const msg = messages.find(m => m.id === msgId);
    if (!msg?.actions) return;

    const dbActions = msg.actions.filter(a => !['navigate', 'info'].includes(a.type));
    const result = await executeActions(dbActions);

    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      let updatedContent = m.content;
      // Append failures to message content if any
      if (result.failures && result.failures.length > 0) {
        updatedContent = updatedContent + '\n\n⚠️ **Action Failures:**\n' + result.failures.map(f => `- ${f}`).join('\n');
      }
      return {
        ...m,
        content: updatedContent,
        executing: false,
        executed: true,
        needs_confirmation: false,
        executionResults: result,
      };
    }));

    window.dispatchEvent(new Event('lifeos-refresh'));
    setTimeout(() => window.dispatchEvent(new Event('lifeos-refresh')), 1500);
  }, [messages]);

  const dismissActions = useCallback((msgId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      return { ...m, needs_confirmation: false, actions: [] };
    }));
  }, []);

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
    try { localStorage.removeItem(getChatStorageKey(user?.id)); } catch { /* Safari private */ }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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
    }
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
        onClearChat={clearChat}
        onNavigateSettings={() => navigate('/settings')}
        onClose={() => setOpen(false)}
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
        onSend={() => sendMessage()}
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
