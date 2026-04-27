-- Audit Log table for multi-user data change tracking (P7-005)
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  table_name text NOT NULL,
  record_id text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  created_at timestamptz DEFAULT now(),
  ip_address inet,
  user_agent text
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_table ON audit_log(table_name);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);