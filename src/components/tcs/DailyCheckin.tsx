/**
 * DailyCheckin — Morning/Evening TCS daily check-in ritual
 *
 * Provides a structured daily checkin flow:
 * - Morning (before 2pm): Plan the day, confirm jobs, log readiness
 * - Evening (after 2pm): Review the day, mood/energy, auto-tally km + income
 * - Streak counter for consecutive check-in days
 *
 * Writes to journal_entries table via useJournalStore.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Sun, Moon, CheckCircle2, Flame, Car, DollarSign,
  Frown, Meh, Smile, ThumbsUp, Heart, Zap, Send, Clock,
} from 'lucide-react';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { useJournalStore } from '../../stores/useJournalStore';
import { useUserStore } from '../../stores/useUserStore';
import { localDateStr, genId } from '../../utils/date';
import { VENUES, ROUTE_KM, ATO_RATE, projectedMonthlyCleaning } from '../../lib/tcs-config';
import './DailyCheckin.css';

// ── Mood/Energy Options ──────────────────────────────────────
const MOOD_OPTIONS = [
  { value: 1, icon: Frown, label: 'Rough', color: '#F43F5E' },
  { value: 2, icon: Meh, label: 'Low', color: '#F97316' },
  { value: 3, icon: Smile, label: 'Okay', color: '#EAB308' },
  { value: 4, icon: ThumbsUp, label: 'Good', color: '#39FF14' },
  { value: 5, icon: Heart, label: 'Great', color: '#22C55E' },
];

const ENERGY_OPTIONS = [
  { value: 1, icon: Frown, label: 'Drained', color: '#F43F5E' },
  { value: 2, icon: Meh, label: 'Tired', color: '#F97316' },
  { value: 3, icon: Smile, label: 'Normal', color: '#EAB308' },
  { value: 4, icon: ThumbsUp, label: 'Energized', color: '#39FF14' },
  { value: 5, icon: Heart, label: 'Wired', color: '#22C55E' },
];

export function DailyCheckin() {
  const user = useUserStore(s => s.user);
  const today = localDateStr();
  const isMorning = new Date().getHours() < 14;

  // ── Store data ──
  const events = useScheduleStore(s => s.getEventsForDate(today));
  const expenses = useFinanceStore(s => s.expenses);
  const income = useFinanceStore(s => s.income);
  const journalEntries = useJournalStore(s => s.entries);
  const addEntry = useJournalStore(s => s.addEntry);

  // ── Local state ──
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);

  // ── Today's TCS work events ──
  const tcsEvents = useMemo(() =>
    events.filter(e =>
      e.event_type === 'work' ||
      e.category === 'work' ||
      (e.metadata as Record<string, unknown>)?.source === 'tcs' ||
      e.title?.toLowerCase().includes('cleaning')
    ),
    [events]
  );

  const completedJobs = useMemo(() =>
    tcsEvents.filter(e => e.status === 'completed').length,
    [tcsEvents]
  );

  // ── Today's km logged ──
  const todayKm = useMemo(() =>
    expenses
      .filter(e => e.date === today && (e.travel_km || 0) > 0)
      .reduce((sum, e) => sum + (e.travel_km || 0), 0),
    [expenses, today]
  );

  // ── Today's income logged ──
  const todayIncome = useMemo(() =>
    income
      .filter(i => i.date === today && i.source === 'TCS Cleaning')
      .reduce((sum, i) => sum + i.amount, 0),
    [income, today]
  );

  // ── Expected income for tonight ──
  const expectedIncome = useMemo(() => {
    if (isMorning) {
      // Project based on schedule
      return tcsEvents.length > 0
        ? tcsEvents.reduce((sum, e) => {
            const meta = e.metadata as Record<string, unknown> | undefined;
            return sum + ((meta?.amount as number) || 0);
          }, 0) || VENUES.reduce((s, v) => s + v.rate, 0)
        : VENUES.reduce((s, v) => s + v.rate, 0);
    }
    return todayIncome;
  }, [isMorning, tcsEvents, todayIncome]);

  // ── Check if already checked in today ──
  useEffect(() => {
    const tag = isMorning ? 'tcs-morning-checkin' : 'tcs-evening-checkin';
    const existing = journalEntries.find(e =>
      e.date === today && e.tags?.includes(tag)
    );
    setAlreadyCheckedIn(!!existing);
  }, [journalEntries, today, isMorning]);

  // ── Streak calculation ──
  const streak = useMemo(() => {
    let count = 0;
    const d = new Date();
    while (true) {
      const dateStr = localDateStr(d);
      const hasCheckin = journalEntries.some(e =>
        e.date === dateStr &&
        (e.tags?.includes('tcs-morning-checkin') || e.tags?.includes('tcs-evening-checkin'))
      );
      if (hasCheckin) {
        count++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  }, [journalEntries]);

  // ── Submit handler ──
  const handleSubmit = useCallback(async () => {
    if (!user?.id) return;

    const phase = isMorning ? 'morning' : 'evening';
    const tag = isMorning ? 'tcs-morning-checkin' : 'tcs-evening-checkin';

    const payload = {
      jobs: isMorning
        ? tcsEvents.map(e => ({ title: e.title, time: e.start_time }))
        : { completed: completedJobs, total: tcsEvents.length },
      km: isMorning ? ROUTE_KM : todayKm,
      income: isMorning ? expectedIncome : todayIncome,
      mood,
      energy,
      notes,
      phase,
    };

    await addEntry({
      id: genId(),
      user_id: user.id,
      date: today,
      title: isMorning ? 'TCS Morning Check-in' : 'TCS Evening Check-in',
      content: JSON.stringify(payload),
      mood: mood ?? null,
      energy: energy ?? null,
      tags: `${tag},tcs-checkin`,
      is_deleted: false,
    } as any); // cast because JournalEntry.tags is string, we're providing it

    setConfirmed(true);
    setTimeout(() => setConfirmed(false), 3000);
  }, [user, isMorning, tcsEvents, completedJobs, todayKm, todayIncome, expectedIncome, mood, energy, notes, today, addEntry]);

  // ── Render ──
  if (alreadyCheckedIn && !confirmed) {
    return (
      <div className="tcs-daily-card">
        <div className="tcs-daily-header">
          {isMorning ? <Sun size={16} /> : <Moon size={16} />}
          <span>{isMorning ? 'Morning' : 'Evening'} Check-in</span>
          {streak > 0 && (
            <span className="tcs-daily-streak">
              <Flame size={12} /> {streak} day{streak !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="tcs-daily-done">
          <CheckCircle2 size={20} />
          <span>Checked in for {isMorning ? 'this morning' : 'tonight'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="tcs-daily-card">
      <div className="tcs-daily-header">
        {isMorning ? <Sun size={16} /> : <Moon size={16} />}
        <span>{isMorning ? 'Morning' : 'Evening'} Check-in</span>
        {streak > 0 && (
          <span className="tcs-daily-streak">
            <Flame size={12} /> {streak} day{streak !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Phase indicator */}
      <div className="tcs-daily-phase">
        <Clock size={12} />
        <span>{isMorning ? 'Plan tonight\'s run' : 'Review how tonight went'}</span>
      </div>

      {/* Jobs / Stats */}
      <div className="tcs-daily-stats">
        {isMorning ? (
          <>
            {tcsEvents.length > 0 ? (
              tcsEvents.map(e => (
                <div key={e.id} className="tcs-daily-stat-row">
                  <span className="tcs-daily-stat-label">{e.title}</span>
                  <span className="tcs-daily-stat-time">
                    {e.start_time?.slice(0, 5) || '--:--'}
                  </span>
                </div>
              ))
            ) : (
              VENUES.map(v => (
                <div key={v.name} className="tcs-daily-stat-row">
                  <span className="tcs-daily-stat-label">{v.name}</span>
                  <span className="tcs-daily-stat-rate">${v.rate.toFixed(0)}</span>
                </div>
              ))
            )}
          </>
        ) : (
          <>
            <div className="tcs-daily-stat-row">
              <span className="tcs-daily-stat-label">Jobs done</span>
              <span className="tcs-daily-stat-value">{completedJobs}/{tcsEvents.length || VENUES.length}</span>
            </div>
            <div className="tcs-daily-stat-row">
              <Car size={12} />
              <span className="tcs-daily-stat-label">KM logged</span>
              <span className="tcs-daily-stat-value">{todayKm || 0}km</span>
            </div>
            <div className="tcs-daily-stat-row">
              <DollarSign size={12} />
              <span className="tcs-daily-stat-label">Income</span>
              <span className="tcs-daily-stat-value">${todayIncome.toFixed(0)}</span>
            </div>
          </>
        )}
      </div>

      {/* Expected overview for morning */}
      {isMorning && (
        <div className="tcs-daily-overview">
          <div className="tcs-daily-overview-item">
            <Car size={12} />
            <span>{ROUTE_KM}km route</span>
            <span className="tcs-daily-overview-deduction">
              ${(ROUTE_KM * ATO_RATE).toFixed(0)} deduction
            </span>
          </div>
          <div className="tcs-daily-overview-item">
            <DollarSign size={12} />
            <span className="tcs-daily-overview-income">
              ${expectedIncome.toFixed(0)} expected
            </span>
          </div>
        </div>
      )}

      {/* Mood / Energy selectors (evening only, or optional morning) */}
      <div className="tcs-daily-selectors">
        <div className="tcs-daily-selector">
          <span className="tcs-daily-selector-label">
            {isMorning ? <Sun size={12} /> : <span>How do you feel?</span>}
          </span>
          <div className="tcs-daily-selector-options">
            {MOOD_OPTIONS.map(opt => (
              <button
                key={`mood-${opt.value}`}
                className={`tcs-daily-selector-btn ${mood === opt.value ? 'active' : ''}`}
                onClick={() => setMood(opt.value)}
                title={opt.label}
                style={mood === opt.value ? { borderColor: opt.color, color: opt.color } : {}}
              >
                <opt.icon size={16} />
              </button>
            ))}
          </div>
        </div>
        <div className="tcs-daily-selector">
          <span className="tcs-daily-selector-label">
            <Zap size={12} /> Energy
          </span>
          <div className="tcs-daily-selector-options">
            {ENERGY_OPTIONS.map(opt => (
              <button
                key={`energy-${opt.value}`}
                className={`tcs-daily-selector-btn ${energy === opt.value ? 'active' : ''}`}
                onClick={() => setEnergy(opt.value)}
                title={opt.label}
                style={energy === opt.value ? { borderColor: opt.color, color: opt.color } : {}}
              >
                <opt.icon size={16} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notes */}
      <textarea
        className="tcs-daily-notes"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder={isMorning ? 'Any notes for tonight?' : 'How was tonight?'}
        rows={2}
      />

      {/* Submit */}
      {confirmed ? (
        <div className="tcs-daily-confirmed">
          <CheckCircle2 size={16} /> Checked in!
        </div>
      ) : (
        <button className="tcs-daily-submit" onClick={handleSubmit}>
          <Send size={14} />
          {isMorning ? 'Ready to Roll' : 'Check In'}
        </button>
      )}
    </div>
  );
}