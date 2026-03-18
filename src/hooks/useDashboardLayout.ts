// LifeOS — Customisable Dashboard Layout
// Users can reorder and toggle visibility of dashboard widgets
// Layout persists in Supabase user_profiles.preferences.dashboardLayout

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/useUserStore';

export interface WidgetConfig {
  id: string;
  label: string;
  icon: string;
  visible: boolean;
}

// Default widget order
const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'morning-brief', label: 'AI Morning Brief', icon: '✨', visible: true },
  { id: 'stats', label: 'Quick Stats', icon: '📊', visible: true },
  { id: 'completion-rates', label: 'Completion Analytics', icon: '📈', visible: true },
  { id: 'insights', label: 'Insights', icon: '📊', visible: true },
  { id: 'tasks', label: 'Tasks', icon: '✅', visible: true },
  { id: 'day-summary', label: 'Day Summary', icon: '🕐', visible: true },
  { id: 'habits', label: 'Habits', icon: '🔥', visible: true },
  { id: 'health', label: 'Health Vitals', icon: '❤️', visible: true },
  { id: 'plugin-activity', label: 'Plugin Activity', icon: '🔌', visible: true },
  { id: 'suggestions', label: 'Habit Suggestions', icon: '✨', visible: true },
  { id: 'fin-alerts', label: 'Financial Alerts', icon: '⚠️', visible: true },
  { id: 'finances', label: 'Finances', icon: '💰', visible: true },
  { id: 'journal', label: 'Journal', icon: '📖', visible: true },
  { id: 'goals', label: 'Goals', icon: '🎯', visible: true },
  { id: 'celestial', label: 'Celestial', icon: '🌙', visible: true },
  { id: 'realm', label: 'The Realm', icon: '🏰', visible: true },
];

export function useDashboardLayout() {
  const user = useUserStore(s => s.user);
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load layout from Supabase preferences
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('preferences')
        .eq('user_id', user.id)
        .maybeSingle();

      const saved = data?.preferences?.dashboardLayout as WidgetConfig[] | undefined;
      if (saved && Array.isArray(saved) && saved.length > 0) {
        // Merge with defaults (in case we added new widgets since they saved)
        const savedIds = new Set(saved.map(w => w.id));
        const merged = [
          ...saved,
          ...DEFAULT_WIDGETS.filter(w => !savedIds.has(w.id)),
        ];
        setWidgets(merged);
      }
      setLoaded(true);
    })();
  }, [user?.id]);

  // Save layout to Supabase
  const save = useCallback(async (newWidgets: WidgetConfig[]) => {
    if (!user?.id) return;
    // Read current preferences first to avoid overwriting other prefs
    const { data } = await supabase
      .from('user_profiles')
      .select('preferences')
      .eq('user_id', user.id)
      .maybeSingle();

    const currentPrefs = (data?.preferences || {}) as Record<string, unknown>;
    await supabase
      .from('user_profiles')
      .update({
        preferences: { ...currentPrefs, dashboardLayout: newWidgets },
      })
      .eq('user_id', user.id);
  }, [user?.id]);

  const moveUp = useCallback((id: string) => {
    setWidgets(prev => {
      const idx = prev.findIndex(w => w.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      save(next);
      return next;
    });
  }, [save]);

  const moveDown = useCallback((id: string) => {
    setWidgets(prev => {
      const idx = prev.findIndex(w => w.id === id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      save(next);
      return next;
    });
  }, [save]);

  const toggleVisible = useCallback((id: string) => {
    setWidgets(prev => {
      const next = prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
      save(next);
      return next;
    });
  }, [save]);

  const reorder = useCallback((fromIndex: number, toIndex: number) => {
    setWidgets(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      save(next);
      return next;
    });
  }, [save]);

  const resetLayout = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS);
    save(DEFAULT_WIDGETS);
  }, [save]);

  const isVisible = useCallback((id: string) => {
    const w = widgets.find(w => w.id === id);
    return w ? w.visible : true;
  }, [widgets]);

  const getOrder = useCallback(() => {
    return widgets.filter(w => w.visible).map(w => w.id);
  }, [widgets]);

  return {
    widgets,
    editing,
    setEditing,
    moveUp,
    moveDown,
    reorder,
    toggleVisible,
    resetLayout,
    isVisible,
    getOrder,
    loaded,
  };
}
