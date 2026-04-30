/**
 * health-device-import.ts — Health Data File Import Framework
 *
 * P7-022: Parses health data exports from popular devices/services
 * (CSV, Apple Health XML, Google Fit JSON) and converts them into
 * HealthRecord objects that can be inserted into the local DB / store.
 *
 * Pure TypeScript — no external XML/JSON parsing libraries.
 */

import { localInsert } from './local-db';
import { getEffectiveUserId } from './local-db';
import { genId } from '../utils/date';
import { logger } from '../utils/logger';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export type HealthMetricType =
  | 'heart_rate'
  | 'steps'
  | 'sleep'
  | 'weight'
  | 'blood_pressure'
  | 'blood_oxygen'
  | 'calories'
  | 'water'
  | 'exercise';

export type DeviceId =
  | 'apple_watch'
  | 'fitbit'
  | 'garmin'
  | 'google_fit'
  | 'samsung_health'
  | 'oura'
  | 'whoop'
  | 'manual';

export interface HealthRecord {
  date: string;           // ISO date string (YYYY-MM-DD)
  type: HealthMetricType;
  value: number;
  unit: string;
  source: DeviceId;
  deviceId: DeviceId;
}

export interface DeviceMetadata {
  id: DeviceId;
  name: string;
  lastSync: string | null;
  recordCount: number;
}

export interface ValidationResults {
  valid: HealthRecord[];
  invalid: { record: Partial<HealthRecord>; error: string }[];
}

/** Mapping from Apple Health HK type strings to our HealthMetricType */
const APPLE_HEALTH_TYPE_MAP: Record<string, HealthMetricType> = {
  'HKQuantityTypeIdentifierHeartRate': 'heart_rate',
  'HKQuantityTypeIdentifierStepCount': 'steps',
  'HKCategoryTypeIdentifierSleepAnalysis': 'sleep',
  'HKQuantityTypeIdentifierBodyMass': 'weight',
  'HKQuantityTypeIdentifierBloodPressureSystolic': 'blood_pressure',
  'HKQuantityTypeIdentifierBloodPressureDiastolic': 'blood_pressure',
  'HKQuantityTypeIdentifierOxygenSaturation': 'blood_oxygen',
  'HKQuantityTypeIdentifierActiveEnergyBurned': 'calories',
  'HKQuantityTypeIdentifierBasalEnergyBurned': 'calories',
  'HKQuantityTypeIdentifierDietaryWater': 'water',
  'HKQuantityTypeIdentifierAppleExerciseTime': 'exercise',
};

/** Mapping from Google Fit metric names to our HealthMetricType */
const GOOGLE_FIT_TYPE_MAP: Record<string, HealthMetricType> = {
  'heart_rate': 'heart_rate',
  'heart_rate.bpm': 'heart_rate',
  'steps': 'steps',
  'step_count': 'steps',
  'sleep': 'sleep',
  'sleep_segment': 'sleep',
  'weight': 'weight',
  'weight.kg': 'weight',
  'blood_pressure': 'blood_pressure',
  'blood_pressure_systolic': 'blood_pressure',
  'blood_pressure_diastolic': 'blood_pressure',
  'blood_oxygen': 'blood_oxygen',
  'oxygen_saturation': 'blood_oxygen',
  'calories': 'calories',
  'calories_burned': 'calories',
  'active_calories': 'calories',
  'water': 'water',
  'water_intake': 'water',
  'hydration': 'water',
  'exercise': 'exercise',
  'activity': 'exercise',
  'workout': 'exercise',
  'active_minutes': 'exercise',
};

/** Friendly names for CSV type columns */
const CSV_TYPE_MAP: Record<string, HealthMetricType> = {
  'heart_rate': 'heart_rate',
  'heart rate': 'heart_rate',
  'heart_rate_bpm': 'heart_rate',
  'hr': 'heart_rate',
  'steps': 'steps',
  'step_count': 'steps',
  'sleep': 'sleep',
  'sleep_hours': 'sleep',
  'weight': 'weight',
  'weight_kg': 'weight',
  'blood_pressure': 'blood_pressure',
  'bp': 'blood_pressure',
  'blood_oxygen': 'blood_oxygen',
  'spo2': 'blood_oxygen',
  'oxygen_saturation': 'blood_oxygen',
  'calories': 'calories',
  'calories_burned': 'calories',
  'active_calories': 'calories',
  'water': 'water',
  'water_glasses': 'water',
  'hydration': 'water',
  'exercise': 'exercise',
  'exercise_minutes': 'exercise',
  'active_minutes': 'exercise',
  'workout_minutes': 'exercise',
};

const DEVICE_NAMES: Record<DeviceId, string> = {
  apple_watch: 'Apple Watch',
  fitbit: 'Fitbit',
  garmin: 'Garmin',
  google_fit: 'Google Fit',
  samsung_health: 'Samsung Health',
  oura: 'Oura',
  whoop: 'Whoop',
  manual: 'Manual Entry',
};

const IMPORT_HISTORY_KEY = 'lifeos_health_import_history';

// ──────────────────────────────────────────────────────────────
// HealthDataImport class
// ──────────────────────────────────────────────────────────────

export class HealthDataImport {
  /**
   * Parse CSV with columns: date, type, value, unit
   * Supports header or headerless rows.
   */
  parseCSV(text: string, deviceId: DeviceId = 'manual'): HealthRecord[] {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length === 0) return [];

    const records: HealthRecord[] = [];
    // Detect if first line is header
    const firstLine = lines[0].toLowerCase();
    const hasHeader = /^(date|type|value|unit|timestamp)/.test(firstLine);
    const startIdx = hasHeader ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;

      const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length < 3) continue;

      const dateStr = parseDate(cols[0] || '');
      const typeStr = (cols[1] || '').toLowerCase().trim();
      const valueNum = parseFloat(cols[2]);
      const unit = cols[3] || inferUnit(typeStr);

      if (!dateStr || isNaN(valueNum)) continue;

      const metricType = CSV_TYPE_MAP[typeStr] ?? guessMetricType(typeStr);
      if (!metricType) continue;

      records.push({
        date: dateStr,
        type: metricType,
        value: valueNum,
        unit,
        source: deviceId,
        deviceId,
      });
    }

    return records;
  }

  /**
   * Parse Apple Health export XML.
   * Apple Health exports a zip containing export.xml with <Record> elements.
   * We use basic regex-based parsing since no XML library is allowed.
   */
  parseAppleHealthXML(xmlText: string, deviceId: DeviceId = 'apple_watch'): HealthRecord[] {
    const records: HealthRecord[] = [];

    // Match <Record .../> or <Record ...>...</Record>
    const recordRegex = /<Record\s+([\s\S]*?)(?:\/>|>(?:[\s\S]*?)<\/Record>)/g;
    let match: RegExpExecArray | null;

    while ((match = recordRegex.exec(xmlText)) !== null) {
      const attrs = match[1];

      const type = extractAttr(attrs, 'type');
      const value = parseFloat(extractAttr(attrs, 'value') || '');
      const unit = extractAttr(attrs, 'unit') || '';
      const startDate = extractAttr(attrs, 'startDate') || '';
      const sourceName = extractAttr(attrs, 'sourceName') || '';

      if (!type || isNaN(value)) continue;

      const metricType = APPLE_HEALTH_TYPE_MAP[type];
      if (!metricType) continue;

      const dateStr = parseDate(startDate);
      if (!dateStr) continue;

      // Heuristic device detection from source name
      const resolvedDevice: DeviceId = deviceId === 'apple_watch' && /apple\s*watch/i.test(sourceName)
        ? 'apple_watch'
        : deviceId;

      records.push({
        date: dateStr,
        type: metricType,
        value,
        unit: unit || inferUnit(metricType),
        source: resolvedDevice,
        deviceId: resolvedDevice,
      });
    }

    // Also parse <CategoryRecord> for sleep data
    const catRegex = /<CategoryRecord\s+([\s\S]*?)(?:\/>|>(?:[\s\S]*?)<\/CategoryRecord>)/g;
    while ((match = catRegex.exec(xmlText)) !== null) {
      const attrs = match[1];
      const type = extractAttr(attrs, 'type');
      const value = extractAttr(attrs, 'value') || '';
      const startDate = extractAttr(attrs, 'startDate') || '';
      const endDate = extractAttr(attrs, 'endDate') || '';

      if (type !== 'HKCategoryTypeIdentifierSleepAnalysis') continue;

      const dateStr = parseDate(startDate);
      if (!dateStr) continue;

      // Calculate sleep duration if we have start/end
      let sleepHours = 0;
      if (startDate && endDate) {
        const start = new Date(startDate.replace(/"/g, ''));
        const end = new Date(endDate.replace(/"/g, ''));
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          sleepHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }
      }

      // Only count "asleep" values
      const valLower = value.toLowerCase();
      if (valLower.includes('asleep') || valLower === '0' || valLower === 'inbed') {
        records.push({
          date: dateStr,
          type: 'sleep',
          value: sleepHours > 0 ? parseFloat(sleepHours.toFixed(2)) : 1,
          unit: 'hours',
          source: deviceId,
          deviceId,
        });
      }
    }

    return records;
  }

  /**
   * Parse Google Fit JSON export.
   * Google Fit exports consist of an array of data points or a bucketed structure.
   * We handle both "array of records" and "bucket" formats.
   */
  parseGoogleFitJSON(jsonText: string, deviceId: DeviceId = 'google_fit'): HealthRecord[] {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      // Try to extract JSON array from surrounding text
      const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        try { parsed = JSON.parse(arrayMatch[0]); } catch { return []; }
      } else {
        return [];
      }
    }

    const records: HealthRecord[] = [];

    // Handle array of points
    const points: any[] = Array.isArray(parsed) ? parsed : (parsed.point || parsed.dataPoints || parsed.records || []);

    for (const pt of points) {
      if (!pt || typeof pt !== 'object') continue;

      const typeStr = (pt.dataType?.name || pt.type || pt.metric || pt.activity || '').toLowerCase();
      const metricType = GOOGLE_FIT_TYPE_MAP[typeStr] ?? guessMetricType(typeStr);
      if (!metricType) continue;

      // Extract value
      let value = 0;
      if (typeof pt.value === 'number') {
        value = pt.value;
      } else if (typeof pt.value === 'string') {
        value = parseFloat(pt.value);
      } else if (Array.isArray(pt.value) && pt.value.length > 0) {
        // Google Fit array of fpVal / intVal
        const v0 = pt.value[0];
        value = v0?.fpVal ?? v0?.intVal ?? parseFloat(String(v0 ?? ''));
      } else if (pt.intVal !== undefined) {
        value = pt.intVal;
      } else if (pt.fpVal !== undefined) {
        value = pt.fpVal;
      }

      if (value === 0 && metricType !== 'sleep') continue;

      // Extract date
      const timestamp = pt.startTimeNanos || pt.startTimeMillis || pt.endTimeNanos || pt.endTimeMillis || pt.timestamp;
      let dateStr: string | null = null;
      if (timestamp) {
        const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
        if (!isNaN(ts)) {
          // Google Fit uses nanos or millis
          const millis = ts > 1e15 ? ts / 1e6 : ts > 1e12 ? ts : ts; // nanos -> ms, or already ms
          dateStr = new Date(millis).toISOString().split('T')[0];
        }
      }
      if (!dateStr) {
        dateStr = pt.date || pt.start_time || pt.startTime;
        if (dateStr) dateStr = parseDate(String(dateStr));
      }
      if (!dateStr) continue;

      const unit = pt.unit || pt.dataType?.unit || inferUnit(metricType);

      records.push({
        date: dateStr,
        type: metricType,
        value: parseFloat(typeof value === 'number' ? value.toFixed(4) : value),
        unit,
        source: deviceId,
        deviceId,
      });
    }

    // Handle bucketed format
    if (parsed.bucket && Array.isArray(parsed.bucket)) {
      for (const bucket of parsed.bucket) {
        const pts = bucket.dataset || bucket.point || [];
        const flatPts = Array.isArray(pts) ? pts.flatMap((ds: any) =>
          Array.isArray(ds.point) ? ds.point : Array.isArray(ds) ? ds : [ds]
        ) : [];
        for (const pt of flatPts) {
          // Same logic as above
          const typeStr = (pt.dataType?.name || pt.type || '').toLowerCase();
          const metricType = GOOGLE_FIT_TYPE_MAP[typeStr];
          if (!metricType) continue;

          let value = 0;
          const vals = pt.value || [];
          if (vals.length > 0) {
            value = vals[0].fpVal ?? vals[0].intVal ?? 0;
          }
          if (value === 0) continue;

          const dateStr = parseDate(String(bucket.startTimeMillis || bucket.startTime || ''));
          if (!dateStr) continue;

          records.push({
            date: dateStr,
            type: metricType,
            value: parseFloat(value.toFixed(4)),
            unit: inferUnit(metricType),
            source: deviceId,
            deviceId,
          });
        }
      }
    }

    return records;
  }

  /**
   * Import validated health records into local DB and health store.
   * Returns the number of records successfully imported.
   */
  async importRecords(records: HealthRecord[]): Promise<number> {
    const { valid } = this.validateRecords(records);
    if (valid.length === 0) return 0;

    let imported = 0;
    const userId = getEffectiveUserId();

    for (const rec of valid) {
      try {
        const { healthEntries } = this.transformForStore([rec]);
        for (const entry of healthEntries) {
          await localInsert('health_metrics', {
            ...entry,
            user_id: userId,
          });
        }
        imported++;
      } catch (err) {
        logger.warn('[health-import] Failed to import record:', err);
      }
    }

    // Update import history
    if (valid.length > 0) {
      this.saveImportHistory(valid[0].deviceId, imported);
    }

    return imported;
  }
}

// ──────────────────────────────────────────────────────────────
// File Type Detection
// ──────────────────────────────────────────────────────────────

export type FileType = 'csv' | 'apple_health_xml' | 'google_fit_json';

export function detectFileType(content: string, filename: string): FileType {
  const lowerName = filename.toLowerCase();

  // Extension-based detection
  if (lowerName.endsWith('.csv') || lowerName.endsWith('.txt')) {
    return 'csv';
  }
  if (lowerName.endsWith('.xml')) {
    // Check for Apple Health specific markers
    if (content.includes('HealthKit') || content.includes('HKQuantityTypeIdentifier') || content.includes('HKCategoryTypeIdentifier')) {
      return 'apple_health_xml';
    }
    // Generic XML — treat as Apple Health if it has Record elements
    if (/<Record\b/.test(content)) {
      return 'apple_health_xml';
    }
    return 'csv'; // fallback
  }
  if (lowerName.endsWith('.json')) {
    return 'google_fit_json';
  }

  // Content-based detection
  const trimmed = content.trim();

  // JSON: starts with { or [
  if (/^[\[{]/.test(trimmed)) {
    return 'google_fit_json';
  }

  // XML: starts with < 
  if (/^<\?xml|^<[a-zA-Z]/.test(trimmed)) {
    if (content.includes('HealthKit') || content.includes('HKQuantityTypeIdentifier') || content.includes('<Record')) {
      return 'apple_health_xml';
    }
    // Default XML to Apple Health
    return 'apple_health_xml';
  }

  // Default: CSV
  return 'csv';
}

// ──────────────────────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────────────────────

const VALID_METRIC_TYPES: Set<string> = new Set([
  'heart_rate', 'steps', 'sleep', 'weight', 'blood_pressure',
  'blood_oxygen', 'calories', 'water', 'exercise',
]);

export function validateRecords(records: HealthRecord[]): ValidationResults {
  const valid: HealthRecord[] = [];
  const invalid: { record: Partial<HealthRecord>; error: string }[] = [];

  for (const rec of records) {
    const errors: string[] = [];

    if (!rec.date) {
      errors.push('Missing date');
    } else if (!/^\d{4}-\d{2}-\d{2}/.test(rec.date)) {
      errors.push(`Invalid date format: ${rec.date}`);
    }

    if (!VALID_METRIC_TYPES.has(rec.type)) {
      errors.push(`Unknown metric type: ${rec.type}`);
    }

    if (rec.value === undefined || rec.value === null || isNaN(rec.value)) {
      errors.push('Missing or invalid value');
    }

    // Range checks for sanity
    if (rec.type === 'heart_rate' && (rec.value < 20 || rec.value > 300)) {
      errors.push(`Heart rate out of range: ${rec.value}`);
    }
    if (rec.type === 'steps' && rec.value < 0) {
      errors.push(`Steps cannot be negative: ${rec.value}`);
    }
    if (rec.type === 'sleep' && (rec.value < 0 || rec.value > 24)) {
      errors.push(`Sleep hours out of range: ${rec.value}`);
    }
    if (rec.type === 'weight' && (rec.value < 1 || rec.value > 500)) {
      errors.push(`Weight out of range: ${rec.value}`);
    }
    if (rec.type === 'blood_oxygen' && (rec.value < 50 || rec.value > 100)) {
      errors.push(`Blood oxygen out of range: ${rec.value}`);
    }

    if (errors.length > 0) {
      invalid.push({ record: rec, error: errors.join('; ') });
    } else {
      valid.push(rec);
    }
  }

  return { valid, invalid };
}

// ──────────────────────────────────────────────────────────────
// Transform for Store
// ──────────────────────────────────────────────────────────────

export function transformForStore(records: HealthRecord[]): {
  healthEntries: any[];
  habitEntries: any[];
} {
  const healthEntries: any[] = [];
  const habitEntries: any[] = [];

  for (const rec of records) {
    switch (rec.type) {
      case 'heart_rate':
      case 'blood_pressure':
      case 'blood_oxygen': {
        // These go into health_metrics as notes
        healthEntries.push({
          id: genId(),
          date: rec.date,
          notes: `${rec.type}: ${rec.value} ${rec.unit} (${DEVICE_NAMES[rec.deviceId] || rec.deviceId})`,
          synced: false,
          updated_at: new Date().toISOString(),
        });
        break;
      }
      case 'steps':
      case 'exercise':
      case 'calories': {
        healthEntries.push({
          id: genId(),
          date: rec.date,
          exercise_minutes: rec.type === 'exercise' ? rec.value : undefined,
          notes: `${rec.type}: ${rec.value} ${rec.unit} (${DEVICE_NAMES[rec.deviceId] || rec.deviceId})`,
          synced: false,
          updated_at: new Date().toISOString(),
        });
        break;
      }
      case 'sleep': {
        healthEntries.push({
          id: genId(),
          date: rec.date,
          sleep_hours: rec.value,
          sleep_quality: undefined,
          synced: false,
          updated_at: new Date().toISOString(),
        });
        break;
      }
      case 'weight': {
        healthEntries.push({
          id: genId(),
          date: rec.date,
          weight_kg: rec.value,
          synced: false,
          updated_at: new Date().toISOString(),
        });
        break;
      }
      case 'water': {
        healthEntries.push({
          id: genId(),
          date: rec.date,
          water_glasses: rec.value,
          synced: false,
          updated_at: new Date().toISOString(),
        });
        break;
      }
    }
  }

  // Coalesce multiple records for the same date into single health metric entries
  const byDate = new Map<string, any>();
  for (const entry of healthEntries) {
    const existing = byDate.get(entry.date);
    if (existing) {
      // Merge fields — take the first defined value for each field
      for (const [key, val] of Object.entries(entry)) {
        if (val !== undefined && (existing[key] === undefined || existing[key] === null)) {
          (existing as any)[key] = val;
        }
      }
      // Merge notes
      if (entry.notes && existing.notes) {
        existing.notes = [existing.notes, entry.notes].join('; ');
      } else if (entry.notes) {
        existing.notes = entry.notes;
      }
    } else {
      byDate.set(entry.date, { ...entry });
    }
  }

  return {
    healthEntries: Array.from(byDate.values()),
    habitEntries,
  };
}

// ──────────────────────────────────────────────────────────────
// Import History (localStorage)
// ──────────────────────────────────────────────────────────────

export function getImportHistory(): DeviceMetadata[] {
  try {
    const raw = localStorage.getItem(IMPORT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DeviceMetadata[];
    return parsed.filter(d => DEVICE_NAMES[d.id as DeviceId]);
  } catch {
    return [];
  }
}

export function clearImportHistory(): void {
  localStorage.removeItem(IMPORT_HISTORY_KEY);
}

// Internal: save import history
function saveImportHistoryImpl(deviceId: DeviceId, recordCount: number): void {
  const history = getImportHistory();
  const existing = history.find(d => d.id === deviceId);

  if (existing) {
    existing.lastSync = new Date().toISOString();
    existing.recordCount += recordCount;
  } else {
    history.push({
      id: deviceId,
      name: DEVICE_NAMES[deviceId],
      lastSync: new Date().toISOString(),
      recordCount,
    });
  }

  try {
    localStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Safari private browsing may throw
  }
}

// Attach to class method
HealthDataImport.prototype.saveImportHistory = function (this: any, deviceId: DeviceId, count: number) {
  saveImportHistoryImpl(deviceId, count);
};

// ──────────────────────────────────────────────────────────────
// Helper Functions
// ──────────────────────────────────────────────────────────────

function parseDate(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^["']|["']$/g, '');

  // Already ISO date
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // ISO datetime
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(trimmed)) {
    return trimmed.split('T')[0].split(' ')[0];
  }

  // MM/DD/YYYY or MM-DD-YYYY
  const usMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (usMatch) {
    return `${usMatch[3]}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY (assume day first for non-US)
  const euMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (euMatch) {
    return `${euMatch[3]}-${euMatch[2].padStart(2, '0')}-${euMatch[1].padStart(2, '0')}`;
  }

  // Fallback: try Date parse
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return null;
}

function extractAttr(attrs: string, name: string): string | null {
  const regex = new RegExp(`${name}="([^"]*)"`, 'i');
  const m = attrs.match(regex);
  return m ? m[1] : null;
}

function inferUnit(typeOrMetric: string): string {
  const t = typeOrMetric.toLowerCase();
  if (t.includes('heart_rate') || t.includes('heart rate') || t.includes('hr')) return 'bpm';
  if (t.includes('steps') || t.includes('step')) return 'count';
  if (t.includes('sleep')) return 'hours';
  if (t.includes('weight') || t.includes('mass') || t.includes('kg')) return 'kg';
  if (t.includes('blood_pressure') || t.includes('bp')) return 'mmHg';
  if (t.includes('blood_oxygen') || t.includes('spo2') || t.includes('oxygen')) return '%';
  if (t.includes('calories') || t.includes('energy')) return 'kcal';
  if (t.includes('water') || t.includes('hydration')) return 'glasses';
  if (t.includes('exercise') || t.includes('active') || t.includes('workout')) return 'minutes';
  return '';
}

function guessMetricType(rawType: string): HealthMetricType | null {
  const t = rawType.toLowerCase();
  if (/heart.?rate|hr\b|pulse|bpm/.test(t)) return 'heart_rate';
  if (/step|walk|stride/.test(t)) return 'steps';
  if (/sleep|rest|nap/.test(t)) return 'sleep';
  if (/weight|mass|body.?weight/.test(t)) return 'weight';
  if (/blood.?pressure|bp\b|systolic|diastolic/.test(t)) return 'blood_pressure';
  if (/oxygen|spo2|saturation/.test(t)) return 'blood_oxygen';
  if (/calorie|energy|burned/.test(t)) return 'calories';
  if (/water|hydration|fluid/.test(t)) return 'water';
  if (/exercise|workout|active|run|cycle|swim/.test(t)) return 'exercise';
  return null;
}

// Re-export saveImportHistory for convenience
export { saveImportHistoryImpl as saveImportHistory };