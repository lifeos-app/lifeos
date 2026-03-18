// ═══════════════════════════════════════════════════════════
// Wellbeing Hooks — meditation, gratitude
// ═══════════════════════════════════════════════════════════
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import type { MeditationLog, GratitudeEntry } from './useHealthTypes';

// ═══════════════════════════════════════════════════════════
// Meditation Hook
// ═══════════════════════════════════════════════════════════
export function useMeditation() {
  const [logs, setLogs] = useState<MeditationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: rows, error } = await supabase.from('meditation_logs').select('*').eq('is_deleted', false).order('date', { ascending: false }).limit(30);
      if (!cancelled) {
        if (error) logger.error('[useMeditation]', error.message);
        setLogs((rows as MeditationLog[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tick]);

  const logMeditation = async (log: Partial<MeditationLog>) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;
    await supabase.from('meditation_logs').insert({ ...log, user_id: user.user.id });
    refresh();
  };

  return { logs, loading, refresh, logMeditation };
}

// ═══════════════════════════════════════════════════════════
// Gratitude Hook
// ═══════════════════════════════════════════════════════════
export function useGratitude() {
  const [entries, setEntries] = useState<GratitudeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: rows, error } = await supabase.from('gratitude_entries').select('*').eq('is_deleted', false).order('date', { ascending: false }).limit(30);
      if (!cancelled) {
        if (error) logger.error('[useGratitude]', error.message);
        setEntries((rows as GratitudeEntry[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tick]);

  const addGratitude = async (entry: Partial<GratitudeEntry>) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;

    const { data: newEntry, error } = await supabase.from('gratitude_entries')
      .insert({ ...entry, user_id: user.user.id })
      .select().single();

    if (error) { logger.error('[addGratitude]', error.message); return; }

    if (newEntry) {
      await supabase.from('journal_entries').insert({
        user_id: user.user.id,
        title: `🙏 Gratitude`,
        content: entry.entry,
        mood: 'grateful',
        created_at: new Date().toISOString(),
      }).then(({ error: jErr }) => {
        if (jErr) logger.warn('[gratitude→journal]', jErr.message);
      });
    }

    refresh();
  };

  return { entries, loading, refresh, addGratitude };
}
