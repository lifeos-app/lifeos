/**
 * TelegramConnect — Settings component for linking Telegram to LifeOS.
 * Shows connect/disconnect UI, generates 6-digit codes, and manages preferences.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/useUserStore';
import { logger } from '../utils/logger';
import {
  Loader2, Check, Link2, Unlink, Clock, Bell, BellOff, Moon, Send,
  Copy, ExternalLink, RefreshCw
} from 'lucide-react';

interface TelegramLink {
  id: string;
  chat_id: number;
  username: string | null;
  first_name: string | null;
  linked_at: string;
  preferences: TelegramPreferences;
  is_active: boolean;
}

interface TelegramPreferences {
  morning_brief: boolean;
  brief_time: string;
  event_reminders: boolean;
  reminder_minutes: number;
  nudges: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

const DEFAULT_PREFS: TelegramPreferences = {
  morning_brief: true,
  brief_time: '06:00',
  event_reminders: true,
  reminder_minutes: 30,
  nudges: true,
  quiet_hours_start: '22:00',
  quiet_hours_end: '06:00',
};

const BOT_USERNAME = 'RunLifeOSBot';

export function TelegramConnect() {
  const user = useUserStore(s => s.user);
  const [link, setLink] = useState<TelegramLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [prefs, setPrefs] = useState<TelegramPreferences>(DEFAULT_PREFS);

  const fetchLink = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('telegram_links')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      setLink(data);
      if (data?.preferences) {
        setPrefs({ ...DEFAULT_PREFS, ...data.preferences });
      }
    } catch (err) {
      logger.error('Failed to fetch telegram link:', err);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchLink(); }, [fetchLink]);

  const generateCode = async () => {
    if (!user?.id) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc('generate_telegram_link_code', {
        p_user_id: user.id,
      });
      if (error) throw error;
      setCode(data);
    } catch (err) {
      logger.error('Failed to generate code:', err);
      alert('Failed to generate code. Please try again.');
    }
    setGenerating(false);
  };

  const copyCode = () => {
    if (!code) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code);
      } else {
        const ta = document.createElement('textarea');
        ta.value = code;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUnlink = async () => {
    if (!user?.id || !link) return;
    if (!confirm('Disconnect Telegram? You won\'t receive notifications anymore.')) return;

    setUnlinking(true);
    try {
      const { error } = await supabase
        .from('telegram_links')
        .update({ is_active: false })
        .eq('id', link.id);

      if (error) throw error;
      setLink(null);
      setCode(null);
    } catch (err) {
      logger.error('Failed to unlink:', err);
      alert('Failed to disconnect. Please try again.');
    }
    setUnlinking(false);
  };

  const savePreferences = async () => {
    if (!link) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('telegram_links')
        .update({ preferences: prefs })
        .eq('id', link.id);

      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      logger.error('Failed to save preferences:', err);
      alert('Failed to save. Please try again.');
    }
    setSaving(false);
  };

  const updatePref = (key: keyof TelegramPreferences, value: any) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="set-telegram-loading">
        <Loader2 size={20} className="spin" />
        <span>Loading Telegram connection...</span>
      </div>
    );
  }

  // ─── Connected State ───
  if (link) {
    return (
      <div className="set-telegram">
        <div className="set-telegram-status connected">
          <div className="set-telegram-status-icon">
            <Send size={20} />
          </div>
          <div className="set-telegram-status-info">
            <strong>Telegram Connected</strong>
            <span>
              {link.username ? `@${link.username}` : link.first_name || 'Connected'}
              {' · '}
              Linked {new Date(link.linked_at).toLocaleDateString()}
            </span>
          </div>
          <button
            className="set-telegram-unlink"
            onClick={handleUnlink}
            disabled={unlinking}
          >
            {unlinking ? <Loader2 size={14} className="spin" /> : <Unlink size={14} />}
            Disconnect
          </button>
        </div>

        {/* Preferences */}
        <div className="set-telegram-prefs">
          <h4>Notification Preferences</h4>

          <div className="set-telegram-pref-row">
            <div className="set-telegram-pref-label">
              <Bell size={14} />
              <span>Morning Brief</span>
            </div>
            <button
              className={`set-toggle ${prefs.morning_brief ? 'on' : 'off'}`}
              onClick={() => updatePref('morning_brief', !prefs.morning_brief)}
            >
              <span className="set-toggle-dot" />
            </button>
          </div>

          {prefs.morning_brief && (
            <div className="set-telegram-pref-row indent">
              <div className="set-telegram-pref-label">
                <Clock size={14} />
                <span>Brief Time</span>
              </div>
              <input
                type="time"
                value={prefs.brief_time}
                onChange={e => updatePref('brief_time', e.target.value)}
                className="set-telegram-time-input"
              />
            </div>
          )}

          <div className="set-telegram-pref-row">
            <div className="set-telegram-pref-label">
              <Bell size={14} />
              <span>Event Reminders</span>
            </div>
            <button
              className={`set-toggle ${prefs.event_reminders ? 'on' : 'off'}`}
              onClick={() => updatePref('event_reminders', !prefs.event_reminders)}
            >
              <span className="set-toggle-dot" />
            </button>
          </div>

          {prefs.event_reminders && (
            <div className="set-telegram-pref-row indent">
              <div className="set-telegram-pref-label">
                <Clock size={14} />
                <span>Remind Before</span>
              </div>
              <select
                value={prefs.reminder_minutes}
                onChange={e => updatePref('reminder_minutes', parseInt(e.target.value))}
                className="set-telegram-select"
              >
                <option value="10">10 min</option>
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="60">1 hour</option>
              </select>
            </div>
          )}

          <div className="set-telegram-pref-row">
            <div className="set-telegram-pref-label">
              <BellOff size={14} />
              <span>Habit Nudges</span>
            </div>
            <button
              className={`set-toggle ${prefs.nudges ? 'on' : 'off'}`}
              onClick={() => updatePref('nudges', !prefs.nudges)}
            >
              <span className="set-toggle-dot" />
            </button>
          </div>

          <div className="set-telegram-pref-row">
            <div className="set-telegram-pref-label">
              <Moon size={14} />
              <span>Quiet Hours</span>
            </div>
            <div className="set-telegram-quiet-hours">
              <input
                type="time"
                value={prefs.quiet_hours_start}
                onChange={e => updatePref('quiet_hours_start', e.target.value)}
                className="set-telegram-time-input"
              />
              <span>to</span>
              <input
                type="time"
                value={prefs.quiet_hours_end}
                onChange={e => updatePref('quiet_hours_end', e.target.value)}
                className="set-telegram-time-input"
              />
            </div>
          </div>

          <button
            className="set-telegram-save"
            onClick={savePreferences}
            disabled={saving}
          >
            {saving ? <Loader2 size={14} className="spin" /> :
             saved ? <Check size={14} /> : <RefreshCw size={14} />}
            {saved ? 'Saved!' : 'Save Preferences'}
          </button>
        </div>
      </div>
    );
  }

  // ─── Disconnected State ───
  return (
    <div className="set-telegram">
      <p className="set-section-desc">
        Connect Telegram to receive morning briefs, habit nudges, event reminders,
        and track your progress right from your phone.
      </p>

      {!code ? (
        <button
          className="set-telegram-connect"
          onClick={generateCode}
          disabled={generating}
        >
          {generating ? <Loader2 size={16} className="spin" /> : <Link2 size={16} />}
          Connect Telegram
        </button>
      ) : (
        <div className="set-telegram-code-box">
          <div className="set-telegram-code-header">
            <span>Your linking code (expires in 10 min):</span>
          </div>
          <div className="set-telegram-code-row">
            <code className="set-telegram-code">{code}</code>
            <button className="set-telegram-copy" onClick={copyCode}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="set-telegram-code-steps">
            <p><strong>Option 1:</strong> Click below to open the bot, then tap Start:</p>
            <a
              href={`https://t.me/${BOT_USERNAME}?start=${code}`}
              target="_blank"
              rel="noopener noreferrer"
              className="set-telegram-deeplink"
            >
              <Send size={14} />
              Open @{BOT_USERNAME}
              <ExternalLink size={12} />
            </a>
            <p><strong>Option 2:</strong> Open Telegram, find @{BOT_USERNAME}, and send:</p>
            <code className="set-telegram-command">/link {code}</code>
          </div>
          <button
            className="set-telegram-regenerate"
            onClick={generateCode}
            disabled={generating}
          >
            <RefreshCw size={12} />
            Generate new code
          </button>
        </div>
      )}
    </div>
  );
}
