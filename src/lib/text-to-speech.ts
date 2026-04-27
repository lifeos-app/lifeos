/**
 * LifeOS Text-to-Speech — Browser SpeechSynthesis API
 *
 * Zero-dependency TTS using the browser's built-in SpeechSynthesis.
 * SpeechSynthesis is only available in the renderer process (not Node.js/Electron main).
 */

// ─── Voice Caching ────────────────────────────────────────────────

let cachedVoices: SpeechSynthesisVoice[] = [];

/** Load voices (handles async loading on some browsers) */
function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    cachedVoices = voices;
  }
  return cachedVoices.length > 0 ? cachedVoices : voices;
}

// ─── Markdown Sanitization ────────────────────────────────────────

/** Strip markdown formatting and code blocks for clean TTS output */
function sanitizeForSpeech(text: string): string {
  // Remove code blocks (```...```)
  let clean = text.replace(/```[\s\S]*?```/g, '');
  // Remove inline code (`...`)
  clean = clean.replace(/`[^`]+`/g, '');
  // Remove bold markers (**text** or __text__)
  clean = clean.replace(/\*\*(.+?)\*\*/g, '$1');
  clean = clean.replace(/__(.+?)__/g, '$1');
  // Remove italic markers (*text* or _text_)
  clean = clean.replace(/\*(.+?)\*/g, '$1');
  clean = clean.replace(/_(.+?)_/g, '$1');
  // Remove heading markers (# ## ### etc.)
  clean = clean.replace(/^#{1,6}\s*/gm, '');
  // Remove links [text](url) → text
  clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Remove images ![alt](url)
  clean = clean.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
  // Remove horizontal rules (---, ***, ___)
  clean = clean.replace(/^[-*_]{3,}\s*$/gm, '');
  // Remove blockquotes (> text)
  clean = clean.replace(/^>\s*/gm, '');
  // Remove list markers (- item, * item, 1. item)
  clean = clean.replace(/^[\s]*[-*+]\s+/gm, '');
  clean = clean.replace(/^[\s]*\d+\.\s+/gm, '');
  // Remove HTML tags
  clean = clean.replace(/<[^>]+>/g, '');
  // Collapse multiple whitespace/newlines
  clean = clean.replace(/\n{2,}/g, '. ');
  clean = clean.replace(/\s+/g, ' ').trim();
  // Limit to 500 characters for reasonable speech duration
  if (clean.length > 500) {
    clean = clean.slice(0, 497) + '...';
  }
  return clean;
}

// ─── Voice Selection ───────────────────────────────────────────────

const PREFERRED_VOICE_PATTERNS = [
  /google/i,
  /samantha/i,
  /daniel/i,
  /karen/i,
  /moira/i,
  /tessa/i,
  /fiona/i,
  /us english/i,
  /en-us/i,
  /en-au/i,
  /en-gb/i,
];

/** Pick the best available English voice */
function selectBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  // Try preferred voices in order
  for (const pattern of PREFERRED_VOICE_PATTERNS) {
    const match = voices.find(v => pattern.test(v.name) && v.lang.startsWith('en'));
    if (match) return match;
  }

  // Fall back to any English voice
  const enVoice = voices.find(v => v.lang.startsWith('en'));
  if (enVoice) return enVoice;

  // Fall back to any voice
  return voices[0] || null;
}

// ─── Public API ────────────────────────────────────────────────────

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice;
}

/**
 * Speak text aloud using the browser's SpeechSynthesis API.
 * Sanitizes markdown, auto-selects best voice, respects preferred voice.
 */
export function speak(text: string, options: SpeakOptions = {}): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const cleanText = sanitizeForSpeech(text);
  if (!cleanText) return;

  const utterance = new SpeechSynthesisUtterance(cleanText);

  // Set options
  if (options.rate != null) utterance.rate = options.rate;
  else utterance.rate = 1;

  if (options.pitch != null) utterance.pitch = options.pitch;
  else utterance.pitch = 1;

  if (options.volume != null) utterance.volume = options.volume;
  else utterance.volume = 1;

  // Select voice: explicit > preferred > auto
  if (options.voice) {
    utterance.voice = options.voice;
  } else {
    const preferred = getPreferredVoice();
    if (preferred) {
      utterance.voice = preferred;
    } else {
      const voices = loadVoices();
      const best = selectBestVoice(voices);
      if (best) utterance.voice = best;
    }
  }

  // Chrome bug workaround: resume if paused
  window.speechSynthesis.resume();
  window.speechSynthesis.speak(utterance);
}

/** Stop all speech */
export function stop(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

/** Check if speech is currently playing */
export function isSpeaking(): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  return window.speechSynthesis.speaking;
}

/** Get all available voices (with caching) */
export function getVoices(): SpeechSynthesisVoice[] {
  return loadVoices();
}

/** Save preferred voice name to localStorage */
export function setPreferredVoice(voiceName: string): void {
  try {
    localStorage.setItem('lifeos:tts-voice', voiceName);
  } catch { /* Safari private mode */ }
}

/** Get the preferred SpeechSynthesisVoice (from localStorage + available voices) */
export function getPreferredVoice(): SpeechSynthesisVoice | null {
  let savedName: string | null = null;
  try {
    savedName = localStorage.getItem('lifeos:tts-voice');
  } catch { /* Safari private mode */ }

  if (!savedName) return null;

  const voices = loadVoices();
  return voices.find(v => v.name === savedName) || null;
}

/** Check if TTS is available in this browser */
export function isTTSAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// ─── Auto-TTS Setting ─────────────────────────────────────────────

const TTS_ENABLED_KEY = 'lifeos:tts-enabled';

/** Check if auto-TTS is enabled (reads AI responses aloud after streaming) */
export function isTTSEnabled(): boolean {
  try {
    return localStorage.getItem(TTS_ENABLED_KEY) === 'true';
  } catch { return false; }
}

/** Enable or disable auto-TTS */
export function setTTSEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(TTS_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch { /* Safari private mode */ }
}