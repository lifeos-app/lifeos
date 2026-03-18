import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic } from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import {
  callIntentEngine, executeActions, loadIntentContext,
  getAISettings,
  type IntentContext,
} from '../lib/intent-engine';
import { useUserStore } from '../stores/useUserStore';
import { getErrorMessage } from '../utils/error';
import './VoiceFAB.css';

interface Toast {
  message: string;
  isError?: boolean;
  fadingOut?: boolean;
}

export function VoiceFAB() {
  const [toast, setToast] = useState<Toast | null>(null);
  const [sending, setSending] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const contextRef = useRef<IntentContext | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const user = useUserStore(s => s.user);

  const [externalInputFocused, setExternalInputFocused] = useState(false);

  // Hide when AI chat is open
  useEffect(() => {
    const onOpen = () => setAiChatOpen(true);
    const onClose = () => setAiChatOpen(false);
    const onToggle = () => setAiChatOpen(prev => !prev);
    document.addEventListener('open-ai-chat', onOpen);
    document.addEventListener('close-ai-chat', onClose);
    document.addEventListener('toggle-ai-chat', onToggle);
    return () => {
      document.removeEventListener('open-ai-chat', onOpen);
      document.removeEventListener('close-ai-chat', onClose);
      document.removeEventListener('toggle-ai-chat', onToggle);
    };
  }, []);

  // Hide when any non-AI input is focused (keyboard open on mobile)
  useEffect(() => {
    const isExtInput = (el: Element | null) =>
      (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement)?.isContentEditable)
        && !el!.closest('.ai-chat-panel');
    const onIn = (e: FocusEvent) => { if (isExtInput(e.target as Element)) setExternalInputFocused(true); };
    const onOut = (e: FocusEvent) => { if (isExtInput(e.target as Element)) setExternalInputFocused(false); };
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => { document.removeEventListener('focusin', onIn); document.removeEventListener('focusout', onOut); };
  }, []);

  const handleFinalTranscript = useCallback((text: string) => {
    // Will be handled by pointer/touch up — just let it populate
  }, []);

  const handleError = useCallback((error: string) => {
    showToast(error, true);
  }, []);

  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    start,
    stop,
    abort,
  } = useSpeechRecognition({
    lang: 'en-AU',
    continuous: true, // Keep listening until user releases
    onFinalTranscript: handleFinalTranscript,
    onError: handleError,
  });

  // Preload context
  useEffect(() => {
    if (user?.id && !contextRef.current) {
      loadIntentContext(user.id).then(ctx => {
        contextRef.current = ctx;
      }).catch(() => { /* will retry on send */ });
    }
  }, [user?.id]);

  const showToast = useCallback((message: string, isError = false) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, isError });
    // Start fade out after 3s
    toastTimerRef.current = setTimeout(() => {
      setToast(prev => prev ? { ...prev, fadingOut: true } : null);
      // Remove after animation
      setTimeout(() => setToast(null), 300);
    }, 3000);
  }, []);

  const sendToEngine = useCallback(async (text: string) => {
    if (!text.trim() || !user?.id || sending) return;

    setSending(true);
    showToast('🎤 Processing…');

    try {
      // Load context if needed
      if (!contextRef.current) {
        contextRef.current = await loadIntentContext(user.id);
      }

      const settings = getAISettings();
      const result = await callIntentEngine(
        text,
        contextRef.current,
        [],
        { provider: settings.provider, model: settings.model, proxyUrl: settings.proxyUrl },
      );

      // If needs confirmation, open AI chat with the message
      if (result.needs_confirmation) {
        // Dispatch event to open AI chat with this message
        const event = new CustomEvent('voice-fab-to-chat', { detail: { message: text } });
        document.dispatchEvent(event);
        showToast('💬 Opening chat for confirmation…');
        setSending(false);
        return;
      }

      // Auto-execute actions
      const dbActions = result.actions.filter(a => !['navigate', 'info'].includes(a.type));
      if (dbActions.length > 0) {
        const execResult = await executeActions(dbActions);
        window.dispatchEvent(new Event('lifeos-refresh'));

        if (execResult.failures.length > 0) {
          showToast(`❌ ${execResult.failures[0]}`, true);
        } else {
          showToast(execResult.successes[0] || `✅ ${result.reply}`);
        }
      } else {
        // Just informational reply
        showToast(`💬 ${result.reply.slice(0, 120)}`);
      }
    } catch (err: unknown) {
      showToast(`❌ ${getErrorMessage(err)}`, true);
    }

    setSending(false);
  }, [user?.id, sending, showToast]);

  // ─── Press-and-hold handlers ───────────────────────────────────
  const isPressingRef = useRef(false);

  const handlePressStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (!isSupported || sending) return;
    isPressingRef.current = true;
    start();
  }, [isSupported, sending, start]);

  const handlePressEnd = useCallback(() => {
    if (!isPressingRef.current) return;
    isPressingRef.current = false;
    stop();

    // Small delay to let final transcript arrive
    setTimeout(() => {
      // Get the latest transcript from the recognition
      const finalText = transcript || interimTranscript;
      if (finalText.trim()) {
        sendToEngine(finalText.trim());
      }
    }, 300);
  }, [stop, transcript, interimTranscript, sendToEngine]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      abort();
    };
  }, [abort]);

  // Don't render if not supported, AI chat is open, or external input focused
  if (!isSupported || aiChatOpen || externalInputFocused) return null;

  const displayText = interimTranscript || transcript;

  return (
    <>
      <button
        className={`voice-fab ${isListening ? 'voice-fab--recording' : ''}`}
        onPointerDown={handlePressStart}
        onPointerUp={handlePressEnd}
        onPointerCancel={handlePressEnd}
        onPointerLeave={isListening ? handlePressEnd : undefined}
        title="Hold to speak"
        aria-label="Voice input — hold to speak"
      >
        <Mic size={18} className="voice-fab__icon" />

        {/* Floating transcript while recording */}
        {isListening && (
          <div className={`voice-fab__transcript ${!displayText ? 'voice-fab__transcript--empty' : ''}`}>
            {displayText || 'Listening…'}
          </div>
        )}
      </button>

      {/* Toast notification */}
      {toast && (
        <div className={`voice-fab__toast ${toast.isError ? 'voice-fab__toast--error' : ''} ${toast.fadingOut ? 'voice-fab__toast--fade-out' : ''}`}>
          {toast.message}
        </div>
      )}
    </>
  );
}
