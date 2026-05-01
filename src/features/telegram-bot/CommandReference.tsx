/**
 * CommandReference — Telegram Bot Command Reference Card
 *
 * All available commands with examples, natural language examples,
 * quick reply templates, voice command syntax, and pro tips.
 */

import { useState } from 'react';
import { TELEGRAM_COMMANDS } from '../../stores/telegramStore';

type Tab = 'commands' | 'natural' | 'quick-reply' | 'voice' | 'tips';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'commands', label: 'Commands', icon: '⌨️' },
  { id: 'natural', label: 'Natural Language', icon: '💬' },
  { id: 'quick-reply', label: 'Quick Reply', icon: '⚡' },
  { id: 'voice', label: 'Voice Commands', icon: '🎙️' },
  { id: 'tips', label: 'Pro Tips', icon: '💡' },
];

const QUICK_REPLIES = [
  { label: '✅ Check habits', command: '/streak' },
  { label: '📊 Daily brief', command: '/brief' },
  { label: '💰 Balance', command: '/balance' },
  { label: '📅 Schedule', command: '/schedule' },
  { label: '🎯 Goals', command: '/goals' },
  { label: '📈 Stats', command: '/stats' },
  { label: '😊 Mood', command: '/mood' },
  { label: '📝 Journal', command: '/journal' },
];

const VOICE_COMMANDS = [
  { say: '"Log 3 hours work at Sonder"', mapsTo: '/log 3 hours work at Sonder' },
  { say: '"Mood 8 feeling productive"', mapsTo: '/mood 8 feeling productive' },
  { say: '"Sleep 7 hours"', mapsTo: '/health sleep 7h' },
  { say: '"Expensed 45 dollars for lunch"', mapsTo: '/expense $45 lunch' },
  { say: '"Check my streaks"', mapsTo: '/streak' },
  { say: '"What\'s on today"', mapsTo: '/schedule' },
  { say: '"Daily briefing"', mapsTo: '/brief' },
  { say: '"Journal entry: productive day"', mapsTo: '/journal productive day' },
];

const PRO_TIPS = [
  {
    title: 'Quick Logging',
    tip: 'Type /log followed by anything — the Intent Engine will figure out what you mean. "3h work Sonder" works just as well as "log 3 hours work at Sonder".',
  },
  {
    title: 'Natural Language',
    tip: 'You don\'t need command prefixes at all! Just type naturally: "I feel great today" or "earned $500 from client work". The bot will route it to the right place.',
  },
  {
    title: 'Habit Tracking',
    tip: 'Use /habit followed by the habit name. If you\'ve logged it before, the bot remembers and auto-completes. "habit meditate" → marks meditation as done.',
  },
  {
    title: 'Combined Logging',
    tip: 'Chain multiple things: "mood 7, sleep 7h, water 6 glasses" — the parser handles compound inputs. One message, multiple logs.',
  },
  {
    title: 'Inline Keyboards',
    tip: 'Some commands show inline buttons you can tap instead of typing. Habit completions and confirmations use tap-to-respond for speed.',
  },
  {
    title: 'Scheduled Briefs',
    tip: 'Enable daily briefs in LifeOS settings and get a morning summary automatically. Includes tasks, habits, health, and finances — delivered right when you wake up.',
  },
  {
    title: 'Offline Support',
    tip: 'If the bot is offline, your messages are queued. When connection is restored, pending actions are processed. Nothing gets lost.',
  },
  {
    title: 'Rate Limits',
    tip: 'The bot allows 30 messages per minute. If you hit the limit, wait 60 seconds and try again. This prevents spam and protects the API.',
  },
];

export function CommandReference() {
  const [activeTab, setActiveTab] = useState<Tab>('commands');

  return (
    <div className="bg-[#0a0a0a] rounded-xl border border-white/10 overflow-hidden">
      {/* Tab Bar */}
      <div className="flex overflow-x-auto border-b border-white/10 bg-black/30 scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'text-[#0088cc] border-b-2 border-[#0088cc] bg-[#0088cc]/5'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'commands' && <CommandsTab />}
        {activeTab === 'natural' && <NaturalLanguageTab />}
        {activeTab === 'quick-reply' && <QuickReplyTab />}
        {activeTab === 'voice' && <VoiceTab />}
        {activeTab === 'tips' && <TipsTab />}
      </div>
    </div>
  );
}

function CommandsTab() {
  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500 mb-3">
        All bot commands with their shorthand syntax
      </p>
      {TELEGRAM_COMMANDS.map((cmd) => (
        <div
          key={cmd.command}
          className="bg-black/40 rounded-lg p-3 border border-white/5"
        >
          <div className="flex items-start gap-3">
            <code className="text-[#0088cc] text-sm font-mono font-bold shrink-0">
              {cmd.command}
            </code>
            <div className="min-w-0">
              <p className="text-sm text-white">{cmd.description}</p>
              <p className="text-xs text-zinc-500 mt-1">
                Intent: <span className="text-zinc-400">{cmd.intentMapping}</span>
              </p>
              <div className="mt-2 bg-[#1a1a2e] rounded px-2 py-1">
                <code className="text-xs text-emerald-400">{cmd.example}</code>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function NaturalLanguageTab() {
  const examples = [
    { input: '3 hours work at Sonder', mapsTo: '/log 3 hours work at Sonder', category: 'Work' },
    { input: 'mood 8 feeling productive', mapsTo: '/mood 8 feeling productive', category: 'Mood' },
    { input: 'slept 7.5 hours', mapsTo: '/health sleep 7.5h', category: 'Health' },
    { input: 'spent $45 on groceries', mapsTo: '/expense $45 groceries', category: 'Finance' },
    { input: 'earned $2000 from client payment', mapsTo: '/income $2000 client payment', category: 'Finance' },
    { input: 'I did meditation today', mapsTo: '/habit meditate', category: 'Habit' },
    { input: 'what\'s my balance?', mapsTo: '/balance', category: 'Query' },
    { input: 'what\'s on today?', mapsTo: '/schedule', category: 'Query' },
    { input: 'daily briefing', mapsTo: '/brief', category: 'Query' },
    { input: 'how are my streaks?', mapsTo: '/streak', category: 'Query' },
    { input: 'journal: productive day, finished the proposal', mapsTo: '/journal productive day, finished the proposal', category: 'Journal' },
    { input: 'drank 6 glasses of water', mapsTo: '/health water 6', category: 'Health' },
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500 mb-2">
        The bot understands natural language — no command syntax needed!
      </p>
      {examples.map((ex, i) => (
        <div key={i} className="bg-black/40 rounded-lg p-3 border border-white/5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0088cc]/10 text-[#0088cc]">
              {ex.category}
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-start gap-2">
              <span className="text-zinc-500 text-xs shrink-0">You:</span>
              <p className="text-sm text-white">"{ex.input}"</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-zinc-500 text-xs shrink-0">Bot:</span>
              <code className="text-xs text-emerald-400">{ex.mapsTo}</code>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function QuickReplyTab() {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (command: string) => {
    navigator.clipboard.writeText(command);
    setCopied(command);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500 mb-2">
        One-tap commands — copy to Telegram and send
      </p>
      <div className="grid grid-cols-2 gap-2">
        {QUICK_REPLIES.map((qr) => (
          <button
            key={qr.command}
            onClick={() => handleCopy(qr.command)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-black/40 border border-white/5 hover:border-[#0088cc]/30 hover:bg-[#0088cc]/5 transition-colors text-left"
          >
            <span className="text-sm">{qr.label}</span>
            {copied === qr.command ? (
              <span className="text-[10px] text-emerald-400 ml-auto">Copied!</span>
            ) : (
              <span className="text-[10px] text-zinc-500 ml-auto">📋</span>
            )}
          </button>
        ))}
      </div>
      <div className="mt-4 bg-[#1a1a2e] rounded-lg p-3 border border-white/5">
        <p className="text-xs text-zinc-400">
          <span className="text-white font-medium">Tip:</span> In Telegram, tap any bot message
          and hold to copy. Or set up quick-reply buttons in the bot for
          one-tap access to your most-used commands.
        </p>
      </div>
    </div>
  );
}

function VoiceTab() {
  return (
    <div className="space-y-3">
      <div className="bg-[#0088cc]/10 border border-[#0088cc]/20 rounded-lg p-3 mb-3">
        <p className="text-sm text-[#0088cc] font-medium">🎙️ Voice Commands</p>
        <p className="text-xs text-zinc-400 mt-1">
          Speak naturally — the bot transcribes and processes your voice messages
          through the Intent Engine. Supports English, with more languages coming soon.
        </p>
      </div>
      {VOICE_COMMANDS.map((vc, i) => (
        <div key={i} className="bg-black/40 rounded-lg p-3 border border-white/5">
          <div className="flex items-start gap-3">
            <span className="text-lg">🗣️</span>
            <div>
              <p className="text-sm text-white">Say: "{vc.say}"</p>
              <p className="text-xs text-zinc-500 mt-1">
                → <code className="text-emerald-400">{vc.mapsTo}</code>
              </p>
            </div>
          </div>
        </div>
      ))}
      <div className="bg-black/40 rounded-lg p-3 border border-white/5">
        <p className="text-xs text-zinc-400">
          <span className="text-amber-400">⚠️</span> Voice transcription requires
          the Telegram Bot API to be configured with a speech-to-text service.
          Check the setup guide for details.
        </p>
      </div>
    </div>
  );
}

function TipsTab() {
  return (
    <div className="space-y-3">
      {PRO_TIPS.map((tip, i) => (
        <div key={i} className="bg-black/40 rounded-lg p-3 border border-white/5">
          <div className="flex items-start gap-3">
            <span className="text-lg shrink-0">💡</span>
            <div>
              <p className="text-sm text-white font-medium">{tip.title}</p>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{tip.tip}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}