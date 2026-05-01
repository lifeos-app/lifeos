/**
 * TelegramBot — Main Admin Page for LifeOS Telegram Bot Configuration
 *
 * Bot token setup, user authorization, command overview, activity log,
 * webhook status indicator, quick setup guide, enable/disable toggle.
 */

import { useState } from 'react';
import { useTelegramBot } from './useTelegramBot';
import { CommandReference } from './CommandReference';
import { BotActivityLog } from './BotActivityLog';
import { BotSetupGuide } from './BotSetupGuide';

type Tab = 'config' | 'commands' | 'activity' | 'setup';

export function TelegramBot() {
  const bot = useTelegramBot();
  const [activeTab, setActiveTab] = useState<Tab>('config');
  const [showToken, setShowToken] = useState(false);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'config', label: 'Config', icon: '⚙️' },
    { id: 'commands', label: 'Commands', icon: '⌨️' },
    { id: 'activity', label: 'Activity', icon: '📋' },
    { id: 'setup', label: 'Setup Guide', icon: '📖' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/40 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0088cc]/20 flex items-center justify-center text-xl">
                🤖
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <span className="text-[#0088cc]">Telegram</span> Bot
                  {bot.isWebhookConnected ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Connected" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-zinc-600" title="Disconnected" />
                  )}
                </h1>
                <p className="text-xs text-zinc-400">
                  {bot.config.enabled
                    ? bot.isWebhookConnected
                      ? 'Bot is active and connected'
                      : 'Bot is enabled but webhook is disconnected'
                    : 'Bot is disabled'}
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-zinc-400">{bot.config.enabled ? 'On' : 'Off'}</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={bot.config.enabled}
                  onChange={(e) => bot.setEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-white/10 peer-checked:bg-[#0088cc] rounded-full transition-colors" />
                <div className="absolute top-0.5 left-0.5 peer-checked:translate-x-5 w-4 h-4 bg-white rounded-full transition-transform" />
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-white/10 bg-black/20">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'text-[#0088cc] border-[#0088cc]'
                    : 'text-zinc-400 border-transparent hover:text-white'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.id === 'activity' && bot.activityLog.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-zinc-400">
                    {bot.activityLog.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {activeTab === 'config' && (
          <ConfigTab bot={bot} showToken={showToken} setShowToken={setShowToken} />
        )}
        {activeTab === 'commands' && <CommandReference />}
        {activeTab === 'activity' && <BotActivityLog />}
        {activeTab === 'setup' && <BotSetupGuide />}
      </div>
    </div>
  );
}

function ConfigTab({
  bot,
  showToken,
  setShowToken,
}: {
  bot: ReturnType<typeof useTelegramBot>;
  showToken: boolean;
  setShowToken: (v: boolean) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Bot Token Section */}
      <section className="bg-[#0a0a0a] rounded-xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 bg-black/30">
          <h2 className="text-sm font-medium flex items-center gap-2">
            <span className="text-[#0088cc]">🔑</span> Bot Token
          </h2>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Bot Token (from @BotFather)</label>
            <div className="flex gap-2">
              <input
                type={showToken ? 'text' : 'password'}
                value={bot.config.botToken}
                onChange={(e) => bot.setBotToken(e.target.value)}
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#0088cc]/50 font-mono"
              />
              <button
                onClick={() => setShowToken(!showToken)}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-400 hover:text-white transition-colors"
              >
                {showToken ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Webhook URL */}
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Webhook URL</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={bot.config.webhookUrl}
                onChange={(e) => bot.setWebhookUrl(e.target.value)}
                placeholder="https://your-lifeos.com/api/telegram/webhook"
                className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#0088cc]/50 font-mono"
              />
              <button
                onClick={() => bot.setWebhook()}
                disabled={!bot.config.botToken || !bot.config.webhookUrl}
                className="px-3 py-2 bg-[#0088cc] text-white text-sm rounded-lg font-medium hover:bg-[#0099dd] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Set
              </button>
            </div>
          </div>

          {/* Webhook Status */}
          <div className="flex items-center gap-3 bg-black/30 rounded-lg p-3">
            <div
              className={`w-3 h-3 rounded-full ${
                bot.isWebhookConnected ? 'bg-emerald-400' : 'bg-zinc-600'
              }`}
            />
            <div className="flex-1">
              <p className="text-sm text-white">
                {bot.isWebhookConnected ? 'Webhook Connected' : 'Webhook Disconnected'}
              </p>
              {bot.webhookStatus.url && (
                <p className="text-xs text-zinc-500 font-mono">{bot.webhookStatus.url}</p>
              )}
            </div>
            {bot.webhookStatus.lastPing && (
              <span className="text-[10px] text-zinc-500">
                Last ping: {new Date(bot.webhookStatus.lastPing).toLocaleTimeString()}
              </span>
            )}
          </div>
          {bot.webhookStatus.lastError && (
            <p className="text-xs text-red-400">Error: {bot.webhookStatus.lastError}</p>
          )}
        </div>
      </section>

      {/* User Authorization */}
      <section className="bg-[#0a0a0a] rounded-xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 bg-black/30">
          <h2 className="text-sm font-medium flex items-center gap-2">
            <span className="text-[#0088cc]">👥</span> Authorized Users
          </h2>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-zinc-400">
            Only these Telegram user IDs can interact with the bot. Find your ID by messaging @userinfobot on Telegram.
          </p>

          {/* Add user form */}
          <div className="flex gap-2">
            <input
              id="new-user-id"
              type="text"
              placeholder="Telegram user ID (e.g., 123456789)"
              className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#0088cc]/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const input = e.currentTarget;
                  const userId = input.value.trim();
                  if (userId) {
                    bot.addAuthorizedUser(userId);
                    input.value = '';
                  }
                }
              }}
            />
            <button
              onClick={() => {
                const input = document.getElementById('new-user-id') as HTMLInputElement;
                const userId = input?.value?.trim();
                if (userId) {
                  bot.addAuthorizedUser(userId);
                  input.value = '';
                }
              }}
              className="px-3 py-2 bg-[#0088cc] text-white text-sm rounded-lg font-medium hover:bg-[#0099dd] transition-colors"
            >
              Add
            </button>
          </div>

          {/* Authorized users list */}
          {bot.config.authorizedUsers.length > 0 ? (
            <div className="space-y-1">
              {bot.config.authorizedUsers.map((userId) => (
                <div key={userId} className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2">
                  <span className="w-6 h-6 rounded-full bg-[#0088cc]/20 flex items-center justify-center text-xs text-[#0088cc]">
                    {userId.slice(-2)}
                  </span>
                  <code className="text-sm text-white flex-1 font-mono">{userId}</code>
                  <button
                    onClick={() => bot.removeAuthorizedUser(userId)}
                    className="text-zinc-500 hover:text-red-400 transition-colors"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 text-center py-3">
              No authorized users — anyone with the bot link can use it
            </p>
          )}

          {/* Linked account */}
          <div className="border-t border-white/5 pt-3">
            <p className="text-xs text-zinc-400 mb-2">Linked LifeOS Account</p>
            {bot.config.linkedAccount ? (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                <span className="text-emerald-400">✅</span>
                <code className="text-sm text-white font-mono">{bot.config.linkedAccount}</code>
                <button
                  onClick={() => bot.unlinkAccount()}
                  className="ml-auto text-xs text-zinc-500 hover:text-red-400"
                >
                  Unlink
                </button>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">No LifeOS account linked</p>
            )}
          </div>
        </div>
      </section>

      {/* Feature Toggles */}
      <section className="bg-[#0a0a0a] rounded-xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 bg-black/30">
          <h2 className="text-sm font-medium flex items-center gap-2">
            <span className="text-[#0088cc]">🔔</span> Features & Notifications
          </h2>
        </div>
        <div className="p-4 space-y-4">
          {/* Daily Brief */}
          <ToggleRow
            label="Daily Brief"
            description={`Morning summary at ${bot.config.dailyBriefTime}`}
            checked={bot.config.dailyBriefEnabled}
            onChange={(checked) => bot.updateConfig({ dailyBriefEnabled: checked })}
          >
            {bot.config.dailyBriefEnabled && (
              <input
                type="time"
                value={bot.config.dailyBriefTime}
                onChange={(e) => bot.setDailyBriefTime(e.target.value)}
                className="ml-4 px-2 py-1 bg-black/40 border border-white/10 rounded text-xs text-white focus:outline-none focus:border-[#0088cc]/50"
              />
            )}
          </ToggleRow>

          <ToggleRow
            label="Habit Reminders"
            description="Get reminders for incomplete habits"
            checked={bot.config.habitReminders}
            onChange={(checked) => bot.updateConfig({ habitReminders: checked })}
          />

          <ToggleRow
            label="Streak Alerts"
            description="Get notified when streaks are at risk"
            checked={bot.config.streakAlerts}
            onChange={(checked) => bot.updateConfig({ streakAlerts: checked })}
          />

          <ToggleRow
            label="Smart Suggestions"
            description="Bot proactively suggests actions based on patterns"
            checked={bot.config.smartSuggestions}
            onChange={(checked) => bot.updateConfig({ smartSuggestions: checked })}
          />

          <ToggleRow
            label="Voice Input"
            description="Process voice messages via speech-to-text"
            checked={bot.config.voiceInput}
            onChange={(checked) => bot.updateConfig({ voiceInput: checked })}
          />
        </div>
      </section>

      {/* Command Prefix */}
      <section className="bg-[#0a0a0a] rounded-xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 bg-black/30">
          <h2 className="text-sm font-medium flex items-center gap-2">
            <span className="text-[#0088cc]">💻</span> Advanced
          </h2>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Command Prefix</label>
            <input
              type="text"
              value={bot.config.commandPrefix}
              onChange={(e) => bot.updateConfig({ commandPrefix: e.target.value })}
              className="w-20 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#0088cc]/50 font-mono text-center"
            />
          </div>
          <button
            onClick={() => bot.resetConfig()}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Reset all configuration
          </button>
        </div>
      </section>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Messages" value={bot.activityLog.length} />
        <StatCard
          label="Success Rate"
          value={`${Math.round(bot.successRate * 100)}%`}
          color={bot.successRate > 0.9 ? 'emerald' : bot.successRate > 0.7 ? 'amber' : 'red'}
        />
        <StatCard label="Commands Used" value={Object.keys(bot.commandCounts).length} />
        <StatCard
          label="Status"
          value={bot.config.enabled ? (bot.isWebhookConnected ? 'Active' : 'Webhook off') : 'Disabled'}
          color={bot.config.enabled && bot.isWebhookConnected ? 'emerald' : 'zinc'}
        />
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  children,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <label className="relative flex-shrink-0 mt-0.5 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-white/10 peer-checked:bg-[#0088cc] rounded-full transition-colors" />
        <div className="absolute top-0.5 left-0.5 peer-checked:translate-x-4 w-4 h-4 bg-white rounded-full transition-transform" />
      </label>
      <div className="flex-1 flex items-center gap-2">
        <div>
          <p className="text-sm text-white">{label}</p>
          <p className="text-xs text-zinc-400">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = 'white',
}: {
  label: string;
  value: string | number;
  color?: 'white' | 'emerald' | 'amber' | 'red' | 'zinc';
}) {
  const colorMap = {
    white: 'text-white',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    zinc: 'text-zinc-400',
  };

  return (
    <div className="bg-black/40 border border-white/5 rounded-lg p-3 text-center">
      <p className={`text-lg font-bold ${colorMap[color]}`}>{value}</p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</p>
    </div>
  );
}