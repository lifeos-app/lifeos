/**
 * KMLogger — Quick-tap km logging for Teddy's Cleaning Systems
 *
 * One-tap buttons for preset distances with ATO deduction auto-calculation.
 * Writes directly to Supabase (expenses + transactions) and invalidates cache.
 */

import { useState, useCallback } from 'react';
import { Car, Plus, Check, Route } from 'lucide-react';
import { supabase } from '../../lib/data-access';
import { TCS_CONFIG, calcDeduction, ROUTE_KM } from '../../lib/tcs-config';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useUserStore } from '../../stores/useUserStore';
import { useGamificationContext } from '../../lib/gamification/context';
import { genId, todayStr, fmtCurrency } from '../../utils/date';
import './KMLogger.css';

function today() { return todayStr(); }

export function KMLogger() {
  const user = useUserStore(s => s.user);
  const { awardXP } = useGamificationContext();
  const [customKm, setCustomKm] = useState('');
  const [logging, setLogging] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Auto-suggest: check if tonight has TCS work events
  const todayEvents = useScheduleStore(s => s.getEventsForDate(todayStr()));
  const expenses = useFinanceStore(s => s.expenses);
  const hasKmToday = expenses.some(e => e.date === todayStr() && (e.travel_km || 0) > 0);
  const hasTCSWorkToday = todayEvents.some(e =>
    e.event_type === 'work' || e.category === 'work' ||
    (e.metadata as Record<string, unknown>)?.source === 'tcs'
  );
  const showRouteSuggestion = hasTCSWorkToday && !hasKmToday && !confirmation;

  const logKm = useCallback(async (km: number) => {
    if (km <= 0) return;
    setLogging(true);
    setError('');

    const deduction = calcDeduction(km);
    const expId = genId();
    const txId = genId();
    const dateStr = today();

    const [expErr, txErr] = await Promise.all([
      supabase.from('expenses').insert({
        id: expId,
        user_id: user?.id,
        amount: deduction,
        date: dateStr,
        description: `Vehicle: ${km}km cleaning run (${deduction.toFixed(2)} deduction)`,
        category_id: null,
        is_deductible: true,
      }).then(r => r.error),
      supabase.from('transactions').insert({
        id: txId,
        user_id: user?.id,
        type: 'expense',
        amount: deduction,
        title: `Vehicle: ${km}km`,
        date: dateStr,
        recurring: false,
        notes: JSON.stringify({
          km,
          ato_rate: 0.85,
          deduction: calcDeduction(km),
          travel: true,
        }),
      }).then(r => r.error),
    ]);

    if (expErr || txErr) {
      setError((expErr || txErr)!.message);
      setLogging(false);
      return;
    }

    // Award XP via gamification context
    try {
      await awardXP('financial_entry', { description: `Vehicle: ${km}km` });
    } catch {
      // Non-critical — don't block if gamification fails
    }

    // Refresh finance store cache
    useFinanceStore.getState().invalidate();

    setLogging(false);
    setConfirmation(`Logged ${km}km - ${fmtCurrency(deduction)} deduction`);
    setTimeout(() => setConfirmation(null), 3000);
  }, [user?.id, awardXP]);

  const handleCustomLog = () => {
    const km = parseInt(customKm, 10);
    if (isNaN(km) || km <= 0) {
      setError('Enter a valid km distance');
      return;
    }
    logKm(km);
    setCustomKm('');
  };

  return (
    <div className="km-logger">
      <div className="km-logger-header">
        <Car size={18} className="km-logger-icon" />
        <h3 className="km-logger-title">KM Logger</h3>
        <span className="km-logger-rate">ATO {TCS_CONFIG.atoKmRate}/km</span>
      </div>

      {error && <div className="km-logger-error">{error}</div>}

      {confirmation && (
        <div className="km-logger-confirmation">
          <Check size={14} />
          <span>{confirmation}</span>
        </div>
      )}

      {/* Auto-suggest: Log tonight's route if TCS work events exist and no km logged yet */}
      {showRouteSuggestion && (
        <button
          className="km-logger-route-suggestion"
          onClick={() => logKm(ROUTE_KM)}
          disabled={logging}
        >
          <Route size={14} />
          <span>Log Tonight's Route</span>
          <span className="km-logger-route-km">{ROUTE_KM}km</span>
        </button>
      )}

      <div className="km-logger-presets">
        {TCS_CONFIG.kmPresets.map((preset) => {
          const deduction = calcDeduction(preset.km);
          return (
            <button
              key={preset.label}
              className="km-logger-preset-btn"
              onClick={() => logKm(preset.km)}
              disabled={logging}
              title={preset.description}
            >
              <span className="km-logger-preset-label">{preset.label}</span>
              <span className="km-logger-preset-km">{preset.km}km</span>
              <span className="km-logger-preset-deduction">{fmtCurrency(deduction)}</span>
            </button>
          );
        })}
      </div>

      <div className="km-logger-custom">
        <div className="km-logger-custom-input-group">
          <Car size={14} className="km-logger-custom-icon" />
          <input
            type="number"
            min="1"
            step="1"
            placeholder="Custom km"
            value={customKm}
            onChange={(e) => setCustomKm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomLog()}
            className="km-logger-custom-input"
          />
          <button
            className="km-logger-custom-btn"
            onClick={handleCustomLog}
            disabled={logging || !customKm}
          >
            {logging ? <Check size={14} /> : <Plus size={14} />}
            <span>Log</span>
          </button>
        </div>
      </div>
    </div>
  );
}