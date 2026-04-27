/**
 * Database Type Definitions
 * 
 * TypeScript interfaces for all major database tables in LifeOS.
 * Use these to replace 'any' types throughout the codebase.
 */

// ──────────────────────────────────────────────────────────────────
// Goals & Tasks
// ──────────────────────────────────────────────────────────────────

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  status: GoalStatus;
  domain?: string;
  category?: string;
  financial_type?: string;
  parent_goal_id: string | null;
  budget_allocated?: number;
  progress?: number;
  target_date: string | null;
  created_at: string;
  updated_at?: string;
  is_deleted: boolean;
  source?: 'manual' | 'onboarding_ai';

  // Goals Revolution
  decomposition_source?: string;
  estimated_hours?: number;
  health_status?: string;
}

export interface Task {
  id: string;
  user_id: string;
  goal_id?: string;
  title: string;
  description?: string;
  status: TaskStatus;

  // Priority field (existing - maps to P1-P4 in UI)
  priority?: 'low' | 'medium' | 'high' | 'urgent';

  due_date?: string;
  scheduled_date?: string;

  // Subtask support
  parent_task_id?: string;
  depth_level?: number;  // 0 = root task, 1 = subtask, 2 = sub-subtask

  // Board view fields
  board_status?: 'todo' | 'in_progress' | 'done';
  board_position?: number;

  estimated_duration?: number;
  actual_duration?: number;
  tags?: string[];
  created_at: string;
  updated_at?: string;
  completed_at?: string;
  is_deleted: boolean;
  source?: 'manual' | 'onboarding_ai';

  // Goals Revolution (WS1/WS2)
  depends_on_task_id?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  energy_level?: string;
  domain?: string;
  suggested_week?: number;
  auto_scheduled?: boolean;
}

// Extended task with subtask progress (from tasks_with_progress view)
export interface TaskWithProgress extends Task {
  subtask_count: number;
  subtasks_completed: number;
  subtask_progress_percent: number | null;
}

// ──────────────────────────────────────────────────────────────────
// Habits
// ──────────────────────────────────────────────────────────────────

export interface Habit {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  target_count?: number;
  streak_current: number;
  streak_best: number;
  category?: string;
  time_of_day?: string;
  duration_minutes?: number;
  goal_id?: string;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at?: string;
  source?: 'manual' | 'onboarding_ai';
}

export interface HabitLog {
  id: string;
  user_id: string;
  habit_id: string;
  date: string;
  count: number;
  notes?: string;
  created_at: string;
}

// ──────────────────────────────────────────────────────────────────
// Schedule & Events
// ──────────────────────────────────────────────────────────────────

export interface ScheduleEvent {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  date: string;
  event_type?: 'task' | 'habit' | 'meeting' | 'block' | 'custom' | 'exercise' | 'workout' | 'meal' | 'sleep' | 'meditation' | 'prayer' | 'education' | 'travel' | 'health' | 'social' | 'work' | 'personal' | 'financial' | 'general' | 'fasting' | 'observance' | 'reading';
  category?: string;
  task_id?: string;
  habit_id?: string;
  location?: string;
  notes?: string;
  day_type?: string;
  recurrence_rule?: string;
  is_recurring: boolean;
  status?: 'scheduled' | 'completed' | 'cancelled' | 'live';
  color?: string;
  /** Source of event (e.g. 'google' for Google Calendar imports) */
  source?: string;
  /** Link to external source (e.g. Google Calendar HTML link) */
  htmlLink?: string;
  metadata?: Record<string, unknown>;
  schedule_layer?: string;
  created_at: string;
  updated_at?: string;
  is_deleted: boolean;
}

// ──────────────────────────────────────────────────────────────────
// Health
// ──────────────────────────────────────────────────────────────────

export interface HealthMetric {
  id: string;
  user_id: string;
  date: string;
  mood_score?: number;
  energy_score?: number;
  stress_score?: number;
  sleep_hours?: number;
  sleep_quality?: number;
  water_glasses?: number;
  weight_kg?: number;
  exercise_minutes?: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface WorkoutTemplate {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  day_of_week?: number;
  preferred_time?: string;
  duration_minutes?: number;
  exercises?: Record<string, unknown>[]; // JSONB
  is_active: boolean;
  created_at: string;
}

// ──────────────────────────────────────────────────────────────────
// Finance
// ──────────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  user_id: string;
  type: 'income' | 'expense';
  amount: number;
  title?: string;
  date: string;
  category_id?: string;
  business_id?: string;
  client_id?: string;
  task_id?: string;
  event_id?: string;
  notes?: string;
  recurring: boolean;
  created_at: string;
  updated_at?: string;
}

export interface RecurringTransaction {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  amount: number;
  category?: string;
  category_id?: string;
  frequency: 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';
  next_due?: string;
  is_active: boolean;
  business_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface Bill {
  id: string;
  user_id: string;
  title: string;
  amount: number;
  due_date?: string;
  category?: string;
  category_id?: string;
  is_recurring: boolean;
  recurrence_rule?: string;
  status: 'pending' | 'paid' | 'overdue';
  is_deleted: boolean;
  created_at: string;
}

export interface Business {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  industry?: string;
  revenue_model?: string;
  monthly_revenue?: number;
  monthly_expenses?: number;
  status?: string;
  icon?: string;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
}

// ──────────────────────────────────────────────────────────────────
// Journal
// ──────────────────────────────────────────────────────────────────

export interface JournalEntry {
  id: string;
  user_id: string;
  date: string;
  title?: string;
  content?: string;
  mood: number | null;
  energy: number | null;
  /** Tag array — may be string (comma-separated legacy) or string[] (JSONB array) */
  tags: string | string[];
  created_at: string;
  updated_at?: string;
  is_deleted: boolean;
}

// ──────────────────────────────────────────────────────────────────
// User & Profile
// ──────────────────────────────────────────────────────────────────

export interface UserProfile {
  user_id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  timezone?: string;
  subscription_tier: 'free' | 'pro' | 'enterprise';
  stripe_customer_id?: string;
  subscription_id?: string;
  subscription_expires_at?: string;
  preferences?: Record<string, unknown>; // JSONB
  onboarding_complete: boolean;
  created_at: string;
  updated_at?: string;
}

// ──────────────────────────────────────────────────────────────────
// Gamification
// ──────────────────────────────────────────────────────────────────

export interface UserXP {
  user_id: string;
  total_xp: number;
  level: number;
  current_level_xp: number;
  next_level_xp: number;
  updated_at: string;
}

export interface Achievement {
  id: string;
  code: string;
  title: string;
  description?: string;
  icon?: string;
  xp_reward: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  category?: string;
}

// ──────────────────────────────────────────────────────────────────
// AI & Chat
// ──────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Record<string, unknown>[]; // JSONB
  created_at: string;
}

export interface ChatAttachment {
  id: string;
  user_id: string;
  message_id?: string;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size?: number;
  created_at: string;
}

// ──────────────────────────────────────────────────────────────────
// Social
// ──────────────────────────────────────────────────────────────────

export interface Partnership {
  id: string;
  user_id: string;
  partner_id: string;
  connection_type?: string;
  status: 'pending' | 'active' | 'declined';
  shared_goals?: string[];
  created_at: string;
  updated_at?: string;
}

export interface PublicProfile {
  user_id: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  show_goals: boolean;
  show_habits: boolean;
  show_stats: boolean;
  show_level: boolean;
  show_streak: boolean;
  created_at: string;
  updated_at?: string;
}

// ──────────────────────────────────────────────────────────────────
// Finance (extended)
// ──────────────────────────────────────────────────────────────────

export interface IncomeEntry {
  id: string;
  amount: number;
  date: string;
  description: string;
  source: string;
  client_id?: string | null;
  is_recurring: boolean;
  is_deleted: boolean;
  user_id?: string;
  created_at?: string;
}

export interface ExpenseEntry {
  id: string;
  user_id?: string;
  amount: number;
  description: string;
  category_id?: string | null;
  date: string;
  is_deductible: boolean;
  is_deleted: boolean;
  is_recurring?: boolean;
  travel_km?: number | null;
  receipt_url?: string | null;
  payment_method?: string | null;
  sync_status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Client {
  id: string;
  name: string;
  business_id?: string | null;
  rate?: number | null;
  is_active: boolean;
  is_deleted: boolean;
  user_id?: string;
  created_at?: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  scope: string;
  budget_monthly?: number | null;
  sort_order: number;
  user_id?: string;
  created_at?: string;
}

export interface Budget {
  id?: string;
  month: string;
  category_id: string;
  amount: number;
  user_id?: string;
  created_at?: string;
}

// ──────────────────────────────────────────────────────────────────
// Assets
// ──────────────────────────────────────────────────────────────────

export type AssetType = 'property' | 'vehicle' | 'device' | 'document' | 'membership' | 'insurance' | 'other';
export type MaintenanceFrequency = 'one_time' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'biannual' | 'yearly';
export type BillCategory = 'electricity' | 'gas' | 'water' | 'internet' | 'phone' | 'insurance' |
  'registration' | 'mortgage' | 'rent' | 'rates' | 'subscription' | 'maintenance' | 'fuel' |
  'parking' | 'tolls' | 'other';
export type DocType = 'registration' | 'insurance' | 'warranty' | 'receipt' | 'manual' |
  'certificate' | 'license' | 'passport' | 'visa' | 'permit' | 'contract' | 'invoice' | 'photo' | 'other';

export interface Asset {
  id: string;
  user_id: string;
  asset_type: AssetType;
  name: string;
  nickname?: string | null;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  image_url?: string | null;
  is_equipped: boolean;
  is_archived: boolean;
  is_deleted: boolean;
  purchase_date?: string | null;
  purchase_price?: number | null;
  current_value?: number | null;
  currency: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AssetMaintenance {
  id: string;
  asset_id: string;
  user_id: string;
  title: string;
  description?: string | null;
  frequency: MaintenanceFrequency;
  next_due?: string | null;
  last_completed?: string | null;
  cost_estimate?: number | null;
  last_cost?: number | null;
  currency: string;
  auto_schedule: boolean;
  auto_task: boolean;
  reminder_days_before: number;
  is_completed: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssetBill {
  id: string;
  asset_id: string;
  user_id: string;
  provider: string;
  category: BillCategory;
  amount: number;
  currency: string;
  frequency: MaintenanceFrequency;
  next_due?: string | null;
  last_paid?: string | null;
  auto_pay: boolean;
  account_number?: string | null;
  notes?: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssetDocument {
  id: string;
  asset_id: string;
  user_id: string;
  doc_type: DocType;
  title: string;
  description?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_size_bytes?: number | null;
  reminder_days_before: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssetWithDetails extends Asset {
  maintenance: AssetMaintenance[];
  bills: AssetBill[];
  documents: AssetDocument[];
}

// ──────────────────────────────────────────────────────────────────
// Inventory
// ──────────────────────────────────────────────────────────────────

export type ItemCategory = 'clothing' | 'shoes' | 'accessories' | 'tech' | 'equipment' | 'pet' | 'fitness';
export type ListType = 'personal' | 'business' | 'pets' | 'fitness';
export type EquipSlot = 'head' | 'torso' | 'legs' | 'feet' | 'hands' | 'accessories' | 'companion';
export type ItemCondition = 'new' | 'good' | 'worn' | 'damaged';

export interface InventoryItem {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  category: ItemCategory;
  subcategory?: string | null;
  list_type: ListType;
  slot?: EquipSlot | null;
  brand?: string | null;
  color?: string | null;
  size?: string | null;
  image_url?: string | null;
  purchase_date?: string | null;
  purchase_price?: number | null;
  condition: ItemCondition;
  is_equipped: boolean;
  is_favorite: boolean;
  tags?: string[] | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface PetProfile {
  id: string;
  user_id: string;
  inventory_item_id?: string | null;
  name: string;
  species: string;
  breed?: string | null;
  birthday?: string | null;
  weight?: number | null;
  vet_name?: string | null;
  vet_phone?: string | null;
  next_vet_date?: string | null;
  feeding_schedule?: Record<string, unknown> | null;
  medications?: Record<string, unknown> | null;
  avatar_url?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  is_deleted: boolean;
}

// ──────────────────────────────────────────────────────────────────
// Supabase Response Types
// ──────────────────────────────────────────────────────────────────

export interface SupabaseResponse<T> {
  data: T | null;
  error: SupabaseError | null;
  count?: number | null;
  status: number;
  statusText: string;
}

export interface SupabaseError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

// ──────────────────────────────────────────────────────────────────
// Database Enums
// ──────────────────────────────────────────────────────────────────

export type GoalStatus = 'active' | 'in_progress' | 'completed' | 'done' | 'archived' | 'paused';
export type TaskStatus = 'todo' | 'pending' | 'in_progress' | 'done' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type HabitFrequency = 'daily' | 'weekly' | 'monthly';
export type EventType = 'task' | 'habit' | 'meeting' | 'block' | 'custom';
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';
export type TransactionType = 'income' | 'expense';
export type RecurringFrequency = 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';
export type BillStatus = 'pending' | 'paid' | 'overdue';
export type PartnershipStatus = 'pending' | 'active' | 'declined';
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type MessageRole = 'user' | 'assistant' | 'system';
export type DataSource = 'manual' | 'onboarding_ai';
