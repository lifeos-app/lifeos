/**
 * Audit Log Types — P7-005
 */

export interface AuditLogEntry {
  id: string;
  user_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table_name: string;
  record_id: string;
  old_data?: Record<string, any>;
  new_data?: Record<string, any>;
  changed_fields?: string[];
  created_at: string;
}

export interface AuditLogFilter {
  tableName?: string;
  action?: 'INSERT' | 'UPDATE' | 'DELETE';
  since?: string;
  limit?: number;
}