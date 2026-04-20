/**
 * useDashboardMode — React hook for time-adaptive dashboard mode
 *
 * Returns the current mode, widget config, greeting, and accent color.
 * Re-evaluates every minute so the mode transitions automatically.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  getDashboardMode,
  getWidgetConfig,
  getModeGreeting,
  getModeAccent,
  type DashboardMode,
  type ModeWidgetConfig,
} from '../lib/dashboard-modes';

export interface DashboardModeResult {
  mode: DashboardMode;
  config: ModeWidgetConfig[];
  greeting: string;
  accent: string;
}

const REFRESH_INTERVAL = 60_000; // 1 minute

export function useDashboardMode(userName?: string): DashboardModeResult {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  const mode = useMemo(() => getDashboardMode(), [now]);
  const config = useMemo(() => getWidgetConfig(mode), [mode]);
  const greeting = useMemo(() => getModeGreeting(mode, userName ?? ''), [mode, userName]);
  const accent = useMemo(() => getModeAccent(mode), [mode]);

  return { mode, config, greeting, accent };
}