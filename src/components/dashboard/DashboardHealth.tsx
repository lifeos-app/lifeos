/**
 * DashboardHealth — Health vitals widget for the Dashboard.
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, ChevronRight, Frown, Meh, Smile, SmilePlus, Moon, Zap, Droplets, Scale,
} from 'lucide-react';

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
    </section>
  );
});
