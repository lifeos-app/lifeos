/**
 * LifeOS Theme System
 *
 * 6 visual themes with CSS custom property application.
 * Themes are persisted to localStorage and applied on startup.
 */

export interface ThemeColors {
  bg: string;
  cardBg: string;
  accent: string;
  accentSecondary: string;
  text: string;
  textMuted: string;
  border: string;
}

export interface AppTheme {
  id: string;
  name: string;
  colors: ThemeColors;
  description: string;
  unlocksAt?: number;
}

export const THEMES: AppTheme[] = [
  {
    id: 'deep-space',
    name: 'Deep Space',
    description: 'The original dark blue cosmos',
    colors: {
      bg: '#0A1628',
      cardBg: 'rgba(255,255,255,0.04)',
      accent: '#00D4FF',
      accentSecondary: '#39FF14',
      text: '#F9FAFB',
      textMuted: '#8BA4BE',
      border: 'rgba(255,255,255,0.08)',
    },
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Pure black with neon green',
    colors: {
      bg: '#0D0D0D',
      cardBg: 'rgba(255,255,255,0.04)',
      accent: '#39FF14',
      accentSecondary: '#00D4FF',
      text: '#E8E8E8',
      textMuted: '#888888',
      border: 'rgba(255,255,255,0.08)',
    },
    unlocksAt: 3,
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Dark forest with mint glow',
    colors: {
      bg: '#0A1A14',
      cardBg: 'rgba(255,255,255,0.04)',
      accent: '#00FF88',
      accentSecondary: '#00D4FF',
      text: '#E0F5EC',
      textMuted: '#6BAF8D',
      border: 'rgba(255,255,255,0.08)',
    },
    unlocksAt: 5,
  },
  {
    id: 'solar',
    name: 'Solar',
    description: 'Dark amber with golden light',
    colors: {
      bg: '#1A1000',
      cardBg: 'rgba(255,255,255,0.04)',
      accent: '#FACC15',
      accentSecondary: '#F97316',
      text: '#FFF8E1',
      textMuted: '#B8A060',
      border: 'rgba(255,255,255,0.08)',
    },
    unlocksAt: 10,
  },
  {
    id: 'crimson',
    name: 'Crimson',
    description: 'Dark red with crimson fire',
    colors: {
      bg: '#1A0A0A',
      cardBg: 'rgba(255,255,255,0.04)',
      accent: '#FF4444',
      accentSecondary: '#F97316',
      text: '#FFE0E0',
      textMuted: '#B06060',
      border: 'rgba(255,255,255,0.08)',
    },
    unlocksAt: 15,
  },
  {
    id: 'violet',
    name: 'Violet',
    description: 'Dark purple with violet glow',
    colors: {
      bg: '#0F0A1A',
      cardBg: 'rgba(255,255,255,0.04)',
      accent: '#C084FC',
      accentSecondary: '#EC4899',
      text: '#EDE0FF',
      textMuted: '#9070B0',
      border: 'rgba(255,255,255,0.08)',
    },
    unlocksAt: 20,
  },
];

const THEME_KEY = 'lifeos_theme';

export function getActiveTheme(): AppTheme {
  try {
    const id = localStorage.getItem(THEME_KEY);
    if (id) {
      const found = THEMES.find(t => t.id === id);
      if (found) return found;
    }
  } catch { /* ignore */ }
  return THEMES[0]; // Deep Space default
}

export function setActiveTheme(themeId: string): void {
  localStorage.setItem(THEME_KEY, themeId);
  const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent('lifeos-theme-changed', { detail: theme }));
}

export function applyTheme(theme: AppTheme): void {
  const root = document.documentElement;
  root.style.setProperty('--theme-bg', theme.colors.bg);
  root.style.setProperty('--theme-card-bg', theme.colors.cardBg);
  root.style.setProperty('--theme-accent', theme.colors.accent);
  root.style.setProperty('--theme-accent-2', theme.colors.accentSecondary);
  root.style.setProperty('--theme-text', theme.colors.text);
  root.style.setProperty('--theme-text-muted', theme.colors.textMuted);
  root.style.setProperty('--theme-border', theme.colors.border);
}

export function initTheme(): void {
  const theme = getActiveTheme();
  applyTheme(theme);
}
