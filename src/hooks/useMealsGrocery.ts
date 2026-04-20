// ═══════════════════════════════════════════════════════════
// Meals & Grocery Hooks — meal tracking, grocery lists
// ═══════════════════════════════════════════════════════════
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/data-access';
import { logger } from '../utils/logger';
import type { Meal, GroceryList, GroceryItem } from './useHealthTypes';

// ═══════════════════════════════════════════════════════════
// Meals Hook
// ═══════════════════════════════════════════════════════════
export function useMeals() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: rows, error } = await supabase
        .from('meals')
        .select('*')
        .eq('is_deleted', false)
        .order('date', { ascending: false })
        .limit(60);
      if (!cancelled) {
        if (error) logger.error('[useMeals]', error.message);
        setMeals((rows as Meal[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tick]);

  const addMeal = async (meal: Partial<Meal>) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;
    const { error } = await supabase.from('meals').insert({
      ...meal,
      user_id: user.user.id,
    });
    if (error) logger.error('[addMeal]', error.message);
    else refresh();
  };

  const updateMeal = async (id: string, updates: Partial<Meal>) => {
    const { error } = await supabase.from('meals').update(updates).eq('id', id);
    if (error) logger.error('[updateMeal]', error.message);
    else refresh();
  };

  const deleteMeal = async (id: string) => {
    await supabase.from('meals').update({ is_deleted: true }).eq('id', id);
    refresh();
  };

  return { meals, loading, refresh, addMeal, updateMeal, deleteMeal };
}

// ═══════════════════════════════════════════════════════════
// Grocery Lists Hook (full CRUD)
// ═══════════════════════════════════════════════════════════
export function useGroceryLists() {
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: rows, error } = await supabase
        .from('grocery_lists')
        .select('*, grocery_items(*)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
      if (!cancelled) {
        if (error) logger.error('[useGroceryLists]', error.message);
        type ListRow = GroceryList & { grocery_items?: (GroceryItem & { is_deleted?: boolean })[] };
        setLists(((rows as ListRow[]) ?? []).map(r => ({
          ...r,
          items: r.grocery_items?.filter(i => !i.is_deleted).sort((a, b) => a.sort_order - b.sort_order) || [],
        })));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tick]);

  const createList = async (list: Partial<GroceryList>) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;
    const { items, ...listData } = list as Partial<GroceryList>;
    const { data: newList, error } = await supabase.from('grocery_lists')
      .insert({ ...listData, user_id: user.user.id, is_active: true })
      .select().single();
    if (error) logger.error('[createList]', error.message);
    else refresh();
    return newList;
  };

  const addItem = async (listId: string, item: Partial<GroceryItem>) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;
    // Get current max sort order
    const list = lists.find(l => l.id === listId);
    const maxOrder = list?.items?.reduce((max, i) => Math.max(max, i.sort_order), -1) ?? -1;
    
    const { error } = await supabase.from('grocery_items').insert({
      ...item,
      list_id: listId,
      user_id: user.user.id,
      checked: false,
      sort_order: maxOrder + 1,
    });
    if (error) logger.error('[addItem]', error.message);
    else refresh();
  };

  const toggleItem = async (itemId: string, checked: boolean) => {
    await supabase.from('grocery_items').update({ checked }).eq('id', itemId);
    refresh();
  };

  const updateItem = async (itemId: string, updates: Partial<GroceryItem>) => {
    const { error } = await supabase.from('grocery_items').update(updates).eq('id', itemId);
    if (error) logger.error('[updateItem]', error.message);
    else refresh();
  };

  const deleteItem = async (itemId: string) => {
    await supabase.from('grocery_items').update({ is_deleted: true }).eq('id', itemId);
    refresh();
  };

  const updateList = async (listId: string, updates: Partial<GroceryList>) => {
    const { items: _i, ...listUpdates } = updates as Partial<GroceryList>;
    const { error } = await supabase.from('grocery_lists').update(listUpdates).eq('id', listId);
    if (error) logger.error('[updateList]', error.message);
    else refresh();
  };

  const deleteList = async (listId: string) => {
    await supabase.from('grocery_lists').update({ is_deleted: true }).eq('id', listId);
    refresh();
  };

  const completeList = async (listId: string) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;

    const list = lists.find(l => l.id === listId);
    if (!list) return;

    const total = list.items?.reduce((sum, item) => sum + (item.actual_cost || item.estimated_cost || 0), 0) || 0;

    if (total > 0) {
      const { useFinanceStore } = await import('../stores/useFinanceStore');
      const expenseRecord = await useFinanceStore.getState().addExpense({
        user_id: user.user.id,
        amount: total,
        description: `Groceries — ${list.store || list.name}`,
        date: new Date().toISOString().split('T')[0],
      });

      if (expenseRecord) {
        await supabase.from('grocery_lists').update({
          expense_id: expenseRecord.id,
          actual_total: total,
          is_active: false,
          completed_at: new Date().toISOString(),
        }).eq('id', listId);
      }
    } else {
      await supabase.from('grocery_lists').update({
        is_active: false,
        completed_at: new Date().toISOString(),
      }).eq('id', listId);
    }

    refresh();
  };

  return { lists, loading, refresh, createList, addItem, toggleItem, updateItem, deleteItem, updateList, deleteList, completeList };
}
