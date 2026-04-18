/**
 * HermeticInsightWidget — Daily Hermetic Principle Insight
 *
 * Rotates through the 7 Hermetic Principles, showing one per day
 * with a contextual life application. Fits naturally into the Dashboard
 * as a daily wisdom card.
 *
 * "The lips of wisdom are closed, except to the ears of understanding."
 * — The Kybalion
 */

import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';

interface HermeticPrinciple {
  name: string;
  principle: string;
  quote: string;
  source: string;
  application: string;
  color: string;
}

const HERMETIC_PRINCIPLES: HermeticPrinciple[] = [
  {
    name: 'Mentalism',
    principle: 'The All is Mind',
    quote: 'The Universe is Mental — held in the Mind of THE ALL.',
    source: 'The Kybalion',
    application: 'Your thoughts shape your reality. Today, observe the connection between your inner state and outer results.',
    color: '#a29bfe',
  },
  {
    name: 'Correspondence',
    principle: 'As above, so below',
    quote: 'As above, so below; as below, so above.',
    source: 'The Kybalion',
    application: 'Your micro-habits mirror your macro-goals. If your daily actions don\'t reflect your aspirations, adjust the small things first.',
    color: '#00D4FF',
  },
  {
    name: 'Vibration',
    principle: 'Nothing rests; everything moves',
    quote: 'Nothing rests; everything moves; everything vibrates.',
    source: 'The Kybalion',
    application: 'Your energy is never still. Notice where your vibration is today — are you rising or sinking? Change your motion to change your mood.',
    color: '#fd79a8',
  },
  {
    name: 'Polarity',
    principle: 'Everything is dual',
    quote: 'Everything is dual; everything has poles; everything has its pair of opposites.',
    source: 'The Kybalion',
    application: 'Stuck between two extremes? You don\'t have to choose — find the middle path. Transmute, don\'t resist.',
    color: '#ffeaa7',
  },
  {
    name: 'Rhythm',
    principle: 'Everything flows',
    quote: 'Everything flows, out and in; the pendulum swing manifests in everything.',
    source: 'The Kybalion',
    application: 'Success and setback are natural cycles. Don\'t cling to highs or fear lows — ride the rhythm.',
    color: '#55efc4',
  },
  {
    name: 'Cause & Effect',
    principle: 'Every cause has its effect',
    quote: 'Every cause has its effect; every effect has its cause.',
    source: 'The Kybalion',
    application: 'Nothing happens by chance. Today\'s results come from yesterday\'s actions. What seed are you planting right now?',
    color: '#fab1a0',
  },
  {
    name: 'Gender',
    principle: 'Gender is in everything',
    quote: 'Gender is in everything; everything has its masculine and feminine principles.',
    source: 'The Kybalion',
    application: 'Balance doing with being. Create with vision, then execute with will. Both forces are needed.',
    color: '#dfe6e9',
  },
];

/** Get today's principle based on day-of-year (stable per day, rotates weekly) */
function getDailyPrinciple(): HermeticPrinciple {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const index = dayOfYear % HERMETIC_PRINCIPLES.length;
  return HERMETIC_PRINCIPLES[index];
}

export function HermeticInsightWidget() {
  const principle = useMemo(() => getDailyPrinciple(), []);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0F2D4A 0%, #0a1f35 100%)',
      border: `1px solid ${principle.color}33`,
      borderRadius: 16,
      padding: '20px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle glow accent */}
      <div style={{
        position: 'absolute',
        top: -20,
        right: -20,
        width: 80,
        height: 80,
        background: `radial-gradient(circle, ${principle.color}22 0%, transparent 70%)`,
        borderRadius: '50%',
        pointerEvents: 'none',
      }} aria-hidden="true" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: `${principle.color}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Sparkles size={16} color={principle.color} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: principle.color, textTransform: 'uppercase', letterSpacing: 1.2 }}>
            {principle.name}
          </div>
          <div style={{ fontSize: 13, color: '#8BA4BE', marginTop: 1 }}>
            {principle.principle}
          </div>
        </div>
      </div>

      <blockquote style={{
        margin: '0 0 14px 0',
        padding: '0 0 0 14px',
        borderLeft: `2px solid ${principle.color}55`,
        fontSize: 14,
        fontStyle: 'italic',
        color: '#c0cad8',
        lineHeight: 1.6,
      }}>
        "{principle.quote}"
        <footer style={{ fontSize: 11, color: '#5A7A9A', marginTop: 4, fontStyle: 'normal' }}>
          — {principle.source}
        </footer>
      </blockquote>

      <p style={{
        margin: 0,
        fontSize: 13,
        color: '#8BA4BE',
        lineHeight: 1.6,
      }}>
        {principle.application}
      </p>
    </div>
  );
}