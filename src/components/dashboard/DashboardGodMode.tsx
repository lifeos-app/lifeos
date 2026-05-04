/**
 * DashboardGodMode.tsx — WorldView-inspired unified cross-domain visualization
 *
 * Combines Knowledge Graph, Temporal Playback, and NL Query into a
 * single cross-domain dashboard widget with tabbed navigation.
 *
 * Design: Glass card, purple/emerald/blue gradient brand, Lucide icons only.
 * Tabs: Graph | Timeline | Query — smooth opacity/transform transitions.
 * Quick-stats badges: total nodes, active connections, recent insights.
 * Compact: ~380px width, max 400px height per tab with overflow-auto.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Network, Clock, Search, Brain, Layers,
  Loader2, Send, Link2, Sparkles,
} from 'lucide-react';
import { KnowledgeGraphView } from '../KnowledgeGraphView';
import { DashboardTemporalPlayback, type DaySnapshot } from './DashboardTemporalPlayback';
import { useNLQuery } from '../../hooks/useNLQuery';
import { NLQueryResult } from '../NLQueryResult';
import { useTemporalSnapshots } from '../../hooks/useTemporalSnapshots';
import { getKnowledgeGraph } from '../../lib/knowledge-graph';

// ── Types ──────────────────────────────────────────────────────────

type GodModeTab = 'graph' | 'timeline' | 'query';

interface DashboardGodModeProps {
  /** Optional override: pre-computed temporal snapshots */
  snapshots?: DaySnapshot[];
}

// ── Tab config ─────────────────────────────────────────────────────

const TABS: { key: GodModeTab; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
  { key: 'graph',    label: 'Graph',    icon: Network },
  { key: 'timeline', label: 'Timeline', icon: Clock },
  { key: 'query',    label: 'Query',    icon: Search },
];

// ── Component ──────────────────────────────────────────────────────

export function DashboardGodMode({ snapshots: snapshotsProp }: DashboardGodModeProps) {
  const [activeTab, setActiveTab] = useState<GodModeTab>('graph');
  const [queryInput, setQueryInput] = useState('');

  // Temporal snapshots — use prop or compute via hook
  const computedSnapshots = useTemporalSnapshots(7);
  const snapshots = snapshotsProp ?? computedSnapshots;

  // NL query
  const { ask, result, loading: queryLoading } = useNLQuery();

  // Knowledge graph stats — read once from singleton (no new API calls)
  const kgStats = useMemo(() => {
    try {
      const kg = getKnowledgeGraph();
      return kg.getStats();
    } catch {
      return { nodeCount: 0, edgeCount: 0, nodeTypes: {}, edgeTypes: {} };
    }
  }, []);

  // Quick-stats derived values
  const totalNodes = kgStats.nodeCount;
  const activeConnections = kgStats.edgeCount;
  const recentInsights = useMemo(() => {
    // Count number of non-zero node types as a proxy for "active domains"
    const activeDomains = Object.values(kgStats.nodeTypes).filter(c => c > 0).length;
    return activeDomains;
  }, [kgStats.nodeTypes]);

  // Handle query submit
  const handleQuerySubmit = useCallback(() => {
    const q = queryInput.trim();
    if (!q) return;
    ask(q);
  }, [queryInput, ask]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleQuerySubmit();
    }
  }, [handleQuerySubmit]);

  // Tab transition styles
  const getTabPanelStyle = (isActive: boolean): React.CSSProperties => ({
    position: isActive ? 'relative' : 'absolute',
    inset: 0,
    opacity: isActive ? 1 : 0,
    transform: isActive ? 'translateY(0)' : 'translateY(6px)',
    transition: 'opacity 0.25s ease, transform 0.25s ease',
    pointerEvents: isActive ? 'auto' : 'none',
    maxHeight: 400,
    overflowY: 'auto',
    overflowX: 'hidden',
  });

  return (
    <div
      className="dash-card god-mode-card"
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        overflow: 'hidden',
      }}
      aria-label="God Mode — Unified cross-domain visualization"
    >
      {/* ── Gradient Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(16, 185, 129, 0.12), rgba(59, 130, 246, 0.12))',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={16} color="#A855F7" />
          <span style={{
            fontSize: 13,
            fontWeight: 700,
            background: 'linear-gradient(135deg, #A855F7, #10B981, #3B82F6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            God Mode
          </span>
        </div>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 500, letterSpacing: 0.5 }}>
          WorldView
        </span>
      </div>

      {/* ── Tab Navigation ── */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          padding: '6px 8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}
        role="tablist"
        aria-label="God Mode tabs"
      >
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const TabIcon = tab.icon;
          const accentColors: Record<GodModeTab, string> = {
            graph: '#A855F7',
            timeline: '#10B981',
            query: '#3B82F6',
          };
          const accent = accentColors[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              aria-selected={isActive}
              aria-controls={`god-mode-panel-${tab.key}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                flex: 1,
                justifyContent: 'center',
                padding: '6px 10px',
                borderRadius: 8,
                border: 'none',
                background: isActive ? `${accent}1A` : 'transparent',
                color: isActive ? accent : 'rgba(255,255,255,0.5)',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <TabIcon size={13} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Quick Stats Badges ── */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '8px 12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
        }}
      >
        <StatBadge icon={<Brain size={11} />} label="Nodes" value={totalNodes} color="#A855F7" />
        <StatBadge icon={<Link2 size={11} />} label="Connections" value={activeConnections} color="#10B981" />
        <StatBadge icon={<Sparkles size={11} />} label="Domains" value={recentInsights} color="#3B82F6" />
      </div>

      {/* ── Tab Panels (stacked, transition via opacity/transform) ── */}
      <div style={{ position: 'relative', minHeight: 200 }}>
        {/* Graph Tab */}
        <div
          id="god-mode-panel-graph"
          role="tabpanel"
          aria-labelledby="graph"
          style={getTabPanelStyle(activeTab === 'graph')}
        >
          <div style={{
            height: 360,
            overflow: 'hidden',
            borderRadius: 8,
            margin: 4,
            position: 'relative',
          }}>
            <KnowledgeGraphView />
          </div>
        </div>

        {/* Timeline Tab */}
        <div
          id="god-mode-panel-timeline"
          role="tabpanel"
          aria-labelledby="timeline"
          style={getTabPanelStyle(activeTab === 'timeline')}
        >
          <div style={{ padding: '8px 8px 4px' }}>
            {snapshots.length > 0 ? (
              <DashboardTemporalPlayback snapshots={snapshots} />
            ) : (
              <EmptyTabState icon={<Clock size={28} />} message="No temporal data yet" />
            )}
          </div>
        </div>

        {/* Query Tab */}
        <div
          id="god-mode-panel-query"
          role="tabpanel"
          aria-labelledby="query"
          style={getTabPanelStyle(activeTab === 'query')}
        >
          <div style={{ padding: '8px 10px' }}>
            {/* Query input bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 10,
              marginBottom: 8,
            }}>
              <Search size={14} color="rgba(255,255,255,0.4)" />
              <input
                type="text"
                value={queryInput}
                onChange={e => setQueryInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your life data..."
                aria-label="Natural language query input"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#e2e8f0',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  minWidth: 0,
                }}
              />
              <button
                onClick={handleQuerySubmit}
                disabled={queryLoading || !queryInput.trim()}
                aria-label="Submit query"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: 'none',
                  background: queryInput.trim() ? '#3B82F6' : 'rgba(255,255,255,0.06)',
                  color: queryInput.trim() ? '#fff' : 'rgba(255,255,255,0.3)',
                  cursor: queryInput.trim() && !queryLoading ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                {queryLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              </button>
            </div>

            {/* Quick query suggestions */}
            {!result && !queryLoading && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Try asking
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {['How was my sleep?', 'Habit completion this week', 'Show my mood trends', 'What goals need attention?'].map(q => (
                    <button
                      key={q}
                      onClick={() => { setQueryInput(q); }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(255,255,255,0.03)',
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: 11,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Query result */}
            {result && (
              <NLQueryResult result={result} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function StatBadge({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 8px',
      borderRadius: 6,
      background: `${color}0D`,
      border: `1px solid ${color}20`,
      fontSize: 11,
      flex: 1,
      minWidth: 0,
    }}>
      <span style={{ color, display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{ color, fontWeight: 700, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function EmptyTabState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
      gap: 8,
      color: 'rgba(255,255,255,0.3)',
    }}>
      {icon}
      <span style={{ fontSize: 12, fontWeight: 500 }}>{message}</span>
    </div>
  );
}

export default DashboardGodMode;