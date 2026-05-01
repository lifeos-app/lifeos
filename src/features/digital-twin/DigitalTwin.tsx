/**
 * DigitalTwin.tsx — Main page component for the Digital Twin feature
 *
 * A visual dashboard showing the AI's understanding of your behavioral patterns.
 * Combines TwinDashboard, PredictionFeed, InterventionPanel, and PatternDiscovery
 * into a cohesive "Your Digital Twin" experience.
 */

import { useState, useCallback } from 'react';
import { useDigitalTwin } from './useDigitalTwin';
import { TwinDashboard } from './TwinDashboard';
import { PredictionFeed } from './PredictionFeed';
import { InterventionPanel } from './InterventionPanel';
import { PatternDiscovery } from './PatternDiscovery';
import type { BehavioralPattern, Prediction, Intervention, BehavioralTraits } from './useDigitalTwin';

// ── Icons ──────────────────────────────────────────────────────────────

const BrainIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"/>
    <path d="M9 21h6"/>
    <path d="M9 17v2"/>
    <path d="M15 17v2"/>
  </svg>
);

const RadarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="2"/>
    <path d="M12 2v4"/>
    <path d="M12 18v4"/>
    <path d="M2 12h4"/>
    <path d="M18 12h4"/>
    <path d="M4.93 4.93l2.83 2.83"/>
    <path d="M16.24 16.24l2.83 2.83"/>
    <path d="M4.93 19.07l2.83-2.83"/>
    <path d="M16.24 7.76l2.83-2.83"/>
  </svg>
);

const ForecastIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18"/>
    <path d="M5.5 6.5l2 2"/>
    <path d="M16.5 6.5l-2 2"/>
    <path d="M3 12h4"/>
    <path d="M17 12h4"/>
    <path d="M5.5 17.5l2-2"/>
    <path d="M16.5 17.5l-2-2"/>
  </svg>
);

const CoachIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8"/>
    <path d="M4 12h4v4l-4 4"/>
    <path d="M20 12h-4v4l4 4"/>
    <rect x="8" y="8" width="8" height="8" rx="1"/>
  </svg>
);

const MagnifyingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <path d="M21 21l-4.3-4.3"/>
  </svg>
);

// ── Accuracy ring ───────────────────────────────────────────────────

function AccuracyRing({ accuracy, size = 60 }: { accuracy: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (accuracy / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="rgba(30,58,91,0.4)"
          strokeWidth="4"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="url(#accuracyGradient)"
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="accuracyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00D4FF" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute text-sm font-bold" style={{ color: '#E2E8F0' }}>
        {Math.round(accuracy)}%
      </span>
    </div>
  );
}

// ── Behavioral timeline ─────────────────────────────────────────────

function BehavioralTimeline({ patterns }: { patterns: BehavioralPattern[] }) {
  // Generate a 7-day mini timeline showing pattern activations
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const now = new Date().getDay();
  const todayIdx = now === 0 ? 6 : now - 1; // Mon=0

  // Create visual indicators for each day
  const dayActivations = days.map((_, i) => {
    const isToday = i === todayIdx;
    const isPast = i <= todayIdx;
    const activation = isPast
      ? patterns.reduce((sum, p) => sum + (p.confidence * (0.3 + Math.random() * 0.7)), 0) / Math.max(patterns.length, 1)
      : 0;
    return { activation: isPast ? activation : 0, isToday };
  });

  return (
    <div className="flex items-end gap-2">
      {days.map((day, i) => {
        const { activation, isToday } = dayActivations[i];
        const h = Math.round(activation * 100);
        return (
          <div key={day} className="flex flex-col items-center gap-1 flex-1">
            <div
              className="w-full rounded-sm transition-all duration-300"
              style={{
                height: `${Math.max(4, h)}%`,
                background: isToday
                  ? 'linear-gradient(to top, #00D4FF, #8B5CF6)'
                  : activation > 0
                    ? `rgba(0, 212, 255, ${0.15 + activation * 0.4})`
                    : 'rgba(30, 58, 91, 0.3)',
                minHeight: '4px',
              }}
            />
            <span
              className="text-[9px]"
              style={{ color: isToday ? '#00D4FF' : '#64748B', fontWeight: isToday ? 'bold' : 'normal' }}
            >
              {day}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Tab config ──────────────────────────────────────────────────────

type Tab = 'dashboard' | 'predictions' | 'interventions' | 'patterns';

const TAB_CONFIG: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard',     label: 'Dashboard',     icon: <RadarIcon /> },
  { id: 'predictions',   label: 'Predictions',    icon: <ForecastIcon /> },
  { id: 'interventions', label: 'Coach',          icon: <CoachIcon /> },
  { id: 'patterns',      label: 'Patterns',        icon: <MagnifyingIcon /> },
];

// ── Main Component ────────────────────────────────────────────────────

export function DigitalTwin() {
  const {
    profile,
    loading,
    training,
    error,
    previousTraits,
    buildProfile,
    trainTwin,
    submitPredictionFeedback,
    submitInterventionFeedback,
    archetype,
    accuracy,
  } = useDigitalTwin();

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [patternReactions, setPatternReactions] = useState<Set<string>>(new Set());

  const handlePatternReaction = useCallback((patternId: string) => {
    setPatternReactions(prev => new Set(prev).add(patternId));
  }, []);

  // Loading state with skeleton
  if (loading && !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6" style={{ background: '#070D1A' }}>
        <div className="text-5xl mb-4 animate-pulse">🧠</div>
        <h2 className="text-lg font-bold mb-2" style={{ color: '#00D4FF' }}>
          Building your Digital Twin...
        </h2>
        <p className="text-sm" style={{ color: '#8BA4BE' }}>
          Analyzing your behavioral patterns, habits, and data
        </p>
        <div className="mt-4 flex items-center gap-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full animate-bounce"
              style={{
                background: '#00D4FF',
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error && !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6" style={{ background: '#070D1A' }}>
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-lg font-bold mb-2" style={{ color: '#EF4444' }}>
          Could not build your Twin
        </h2>
        <p className="text-sm mb-4" style={{ color: '#8BA4BE' }}>{error}</p>
        <button
          onClick={buildProfile}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: 'rgba(0,212,255,0.15)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.3)' }}
        >
          Try Again
        </button>
      </div>
    );
  }

  // Empty state — no profile yet
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6" style={{ background: '#070D1A' }}>
        <div className="text-7xl mb-4">🪞</div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: '#E2E8F0' }}>
          Your Digital Twin
        </h1>
        <p className="text-sm text-center mb-6 max-w-md" style={{ color: '#8BA4BE' }}>
          An AI model that learns your patterns, predicts your behavior, and intervenes before you fall off.
          The more data you give it, the smarter it gets.
        </p>
        <button
          onClick={buildProfile}
          className="px-6 py-3 rounded-lg font-medium transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)',
            color: '#070D1A',
          }}
        >
          🧠 Build My Twin
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#070D1A', color: '#E2E8F0' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(30,58,91,0.4)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(139,92,246,0.2))' }}
          >
            <BrainIcon />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: '#00D4FF' }}>
              Digital Twin
            </h1>
            <p className="text-xs" style={{ color: '#8BA4BE' }}>
              {profile.archetype} · {profile.dataPoints} data points analyzed
            </p>
          </div>
        </div>

        {/* Accuracy + Train */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <AccuracyRing accuracy={profile.accuracy} size={44} />
            <span className="text-[9px] mt-0.5" style={{ color: '#64748B' }}>accuracy</span>
          </div>
          <button
            onClick={trainTwin}
            disabled={training}
            className="px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5"
            style={{
              background: training ? 'rgba(139,92,246,0.1)' : 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(0,212,255,0.2))',
              color: training ? '#64748B' : '#C084FC',
              border: `1px solid ${training ? 'rgba(30,58,91,0.4)' : 'rgba(139,92,246,0.3)'}`,
            }}
          >
            {training ? (
              <>
                <span className="animate-spin">⚙️</span> Training...
              </>
            ) : (
              <>🔄 Train Twin</>
            )}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="flex items-center gap-1 px-4 py-2"
        style={{ borderBottom: '1px solid rgba(30,58,91,0.3)' }}
      >
        {TAB_CONFIG.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: activeTab === tab.id ? 'rgba(0,212,255,0.1)' : 'transparent',
              color: activeTab === tab.id ? '#00D4FF' : '#8BA4BE',
              border: `1px solid ${activeTab === tab.id ? 'rgba(0,212,255,0.2)' : 'transparent'}`,
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: 'thin' }}>
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Personality radar */}
            <TwinDashboard
              traits={profile.traits}
              previousTraits={previousTraits}
              archetype={profile.archetype}
            />

            {/* Behavioral timeline */}
            <div>
              <h3 className="text-sm font-semibold mb-2" style={{ color: '#C084FC' }}>
                📊 Behavioral Rhythm
              </h3>
              <div
                className="rounded-xl p-4 h-32 flex flex-col justify-end"
                style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(30,58,91,0.4)' }}
              >
                <BehavioralTimeline patterns={profile.patterns} />
              </div>
            </div>

            {/* Quick insights */}
            <div>
              <h3 className="text-sm font-semibold mb-3" style={{ color: '#00D4FF' }}>
                💡 Your Twin has noticed...
              </h3>
              <div className="space-y-2">
                {profile.patterns.slice(0, 3).map((pattern, i) => (
                  <div
                    key={pattern.id}
                    className="p-3 rounded-lg"
                    style={{
                      background: 'rgba(15,23,42,0.5)',
                      border: '1px solid rgba(30,58,91,0.4)',
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-sm">
                        {['🧬', '⚡', '🔄'][i] || '📊'}
                      </span>
                      <div>
                        <p className="text-sm font-medium" style={{ color: '#E2E8F0' }}>
                          {pattern.name}
                        </p>
                        <p className="text-xs" style={{ color: '#8BA4BE' }}>
                          {pattern.description}
                        </p>
                      </div>
                      <span className="text-xs ml-auto whitespace-nowrap" style={{ color: '#64748B' }}>
                        {Math.round(pattern.confidence * 100)}% conf.
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top prediction */}
            {profile.predictions.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: '#FACC15' }}>
                  ⚡ Top Prediction
                </h3>
                <div
                  className="p-4 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(250,204,21,0.08), rgba(249,115,22,0.08))',
                    border: '1px solid rgba(250,204,21,0.2)',
                  }}
                >
                  <p className="text-sm font-medium" style={{ color: '#FACC15' }}>
                    {profile.predictions[0].event}
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#8BA4BE' }}>
                    {profile.predictions[0].reasoning}
                  </p>
                </div>
              </div>
            )}

            {/* Top intervention */}
            {profile.interventions.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: '#10B981' }}>
                  🎯 Recommended Action
                </h3>
                <div
                  className="p-4 rounded-xl"
                  style={{
                    background: 'rgba(16,185,129,0.08)',
                    border: '1px solid rgba(16,185,129,0.2)',
                    borderLeft: '3px solid #10B981',
                  }}
                >
                  <p className="text-xs mb-1" style={{ color: '#10B981' }}>
                    {profile.interventions[0].trigger}
                  </p>
                  <p className="text-sm font-medium" style={{ color: '#E2E8F0' }}>
                    {profile.interventions[0].action}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'predictions' && (
          <PredictionFeed
            predictions={profile.predictions}
            onFeedback={submitPredictionFeedback}
          />
        )}

        {activeTab === 'interventions' && (
          <InterventionPanel
            interventions={profile.interventions}
            onFeedback={submitInterventionFeedback}
          />
        )}

        {activeTab === 'patterns' && (
          <PatternDiscovery
            patterns={profile.patterns}
            onReaction={handlePatternReaction}
          />
        )}
      </div>

      {/* Last updated footer */}
      <div className="px-4 py-2 text-center" style={{ borderTop: '1px solid rgba(30,58,91,0.3)' }}>
        <span className="text-[10px]" style={{ color: '#475569' }}>
          Last updated: {new Date(profile.lastUpdated).toLocaleString()} · {profile.accuracy}% accuracy · {profile.dataPoints} data points
        </span>
      </div>
    </div>
  );
}

export default DigitalTwin;