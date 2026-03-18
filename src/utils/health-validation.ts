import { showToast } from '../components/Toast';

const RANGES: Record<string, [number, number, string]> = {
  weight_kg: [20, 300, 'Weight must be 20–300 kg'],
  height_cm: [50, 280, 'Height must be 50–280 cm'],
  sleep_hours: [0, 24, 'Sleep must be 0–24 hours'],
  water_ml: [0, 10000, 'Water must be 0–10,000 ml'],
};

export function validateHealth(field: string, value: number): boolean {
  const r = RANGES[field];
  if (!r) return true;
  if (isNaN(value) || value < r[0] || value > r[1]) {
    showToast(r[2], '⚠️', '#F97316');
    return false;
  }
  return true;
}
