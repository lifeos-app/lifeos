/**
 * SmartNotificationToast — Auto-shows HIGH priority notifications as compact toasts
 *
 * - Only shows 1 toast at a time
 * - Only auto-toasts HIGH priority (overdue tasks, streak at risk)
 * - Respects localStorage-dismissed notifications
 * - Auto-dismiss after 5s
 * - Clicking expands details; dismiss records to localStorage
 */

import { useEffect, useRef, useCallback } from 'react';
import { showToast } from './Toast';
import type { Notification } from '../hooks/useNotifications';

const LS_TOASTED_KEY = 'lifeos-notif-toasted';

function getToastedIds(): Set<string> {
  try {
    const stored = localStorage.getItem(LS_TOASTED_KEY);
    if (!stored) return new Set();
    return new Set(JSON.parse(stored));
  } catch { return new Set(); }
}

function markToastShown(id: string) {
  try {
    const ids = getToastedIds();
    ids.add(id);
    // Keep last 100 to avoid unbounded growth
    const arr = [...ids].slice(-100);
    localStorage.setItem(LS_TOASTED_KEY, JSON.stringify(arr));
  } catch { /* silent */ }
}

interface SmartNotificationToastProps {
  highPriorityNotifications: Notification[];
  onDismiss: (id: string) => void;
}

export function SmartNotificationToast({ highPriorityNotifications, onDismiss }: SmartNotificationToastProps) {
  const shownRef = useRef<Set<string>>(getToastedIds());
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const showNextToast = useCallback(() => {
    // Find the first HIGH priority notification not yet toasted this session
    const next = highPriorityNotifications.find(n => !shownRef.current.has(n.id));
    if (!next) return;

    shownRef.current.add(next.id);
    markToastShown(next.id);

    const iconMap: Record<string, string> = {
      '⏰': '⏰',
      '🔥': '🔥',
      '📅': '📅',
    };
    const colorMap: Record<string, string> = {
      task: '#EF4444',
      habit: '#F97316',
      event: '#00D4FF',
    };

    showToast(
      next.title,
      iconMap[next.icon] || next.icon,
      colorMap[next.type] || '#00D4FF',
      {
        duration: 5000,
        expandable: next.subtitle,
        action: next.route ? {
          label: 'View',
          onClick: () => {
            onDismiss(next.id);
            // Navigate is handled by the consumer; just dismiss the toast
          },
        } : undefined,
      },
    );
  }, [highPriorityNotifications, onDismiss]);

  useEffect(() => {
    // Debounce: wait 2s after mount before showing first toast
    timerRef.current = setTimeout(() => {
      showNextToast();
    }, 2000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [showNextToast]);

  // This component has no visual output — it just triggers toasts
  return null;
}