/**
 * DashboardHealth — Health vitals widget for the Dashboard.
 */

import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, ChevronRight, Frown, Meh, Smile, SmilePlus, Moon, Zap, Droplets, Scale, GitMerge,
} from 'lucide-react';
import { useHealthStore } from '../../stores/useHealthStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { correlateHealthWithProductivity } from '../../lib/llm/correlation-engine';

interface HealthMetrics {
  mood_score?: number;
  energy_score?: number;
  sleep_hours?: number;
  water_glasses?: number;
  weight_kg?: number;
}

interface DashboardHealthProps {
  healthMetrics: HealthMetrics | null;
}

export const DashboardHealth = React.memo(function DashboardHealth({ healthMetrics }: DashboardHealthProps) {
  const navigate = useNavigate();

  // Pull store slices for correlation analysis
  const allMetrics = useHealthStore(s => s.todayMetrics ? [s.todayMetrics] : []);
  const tasks = useScheduleStore(s => s.tasks);
  const habitLogs = useHabitsStore(s => s.logs);

  // Run health↔productivity correlations (memoised — only changes when data changes)
  const correlations = useMemo(
    () => correlateHealthWithProductivity(allMetrics as Parameters<typeof correlateHealthWithProductivity>[0], tasks, habitLogs)
      .filter(c => Math.abs(c.strength) >= 0.35)
      .slice(0, 2),
    [allMetrics, tasks, habitLogs],
  );

  return (
    <section className="dash-card">
      <div className="card-top">
        <h2><Activity size={16} /> Health Vitals</h2>
        <Link to="/health" className="card-link">Full view <ChevronRight size={14} /></Link>
      </div>
      {healthMetrics ? (
        <div className="dash-health-grid">
          {healthMetrics.mood_score && (
            <div className="dash-health-metric clickable" onClick={() => navigate('/health')}>
              <span className="dash-health-emoji">{[<Frown size={20} color="#F43F5E" />, <Frown size={20} color="#F97316" />, <Meh size={20} color="#FACC15" />, <Smile size={20} color="#00D4FF" />, <SmilePlus size={20} color="#4ECB71" />][healthMetrics.mood_score - 1]}</span>
              <span className="dash-health-label">Mood</span>
            </div>
          )}
          {healthMetrics.energy_score && (
            <div className="dash-health-metric clickable" onClick={() => navigate('/health')}>
              <span className="dash-health-emoji"><Zap size={20} color="#FACC15" /></span>
              <span className="dash-health-val">{healthMetrics.energy_score}/5</span>
              <span className="dash-health-label">Energy</span>
            </div>
          )}
          {healthMetrics.sleep_hours && (
            <div className="dash-health-metric clickable" onClick={() => navigate('/health')}>
              <span className="dash-health-emoji"><Moon size={20} color="#74B9FF" /></span>
              <span className="dash-health-val">{healthMetrics.sleep_hours}h</span>
              <span className="dash-health-label">Sleep</span>
            </div>
          )}
          {healthMetrics.water_glasses != null && (
            <div className="dash-health-metric clickable" onClick={() => navigate('/health')}>
              <span className="dash-health-emoji"><Droplets size={20} color="#74B9FF" /></span>
              <span className="dash-health-val">{healthMetrics.water_glasses}/8</span>
              <span className="dash-health-label">Water</span>
            </div>
          )}
          {healthMetrics.weight_kg && (
            <div className="dash-health-metric clickable" onClick={() => navigate('/health')}>
              <span className="dash-health-emoji"><Scale size={20} color="#A855F7" /></span>
              <span className="dash-health-val">{healthMetrics.weight_kg}kg</span>
              <span className="dash-health-label">Weight</span>
            </div>
          )}
        </div>
      ) : (
        <div className="card-empty">
          <p>No health data today</p>
          <Link to="/health" className="card-empty-hint" style={{ color: '#00D4FF', textDecoration: 'none' }}>Log your vitals →</Link>
        </div>
      )}

      {/* Cross-domain correlations */}
      {correlations.length > 0 && (
        <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6, fontSize: 10, color: '#5A7A9A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <GitMerge size={10} /> Pattern detected
          </div>
          {correlations.map(c => (
            <div key={c.id} style={{
              fontSize: 10, color: c.type === 'positive' ? '#39FF14' : '#F97316',
              lineHeight: 1.45, marginBottom: 4, paddingLeft: 4,
              borderLeft: `2px solid ${c.type === 'positive' ? '#39FF1430' : '#F9731630'}`,
            }}>
              {c.description}
            </div>
          ))}
        </div>
      )}
    </section>
  );
});
