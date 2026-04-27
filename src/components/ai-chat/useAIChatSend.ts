import { useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { getErrorMessage } from '../../utils/error';
import { showToast } from '../Toast';
import { agentChatStream, type AgentChatResponse } from '../../lib/zeroclaw-client';
import {
  callIntentEngine, executeActions, loadIntentContext,
  getAISettings,
  type IntentResult, type IntentContext, type RateLimitInfo,
} from '../../lib/intent-engine';
import { executeTool, detectToolIntent, type OrchestratorToolName } from '../../lib/llm/orchestrator';
import { supabase } from '../../lib/data-access';
import { streamText, type StreamController } from '../../lib/streaming';
import { genId } from '../../utils/date';
import type { ChatMessage } from './helpers';
import { getPageContext } from './helpers';
import { logger } from '../../utils/logger';

export interface UseAIChatSendArgs {
  user: User | null;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  streaming: boolean;
  setStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  open: boolean;
  appendToConversation: (msg: string) => Promise<void>;
  intentContext: IntentContext | null;
  setIntentContext: React.Dispatch<React.SetStateAction<IntentContext | null>>;
  setContextLoading: React.Dispatch<React.SetStateAction<boolean>>;
  currentConversationId: string | null;
  rateLimit: RateLimitInfo | null;
  setRateLimit: React.Dispatch<React.SetStateAction<RateLimitInfo | null>>;
  tier: 'free' | 'pro' | null;
  awardXP: (type: string, meta?: Record<string, unknown>) => void;
}

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

export function isDeepQuery(msg: string): boolean {
  return DEEP_QUERY_PATTERNS.some(p => p.test(msg));
}

export function useAIChatSend({
  user,
  messages,
  setMessages,
  loading,
  setLoading,
  streaming,
  setStreaming,
  open,
  appendToConversation,
  intentContext,
  setIntentContext,
  setContextLoading,
  currentConversationId,
  rateLimit,
  setRateLimit,
  tier,
  awardXP,
}: UseAIChatSendArgs) {
  const navigate = useNavigate();
  const location = useLocation();

  const agentAbortRef = useRef<AbortController | null>(null);
  const streamControllerRef = useRef<StreamController | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Ref to avoid stale closure in callServerAgent
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

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
  }, [user?.id, location.pathname, setMessages, setStreaming]);

  const sendMessage = useCallback(async (text?: string, inputText?: string) => {
    const msg = text || (inputText || '').trim();
    if (!msg || loading || streaming) return;

    // If context isn't loaded yet, load it now
    let ctx = intentContext;
    if (!ctx && user?.id) {
      try {
        setContextLoading(true);
        ctx = await loadIntentContext(user.id);
        setIntentContext(ctx);
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

    // ─── AI Persistent Memory: create conversation on first message ───
    if (!currentConversationId && user?.id) {
      await appendToConversation(msg);
    }

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
                  // Append success summary inline if not already in content
                  if (execResult.success && execResult.successes.length > 0) {
                    const successLine = execResult.successes.join(' · ');
                    if (!updatedContent.includes(successLine)) {
                      updatedContent = updatedContent + '\n\n✅ ' + successLine;
                    }
                  }
                  return { ...m, content: updatedContent, executing: false, executed: true, executionResults: execResult, isStreaming: false };
                }
                return m;
              }));
              // Show green toast for successful action execution
              if (execResult.success) {
                showToast(execResult.message, '✅', '#22C55E');
              } else {
                showToast(execResult.message, '⚠️', '#F97316');
              }
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
  }, [messages, loading, streaming, navigate, location.pathname, user?.id, tier, rateLimit, callServerAgent, currentConversationId, intentContext, setIntentContext, setContextLoading, setMessages, setLoading, setStreaming, setRateLimit, awardXP, appendToConversation]);

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
  }, [setLoading, setStreaming, setMessages]);

  return { sendMessage, cancelGeneration, isDeepQuery };
}