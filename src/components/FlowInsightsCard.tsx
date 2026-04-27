/**
 * FlowInsightsCard — Shows flow insights: peak hours, avg duration, recommendations.
 *
 * Glass card style matching LifeOS design.
 * Uses the Hermetic Principle of Rhythm ("everything flows").
 */

import React from 'react';
import { useFlowState } from '../hooks/useFlowState';
import { SEVEN_PRINCIPLES } from '../lib/hermetic-integration';

export function FlowInsightsCard() {
  const { insights, flowStates, ultradianPhase } = useFlowState();

  // Rhythm principle (index 4)
  const rhythm = SEVEN_PRINCIPLES[4];
  const rhythmColor = rhythm.color;

  // Format hours for display
  const formatHour = (h: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${display}${ampm}`;
  };

  // Mini bar chart for peak hours
  const peakHourBars = insights.peakFlowHours.length > 0
    ? insights.peakFlowHours.map(h => {
        const flowsInHour = flowStates.filter(r => new Date(r.startedAt).getHours() === h).length;
        return { hour: h, count: flowsInHour, label: formatHour(h) };
      })
    : [];

  const maxPeakCount = Math.max(...peakHourBars.map(b => b.count), 1);

  // Weekly flow stats
  const lastWeekFlows = flowStates.filter(r => {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    return r.startedAt >= weekAgo;
  });
  const avgDepth = lastWeekFlows.length > 0
    ? lastWeekFlows.reduce((s, r) => s + r.depth_score, 0) / lastWeekFlows.length
    : 0;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(12px)',
      border: `1px solid rgba(249,115,22,0.12)`,
      borderRadius: 14,
      padding: '14px 16px',
      transition: 'border-color 0.3s ease',
    }}>
      {/* Header with Rhythm principle */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14, color: rhythmColor }}>∿</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#F9FAFB' }}>
            Flow Rhythm
          </span>
        </div>
        <span style={{
          fontSize: 9,
          fontWeight: 500,
          color: rhythmColor,
          opacity: 0.7,
          letterSpacing: 0.5,
        }}>
          RHYTHM
        </span>
      </div>

      {/* Peak hours mini chart */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontWeight: 500 }}>
          Peak Flow Hours
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 48 }}>
          {peakHourBars.length > 0 ? peakHourBars.map(bar => (
            <div key={bar.hour} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flex: 1,
              gap: 2,
            }}>
              <div style={{
                width: '100%',
                maxWidth: 28,
                height: Math.max(4, (bar.count / maxPeakCount) * 36),
                background: `linear-gradient(180deg, ${rhythmColor}, rgba(249,115,22,0.4))`,
                borderRadius: 3,
                transition: 'height 0.4s ease',
              }} />
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)' }}>
                {bar.label}
              </span>
            </div>
          )) : (
            <div style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.3)',
              fontStyle: 'italic',
            }}>
              Flow data will appear as you log sessions
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 8,
        marginBottom: 14,
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 8,
          padding: '6px 8px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F97316' }}>
            {insights.weeklyFlowHours}
          </div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
            hrs/week
          </div>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 8,
          padding: '6px 8px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F9FAFB' }}>
            {insights.avgFlowDuration}
          </div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
            avg min
          </div>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 8,
          padding: '6px 8px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#00D4FF' }}>
            {Math.round(avgDepth * 100)}%
          </div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
            depth
          </div>
        </div>
      </div>

      {/* Ultradian phase indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
        padding: '6px 10px',
        borderRadius: 8,
        background: ultradianPhase.phase === 'focus'
          ? 'rgba(0,212,255,0.06)'
          : 'rgba(249,115,22,0.06)',
        border: `1px solid ${ultradianPhase.phase === 'focus' ? 'rgba(0,212,255,0.12)' : 'rgba(249,115,22,0.12)'}`,
      }}>
        <span style={{
          fontSize: 11,
          color: ultradianPhase.phase === 'focus' ? '#00D4FF' : '#F97316',
          fontWeight: 600,
        }}>
          {ultradianPhase.phase === 'focus' ? '◈ Focus' : '◌ Rest'}
        </span>
        <div style={{
          flex: 1,
          height: 3,
          borderRadius: 2,
          background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: ultradianPhase.phase === 'focus'
              ? `${((90 - ultradianPhase.minutesLeft) / 90) * 100}%`
              : `${((20 - ultradianPhase.minutesLeft) / 20) * 100}%`,
            background: ultradianPhase.phase === 'focus'
              ? 'linear-gradient(90deg, #00D4FF, rgba(0,212,255,0.4))'
              : 'linear-gradient(90deg, #F97316, rgba(249,115,22,0.4))',
            borderRadius: 2,
            transition: 'width 1s ease',
          }} />
        </div>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
          {ultradianPhase.minutesLeft}m
        </span>
      </div>

      {/* Recommendations */}
      <div style={{
        fontSize: 11,
        color: 'rgba(255,255,255,0.6)',
        lineHeight: 1.5,
        padding: '8px 10px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: rhythmColor, marginBottom: 4, letterSpacing: 0.5 }}>
          RHYTHM SAYS
        </div>
        {insights.recommendation}
      </div>

      {/* Conditions tags */}
      {insights.optimalConditions.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
          {insights.optimalConditions.map(c => (
            <span key={c} style={{
              fontSize: 9,
              padding: '2px 7px',
              borderRadius: 10,
              background: 'rgba(249,115,22,0.08)',
              border: '1px solid rgba(249,115,22,0.15)',
              color: 'rgba(249,115,22,0.8)',
            }}>
              {c.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}