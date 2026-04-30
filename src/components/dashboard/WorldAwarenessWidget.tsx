/**
 * WorldAwarenessWidget — P7-020
 *
 * Compact card showing timezone, season, weather approximation,
 * daylight progress bar, seasonal tip, and days until next season.
 * Dark theme: bg #050E1A, card #0F2D4A, accent #00D4FF
 * Lucide icons only — no emoji.
 */

import React, { useState, useEffect } from 'react';
import {
  Globe, Sun, Moon, Thermometer, CloudRain, Leaf,
  Snowflake, Flower, Sunrise, Sunset, ArrowRight,
  Zap, Target, Battery, MoonStar, Compass, Sprout,
  BatteryCharging,
} from 'lucide-react';
import { getWorldContext, type WorldContext } from '../../lib/world-awareness';

const SEASON_ICON_MAP: Record<string, React.FC<any>> = {
  Sun,
  Snowflake,
  Leaf,
  Flower,
  CloudRain,
};

const PRODUCTIVITY_ICON_MAP: Record<string, React.FC<any>> = {
  Sunrise, Sunset, ArrowRight, Zap, Target, Battery, Moon, MoonStar,
  Compass, Sprout, Sun, BatteryCharging,
};

export function WorldAwarenessWidget() {
  const [ctx, setCtx] = useState<WorldContext | null>(null);

  useEffect(() => {
    setCtx(getWorldContext());
  }, []);

  if (!ctx) return null;

  const SeasonIcon = SEASON_ICON_MAP[ctx.season.icon] || Globe;

  // Determine if it's currently day or night
  const isDaytime = ctx.daylight.progressDaylight > 0 && ctx.daylight.progressDaylight < 1;
  const TimeIcon = isDaytime ? Sun : Moon;

  // Weather icon
  const WeatherIcon = SEASON_ICON_MAP[ctx.weather.icon] || Thermometer;

  return (
    <div style={{
      background: '#050E1A',
      borderRadius: 12,
      padding: 16,
      color: 'rgba(255,255,255,0.85)',
      fontSize: 13,
      lineHeight: 1.5,
      border: '1px solid rgba(0,212,255,0.15)',
    }}>
      {/* ── Header: Season + Hemisphere + Timezone ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <SeasonIcon size={18} color="#00D4FF" strokeWidth={2} />
        <span style={{ fontWeight: 600, color: '#00D4FF', fontSize: 14 }}>
          {ctx.season.name}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
          ({ctx.hemisphere === 'northern' ? 'N' : 'S'} hemi)
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
          <Globe size={12} />
          {ctx.timezone.replace(/_/, ' ')}
        </span>
      </div>

      {/* ── Weather Approximation ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px', marginBottom: 10,
        background: '#0F2D4A', borderRadius: 8,
      }}>
        <WeatherIcon size={16} color="rgba(255,255,255,0.6)" />
        <span style={{ color: 'rgba(255,255,255,0.75)' }}>
          {ctx.weather.description}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          ~seasonal
        </span>
      </div>

      {/* ── Daylight Progress Bar ── */}
      <div style={{ marginBottom: 12 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 4, fontSize: 11, color: 'rgba(255,255,255,0.5)',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Sunrise size={12} /> {ctx.daylight.sunrise}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {ctx.daylight.daylightHours}h daylight
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Sunset size={12} /> {ctx.daylight.sunset}
          </span>
        </div>
        <div style={{
          position: 'relative',
          height: 6,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 3,
          overflow: 'hidden',
        }}>
          {/* Daylight window */}
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: '100%',
            background: 'linear-gradient(90deg, rgba(0,212,255,0.2), rgba(255,214,0,0.25), rgba(0,212,255,0.2))',
            borderRadius: 3,
          }} />
          {/* Current position marker */}
          <div style={{
            position: 'absolute',
            left: `${ctx.daylight.progressDay * 100}%`,
            top: -2,
            width: 2,
            height: 10,
            background: ctx.daylight.progressDaylight > 0 && ctx.daylight.progressDaylight < 1
              ? '#00D4FF'
              : 'rgba(255,255,255,0.3)',
            borderRadius: 1,
            transition: 'left 0.5s ease',
          }} />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.45)',
        }}>
          <TimeIcon size={11} />
          <span>
            {ctx.daylight.progressDaylight > 0 && ctx.daylight.progressDaylight < 1
              ? `${Math.round(ctx.daylight.progressDaylight * 100)}% through daylight`
              : ctx.daylight.progressDaylight >= 1
                ? 'After sunset'
                : 'Before sunrise'}
          </span>
        </div>
      </div>

      {/* ── Seasonal Tip (top productivity recommendation) ── */}
      {ctx.productivity.length > 0 && (
        <div style={{
          padding: '8px 10px',
          marginBottom: 10,
          background: '#0F2D4A',
          borderRadius: 8,
          borderLeft: '3px solid #00D4FF',
        }}>
          {(() => {
            const tip = ctx.productivity[0];
            const TipIcon = PRODUCTIVITY_ICON_MAP[tip.icon] || Zap;
            return (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <TipIcon size={14} color="#00D4FF" style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
                  {tip.recommendation}
                </span>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Days Until Next Season ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 10px',
        background: 'rgba(0,212,255,0.06)',
        borderRadius: 8,
        fontSize: 11,
      }}>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>Next season in</span>
        <span style={{ color: '#00D4FF', fontWeight: 600 }}>
          {ctx.season.daysUntilChange} day{ctx.season.daysUntilChange !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Global Context (awareness items, max 2) ── */}
      {ctx.globalContext.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {ctx.globalContext.slice(0, 2).map((item, i) => (
            <div key={i} style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.45)',
              padding: '2px 0',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <Globe size={10} />
              {item.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}