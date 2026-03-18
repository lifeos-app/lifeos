// ═══ EventDrawer helpers — pure functions & types ═══

import {
  Dumbbell, BookOpen, Coffee, Moon, Briefcase, Target,
} from 'lucide-react';
import type { ScheduleEvent } from '../../hooks/useCurrentEvent';

// ═══ Types ═══
export type TabId = 'now' | 'details';

// ═══ Helpers ═══
export function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function formatHour(date: Date): string {
  const h = date.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}${ampm}`;
}

export function formatMinutes(mins: number): string {
  if (mins < 1) return '< 1m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function getCategoryIcon(category?: string, eventType?: string, title?: string, size = 18) {
  const t = (eventType || category || '').toLowerCase();
  const ti = (title || '').toLowerCase();
  if (t === 'health' || ti.includes('gym') || ti.includes('workout') || ti.includes('exercise')) return <Dumbbell size={size} />;
  if (ti.includes('read') || ti.includes('book') || ti.includes('bible') || ti.includes('study')) return <BookOpen size={size} />;
  if (t === 'work' || ti.includes('clean') || ti.includes('office')) return <Briefcase size={size} />;
  if (ti.includes('sleep') || ti.includes('bed')) return <Moon size={size} />;
  if (ti.includes('coffee') || ti.includes('break')) return <Coffee size={size} />;
  return <Target size={size} />;
}

export function getTimeOfDayLabel(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Night';
  if (h < 7) return 'Early Morning';
  if (h < 12) return 'Morning';
  if (h < 14) return 'Midday';
  if (h < 17) return 'Afternoon';
  if (h < 20) return 'Evening';
  return 'Night';
}

export function getContextMessage(timeLabel: string, eventType?: string, title?: string): string {
  const t = (eventType || '').toLowerCase();
  const ti = (title || '').toLowerCase();

  if (ti.includes('gym') || ti.includes('workout') || t === 'health') {
    const msgs: Record<string, string> = {
      'Early Morning': 'Dawn warriors build empires. Your body is your first kingdom.',
      'Morning': 'Morning movement sets the frequency for everything that follows.',
      'Midday': 'Midday training — breaking through the comfort of routine.',
      'Afternoon': 'Afternoon strength. The disciplined mind trains regardless.',
      'Evening': 'Evening iron. Forge tomorrow\'s strength tonight.',
      'Night': 'Night session. While others sleep, you sharpen.',
    };
    return msgs[timeLabel] || 'Your body is a temple. Train it accordingly.';
  }

  if (ti.includes('read') || ti.includes('study') || ti.includes('bible') || t === 'education') {
    const msgs: Record<string, string> = {
      'Early Morning': 'The quiet hours feed the deepest learning.',
      'Morning': 'Morning study — the mind is fresh, the soul is ready.',
      'Midday': 'Midday wisdom. Pause the doing, feed the knowing.',
      'Afternoon': 'Afternoon study — persistence compounds into mastery.',
      'Evening': 'Evening reflection. Let knowledge settle into understanding.',
      'Night': 'Night study. The world is quiet; the mind speaks loudest.',
    };
    return msgs[timeLabel] || 'Knowledge is the path. Walk it daily.';
  }

  if (ti.includes('clean') || ti.includes('office') || t === 'work') {
    const msgs: Record<string, string> = {
      'Early Morning': 'Before the world wakes, you\'re already building.',
      'Morning': 'Morning work. Every task is a brick in your foundation.',
      'Midday': 'Midday grind. Consistency is the only currency that never devalues.',
      'Afternoon': 'Afternoon focus. Stay locked in — the finish line approaches.',
      'Evening': 'Evening work. Others clock out, you level up.',
      'Night': 'Night work. Focus when the world is quiet.',
    };
    return msgs[timeLabel] || 'Work with purpose. Every hour counts.';
  }

  // Generic
  const generic: Record<string, string> = {
    'Early Morning': 'The early hours hold untapped potential. Use them wisely.',
    'Morning': 'A new morning, a new chance to align action with intention.',
    'Midday': 'Midday checkpoint. Are you on mission?',
    'Afternoon': 'Afternoon energy — channel it toward what matters most.',
    'Evening': 'Evening wind-down. Reflect, reset, prepare.',
    'Night': 'Night mode. Rest is productive. Recovery is strategic.',
  };
  return generic[timeLabel] || 'Every moment is an opportunity for alignment.';
}

export function resolveEventCategory(event?: ScheduleEvent | null): string {
  if (!event) return 'personal';
  const t = (event.event_type || event.category || '').toLowerCase();
  const ti = (event.title || '').toLowerCase();
  if (t === 'health' || ti.includes('gym') || ti.includes('workout') || ti.includes('exercise')) return 'health';
  if (t === 'education' || ti.includes('read') || ti.includes('study') || ti.includes('bible') || ti.includes('book')) return 'education';
  if (t === 'work' || ti.includes('clean') || ti.includes('office')) return 'work';
  return 'personal';
}
