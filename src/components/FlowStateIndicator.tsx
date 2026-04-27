/**
 * FlowStateIndicator — A subtle indicator showing current flow state status.
 *
 * 3 states:
 *   - "Not in flow" (dim)
 *   - "Flow possible" (warm glow)
 *   - "Deep flow" (bright pulse with wave animation)
 *
 * Uses the Hermetic Principle of Rhythm as philosophical hook.
 * Click to manually start/log a flow session.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useFlowState, type FlowStateRecord, type FlowActivity } from '../hooks/useFlowState';
import { getUltradianPhase } from '../lib/flow-state-engine';

type FlowState = 'idle' | 'possible' | 'deep';

export function FlowStateIndicator() {
  const { currentFlowState, insights, isLikelyInFlow, logFlow, ultradianPhase } = useFlowState();
  const [manualFlowStart, setManualFlowStart] = useState<string | null>(null);
  const [showManualMenu, setShowManualMenu] = useState(false);

  // Determine flow state
  const flowState: FlowState = (() => {
    if (currentFlowState && currentFlowState.depth_score >= 0.7) return 'deep';
    if (isLikelyInFlow || manualFlowStart) return 'possible';
    if (ultradianPhase.phase === 'focus') return 'possible';
    return 'idle';
  })();

  // Current streak duration if in flow
  const streakMinutes = (() => {
    if (currentFlowState) return currentFlowState.duration_minutes;
    if (manualFlowStart) {
      return Math.round((Date.now() - new Date(manualFlowStart).getTime()) / 60000);
    }
    return 0;
  })();

  // Start manual flow session
  const startManualFlow = useCallback(() => {
    const now = new Date().toISOString();
    setManualFlowStart(now);
    setShowManualMenu(false);
  }, []);

  // End manual flow and log it
  const endManualFlow = useCallback((activity: FlowActivity) => {
    if (!manualFlowStart) return;
    const now = new Date().toISOString();
    const durationMin = Math.round((Date.now() - new Date(manualFlowStart).getTime()) / 60000);
    if (durationMin >= 5) {
      const record: FlowStateRecord = {
        id: `flow_manual_${Date.now()}`,
        startedAt: manualFlowStart,
        endedAt: now,
        duration_minutes: durationMin,
        activity,
        depth_score: durationMin >= 45 ? 0.7 : 0.4,
        challenge_level: 7,
        skill_level: 7,
      };
      logFlow(record);
    }
    setManualFlowStart(null);
  }, [manualFlowStart, logFlow]);

  // Auto-stop manual flow after 90 min (ultradian cycle)
  useEffect(() => {
    if (!manualFlowStart) return;
    const timeout = setTimeout(() => {
      endManualFlow('other');
    }, 90 * 60_000);
    return () => clearTimeout(timeout);
  }, [manualFlowStart, endManualFlow]);

  // Color and animation based on state
  const config = {
    idle: {
      bg: 'rgba(255,255,255,0.04)',
      border: 'rgba(255,255,255,0.08)',
      glow: 'none',
      icon: '○',
      label: 'Not in flow',
      color: 'rgba(255,255,255,0.35)',
    },
    possible: {
      bg: 'rgba(249,115,22,0.08)',
      border: 'rgba(249,115,22,0.2)',
      glow: '0 0 12px rgba(249,115,22,0.15)',
      icon: '◎',
      label: 'Flow possible',
      color: '#F97316',
    },
    deep: {
      bg: 'rgba(0,212,255,0.1)',
      border: 'rgba(0,212,255,0.3)',
      glow: '0 0 20px rgba(0,212,255,0.25)',
      icon: '◉',
      label: 'Deep flow',
      color: '#00D4FF',
    },
  }[flowState];

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        onClick={() => {
          if (manualFlowStart) {
            setShowManualMenu(true);
          } else {
            startManualFlow();
          }
        }}
        title={
          manualFlowStart
            ? `In flow for ${streakMinutes} min — click to end`
            : `Current: ${config.label}${ultradianPhase.phase === 'focus' ? ` — focus phase (${ultradianPhase.minutesLeft}m left)` : ` — rest phase (${ultradianPhase.minutesLeft}m left)`}`
        }
        aria-label={`Flow state: ${config.label}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 10px',
          borderRadius: 16,
          border: `1px solid ${config.border}`,
          background: config.bg,
          color: config.color,
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.4s ease',
          boxShadow: config.glow,
          outline: 'none',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Wave animation for deep flow */}
        {flowState === 'deep' && (
          <span
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              overflow: 'hidden',
              pointerEvents: 'none',
              opacity: 0.15,
            }}
          >
            <svg viewBox="0 0 80 20" style={{ width: '100%', height: '100%' }}>
              <path
                d="M0 10 Q10 0 20 10 Q30 20 40 10 Q50 0 60 10 Q70 20 80 10"
                fill="none"
                stroke="#00D4FF"
                strokeWidth="2"
                style={{
                  animation: 'flowWave 2s ease-in-out infinite',
                }}
              />
            </svg>
          </span>
        )}

        <span style={{
          fontSize: flowState === 'deep' ? 13 : 11,
          animation: flowState === 'deep' ? 'flowPulse 2s ease-in-out infinite' : 'none',
        }}>
          {config.icon}
        </span>

        <span style={{ position: 'relative', zIndex: 1 }}>
          {manualFlowStart ? `${streakMinutes}m` : config.label}
        </span>

        {ultradianPhase.phase === 'focus' && !manualFlowStart && (
          <span style={{ fontSize: 9, opacity: 0.6, position: 'relative', zIndex: 1 }}>
            {ultradianPhase.minutesLeft}m
          </span>
        )}
      </button>

      {/* Manual flow end menu */}
      {showManualMenu && manualFlowStart && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 4,
          background: 'rgba(15,20,30,0.95)',
          border: '1px solid rgba(0,212,255,0.2)',
          borderRadius: 10,
          padding: '8px 0',
          minWidth: 160,
          zIndex: 100,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          <div style={{ padding: '2px 12px', fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
            Log flow activity:
          </div>
          {(['coding', 'writing', 'studying', 'exercise', 'cleaning', 'other'] as FlowActivity[]).map(act => (
            <button
              key={act}
              onClick={() => endManualFlow(act)}
              style={{
                display: 'block',
                width: '100%',
                padding: '6px 12px',
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.8)',
                fontSize: 12,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,212,255,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {act.charAt(0).toUpperCase() + act.slice(1)}
            </button>
          ))}
          <button
            onClick={() => { setManualFlowStart(null); setShowManualMenu(false); }}
            style={{
              display: 'block',
              width: '100%',
              padding: '6px 12px',
              background: 'transparent',
              border: 'none',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.4)',
              fontSize: 11,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Inline keyframes for animations */}
      <style>{`
        @keyframes flowPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes flowWave {
          0% { transform: translateX(-20px); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}