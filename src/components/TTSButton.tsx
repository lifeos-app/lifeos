import { useState, useCallback } from 'react';
import { Volume2, Volume1, VolumeX } from 'lucide-react';
import { useTTS } from '../hooks/useTTS';
import { isTTSAvailable } from '../lib/text-to-speech';

interface TTSButtonProps {
  text: string;
  size?: number;
  className?: string;
}

/**
 * Small speaker icon button that speaks the provided text when clicked.
 * Shows different states: idle (volume-2), speaking (volume-1 + pulse), error (volume-x).
 * Click while speaking = stop.
 * Glass button style matching LifeOS aesthetic.
 */
export function TTSButton({ text, size = 14, className = '' }: TTSButtonProps) {
  const { speak, stop, isSpeaking } = useTTS();
  const [error, setError] = useState(false);
  const available = isTTSAvailable();

  const handleClick = useCallback(() => {
    if (!available) {
      setError(true);
      setTimeout(() => setError(false), 2000);
      return;
    }

    if (isSpeaking) {
      stop();
    } else {
      try {
        speak(text);
        setError(false);
      } catch {
        setError(true);
        setTimeout(() => setError(false), 2000);
      }
    }
  }, [available, isSpeaking, speak, stop, text]);

  // Don't render if TTS is completely unavailable
  if (!available) return null;

  const iconSize = size;
  let Icon: typeof Volume2;
  let title: string;

  if (error) {
    Icon = VolumeX;
    title = 'Speech not available';
  } else if (isSpeaking) {
    Icon = Volume1;
    title = 'Stop speaking';
  } else {
    Icon = Volume2;
    title = 'Read aloud';
  }

  return (
    <button
      className={`tts-btn ${isSpeaking ? 'tts-btn--speaking' : ''} ${error ? 'tts-btn--error' : ''} ${className}`}
      onClick={handleClick}
      title={title}
      aria-label={title}
      type="button"
    >
      <Icon size={iconSize} />
    </button>
  );
}