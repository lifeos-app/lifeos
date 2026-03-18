// ═══ Junction Data Hook — core tradition/figure/XP state ═══
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { getErrorMessage } from '../utils/error';
import { useUserStore } from '../stores/useUserStore';
import { logger } from '../utils/logger';
import type {
  JunctionTradition, JunctionFigure, UserJunction, JunctionXPProgress,
} from './useJunctionTypes';

export function useJunction() {
  const user = useUserStore(s => s.user);
  const [userJunction, setUserJunction] = useState<UserJunction | null>(null);
  const [tradition, setTradition] = useState<JunctionTradition | null>(null);
  const [figures, setFigures] = useState<JunctionFigure[]>([]);
  const [traditions, setTraditions] = useState<JunctionTradition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch all traditions
      const { data: tradData, error: tradErr } = await supabase
        .from('junction_traditions')
        .select('*')
        .order('name', { ascending: true });
      
      if (tradErr) {
        logger.warn('[Junction] Error fetching traditions:', tradErr);
        // Tables might not exist yet — use defaults
        setLoading(false);
        return;
      }

      const traditionsProcessed: JunctionTradition[] = (tradData || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        icon: t.icon || '🔮',
        description: t.description || '',
        color: t.color || '#A855F7',
        background_gradient: t.background_gradient,
        available: t.is_active ?? true,
        paths: Array.isArray(t.paths) ? t.paths.map((p: any, i: number) => ({
          id: p.id || `path-${i}`,
          name: p.name || `Path ${i + 1}`,
          description: p.description || '',
          icon: p.icon || '📿',
        })) : [],
        calendar_type: t.calendar_type || 'gregorian',
      }));
      setTraditions(traditionsProcessed);

      // Fetch user junction (filter active + limit 1 to avoid maybeSingle crash on duplicates)
      const { data: ujRows, error: ujError } = await supabase
        .from('user_junction')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);
      if (ujError) {
        logger.error('[Junction] Failed to fetch user junction:', ujError.message);
      }
      const ujData = ujRows?.[0] ?? null;

      if (ujData) {
        const uj: UserJunction = {
          id: ujData.id || ujData.user_id,
          user_id: ujData.user_id,
          tradition_id: ujData.tradition_id,
          path_id: ujData.path_id || null,
          junction_xp: ujData.junction_xp || 0,
          current_figure_id: ujData.current_figure_id || null,
          equipped_at: ujData.junctioned_at || ujData.created_at,
        };
        setUserJunction(uj);

        // Fetch figures for this tradition
        const { data: figData } = await supabase
          .from('junction_figures')
          .select('*')
          .eq('tradition_id', ujData.tradition_id)
          .order('sort_order', { ascending: true });

        const junctionXP = uj.junction_xp;
        const processedFigures: JunctionFigure[] = (figData || []).map((f: any) => ({
          id: f.id,
          tradition_id: f.tradition_id,
          name: f.name,
          title: f.title || '',
          bio: f.bio || '',
          icon: f.icon || '👤',
          tier: f.tier || 0,
          xp_required: f.xp_required || 0,
          feast_day: f.feast_day,
          sort_order: f.sort_order || 0,
          unlocked: junctionXP >= (f.xp_required || 0),
          is_current: f.id === uj.current_figure_id,
        }));
        setFigures(processedFigures);

        // Set tradition
        const matchedTradition = traditionsProcessed.find(t => t.id === ujData.tradition_id);
        setTradition(matchedTradition || null);
      } else {
        setUserJunction(null);
        setFigures([]);
        setTradition(null);
      }
    } catch (err: unknown) {
      logger.warn('[Junction] Error fetching data:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // XP Progress computation
  const xpProgress = useMemo((): JunctionXPProgress => {
    if (!userJunction || figures.length === 0) {
      return { currentXP: 0, xpToNextFigure: 100, progressPercent: 0, currentFigure: null, nextFigure: null };
    }

    const currentXP = userJunction.junction_xp;
    const currentFigure = figures.find(f => f.is_current) || figures.filter(f => f.unlocked).pop() || figures[0];
    
    // Find next locked figure
    const nextFigure = figures.find(f => !f.unlocked && f.xp_required > currentXP) || null;
    
    const xpToNextFigure = nextFigure ? nextFigure.xp_required : currentFigure?.xp_required || 100;
    const prevXP = currentFigure?.xp_required || 0;
    const range = xpToNextFigure - prevXP;
    const progressPercent = range > 0 ? Math.min(((currentXP - prevXP) / range) * 100, 100) : 100;

    return {
      currentXP,
      xpToNextFigure,
      progressPercent,
      currentFigure: currentFigure || null,
      nextFigure,
    };
  }, [userJunction, figures]);

  // Equip a junction
  const equipJunction = useCallback(async (traditionId: string, pathId: string | null) => {
    if (!user?.id) return;

    // Get first figure (lowest sort_order) for this tradition
    const { data: firstFig } = await supabase
      .from('junction_figures')
      .select('id')
      .eq('tradition_id', traditionId)
      .order('sort_order', { ascending: true })
      .limit(1);

    const firstFigureId = firstFig?.[0]?.id || null;

    // Schema: id, user_id, tradition_id, path_id, current_figure_id, junction_xp, junctioned_at, is_active, preferences
    const { error } = await supabase
      .from('user_junction')
      .upsert({
        user_id: user.id,
        tradition_id: traditionId,
        path_id: pathId,
        junction_xp: 0,
        current_figure_id: firstFigureId,
        junctioned_at: new Date().toISOString(),
        is_active: true,
        preferences: {},
      }, { onConflict: 'user_id' });

    if (error) throw error;
    await fetchAll();
  }, [user?.id, fetchAll]);

  // Unjunction (remove)
  const unjunction = useCallback(async () => {
    if (!user?.id) return;
    await supabase.from('user_junction').delete().eq('user_id', user.id);
    setUserJunction(null);
    setTradition(null);
    setFigures([]);
    await fetchAll();
  }, [user?.id, fetchAll]);

  // Switch guard ref
  const [switching, setSwitching] = useState(false);

  // Switch Junction (with cooldown and progress preservation)
  const switchJunction = useCallback(async (newTraditionId: string) => {
    if (!user?.id) return { error: 'Not logged in' };
    if (switching) return { error: 'Switch already in progress' };

    setSwitching(true);
    try {
      // Check cooldown: 1 switch per week
      const { data: current } = await supabase
        .from('user_junction')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);
      
      if (current?.length) {
        const lastSwitch = new Date(current[0].junctioned_at);
        const daysSince = (Date.now() - lastSwitch.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSince < 7) {
          const daysLeft = Math.ceil(7 - daysSince);
          return { error: `You can switch Junctions in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` };
        }
        
        // Deactivate current (but DON'T delete — progress is preserved)
        await supabase
          .from('user_junction')
          .update({ is_active: false })
          .eq('id', current[0].id);
      }
      
      // Check if user already has progress in the new junction
      const { data: existing } = await supabase
        .from('user_junction')
        .select('*')
        .eq('user_id', user.id)
        .eq('tradition_id', newTraditionId)
        .limit(1);
      
      if (existing?.length) {
        // Reactivate existing progress
        await supabase
          .from('user_junction')
          .update({ 
            is_active: true, 
            junctioned_at: new Date().toISOString() 
          })
          .eq('id', existing[0].id);
      } else {
        // Create new junction entry
        // Get first figure for this tradition
        const { data: firstFig } = await supabase
          .from('junction_figures')
          .select('id')
          .eq('tradition_id', newTraditionId)
          .order('sort_order', { ascending: true })
          .limit(1);

        const firstFigureId = firstFig?.[0]?.id || null;

        await supabase.from('user_junction').insert({
          user_id: user.id,
          tradition_id: newTraditionId,
          junction_xp: 0,
          is_active: true,
          junctioned_at: new Date().toISOString(),
          current_figure_id: firstFigureId,
          preferences: {},
        });
      }
      
      await fetchAll();
      return { success: true };
    } catch (err: unknown) {
      logger.error('[Junction] Error switching:', err);
      return { error: getErrorMessage(err) };
    } finally {
      setSwitching(false);
    }
  }, [user?.id, fetchAll, switching]);

  return {
    userJunction,
    tradition,
    traditions,
    figures,
    xpProgress,
    loading,
    error,
    equipJunction,
    unjunction,
    switchJunction,
    refresh: fetchAll,
    isEquipped: !!userJunction,
  };
}
