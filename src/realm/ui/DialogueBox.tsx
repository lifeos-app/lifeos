/**
 * Dialogue Box — The Realm
 *
 * Shows NPC dialogue with typewriter effect.
 * Tap/click to advance, auto-dismiss on last line.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface DialogueBoxProps {
  npcName: string;
  lines: string[];
  onClose: () => void;
}

export function DialogueBox({ npcName, lines, onClose }: DialogueBoxProps) {
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const timerRef = useRef<number | null>(null);

  const currentLine = lines[lineIndex] || '';
  const isTyping = charIndex < currentLine.length;
  const isLastLine = lineIndex >= lines.length - 1;

  // Typewriter effect
  useEffect(() => {
    if (charIndex < currentLine.length) {
      timerRef.current = window.setTimeout(() => {
        setCharIndex(i => i + 1);
        setDisplayedText(currentLine.slice(0, charIndex + 1));
      }, 30);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [charIndex, currentLine]);

  // Reset on line change
  useEffect(() => {
    setCharIndex(0);
    setDisplayedText('');
  }, [lineIndex]);

  const advance = useCallback(() => {
    if (isTyping) {
      // Skip to full line
      setCharIndex(currentLine.length);
      setDisplayedText(currentLine);
      if (timerRef.current) clearTimeout(timerRef.current);
    } else if (isLastLine) {
      onClose();
    } else {
      setLineIndex(i => i + 1);
    }
  }, [isTyping, isLastLine, currentLine, onClose]);

  return (
    <div className="realm-dialogue-backdrop" onClick={advance}>
      <div className="realm-dialogue-box">
        <div className="realm-dialogue-name">{npcName}</div>
        <div className="realm-dialogue-text">
          {displayedText}
          {isTyping && <span className="realm-dialogue-cursor">▊</span>}
        </div>
        <div className="realm-dialogue-hint">
          {isLastLine && !isTyping ? 'tap to close' : 'tap to continue ▶'}
        </div>
      </div>
    </div>
  );
}
