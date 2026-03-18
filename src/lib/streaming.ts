/**
 * LifeOS Streaming Text Reveal
 * 
 * Simulates streaming by revealing text word-by-word with natural timing.
 * Since the backend returns full responses, we animate the reveal to feel alive.
 */

export interface StreamController {
  /** Cancel the streaming animation */
  cancel: () => void;
  /** Promise that resolves when streaming is complete (or cancelled) */
  done: Promise<void>;
}

interface StreamOptions {
  /** Called with each progressive chunk of text */
  onChunk: (text: string) => void;
  /** Called when streaming completes naturally */
  onDone?: () => void;
  /** Called if cancelled */
  onCancel?: () => void;
  /** Base delay between words in ms (default: 30) */
  baseDelay?: number;
  /** Chunk size in words (default: 1-3 random) */
  chunkSize?: number;
}

/**
 * Stream text word-by-word with natural timing variations.
 * Returns a controller to cancel mid-stream.
 */
export function streamText(fullText: string, options: StreamOptions): StreamController {
  const {
    onChunk,
    onDone,
    onCancel,
    baseDelay = 25,
  } = options;

  let cancelled = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const words = fullText.split(/(\s+)/); // Preserve whitespace
  let currentIndex = 0;
  let revealedText = '';

  const done = new Promise<void>((resolve) => {
    function revealNext() {
      if (cancelled) {
        onCancel?.();
        resolve();
        return;
      }

      if (currentIndex >= words.length) {
        onDone?.();
        resolve();
        return;
      }

      // Reveal 1-3 words at a time for natural feel
      const chunkCount = Math.floor(Math.random() * 3) + 1;
      let chunk = '';
      for (let i = 0; i < chunkCount && currentIndex < words.length; i++) {
        chunk += words[currentIndex];
        currentIndex++;
      }

      revealedText += chunk;
      onChunk(revealedText);

      // Natural timing: longer pauses after punctuation, shorter between words
      let delay = baseDelay;
      if (/[.!?]\s*$/.test(chunk)) {
        delay = baseDelay * 4; // Pause after sentences
      } else if (/[,;:]\s*$/.test(chunk)) {
        delay = baseDelay * 2; // Brief pause after commas
      } else if (/\n/.test(chunk)) {
        delay = baseDelay * 3; // Pause at line breaks
      } else {
        // Slight randomness for natural feel
        delay = baseDelay + Math.random() * baseDelay * 0.5;
      }

      timeoutId = setTimeout(revealNext, delay);
    }

    // Start with a tiny initial delay
    timeoutId = setTimeout(revealNext, 50);
  });

  return {
    cancel: () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    },
    done,
  };
}
