/**
 * FlipperCheckin — Game-style check-in triggered by Flipper Zero USB connection
 * 
 * Detects Flipper Zero via WebUSB API (VID 0x0483, PID 0x5740)
 * Shows RPG-style overlay for quick activity logging + health check
 */

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useUserStore } from '../stores/useUserStore';
import { logUnifiedEvent } from '../lib/events';
import { localInsert, localUpdate, localQuery, getEffectiveUserId } from '../lib/local-db';
import { localDateStr } from '../utils/date';
import { logger } from '../utils/logger';
import type { HealthMetric } from '../types/database';
import './FlipperCheckin.css';

const FLIPPER_VENDOR_ID = 0x0483; // STMicroelectronics
const FLIPPER_PRODUCT_ID = 0x5740; // Flipper Zero

const ACTIVITIES = [
  { emoji: '🔧', label: 'Working', type: 'work' },
  { emoji: '📚', label: 'Learning', type: 'custom' },
  { emoji: '💪', label: 'Exercise', type: 'exercise' },
  { emoji: '🍽️', label: 'Eating', type: 'meal' },
  { emoji: '😴', label: 'Resting', type: 'sleep' },
  { emoji: '🚗', label: 'Travelling', type: 'custom' },
  { emoji: '🎮', label: 'Gaming', type: 'custom' },
  { emoji: '💬', label: 'Socializing', type: 'custom' },
] as const;

const DURATIONS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hr', minutes: 60 },
  { label: '2 hr', minutes: 120 },
  { label: '3 hr+', minutes: 180 },
];

const ENERGY_EMOJI = ['😴', '😪', '😐', '🙂', '⚡'];
const MOOD_EMOJI = ['😢', '😕', '😐', '🙂', '😊'];

export function FlipperCheckin() {
  const [showCheckin, setShowCheckin] = useState(false);
  const [step, setStep] = useState<'activity' | 'details'>('activity');
  const [selectedActivity, setSelectedActivity] = useState<typeof ACTIVITIES[number] | null>(null);
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState('');
  const [energy, setEnergy] = useState(3);
  const [mood, setMood] = useState(3);
  const [water, setWater] = useState(4);
  const [showXP, setShowXP] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
  const user = useUserStore(s => s.user);
  const userId = user?.id || getEffectiveUserId();

  // Auto-dismiss after 30s of inactivity
  const resetInactivityTimer = () => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      setShowCheckin(false);
      resetState();
    }, 30000);
  };

  const resetState = () => {
    setStep('activity');
    setSelectedActivity(null);
    setDuration(30);
    setNotes('');
    setEnergy(3);
    setMood(3);
    setWater(4);
    setShowXP(false);
    setIsLogging(false);
  };

  // Check if WebUSB is supported and check for existing permissions
  useEffect(() => {
    if (!('usb' in navigator)) {
      logger.warn('[FlipperCheckin] WebUSB not supported in this browser');
      return;
    }

    // Check if we already have permission for Flipper Zero
    navigator.usb.getDevices().then(devices => {
      const hasFlipper = devices.some(
        d => d.vendorId === FLIPPER_VENDOR_ID && d.productId === FLIPPER_PRODUCT_ID
      );
      setHasPermission(hasFlipper);
    });

    const handleConnect = (event: USBConnectionEvent) => {
      const device = event.device;
      if (device.vendorId === FLIPPER_VENDOR_ID && device.productId === FLIPPER_PRODUCT_ID) {
        logger.log('[FlipperCheckin] Flipper Zero detected!');
        setShowCheckin(true);
        resetInactivityTimer();
      }
    };

    const handleDisconnect = (event: USBConnectionEvent) => {
      if (event.device.vendorId === FLIPPER_VENDOR_ID) {
        logger.log('[FlipperCheckin] Flipper Zero disconnected');
        // Optional: auto-dismiss
      }
    };

    navigator.usb.addEventListener('connect', handleConnect);
    navigator.usb.addEventListener('disconnect', handleDisconnect);

    return () => {
      navigator.usb.removeEventListener('connect', handleConnect);
      navigator.usb.removeEventListener('disconnect', handleDisconnect);
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, []);

  // Reset timer on any interaction
  useEffect(() => {
    if (showCheckin) {
      resetInactivityTimer();
    }
  }, [showCheckin, step, selectedActivity, duration, energy, mood, water]);

  const handleActivitySelect = (activity: typeof ACTIVITIES[number]) => {
    setSelectedActivity(activity);
    setStep('details');
  };

  const handleLogActivity = async () => {
    if (!selectedActivity || isLogging) return;

    setIsLogging(true);

    try {
      const now = new Date();
      const startTime = new Date(now.getTime() - duration * 60 * 1000);

      // Log unified event
      logUnifiedEvent({
        user_id: userId,
        timestamp: startTime.toISOString(),
        end_timestamp: now.toISOString(),
        type: selectedActivity.type as any,
        title: `${selectedActivity.emoji} ${selectedActivity.label}`,
        details: {
          notes: notes || undefined,
          duration_minutes: duration,
          source: 'flipper_checkin',
        },
        module_source: 'ai_chat',
        duration_minutes: duration,
      });

      // Update health metrics
      const today = localDateStr();
      const existingMetrics = await localQuery<HealthMetric>('health_metrics', 'date', today);
      const existing = existingMetrics[0];

      const healthData = {
        user_id: userId,
        date: today,
        energy_level: energy,
        mood: mood,
        water_intake: water,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await localUpdate('health_metrics', existing.id, healthData);
      } else {
        await localInsert('health_metrics', healthData);
      }

      // Show XP animation
      setShowXP(true);
      setTimeout(() => {
        setShowCheckin(false);
        resetState();
      }, 2000);

      logger.log('[FlipperCheckin] Activity logged successfully');
    } catch (error) {
      logger.error('[FlipperCheckin] Failed to log activity:', error);
      alert('Failed to log activity. Please try again.');
    } finally {
      setIsLogging(false);
    }
  };

  const handleClose = () => {
    setShowCheckin(false);
    resetState();
  };

  if (!showCheckin) return null;

  return (
    <div className="flipper-checkin-overlay" onClick={resetInactivityTimer}>
      <div className="flipper-checkin-modal" onClick={e => e.stopPropagation()}>
        {/* Close button */}
        <button className="flipper-close-btn" onClick={handleClose} aria-label="Close">
          <X size={24} />
        </button>

        {/* XP Animation */}
        {showXP && (
          <div className="flipper-xp-animation">
            +25 XP
          </div>
        )}

        {/* Header */}
        <div className="flipper-header">
          <div className="flipper-pulse">⚡</div>
          <h2>Flipper detected! Time to check in.</h2>
        </div>

        {/* Activity Selection */}
        {step === 'activity' && (
          <div className="flipper-content">
            <h3>What have you been up to?</h3>
            <div className="flipper-activity-grid">
              {ACTIVITIES.map(activity => (
                <button
                  key={activity.label}
                  className="flipper-activity-btn"
                  onClick={() => handleActivitySelect(activity)}
                >
                  <span className="flipper-emoji">{activity.emoji}</span>
                  <span className="flipper-label">{activity.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Details & Health Check */}
        {step === 'details' && selectedActivity && (
          <div className="flipper-content">
            <div className="flipper-selected-activity">
              <span className="flipper-emoji-large">{selectedActivity.emoji}</span>
              <h3>{selectedActivity.label}</h3>
            </div>

            {/* Duration */}
            <div className="flipper-section">
              <label>Duration</label>
              <div className="flipper-duration-grid">
                {DURATIONS.map(d => (
                  <button
                    key={d.minutes}
                    className={`flipper-duration-btn ${duration === d.minutes ? 'active' : ''}`}
                    onClick={() => setDuration(d.minutes)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="flipper-section">
              <label>Notes (optional)</label>
              <textarea
                className="flipper-notes"
                placeholder="Any details you want to remember..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Health Check */}
            <div className="flipper-health-grid">
              <div className="flipper-health-item">
                <label>Energy</label>
                <div className="flipper-emoji-selector">
                  {ENERGY_EMOJI.map((emoji, i) => (
                    <button
                      key={i}
                      className={`flipper-emoji-btn ${energy === i + 1 ? 'active' : ''}`}
                      onClick={() => setEnergy(i + 1)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flipper-health-item">
                <label>Mood</label>
                <div className="flipper-emoji-selector">
                  {MOOD_EMOJI.map((emoji, i) => (
                    <button
                      key={i}
                      className={`flipper-emoji-btn ${mood === i + 1 ? 'active' : ''}`}
                      onClick={() => setMood(i + 1)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flipper-health-item">
                <label>Water (glasses)</label>
                <input
                  type="range"
                  min="0"
                  max="8"
                  value={water}
                  onChange={e => setWater(parseInt(e.target.value))}
                  className="flipper-water-slider"
                />
                <div className="flipper-water-display">
                  {Array.from({ length: water }, (_, i) => (
                    <span key={i}>💧</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              className="flipper-submit-btn"
              onClick={handleLogActivity}
              disabled={isLogging}
            >
              {isLogging ? 'Logging...' : 'Log it! 🎮'}
            </button>

            <button
              className="flipper-back-btn"
              onClick={() => setStep('activity')}
            >
              ← Back
            </button>
          </div>
        )}

        {/* Permission reminder (shown if no access granted yet) */}
        {!hasPermission && (
          <div className="flipper-permission-hint">
            💡 First time? Go to Settings → Connect Flipper to grant USB access
          </div>
        )}
      </div>
    </div>
  );
}
