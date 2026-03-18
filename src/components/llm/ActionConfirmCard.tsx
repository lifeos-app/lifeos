/**
 * ActionConfirmCard
 *
 * Displays a proposed AI action with Confirm/Cancel buttons.
 * Shows a success animation on confirm.
 * Used inside AIChat for actions that require user confirmation.
 */

import { useState } from 'react';
import {
  CheckSquare, DollarSign, Calendar, Zap, Target,
  MapPin, Check, X, Loader2, AlertCircle,
} from 'lucide-react';
import type { AIAction, AIActionType } from '../../lib/llm/actions';

// ── ICON/COLOR MAPS ────────────────────────────────────────────────────────────

const ACTION_ICONS: Record<AIActionType, React.ElementType> = {
  create_task:    CheckSquare,
  log_habit:      Zap,
  log_health:     Zap,
  create_event:   Calendar,
  log_income:     DollarSign,
  log_expense:    DollarSign,
  complete_task:  CheckSquare,
  navigate:       MapPin,
};

const ACTION_COLORS: Record<AIActionType, string> = {
  create_task:    '#00D4FF',
  log_habit:      '#FACC15',
  log_health:     '#F43F5E',
  create_event:   '#A855F7',
  log_income:     '#22C55E',
  log_expense:    '#F97316',
  complete_task:  '#39FF14',
  navigate:       '#6B7280',
};

const ACTION_LABELS: Record<AIActionType, string> = {
  create_task:    'Create Task',
  log_habit:      'Log Habit',
  log_health:     'Log Health',
  create_event:   'Create Event',
  log_income:     'Log Income',
  log_expense:    'Log Expense',
  complete_task:  'Complete Task',
  navigate:       'Navigate',
};

// ── TYPES ──────────────────────────────────────────────────────────────────────

type CardState = 'pending' | 'confirming' | 'success' | 'error' | 'cancelled';

interface ActionConfirmCardProps {
  action: AIAction;
  /** Called when user confirms — should execute the action and return a result string */
  onConfirm: (action: AIAction) => Promise<string>;
  /** Called when user cancels */
  onCancel: () => void;
  /** Optional: show inline (without the card wrapper) */
  inline?: boolean;
}

// ── COMPONENT ──────────────────────────────────────────────────────────────────

export function ActionConfirmCard({
  action,
  onConfirm,
  onCancel,
  inline = false,
}: ActionConfirmCardProps) {
  const [state, setState] = useState<CardState>('pending');
  const [resultMessage, setResultMessage] = useState<string>('');

  const Icon = ACTION_ICONS[action.type] ?? Target;
  const color = ACTION_COLORS[action.type] ?? '#6B7280';
  const label = ACTION_LABELS[action.type] ?? action.type;

  const handleConfirm = async () => {
    setState('confirming');
    try {
      const result = await onConfirm(action);
      setResultMessage(result);
      setState('success');
    } catch (err) {
      setResultMessage(err instanceof Error ? err.message : 'Action failed');
      setState('error');
    }
  };

  const handleCancel = () => {
    setState('cancelled');
    onCancel();
  };

  // ── SUCCESS STATE ──
  if (state === 'success') {
    return (
      <SuccessState message={resultMessage} color={color} />
    );
  }

  // ── CANCELLED STATE ──
  if (state === 'cancelled') {
    return (
      <div style={{ fontSize: 12, color: '#5A7A9A', padding: '6px 0', fontStyle: 'italic' }}>
        Action cancelled
      </div>
    );
  }

  // ── ERROR STATE ──
  if (state === 'error') {
    return (
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          8,
        padding:      '8px 12px',
        background:   'rgba(239, 68, 68, 0.08)',
        border:       '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: 8,
        fontSize:     12,
        color:        '#EF4444',
      }}>
        <AlertCircle size={14} />
        {resultMessage || 'Something went wrong'}
      </div>
    );
  }

  // ── PENDING / CONFIRMING STATE ──
  const cardStyles = inline ? {} : {
    background:   `${color}0A`,
    border:       `1px solid ${color}25`,
    borderRadius: 10,
    padding:      '10px 12px',
    marginTop:    8,
  };

  return (
    <div style={cardStyles}>
      {/* Action header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width:        28,
          height:       28,
          borderRadius: 8,
          background:   `${color}18`,
          border:       `1px solid ${color}30`,
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          flexShrink:   0,
        }}>
          <Icon size={14} style={{ color }} />
        </div>
        <div>
          <span style={{ fontSize: 11, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {label}
          </span>
        </div>
      </div>

      {/* Action summary */}
      <ActionSummary action={action} color={color} />

      {/* Buttons */}
      {state !== 'confirming' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button
            onClick={handleConfirm}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          5,
              background:   color,
              color:        '#000',
              border:       'none',
              borderRadius: 7,
              padding:      '6px 14px',
              fontSize:     12,
              fontWeight:   700,
              cursor:       'pointer',
              transition:   'opacity 0.15s, transform 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'scale(1.03)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <Check size={12} /> Confirm
          </button>
          <button
            onClick={handleCancel}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          5,
              background:   'rgba(255,255,255,0.06)',
              color:        '#8BA4BE',
              border:       '1px solid rgba(255,255,255,0.1)',
              borderRadius: 7,
              padding:      '6px 14px',
              fontSize:     12,
              cursor:       'pointer',
              transition:   'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <X size={12} /> Cancel
          </button>
        </div>
      )}

      {/* Confirming spinner */}
      {state === 'confirming' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8BA4BE', marginTop: 8 }}>
          <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
          Executing…
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── ACTION SUMMARY ─────────────────────────────────────────────────────────────

function ActionSummary({ action, color }: { action: AIAction; color: string }) {
  const params = action.params;

  // Format key-value pairs as a human-readable summary
  const renderParam = (key: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return null;
    const label = key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());

    const displayValue =
      key === 'amount'
        ? `$${Number(value).toFixed(2)}`
        : String(value);

    return (
      <div key={key} style={{ display: 'flex', gap: 6, fontSize: 12 }}>
        <span style={{ color: '#5A7A9A', minWidth: 70 }}>{label}:</span>
        <span style={{ color: '#C5D5E8', fontWeight: 500 }}>{displayValue}</span>
      </div>
    );
  };

  // Priority/important params first
  const priorityKeys = ['title', 'amount', 'date', 'priority', 'metric_type', 'value', 'description', 'target'];
  const otherKeys = Object.keys(params).filter(k => !priorityKeys.includes(k));
  const orderedKeys = [...priorityKeys.filter(k => k in params), ...otherKeys].slice(0, 6);

  return (
    <div style={{
      background:   'rgba(0,0,0,0.2)',
      borderRadius: 8,
      padding:      '8px 10px',
      display:      'flex',
      flexDirection: 'column',
      gap:          4,
      borderLeft:   `2px solid ${color}40`,
    }}>
      {orderedKeys.map(k => renderParam(k, params[k]))}
    </div>
  );
}

// ── SUCCESS STATE ──────────────────────────────────────────────────────────────

function SuccessState({ message, color }: { message: string; color: string }) {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          8,
      padding:      '8px 12px',
      background:   `${color}0A`,
      border:       `1px solid ${color}25`,
      borderRadius: 8,
      fontSize:     12,
      color:        color,
      animation:    'fadeInScale 0.3s ease',
    }}>
      <div style={{
        width:          20,
        height:         20,
        borderRadius:   '50%',
        background:     color,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        flexShrink:     0,
      }}>
        <Check size={11} style={{ color: '#000' }} />
      </div>
      <span style={{ color: '#C5D5E8' }}>{message}</span>
      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ── MULTI-ACTION CARD ──────────────────────────────────────────────────────────

/**
 * MultiActionConfirmCard — shows multiple proposed actions with a single
 * "Confirm all" button. Used when the AI proposes several actions at once.
 */
interface MultiActionConfirmCardProps {
  actions: AIAction[];
  onConfirmAll: (actions: AIAction[]) => Promise<string[]>;
  onCancel: () => void;
}

export function MultiActionConfirmCard({
  actions,
  onConfirmAll,
  onCancel,
}: MultiActionConfirmCardProps) {
  const [state, setState] = useState<'pending' | 'confirming' | 'done'>('pending');
  const [results, setResults] = useState<string[]>([]);

  const handleConfirm = async () => {
    setState('confirming');
    const r = await onConfirmAll(actions);
    setResults(r);
    setState('done');
  };

  if (state === 'done') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {results.map((r, i) => (
          <div key={i} style={{ fontSize: 12, color: '#22C55E', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={12} /> {r}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      background:   'rgba(10, 37, 64, 0.5)',
      border:       '1px solid rgba(0, 212, 255, 0.15)',
      borderRadius: 10,
      padding:      '12px 14px',
      marginTop:    8,
    }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#E8F0FE', margin: '0 0 10px' }}>
        {actions.length} action{actions.length !== 1 ? 's' : ''} to confirm:
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {actions.map((action, i) => {
          const Icon = ACTION_ICONS[action.type] ?? Target;
          const color = ACTION_COLORS[action.type] ?? '#6B7280';
          const label = ACTION_LABELS[action.type] ?? action.type;
          const title = String(action.params.title ?? action.params.description ?? action.params.metric_type ?? '');
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <Icon size={13} style={{ color }} />
              <span style={{ color, fontWeight: 600 }}>{label}</span>
              {title && <span style={{ color: '#8BA4BE' }}>— {title}</span>}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleConfirm}
          disabled={state === 'confirming'}
          style={{
            background:   '#00D4FF',
            color:        '#000',
            border:       'none',
            borderRadius: 7,
            padding:      '7px 16px',
            fontSize:     12,
            fontWeight:   700,
            cursor:       state === 'confirming' ? 'wait' : 'pointer',
            display:      'flex',
            alignItems:   'center',
            gap:          5,
          }}
        >
          {state === 'confirming' ? (
            <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Executing…</>
          ) : (
            <><Check size={12} /> Confirm all</>
          )}
        </button>
        <button
          onClick={onCancel}
          style={{
            background:   'transparent',
            color:        '#8BA4BE',
            border:       '1px solid rgba(255,255,255,0.1)',
            borderRadius: 7,
            padding:      '7px 14px',
            fontSize:     12,
            cursor:       'pointer',
            display:      'flex',
            alignItems:   'center',
            gap:          5,
          }}
        >
          <X size={12} /> Cancel
        </button>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
