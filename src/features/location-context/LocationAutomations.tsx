/**
 * LocationAutomations.tsx — Automation rule builder
 *
 * Trigger selection (arrive/leave/dwell), location selector,
 * action configuration, enable/disable toggle, automation
 * history, and test automation button.
 */

import { useState } from 'react';
import { useLocationContext } from './useLocationContext';
import {
  type AutomationAction,
  type AutomationTrigger,
  type ContextMode,
  type LocationAutomation,
} from '../../stores/locationStore';

const TRIGGER_OPTIONS: { value: AutomationTrigger; label: string; icon: string; description: string }[] = [
  { value: 'arrive', label: 'Arrive', icon: '📍', description: 'When you enter the geofence' },
  { value: 'leave', label: 'Leave', icon: '👋', description: 'When you exit the geofence' },
  { value: 'dwell_5min', label: 'Dwell 5m', icon: '⏱️', description: 'After staying 5 minutes' },
  { value: 'dwell_15min', label: 'Dwell 15m', icon: '⏳', description: 'After staying 15 minutes' },
  { value: 'dwell_30min', label: 'Dwell 30m', icon: '⏰', description: 'After staying 30 minutes' },
];

const ACTION_TYPES: { type: AutomationAction['type']; label: string; icon: string; needsConfig: boolean }[] = [
  { type: 'log_travel', label: 'Log Travel', icon: '🚗', needsConfig: true },
  { type: 'log_work_start', label: 'Log Work Start', icon: '⏱️', needsConfig: false },
  { type: 'log_work_end', label: 'Log Work End', icon: '🏁', needsConfig: false },
  { type: 'switch_context', label: 'Switch Context', icon: '🔄', needsConfig: true },
  { type: 'prompt_checkin', label: 'Prompt Check-in', icon: '✅', needsConfig: true },
  { type: 'start_timer', label: 'Start Timer', icon: '⏲️', needsConfig: true },
  { type: 'nudge_habit', label: 'Nudge Habit', icon: '💪', needsConfig: true },
  { type: 'send_notification', label: 'Send Notification', icon: '🔔', needsConfig: true },
];

const CONTEXT_OPTIONS: { value: ContextMode; label: string; icon: string }[] = [
  { value: 'morning', label: 'Morning', icon: '🌅' },
  { value: 'work', label: 'Work', icon: '💼' },
  { value: 'evening', label: 'Evening', icon: '🌆' },
  { value: 'night', label: 'Night', icon: '🌙' },
];

export function LocationAutomations() {
  const ctx = useLocationContext();
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-white/80">Automations</h2>
          <p className="text-[10px] text-white/30 mt-0.5">
            {ctx.automations.length} rule{ctx.automations.length !== 1 ? 's' : ''} · Context-aware triggers
          </p>
        </div>
        <button
          onClick={() => { setShowBuilder(true); setEditingId(null); }}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-violet-600/60 to-purple-600/60 hover:from-violet-500/70 hover:to-purple-500/70 border border-violet-500/30 transition-all"
        >
          + New Rule
        </button>
      </div>

      {/* Builder Form */}
      {showBuilder && (
        <AutomationBuilder
          existingId={editingId}
          onClose={() => { setShowBuilder(false); setEditingId(null); }}
        />
      )}

      {/* Automation List */}
      {ctx.automations.length === 0 && !showBuilder ? (
        <div className="text-center py-12 text-white/30 text-sm">
          <div className="text-3xl mb-3">⚡</div>
          <p>No automations configured.</p>
          <p className="text-[10px] mt-1">Arrive at work → auto-log start. Leave → prompt end-time.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ctx.automations.map(automation => {
            const place = ctx.places.find(p => p.id === automation.locationId);
            const triggerInfo = TRIGGER_OPTIONS.find(t => t.value === automation.trigger);
            return (
              <AutomationCard
                key={automation.id}
                automation={automation}
                placeName={place?.name || 'Unknown'}
                placeIcon={place?.icon || '📍'}
                triggerInfo={triggerInfo}
                onToggle={() => ctx.updateAutomation(automation.id, { enabled: !automation.enabled })}
                onEdit={() => { setEditingId(automation.id); setShowBuilder(true); }}
                onRemove={() => ctx.removeAutomation(automation.id)}
                onTest={() => ctx.triggerAutomation(automation.id)}
              />
            );
          })}
        </div>
      )}

      {/* Help Text */}
      <div className="p-3 rounded-xl bg-violet-900/15 border border-violet-500/10">
        <div className="text-xs text-violet-200/60">
          <span className="font-medium text-violet-200/80">How it works:</span>{' '}
          When your GPS enters or leaves a geofence zone, LifeOS fires the connected
          actions automatically. Dwell triggers fire after you stay in a zone for
          the set time.
        </div>
      </div>
    </div>
  );
}

// ── Automation Card ──────────────────────────────────────────────────

function AutomationCard({ automation, placeName, placeIcon, triggerInfo, onToggle, onEdit, onRemove, onTest }: {
  automation: LocationAutomation;
  placeName: string;
  placeIcon: string;
  triggerInfo: typeof TRIGGER_OPTIONS[number] | undefined;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onTest: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className={`p-3 rounded-xl border transition-all ${
      automation.enabled
        ? 'bg-violet-900/15 border-violet-500/20'
        : 'bg-[#111132]/40 border-white/5 opacity-60'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{placeIcon}</span>
          <div>
            <div className="text-sm font-medium text-white">
              {triggerInfo?.icon} {triggerInfo?.label || automation.trigger}
              <span className="text-white/30"> at </span>
              {placeName}
            </div>
            <div className="text-[10px] text-white/30 mt-0.5">
              {automation.actions.length} action{automation.actions.length !== 1 ? 's' : ''}
              {automation.lastTriggered && (
                <> · Last: {new Date(automation.lastTriggered).toLocaleString()}</>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onToggle}
          className={`w-10 h-5 rounded-full transition-all relative flex-shrink-0 ${
            automation.enabled
              ? 'bg-gradient-to-r from-violet-500 to-purple-500'
              : 'bg-slate-700'
          }`}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${
            automation.enabled ? 'left-5' : 'left-0.5'
          }`} />
        </button>
      </div>

      {/* Actions Preview */}
      <div className="flex flex-wrap gap-1 mb-2">
        {automation.actions.map((action, i) => (
          <span key={i} className="px-1.5 py-0.5 rounded text-[9px] text-violet-200/70 bg-violet-900/30">
            {ACTION_TYPES.find(a => a.type === action.type)?.icon}{' '}
            {ACTION_TYPES.find(a => a.type === action.type)?.label}
            {action.type === 'switch_context' && `: ${(action as { type: 'switch_context'; context: ContextMode }).context}`}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
        <button
          onClick={onTest}
          className="px-2 py-1 rounded text-[10px] text-cyan-300/50 hover:text-cyan-300 bg-cyan-900/20 hover:bg-cyan-900/30 transition-all"
        >
          🧪 Test
        </button>
        <button
          onClick={onEdit}
          className="px-2 py-1 rounded text-[10px] text-white/50 hover:text-white bg-white/5 hover:bg-white/10 transition-all"
        >
          ✏️ Edit
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button onClick={onRemove} className="px-2 py-1 rounded text-[10px] text-red-300 bg-red-900/40 hover:bg-red-900/60 transition-all">
              Confirm
            </button>
            <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 rounded text-[10px] text-white/50 bg-white/5 transition-all">
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-2 py-1 rounded text-[10px] text-red-300/50 hover:text-red-300 hover:bg-red-900/30 transition-all"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}

// ── Automation Builder ───────────────────────────────────────────────

function AutomationBuilder({ existingId, onClose }: { existingId: string | null; onClose: () => void }) {
  const ctx = useLocationContext();
  const existing = existingId ? ctx.automations.find(a => a.id === existingId) : null;

  const [locationId, setLocationId] = useState(existing?.locationId || (ctx.places[0]?.id || ''));
  const [trigger, setTrigger] = useState<AutomationTrigger>(existing?.trigger || 'arrive');
  const [actions, setActions] = useState<AutomationAction[]>(existing?.actions || []);
  const [showActionConfig, setShowActionConfig] = useState<string | null>(null);

  // Action config state
  const [travelKms, setTravelKms] = useState('10');
  const [contextMode, setContextMode] = useState<ContextMode>('work');
  const [checkinMsg, setCheckinMsg] = useState("Check in — you've arrived!");
  const [timerLabel, setTimerLabel] = useState('Work session');
  const [habitId, setHabitId] = useState('');
  const [notifMsg, setNotifMsg] = useState('Location trigger fired!');

  const addAction = (type: AutomationAction['type']) => {
    let action: AutomationAction;
    switch (type) {
      case 'log_travel':
        action = { type: 'log_travel', metadata: { kms: parseFloat(travelKms) || 10 } };
        break;
      case 'log_work_start':
        action = { type: 'log_work_start' };
        break;
      case 'log_work_end':
        action = { type: 'log_work_end' };
        break;
      case 'switch_context':
        action = { type: 'switch_context', context: contextMode };
        break;
      case 'prompt_checkin':
        action = { type: 'prompt_checkin', message: checkinMsg };
        break;
      case 'start_timer':
        action = { type: 'start_timer', label: timerLabel };
        break;
      case 'nudge_habit':
        action = { type: 'nudge_habit', habitId };
        break;
      case 'send_notification':
        action = { type: 'send_notification', message: notifMsg };
        break;
    }
    setActions(prev => [...prev, action]);
    setShowActionConfig(null);
  };

  const removeAction = (index: number) => {
    setActions(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!locationId || actions.length === 0) return;

    if (existingId) {
      ctx.updateAutomation(existingId, { locationId, trigger, actions });
    } else {
      ctx.addAutomation({ locationId, trigger, actions, enabled: true });
    }
    onClose();
  };

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-b from-[#111132] to-[#0d0d24] border border-violet-500/15">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-violet-200">
          {existingId ? 'Edit Automation' : 'New Automation'}
        </h3>
        <button onClick={onClose} className="text-white/40 hover:text-white/60 text-xs">✕</button>
      </div>

      {/* Location Selector */}
      <div className="mb-3">
        <label className="text-[10px] uppercase tracking-widest text-violet-400/60 mb-1.5 block">
          When I'm at...
        </label>
        {ctx.places.length === 0 ? (
          <div className="text-xs text-white/30 py-2">Add places first (Places tab)</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {ctx.places.map(place => (
              <button
                key={place.id}
                onClick={() => setLocationId(place.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  locationId === place.id
                    ? 'border-opacity-100 text-white'
                    : 'border-white/10 text-white/40 hover:text-white/60'
                }`}
                style={{
                  backgroundColor: locationId === place.id ? place.color + '30' : 'transparent',
                  borderColor: locationId === place.id ? place.color + '60' : undefined,
                }}
              >
                {place.icon} {place.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Trigger Selection */}
      <div className="mb-3">
        <label className="text-[10px] uppercase tracking-widest text-violet-400/60 mb-1.5 block">
          Trigger
        </label>
        <div className="flex flex-wrap gap-1.5">
          {TRIGGER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTrigger(opt.value)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                trigger === opt.value
                  ? 'bg-violet-600/30 border-violet-400/60 text-white'
                  : 'border-white/10 text-white/40 hover:text-white/60'
              }`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
        {trigger !== 'arrive' && trigger !== 'leave' && (
          <p className="text-[10px] text-violet-300/50 mt-1">
            {TRIGGER_OPTIONS.find(t => t.value === trigger)?.description}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="mb-3">
        <label className="text-[10px] uppercase tracking-widest text-violet-400/60 mb-1.5 block">
          Then do...
        </label>
        {/* Added actions */}
        {actions.length > 0 && (
          <div className="space-y-1 mb-2">
            {actions.map((action, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-violet-900/20 border border-violet-500/10">
                <span className="text-xs text-violet-200">
                  {ACTION_TYPES.find(a => a.type === action.type)?.icon}{' '}
                  {ACTION_TYPES.find(a => a.type === action.type)?.label}
                  {action.type === 'switch_context' && ` → ${(action as { type: 'switch_context'; context: ContextMode }).context}`}
                  {action.type === 'log_travel' && ` (${(action as { type: 'log_travel'; metadata: { kms: number } }).metadata.kms}km)`}
                </span>
                <button
                  onClick={() => removeAction(i)}
                  className="text-[10px] text-red-300/50 hover:text-red-300"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add action buttons */}
        <div className="flex flex-wrap gap-1">
          {ACTION_TYPES.map(act => (
            <button
              key={act.type}
              onClick={() => act.needsConfig ? setShowActionConfig(act.type) : addAction(act.type)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-all border ${
                showActionConfig === act.type
                  ? 'bg-violet-600/30 border-violet-400/50 text-white'
                  : 'border-white/5 text-white/30 hover:text-white/50 hover:bg-white/5'
              }`}
            >
              {act.icon} {act.label}
            </button>
          ))}
        </div>

        {/* Action Configuration Panel */}
        {showActionConfig && (
          <div className="mt-2 p-3 rounded-lg bg-white/5 border border-white/10">
            {showActionConfig === 'log_travel' && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={travelKms}
                  onChange={e => setTravelKms(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white font-mono outline-none"
                  placeholder="KM"
                />
                <button onClick={() => addAction('log_travel')} className="px-3 py-1.5 rounded text-xs bg-emerald-600/50 text-emerald-200">
                  Add
                </button>
              </div>
            )}
            {showActionConfig === 'switch_context' && (
              <div className="flex flex-wrap gap-1.5">
                {CONTEXT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setContextMode(opt.value);
                      addAction('switch_context');
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-all"
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            )}
            {showActionConfig === 'prompt_checkin' && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={checkinMsg}
                  onChange={e => setCheckinMsg(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none"
                  placeholder="Check-in message"
                />
                <button onClick={() => addAction('prompt_checkin')} className="px-3 py-1.5 rounded text-xs bg-emerald-600/50 text-emerald-200">
                  Add
                </button>
              </div>
            )}
            {showActionConfig === 'start_timer' && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={timerLabel}
                  onChange={e => setTimerLabel(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none"
                  placeholder="Timer label"
                />
                <button onClick={() => addAction('start_timer')} className="px-3 py-1.5 rounded text-xs bg-emerald-600/50 text-emerald-200">
                  Add
                </button>
              </div>
            )}
            {showActionConfig === 'nudge_habit' && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={habitId}
                  onChange={e => setHabitId(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white font-mono outline-none"
                  placeholder="Habit ID"
                />
                <button onClick={() => addAction('nudge_habit')} className="px-3 py-1.5 rounded text-xs bg-emerald-600/50 text-emerald-200">
                  Add
                </button>
              </div>
            )}
            {showActionConfig === 'send_notification' && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={notifMsg}
                  onChange={e => setNotifMsg(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none"
                  placeholder="Notification message"
                />
                <button onClick={() => addAction('send_notification')} className="px-3 py-1.5 rounded text-xs bg-emerald-600/50 text-emerald-200">
                  Add
                </button>
              </div>
            )}
            <button
              onClick={() => setShowActionConfig(null)}
              className="mt-2 text-[10px] text-white/30 hover:text-white/50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={handleSave}
          disabled={!locationId || actions.length === 0}
          className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          {existingId ? '💾 Update Rule' : '⚡ Save Rule'}
        </button>
        <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm bg-white/5 hover:bg-white/10 text-white/50 transition-all">
          Cancel
        </button>
      </div>
    </div>
  );
}