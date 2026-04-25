/**
 * DecisionJournal — Log decisions, detect biases, track outcomes
 *
 * Real-time bias detection as user types. Monthly grouping of past decisions.
 * Overdue decisions highlighted. Bias frequency chart.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Brain, AlertTriangle, ChevronDown, ChevronUp, Plus, Calendar,
  CheckCircle2, Clock, BarChart3,
} from 'lucide-react';
import {
  detectBiases,
  saveDecision,
  updateDecision,
  getDecisions,
  getOutstandingDecisions,
  getPatternReport,
  BIAS_DESCRIPTIONS,
  type DecisionEntry,
  type CognitiveBias,
} from '../../lib/decision-journal';

// ── BIAS COLORS ──

const BIAS_COLORS: Record<CognitiveBias, string> = {
  confirmation_bias: '#F43F5E',
  sunk_cost: '#F97316',
  availability_heuristic: '#EAB308',
  anchoring: '#A855F7',
  overconfidence: '#00D4FF',
  present_bias: '#EC4899',
};

export function DecisionJournal() {
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [decisions, setDecisions] = useState<DecisionEntry[]>(() => getDecisions());
  const [outcomeId, setOutcomeId] = useState<string | null>(null);
  const [outcomeText, setOutcomeText] = useState('');

  // Form state
  const [decision, setDecision] = useState('');
  const [context, setContext] = useState('');
  const [expectedOutcome, setExpectedOutcome] = useState('');
  const [revisitDate, setRevisitDate] = useState('');

  // Debounced bias detection
  const [detectedBiases, setDetectedBiases] = useState<CognitiveBias[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (decision.length > 5 || context.length > 5) {
        setDetectedBiases(detectBiases(decision, context));
      } else {
        setDetectedBiases([]);
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [decision, context]);

  const outstanding = useMemo(() => getOutstandingDecisions(), [decisions]);
  const report = useMemo(() => getPatternReport(), [decisions]);

  const handleSave = useCallback(() => {
    if (!decision.trim()) return;
    const today = new Date().toISOString().split('T')[0];
    const entry = saveDecision({
      date: today,
      decision: decision.trim(),
      context: context.trim(),
      expectedOutcome: expectedOutcome.trim(),
      revisitDate: revisitDate || undefined,
    });
    setDecisions(prev => [...prev, entry]);
    setDecision('');
    setContext('');
    setExpectedOutcome('');
    setRevisitDate('');
    setDetectedBiases([]);
    setShowForm(false);
  }, [decision, context, expectedOutcome, revisitDate]);

  const handleRecordOutcome = useCallback((id: string) => {
    if (!outcomeText.trim()) return;
    updateDecision(id, { actualOutcome: outcomeText.trim() });
    setDecisions(getDecisions());
    setOutcomeId(null);
    setOutcomeText('');
  }, [outcomeText]);

  // Group decisions by month
  const grouped = useMemo(() => {
    const groups: Record<string, DecisionEntry[]> = {};
    const sorted = [...decisions].sort((a, b) => b.date.localeCompare(a.date));
    for (const d of sorted) {
      const month = d.date.slice(0, 7); // YYYY-MM
      if (!groups[month]) groups[month] = [];
      groups[month].push(d);
    }
    return groups;
  }, [decisions]);

  const today = new Date().toISOString().split('T')[0];

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    padding: '8px 10px',
    color: '#E2E8F0',
    fontSize: 13,
    outline: 'none',
    resize: 'vertical' as const,
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      marginTop: 16,
      overflow: 'hidden',
    }}>
      {/* Header — collapsible */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '14px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#E2E8F0',
        }}
      >
        <Brain size={18} style={{ color: '#A855F7' }} />
        <span style={{ fontWeight: 600, fontSize: 15 }}>Decision Journal</span>
        {outstanding.length > 0 && (
          <span style={{
            background: 'rgba(234, 179, 8, 0.15)',
            color: '#EAB308',
            borderRadius: 8,
            padding: '1px 8px',
            fontSize: 11,
            fontWeight: 600,
          }}>
            {outstanding.length} overdue
          </span>
        )}
        <span style={{ marginLeft: 'auto', color: '#6B7280' }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* New Decision Button / Form */}
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(168, 85, 247, 0.1)',
                border: '1px solid rgba(168, 85, 247, 0.2)',
                borderRadius: 8,
                padding: '8px 14px',
                color: '#A855F7',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: 12,
              }}
            >
              <Plus size={14} /> Log Decision
            </button>
          ) : (
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              borderRadius: 10,
              padding: 14,
              marginBottom: 12,
            }}>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: '#8BA4BE', display: 'block', marginBottom: 4 }}>
                  Decision
                </label>
                <textarea
                  value={decision}
                  onChange={e => setDecision(e.target.value)}
                  placeholder="What decision are you making?"
                  rows={2}
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: '#8BA4BE', display: 'block', marginBottom: 4 }}>
                  Context
                </label>
                <textarea
                  value={context}
                  onChange={e => setContext(e.target.value)}
                  placeholder="Why are you making this decision? What factors are involved?"
                  rows={2}
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: '#8BA4BE', display: 'block', marginBottom: 4 }}>
                  Expected Outcome
                </label>
                <input
                  value={expectedOutcome}
                  onChange={e => setExpectedOutcome(e.target.value)}
                  placeholder="What do you expect to happen?"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: '#8BA4BE', display: 'block', marginBottom: 4 }}>
                  Revisit Date
                </label>
                <input
                  type="date"
                  value={revisitDate}
                  onChange={e => setRevisitDate(e.target.value)}
                  style={{ ...inputStyle, width: 'auto' }}
                />
              </div>

              {/* Real-time bias warnings */}
              {detectedBiases.length > 0 && (
                <div style={{
                  background: 'rgba(234, 179, 8, 0.08)',
                  border: '1px solid rgba(234, 179, 8, 0.2)',
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 10,
                }}>
                  <div style={{ fontSize: 11, color: '#EAB308', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={12} /> Potential biases detected
                  </div>
                  {detectedBiases.map(bias => (
                    <div key={bias} style={{ fontSize: 12, color: '#CBD5E1', marginBottom: 4 }}>
                      <span style={{ color: BIAS_COLORS[bias], fontWeight: 600 }}>
                        {BIAS_DESCRIPTIONS[bias].name}
                      </span>
                      <span style={{ color: '#8BA4BE' }}> — {BIAS_DESCRIPTIONS[bias].reframe}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleSave}
                  disabled={!decision.trim()}
                  style={{
                    background: decision.trim() ? 'linear-gradient(135deg, #A855F7 0%, #7C3AED 100%)' : '#374151',
                    border: 'none',
                    borderRadius: 6,
                    padding: '7px 16px',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: decision.trim() ? 'pointer' : 'default',
                  }}
                >
                  Save Decision
                </button>
                <button
                  onClick={() => { setShowForm(false); setDecision(''); setContext(''); setExpectedOutcome(''); setRevisitDate(''); setDetectedBiases([]); }}
                  style={{
                    background: 'none',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6,
                    padding: '7px 12px',
                    color: '#8BA4BE',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Outstanding decisions (overdue) */}
          {outstanding.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#EAB308', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} /> Overdue for Review
              </div>
              {outstanding.map(d => (
                <div key={d.id} style={{
                  background: 'rgba(234, 179, 8, 0.06)',
                  border: '1px solid rgba(234, 179, 8, 0.15)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  marginBottom: 6,
                }}>
                  <div style={{ fontSize: 13, color: '#E2E8F0', marginBottom: 4 }}>{d.decision}</div>
                  <div style={{ fontSize: 11, color: '#8BA4BE' }}>
                    Expected: {d.expectedOutcome}
                  </div>
                  {outcomeId === d.id ? (
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <input
                        value={outcomeText}
                        onChange={e => setOutcomeText(e.target.value)}
                        placeholder="What actually happened?"
                        style={{ ...inputStyle, flex: 1 }}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleRecordOutcome(d.id); }}
                      />
                      <button
                        onClick={() => handleRecordOutcome(d.id)}
                        style={{
                          background: '#39FF14',
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 10px',
                          color: '#0A1628',
                          fontWeight: 600,
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setOutcomeId(d.id); setOutcomeText(''); }}
                      style={{
                        marginTop: 6,
                        background: 'none',
                        border: '1px solid rgba(57, 255, 20, 0.2)',
                        borderRadius: 4,
                        padding: '4px 10px',
                        color: '#39FF14',
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <CheckCircle2 size={11} /> Record Outcome
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Past decisions grouped by month */}
          {Object.entries(grouped).map(([month, entries]) => {
            const monthLabel = new Date(month + '-01T00:00:00').toLocaleDateString('en-AU', {
              month: 'long', year: 'numeric',
            });
            return (
              <div key={month} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, marginBottom: 6 }}>
                  {monthLabel}
                </div>
                {entries.map(d => {
                  const isOverdue = d.revisitDate && d.revisitDate <= today && !d.actualOutcome;
                  return (
                    <div key={d.id} style={{
                      background: isOverdue
                        ? 'rgba(234, 179, 8, 0.04)'
                        : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isOverdue ? 'rgba(234, 179, 8, 0.15)' : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: 6,
                      padding: '8px 10px',
                      marginBottom: 4,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, color: '#E2E8F0', flex: 1 }}>{d.decision}</span>
                        <span style={{ fontSize: 10, color: '#6B7280' }}>{d.date}</span>
                      </div>
                      {d.biasesDetected.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                          {d.biasesDetected.map(b => (
                            <span key={b} style={{
                              fontSize: 10,
                              background: `${BIAS_COLORS[b]}15`,
                              color: BIAS_COLORS[b],
                              padding: '1px 6px',
                              borderRadius: 4,
                            }}>
                              {BIAS_DESCRIPTIONS[b].name}
                            </span>
                          ))}
                        </div>
                      )}
                      {d.actualOutcome && (
                        <div style={{ fontSize: 11, color: '#39FF14', marginTop: 4, opacity: 0.8 }}>
                          Outcome: {d.actualOutcome}
                        </div>
                      )}
                      {!d.actualOutcome && d.revisitDate && !isOverdue && (
                        <div style={{ fontSize: 10, color: '#6B7280', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={10} /> Revisit: {d.revisitDate}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Bias frequency chart */}
          {decisions.length >= 3 && (
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 8,
              padding: 12,
              marginTop: 8,
            }}>
              <div style={{ fontSize: 12, color: '#8BA4BE', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <BarChart3 size={13} /> Bias Frequency
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(Object.entries(report.biasCount) as [CognitiveBias, number][])
                  .filter(([_, count]) => count > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([bias, count]) => {
                    const maxCount = Math.max(...Object.values(report.biasCount), 1);
                    const pct = (count / maxCount) * 100;
                    return (
                      <div key={bias} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: BIAS_COLORS[bias], width: 120, flexShrink: 0 }}>
                          {BIAS_DESCRIPTIONS[bias].name}
                        </span>
                        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3 }}>
                          <div style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: BIAS_COLORS[bias],
                            borderRadius: 3,
                            transition: 'width 0.3s',
                          }} />
                        </div>
                        <span style={{ fontSize: 11, color: '#6B7280', width: 20, textAlign: 'right' }}>{count}</span>
                      </div>
                    );
                  })}
                {Object.values(report.biasCount).every(c => c === 0) && (
                  <div style={{ fontSize: 11, color: '#4B5563', fontStyle: 'italic' }}>
                    No biases detected yet. Keep logging decisions.
                  </div>
                )}
              </div>
            </div>
          )}

          {decisions.length === 0 && (
            <div style={{ fontSize: 13, color: '#4B5563', fontStyle: 'italic', textAlign: 'center', padding: 12 }}>
              No decisions logged yet. Start tracking to identify patterns.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
