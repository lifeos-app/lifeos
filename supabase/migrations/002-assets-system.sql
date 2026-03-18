-- ══════════════════════════════════════════════════
-- LifeOS Assets System — "Equip Your Life"
-- 
-- Master asset table + maintenance, bills, documents
-- Everything you own is "equipped" to your character.
-- Each asset is a portal to its data, upkeep, and costs.
-- ══════════════════════════════════════════════════

-- ── Master Assets Table ──────────────────────────
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Core identity
  asset_type TEXT NOT NULL CHECK (asset_type IN (
    'property', 'vehicle', 'device', 'document', 'membership', 'insurance', 'other'
  )),
  name TEXT NOT NULL,
  nickname TEXT,
  description TEXT,
  icon TEXT,              -- emoji or lucide icon name
  color TEXT,             -- hex color for UI accent
  image_url TEXT,
  
  -- State
  is_equipped BOOLEAN NOT NULL DEFAULT true,  -- shown on character page
  is_archived BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  
  -- Financial
  purchase_date DATE,
  purchase_price NUMERIC(12,2),
  current_value NUMERIC(12,2),
  currency TEXT DEFAULT 'AUD',
  
  -- Type-specific metadata (flexible JSONB)
  -- Vehicle: { make, model, year, rego_plate, rego_expiry, fuel_type, fuel_grade,
  --            tank_capacity_litres, avg_consumption_per_100km, current_odometer,
  --            ato_rate_per_km, insurance_provider, insurance_policy_number }
  -- Property: { address, suburb, state, postcode, property_type, bedrooms, bathrooms,
  --             land_size_sqm, floor_plan_url, mortgage_provider, mortgage_balance,
  --             rent_amount, is_owned }
  -- Device: { make, model, serial_number, warranty_expiry, os, storage_gb }
  -- Document: { document_number, issuing_authority, issue_date, expiry_date,
  --             category: passport|license|certification|visa|permit }
  -- Membership: { provider, plan_name, billing_cycle, monthly_cost, auto_renew,
  --              login_url, member_id }
  -- Insurance: { provider, policy_number, policy_type, premium_amount, premium_frequency,
  --             coverage_amount, excess_amount, expiry_date, linked_asset_id }
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Asset Maintenance ────────────────────────────
-- Recurring upkeep tasks linked to any asset
CREATE TABLE IF NOT EXISTS asset_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  description TEXT,
  
  -- Schedule
  frequency TEXT NOT NULL CHECK (frequency IN (
    'one_time', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'biannual', 'yearly'
  )),
  next_due DATE,
  last_completed DATE,
  
  -- Cost
  cost_estimate NUMERIC(10,2),
  last_cost NUMERIC(10,2),
  currency TEXT DEFAULT 'AUD',
  
  -- Automation
  auto_schedule BOOLEAN NOT NULL DEFAULT false,  -- auto-create schedule events
  auto_task BOOLEAN NOT NULL DEFAULT false,      -- auto-create tasks
  reminder_days_before INTEGER DEFAULT 7,        -- nudge N days before due
  
  -- State
  is_completed BOOLEAN NOT NULL DEFAULT false,   -- for one_time items
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Asset Bills ──────────────────────────────────
-- Recurring bills/costs linked to any asset
CREATE TABLE IF NOT EXISTS asset_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Bill details
  provider TEXT NOT NULL,       -- "AGL", "Telstra", etc.
  category TEXT NOT NULL CHECK (category IN (
    'electricity', 'gas', 'water', 'internet', 'phone', 'insurance',
    'registration', 'mortgage', 'rent', 'rates', 'subscription',
    'maintenance', 'fuel', 'parking', 'tolls', 'other'
  )),
  
  -- Amount
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'AUD',
  frequency TEXT NOT NULL CHECK (frequency IN (
    'weekly', 'fortnightly', 'monthly', 'quarterly', 'biannual', 'yearly', 'one_time'
  )),
  
  -- Dates
  next_due DATE,
  last_paid DATE,
  
  -- Options
  auto_pay BOOLEAN NOT NULL DEFAULT false,
  account_number TEXT,
  notes TEXT,
  
  -- State
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Asset Documents ──────────────────────────────
-- Files/certificates/papers attached to any asset
CREATE TABLE IF NOT EXISTS asset_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Document details
  doc_type TEXT NOT NULL CHECK (doc_type IN (
    'registration', 'insurance', 'warranty', 'receipt', 'manual',
    'certificate', 'license', 'passport', 'visa', 'permit',
    'contract', 'invoice', 'photo', 'other'
  )),
  title TEXT NOT NULL,
  description TEXT,
  
  -- Dates
  issue_date DATE,
  expiry_date DATE,
  
  -- File
  file_url TEXT,
  file_name TEXT,
  file_size_bytes BIGINT,
  
  -- Alerts
  reminder_days_before INTEGER DEFAULT 30,  -- alert N days before expiry
  
  -- State
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_assets_user ON assets(user_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(user_id, asset_type) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_assets_equipped ON assets(user_id) WHERE is_equipped AND NOT is_deleted;

CREATE INDEX IF NOT EXISTS idx_asset_maintenance_asset ON asset_maintenance(asset_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_asset_maintenance_user ON asset_maintenance(user_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_asset_maintenance_due ON asset_maintenance(user_id, next_due) WHERE NOT is_deleted AND NOT is_completed;

CREATE INDEX IF NOT EXISTS idx_asset_bills_asset ON asset_bills(asset_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_asset_bills_user ON asset_bills(user_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_asset_bills_due ON asset_bills(user_id, next_due) WHERE NOT is_deleted;

CREATE INDEX IF NOT EXISTS idx_asset_documents_asset ON asset_documents(asset_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_asset_documents_user ON asset_documents(user_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_asset_documents_expiry ON asset_documents(user_id, expiry_date) WHERE NOT is_deleted AND expiry_date IS NOT NULL;

-- ── RLS Policies ─────────────────────────────────
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_documents ENABLE ROW LEVEL SECURITY;

-- Assets
CREATE POLICY assets_select_own ON assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY assets_insert_own ON assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY assets_update_own ON assets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY assets_delete_own ON assets FOR DELETE USING (auth.uid() = user_id);

-- Maintenance
CREATE POLICY asset_maintenance_select_own ON asset_maintenance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY asset_maintenance_insert_own ON asset_maintenance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY asset_maintenance_update_own ON asset_maintenance FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY asset_maintenance_delete_own ON asset_maintenance FOR DELETE USING (auth.uid() = user_id);

-- Bills
CREATE POLICY asset_bills_select_own ON asset_bills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY asset_bills_insert_own ON asset_bills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY asset_bills_update_own ON asset_bills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY asset_bills_delete_own ON asset_bills FOR DELETE USING (auth.uid() = user_id);

-- Documents
CREATE POLICY asset_documents_select_own ON asset_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY asset_documents_insert_own ON asset_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY asset_documents_update_own ON asset_documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY asset_documents_delete_own ON asset_documents FOR DELETE USING (auth.uid() = user_id);

-- ── Updated_at trigger ───────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER assets_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER asset_maintenance_updated_at BEFORE UPDATE ON asset_maintenance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER asset_bills_updated_at BEFORE UPDATE ON asset_bills FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER asset_documents_updated_at BEFORE UPDATE ON asset_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
