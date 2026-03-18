// ═══ Junction Action Hooks — practices, calendar, wisdom, logging ═══
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/useUserStore';
import { logger } from '../utils/logger';
import { getPracticeIconPath, getCalendarIconPath, getTimeContext } from './useJunctionHelpers';
import type {
  JunctionPractice, JunctionCalendarEntry, JunctionWisdomEntry,
} from './useJunctionTypes';

// ═══ Practices Hook ═══
export function useJunctionPractices(traditionId?: string, currentTier?: number) {
  const [practices, setPractices] = useState<JunctionPractice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!traditionId) { setPractices([]); setLoading(false); return; }

    const fetch = async () => {
      setLoading(true);
      
      // Fetch tradition to get slug
      const { data: traditionData } = await supabase
        .from('junction_traditions')
        .select('slug')
        .eq('id', traditionId)
        .single();
      
      const traditionSlug = traditionData?.slug || null;
      
      const { data } = await supabase
        .from('junction_practices')
        .select('*')
        .eq('tradition_id', traditionId)
        .lte('tier_required', currentTier ?? 0)
        .order('tier_required', { ascending: true });

      setPractices((data || []).map((p: any) => ({
        id: p.id,
        tradition_id: p.tradition_id,
        name: p.name,
        description: p.description || '',
        icon: p.icon || getPracticeIconPath(traditionSlug, p.type || 'prayer', p.id),
        xp_reward: p.xp_value || 10,
        min_tier: p.tier_required || 0,
        duration_default: p.duration_min || 15,
        category: p.type || 'general',
        frequency: p.frequency || 'daily',
        time_of_day: p.time_of_day,
      })));
      setLoading(false);
    };
    fetch();
  }, [traditionId, currentTier]);

  return { practices, loading };
}

// ═══ Calendar Hook ═══
export function useJunctionCalendar(traditionId?: string) {
  const [entries, setEntries] = useState<JunctionCalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!traditionId) { setEntries([]); setLoading(false); return; }

    const fetch = async () => {
      setLoading(true);
      const now = new Date();
      const currentMonth = now.getMonth() + 1; // 1-indexed
      const currentDay = now.getDate();
      
      // Fetch fixed-date entries that match today
      const { data } = await supabase
        .from('junction_calendar')
        .select('*')
        .eq('tradition_id', traditionId)
        .eq('fixed_month', currentMonth)
        .eq('fixed_day', currentDay);

      setEntries((data || []).map((e: any) => {
        const type = e.significance || e.date_type || 'observance';
        return {
          id: e.id,
          tradition_id: e.tradition_id,
          name: e.name,
          description: e.description || '',
          date_type: e.date_type,
          fixed_month: e.fixed_month,
          fixed_day: e.fixed_day,
          significance: e.significance,
          icon: e.icon || getCalendarIconPath(type),
          type,
          color: e.color,
        };
      }));
      setLoading(false);
    };
    fetch();
  }, [traditionId]);

  return { entries, loading };
}

// ═══ Wisdom Hook ═══
export function useJunctionWisdom(traditionId?: string) {
  const [wisdom, setWisdom] = useState<JunctionWisdomEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!traditionId) { setWisdom(null); setLoading(false); return; }

    const fetch = async () => {
      setLoading(true);
      const timeCtx = getTimeContext();
      
      // Fetch wisdom entries, preferring ones with matching context_tags
      const { data } = await supabase
        .from('junction_wisdom')
        .select('*')
        .eq('tradition_id', traditionId);

      if (data && data.length > 0) {
        // Prefer entries with matching time context tag, fall back to any
        const contextMatches = data.filter((w: any) => 
          Array.isArray(w.context_tags) && w.context_tags.includes(timeCtx)
        );
        const pool = contextMatches.length > 0 ? contextMatches : data;
        
        // Pick a semi-random one (changes every hour, consistent within the hour)
        const seed = new Date().toISOString().slice(0, 13);
        const index = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % pool.length;
        const w = pool[index];
        setWisdom({
          id: w.id,
          tradition_id: w.tradition_id,
          text: w.text,
          source: w.source || '',
          context_tags: w.context_tags || [],
          time_context: timeCtx,
        });
      } else {
        setWisdom(null);
      }
      setLoading(false);
    };
    fetch();
  }, [traditionId]);

  return { wisdom, loading };
}

// ═══ Log Practice ═══
export function useLogPractice() {
  const user = useUserStore(s => s.user);
  const [logging, setLogging] = useState(false);

  const logPractice = useCallback(async (
    practiceId: string,
    durationMin: number,
    notes?: string,
    xpReward: number = 10
  ) => {
    if (!user?.id) return null;
    setLogging(true);

    try {
      // Get user's tradition_id for the log
      const { data: ujData } = await supabase
        .from('user_junction')
        .select('tradition_id')
        .eq('user_id', user.id)
        .maybeSingle();

      // Insert log — schema: id, user_id, practice_id, tradition_id, date, duration_min, xp_earned, notes, created_at
      const { error: logErr } = await supabase.from('user_junction_log').insert({
        user_id: user.id,
        practice_id: practiceId,
        tradition_id: ujData?.tradition_id || null,
        date: new Date().toISOString().slice(0, 10),
        duration_min: durationMin,
        xp_earned: xpReward,
        notes: notes || null,
      });
      if (logErr) {
        logger.warn('[Junction] Log insert error:', logErr);
      }

      // Update user junction XP
      const { data: currentJunction } = await supabase
        .from('user_junction')
        .select('junction_xp, tradition_id, current_figure_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (currentJunction) {
        const currentXPVal = currentJunction.junction_xp || 0;
        const newXP = currentXPVal + xpReward;

        // Check if we should unlock a new figure
        const { data: nextFig } = await supabase
          .from('junction_figures')
          .select('id, xp_required')
          .eq('tradition_id', currentJunction.tradition_id)
          .gt('xp_required', currentXPVal)
          .lte('xp_required', newXP)
          .order('xp_required', { ascending: false })
          .limit(1);

        const updatePayload: Record<string, any> = { junction_xp: newXP };
        if (nextFig && nextFig.length > 0) {
          updatePayload.current_figure_id = nextFig[0].id;
        }

        await supabase
          .from('user_junction')
          .update(updatePayload)
          .eq('user_id', user.id);

        return {
          xpAwarded: xpReward,
          newTotalXP: newXP,
          figureUnlocked: nextFig && nextFig.length > 0 ? nextFig[0] : null,
        };
      }

      return { xpAwarded: xpReward, newTotalXP: xpReward, figureUnlocked: null };
    } catch (err: unknown) {
      logger.error('[Junction] Error logging practice:', err);
      return null;
    } finally {
      setLogging(false);
    }
  }, [user?.id]);

  return { logPractice, logging };
}
