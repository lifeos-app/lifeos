import { useCallback } from 'react';
import { showToast } from '../Toast';
import { executeActions } from '../../lib/intent-engine';
import type { ChatMessage } from './helpers';

export interface UseMessageActionsArgs {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  awardXP: (type: string, meta?: Record<string, unknown>) => void;
}

export function useMessageActions({
  messages,
  setMessages,
}: UseMessageActionsArgs) {
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
      // Append success summary inline if not already in content
      if (result.success && result.successes.length > 0) {
        const successLine = result.successes.join(' · ');
        if (!updatedContent.includes(successLine)) {
          updatedContent = updatedContent + '\n\n✅ ' + successLine;
        }
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

    // Show green toast for successful action execution
    if (result.success) {
      showToast(result.message, '✅', '#22C55E');
    } else {
      showToast(result.message, '⚠️', '#F97316');
    }

    window.dispatchEvent(new Event('lifeos-refresh'));
    setTimeout(() => window.dispatchEvent(new Event('lifeos-refresh')), 1500);
  }, [messages, setMessages]);

  const dismissActions = useCallback((msgId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      return { ...m, needs_confirmation: false, actions: [] };
    }));
  }, [setMessages]);

  return { confirmActions, dismissActions };
}