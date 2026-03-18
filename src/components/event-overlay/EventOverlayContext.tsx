// ═══ EventOverlay Context & Provider ═══

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase } from '../../lib/supabase';
import type { ActiveEvent, OverlayState, EventOverlayContextValue } from './types';

const EventOverlayContext = createContext<EventOverlayContextValue | null>(null);

export function useEventOverlay() {
  const ctx = useContext(EventOverlayContext);
  if (!ctx) return { overlayState: { activeEvent: null, isMinimized: false, isVisible: false }, startOverlay: () => {}, closeOverlay: () => {}, toggleMinimize: () => {}, drawerOpen: false, setDrawerOpen: () => {} };
  return ctx;
}

// ═══ Provider ═══
export function EventOverlayProvider({ children }: { children: React.ReactNode }) {
  const [overlayState, setOverlayState] = useState<OverlayState>({
    activeEvent: null,
    isMinimized: false,
    isVisible: false,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const startOverlay = useCallback((event: ActiveEvent) => {
    // Dispatch to EventDrawer focus mode instead of rendering overlay
    window.dispatchEvent(new CustomEvent('lifeos-focus-event', { detail: event }));
  }, []);

  const closeOverlay = useCallback(() => {
    setOverlayState(prev => ({ ...prev, isVisible: false }));
    // Delay clearing event for exit animation
    setTimeout(() => setOverlayState({ activeEvent: null, isMinimized: false, isVisible: false }), 300);
  }, []);

  const toggleMinimize = useCallback(() => {
    setOverlayState(prev => ({ ...prev, isMinimized: !prev.isMinimized }));
  }, []);

  // Listen for 'lifeos-refresh' and re-query active event from Supabase
  useEffect(() => {
    const handleRefresh = async () => {
      if (!overlayState.activeEvent) return;

      const { data, error } = await supabase
        .from('schedule_events')
        .select('*')
        .eq('id', overlayState.activeEvent.id)
        .single();

      if (error || !data) {
        // Event was deleted or error occurred - close overlay
        closeOverlay();
        return;
      }

      // Update activeEvent with fresh data
      setOverlayState(prev => ({
        ...prev,
        activeEvent: {
          ...prev.activeEvent!,
          ...data,
        },
      }));
    };

    window.addEventListener('lifeos-refresh', handleRefresh);
    return () => window.removeEventListener('lifeos-refresh', handleRefresh);
  }, [overlayState.activeEvent, closeOverlay]);

  // Auto-trigger removed — EventDrawer now handles auto-opening
  // The overlay only opens via explicit startOverlay() calls (e.g., user taps Play)

  return (
    <EventOverlayContext.Provider value={{ overlayState, startOverlay, closeOverlay, toggleMinimize, drawerOpen, setDrawerOpen }}>
      {children}
      {/* EventOverlay portal removed — EventDrawer (Mission Control slider) handles all event UI */}
    </EventOverlayContext.Provider>
  );
}
