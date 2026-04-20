/**
 * LifeOS Intent Engine — Grocery Actions
 *
 * Handles grocery_add, grocery_remove, grocery_clear, grocery_check actions.
 */

import { supabase } from '../data-access';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function executeGroceryAdd(
  data: Record<string, unknown>,
  successes: string[],
  failures: string[],
): Promise<void> {
  const userId = data.user_id as string;
  let listId = data.list_id as string;
  if (!listId || !UUID_REGEX.test(listId)) {
    const { data: lists } = await supabase.from('grocery_lists')
      .select('id').eq('user_id', userId).eq('is_active', true).eq('is_deleted', false)
      .order('created_at', { ascending: false }).limit(1);
    if (lists?.length) {
      listId = lists[0].id;
    } else {
      const { data: newList, error: listErr } = await supabase.from('grocery_lists')
        .insert({ user_id: userId, name: 'Shopping List' }).select().single();
      if (listErr) throw listErr;
      listId = newList.id;
    }
  }
  const groceryItem = { user_id: userId, list_id: listId, name: data.name, quantity: data.quantity, estimated_cost: data.estimated_cost, category: data.category };
  const { error: giErr } = await supabase.from('grocery_items').insert(groceryItem);
  if (giErr) throw giErr;
  successes.push(`🛒 ${data.name} added to grocery list`);
}

export async function executeGroceryRemove(
  data: Record<string, unknown>,
  successes: string[],
  failures: string[],
): Promise<void> {
  const rmName = data.item_name as string;
  let rmQuery = supabase.from('grocery_items')
    .select('id,name')
    .eq('is_deleted', false)
    .ilike('name', `%${rmName}%`);
  if (data.list_id && UUID_REGEX.test(data.list_id as string)) {
    rmQuery = rmQuery.eq('list_id', data.list_id);
  }
  const { data: rmItems } = await rmQuery;
  if (!rmItems?.length) { failures.push(`❌ Item "${rmName}" not found on grocery list`); return; }
  for (const item of rmItems) {
    const { error: rmErr } = await supabase.from('grocery_items')
      .update({ is_deleted: true }).eq('id', item.id);
    if (rmErr) throw rmErr;
  }
  successes.push(`🗑️ Removed ${rmItems.length > 1 ? rmItems.length + ' items matching' : ''} "${rmName}" from grocery list`);
}

export async function executeGroceryClear(
  data: Record<string, unknown>,
  successes: string[],
  failures: string[],
): Promise<void> {
  let clearListId = data.list_id as string;
  if (!clearListId || !UUID_REGEX.test(clearListId)) {
    const { data: lists } = await supabase.from('grocery_lists')
      .select('id').eq('is_active', true).eq('is_deleted', false)
      .order('created_at', { ascending: false }).limit(1);
    if (!lists?.length) { failures.push(`❌ No active grocery list found`); return; }
    clearListId = lists[0].id;
  }
  const { data: clearItems, error: countErr } = await supabase.from('grocery_items')
    .select('id').eq('list_id', clearListId).eq('is_deleted', false);
  if (countErr) throw countErr;
  if (!clearItems?.length) { successes.push(`ℹ️ Grocery list is already empty`); return; }
  const { error: clearErr } = await supabase.from('grocery_items')
    .update({ is_deleted: true }).eq('list_id', clearListId).eq('is_deleted', false);
  if (clearErr) throw clearErr;
  successes.push(`🗑️ Cleared ${clearItems.length} items from grocery list`);
}

export async function executeGroceryCheck(
  data: Record<string, unknown>,
  successes: string[],
  failures: string[],
): Promise<void> {
  const itemName = data.item_name as string;
  const { data: items } = await supabase.from('grocery_items')
    .select('id,name').eq('is_deleted', false).eq('checked', false)
    .ilike('name', `%${itemName}%`).limit(1);
  if (!items?.length) { failures.push(`❌ Item "${itemName}" not found`); return; }
  const updates: Record<string, unknown> = { checked: true };
  if (data.actual_cost) updates.actual_cost = data.actual_cost;
  const { error: gcErr } = await supabase.from('grocery_items').update(updates).eq('id', items[0].id);
  if (gcErr) throw gcErr;
  successes.push(`✅ Checked off "${itemName}"`);
}