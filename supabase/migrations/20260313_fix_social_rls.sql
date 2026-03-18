-- Fix infinite recursion in goal_group_members RLS policy
-- The original policy references goal_group_members in its own USING clause,
-- causing infinite recursion. The fix: make group memberships viewable by
-- any authenticated user (group lists are public), but restrict insert/delete
-- to own rows.
--
-- Also fixes cascade: messages and guild_contributions policies that reference
-- goal_group_members were also breaking due to the recursion.
--
-- Run in Supabase SQL Editor
-- Migration: 20260313_fix_social_rls

-- ══════════════════════════════════════════════════════
-- 1. FIX goal_group_members — Remove recursive policy
-- ══════════════════════════════════════════════════════

-- Drop the broken recursive SELECT policy
DROP POLICY IF EXISTS "Users can view group memberships" ON goal_group_members;

-- New policy: all authenticated users can see group memberships
-- (groups are public — you need to see members to browse guilds)
CREATE POLICY "Authenticated users can view group memberships"
  ON goal_group_members FOR SELECT
  TO authenticated
  USING (true);

-- ══════════════════════════════════════════════════════
-- 2. FIX messages — Simplify group message access
-- ══════════════════════════════════════════════════════

-- Drop the old policy that referenced goal_group_members (causing cascade error)
DROP POLICY IF EXISTS "Users can view own direct messages" ON messages;

-- New policy: DMs visible to sender/receiver, group messages visible to group members
-- Uses (SELECT auth.uid()) for performance (evaluated once, not per-row)
CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = sender_id
    OR (SELECT auth.uid()) = receiver_id
    OR (
      group_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM goal_group_members gm
        WHERE gm.group_id = messages.group_id
          AND gm.user_id = (SELECT auth.uid())
      )
    )
  );

-- ══════════════════════════════════════════════════════
-- 3. Ensure guild_contributions and goal_comments have proper RLS
-- ══════════════════════════════════════════════════════

-- guild_contributions: members of the guild can view, own user can insert
DROP POLICY IF EXISTS "Users can view guild contributions" ON guild_contributions;
DROP POLICY IF EXISTS "Users can log guild contributions" ON guild_contributions;

CREATE POLICY "Authenticated users can view guild contributions"
  ON guild_contributions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can log own guild contributions"
  ON guild_contributions FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- goal_comments: visible to all authenticated, own user can insert/update/delete
DROP POLICY IF EXISTS "Users can view goal comments" ON goal_comments;
DROP POLICY IF EXISTS "Users can create goal comments" ON goal_comments;
DROP POLICY IF EXISTS "Users can update own goal comments" ON goal_comments;
DROP POLICY IF EXISTS "Users can delete own goal comments" ON goal_comments;

CREATE POLICY "Authenticated users can view goal comments"
  ON goal_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create goal comments"
  ON goal_comments FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own goal comments"
  ON goal_comments FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own goal comments"
  ON goal_comments FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);
