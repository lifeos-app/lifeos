/**
 * Agent Store — ZeroClaw Agent State
 *
 * Manages: conversation history, pending actions, nudges, agent status
 */
import { create } from 'zustand';
import { logger } from '../utils/logger';
import { supabase } from '../lib/supabase';
import {
  agentChat,
  agentChatStream,
  agentNudges,
  agentExecuteAction,
  agentHealthCheck,
  type AgentAction,
  type AgentMessage as APIAgentMessage,
} from '../lib/zeroclaw-client';

interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  actions?: AgentAction[];
  thinking?: string;
  toolsUsed?: string[];
  timestamp: number;
}

interface AgentNudge {
  id: string;
  type: string;
  title: string;
  summary: string;
  priority: string;
  dismissed: boolean;
  actions?: AgentAction[];
  generatedAt: string;
}

interface AgentState {
  messages: AgentMessage[];
  nudges: AgentNudge[];
  isOnline: boolean;
  isTyping: boolean;
  lastHealthCheck: number | null;

  // Actions
  sendMessage: (userId: string, message: string, context?: Record<string, unknown>) => Promise<void>;
  sendMessageStream: (userId: string, message: string, context?: Record<string, unknown>) => AbortController | null;
  fetchNudges: (userId: string) => Promise<void>;
  dismissNudge: (nudgeId: string) => void;
  persistInsight: (userId: string, nudge: AgentNudge) => Promise<void>;
  fetchPersistedInsights: (userId: string) => Promise<void>;
  executeAction: (userId: string, action: AgentAction) => Promise<boolean>;
  checkHealth: () => Promise<void>;
  clearHistory: () => void;
}

let messageCounter = 0;
const genMsgId = () => `msg_${Date.now()}_${++messageCounter}`;

export const useAgentStore = create<AgentState>((set, get) => ({
  messages: [],
  nudges: [],
  isOnline: false,
  isTyping: false,
  lastHealthCheck: null,

  sendMessage: async (userId, message, context) => {
    const userMsg: AgentMessage = {
      id: genMsgId(), role: 'user', content: message, timestamp: Date.now(),
    };
    set(s => ({ messages: [...s.messages, userMsg], isTyping: true }));

    try {
      const history: APIAgentMessage[] = get().messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const response = await agentChat({
        userId, message, context,
        conversationHistory: history,
      });
      
      const assistantMsg: AgentMessage = {
        id: genMsgId(), role: 'assistant', content: response.message,
        actions: response.actions, thinking: response.thinking,
        toolsUsed: response.toolsUsed, timestamp: Date.now(),
      };
      set(s => ({ messages: [...s.messages, assistantMsg], isTyping: false }));
    } catch (err) {
      const errorMsg: AgentMessage = {
        id: genMsgId(), role: 'assistant',
        content: 'Agent is temporarily unavailable. Try again in a moment.',
        timestamp: Date.now(),
      };
      set(s => ({ messages: [...s.messages, errorMsg], isTyping: false }));
    }
  },

  sendMessageStream: (userId, message, context) => {
    const userMsg: AgentMessage = {
      id: genMsgId(), role: 'user', content: message, timestamp: Date.now(),
    };
    const streamMsgId = genMsgId();
    const streamMsg: AgentMessage = {
      id: streamMsgId, role: 'assistant', content: '', timestamp: Date.now(),
    };
    set(s => ({ messages: [...s.messages, userMsg, streamMsg], isTyping: true }));

    const history: APIAgentMessage[] = get().messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
    
    const controller = agentChatStream(
      { userId, message, context, conversationHistory: history },
      (chunk) => {
        set(s => ({
          messages: s.messages.map(m =>
            m.id === streamMsgId ? { ...m, content: m.content + chunk } : m
          ),
        }));
      },
      (response) => {
        set(s => ({
          messages: s.messages.map(m =>
            m.id === streamMsgId ? {
              ...m, content: response.message || m.content,
              actions: response.actions, toolsUsed: response.toolsUsed,
            } : m
          ),
          isTyping: false,
        }));
      },
      (error) => {
        logger.error('[Agent] Stream error:', error);
        set(s => ({
          messages: s.messages.map(m =>
            m.id === streamMsgId ? { ...m, content: m.content || 'Connection lost. Try again.' } : m
          ),
          isTyping: false,
        }));
      },
    );
    
    return controller;
  },

  fetchNudges: async (userId) => {
    try {
      const nudges = await agentNudges(userId);

      // Deduplicate: don't add nudges of the same type already persisted in last 24h
      const { data: recent } = await supabase
        .from('ai_insights')
        .select('insight_type, created_at')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const recentTypes = new Set((recent || []).map(r => r.insight_type));

      const newNudges = nudges
        .filter(n => !recentTypes.has(n.type))
        .map((n, i) => ({
          ...n, id: `nudge_${Date.now()}_${i}`, dismissed: false,
        }));

      set({ nudges: newNudges });

      // Persist new insights to Supabase
      for (const nudge of newNudges) {
        get().persistInsight(userId, nudge);
      }
    } catch (e) { logger.warn('[agent] fetchNudges failed:', e); }
  },

  dismissNudge: (nudgeId) => {
    set(s => ({
      nudges: s.nudges.map(n => n.id === nudgeId ? { ...n, dismissed: true } : n),
    }));
    // Mark dismissed in Supabase if it's a persisted insight
    supabase
      .from('ai_insights')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', nudgeId)
      .then(() => {})
      .catch(e => logger.warn('[agent] dismiss nudge sync failed:', e));
  },

  persistInsight: async (userId, nudge) => {
    try {
      await supabase.from('ai_insights').insert({
        user_id: userId,
        insight_type: nudge.type,
        title: nudge.title,
        summary: nudge.summary,
        priority: nudge.priority,
        data: { actions: nudge.actions, generatedAt: nudge.generatedAt },
      });
    } catch (err) {
      logger.warn('[Agent] Failed to persist insight:', err);
    }
  },

  fetchPersistedInsights: async (userId) => {
    try {
      const { data } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('user_id', userId)
        .is('dismissed_at', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data && data.length > 0) {
        const persistedNudges: AgentNudge[] = data.map(row => ({
          id: row.id,
          type: row.insight_type,
          title: row.title,
          summary: row.summary || '',
          priority: row.priority || 'medium',
          dismissed: false,
          actions: row.data?.actions || [],
          generatedAt: row.created_at,
        }));

        // Merge with existing nudges, avoiding duplicates by type
        const existing = get().nudges;
        const existingTypes = new Set(existing.map(n => n.type));
        const newOnes = persistedNudges.filter(n => !existingTypes.has(n.type));
        if (newOnes.length > 0) {
          set({ nudges: [...existing, ...newOnes] });
        }
      }
    } catch (e) { logger.warn('[agent] fetchPersistedInsights failed:', e); }
  },

  executeAction: async (userId, action) => {
    // Handle navigate actions client-side
    if (action.type === 'navigate' && action.payload?.path) {
      window.location.hash = '';
      window.location.href = action.payload.path as string;
      return true;
    }

    try {
      const result = await agentExecuteAction(userId, action);
      if (result.success) {
        window.dispatchEvent(new Event('lifeos-refresh'));
      }
      return result.success;
    } catch (e) {
      logger.warn('[agent] executeAction failed:', e);
      return false;
    }
  },

  checkHealth: async () => {
    const online = await agentHealthCheck();
    set({ isOnline: online, lastHealthCheck: Date.now() });
  },

  clearHistory: () => set({ messages: [] }),
}));
