-- ═══════════════════════════════════════════════════════════
-- 007: Vehicles table — equipment loadout for travel tracking
-- ═══════════════════════════════════════════════════════════
-- Each user can have multiple vehicles. The "equipped" vehicle
-- is used for travel event calculations (fuel cost, efficiency, deductions).

CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Vehicle identity
  name TEXT NOT NULL,                    -- e.g. "Nissan Dualis"
  make TEXT,                             -- e.g. "Nissan"
  model TEXT,                            -- e.g. "Dualis"
  year INTEGER,                          -- e.g. 2010
  color TEXT,                            -- e.g. "Black"
  registration TEXT,                     -- e.g. "ABC123"
  
  -- Fuel & efficiency
  fuel_type TEXT DEFAULT 'petrol',       -- petrol | diesel | electric | hybrid | lpg
  fuel_grade TEXT,                       -- e.g. "95", "98", "E10"
  tank_capacity_litres NUMERIC(6,1),    -- e.g. 55.0
  avg_consumption_per_100km NUMERIC(5,1), -- e.g. 8.5 L/100km
  
  -- Odometer
  current_odometer INTEGER,              -- latest reading in km
  last_odometer_update TIMESTAMPTZ,
  
  -- Service tracking
  last_service_km INTEGER,
  service_interval_km INTEGER DEFAULT 10000,
  last_service_date DATE,
  
  -- Status
  is_equipped BOOLEAN DEFAULT false,     -- the "active" vehicle for travel events
  is_deleted BOOLEAN DEFAULT false,
  
  -- ATO deduction tracking (Australia-specific)
  ato_method TEXT DEFAULT 'cents_per_km', -- cents_per_km | logbook
  ato_rate_per_km NUMERIC(4,2) DEFAULT 0.88, -- 2025-26 rate
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own vehicles"
  ON vehicles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_vehicles_user ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_equipped ON vehicles(user_id, is_equipped) WHERE is_equipped = true;

-- Ensure only one vehicle is equipped per user
CREATE OR REPLACE FUNCTION ensure_single_equipped_vehicle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_equipped = true THEN
    UPDATE vehicles 
    SET is_equipped = false, updated_at = NOW()
    WHERE user_id = NEW.user_id 
      AND id != NEW.id 
      AND is_equipped = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_single_equipped_vehicle
  BEFORE INSERT OR UPDATE OF is_equipped ON vehicles
  FOR EACH ROW
  WHEN (NEW.is_equipped = true)
  EXECUTE FUNCTION ensure_single_equipped_vehicle();

-- Link travel events to vehicles (add column to schedule_events)
-- Using ALTER to be additive (never break existing data)
DO $$ BEGIN
  ALTER TABLE schedule_events ADD COLUMN vehicle_id UUID REFERENCES vehicles(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

COMMENT ON TABLE vehicles IS 'Vehicle equipment loadout — the "equipped" vehicle powers travel calculations';
COMMENT ON COLUMN vehicles.is_equipped IS 'Only one vehicle per user can be equipped at a time (active for travel)';
COMMENT ON COLUMN vehicles.ato_rate_per_km IS 'ATO cents-per-km rate for tax deductions — update annually';
