/**
 * BotSetupGuide — Step-by-step Telegram Bot Setup Wizard
 *
 * Guides through: creating bot via @BotFather, getting API token,
 * setting webhook, linking Telegram account, testing connection.
 * Each step has copy-paste commands and status indicators.
 */

import { useState, useCallback } from 'react';
import { useTelegramBot } from './useTelegramBot';

interface StepStatus {
  step: number;
  status: 'pending' | 'active' | 'completed' | 'error';
  detail?: string;
}

const STEPS = [
  {
    step: 1,
    title: 'Create Bot via @BotFather',
    description: 'Start a chat with @BotFather on Telegram and create a new bot',
    instructions: [
      'Open Telegram and search for @BotFather',
      'Send the command /newbot',
      'Choose a display name for your bot (e.g., "My LifeOS Bot")',
      'Choose a username ending in "bot" (e.g., "my_lifeos_bot")',
      'BotFather will respond with your bot token',
    ],
    copyable: '/newbot',
  },
  {
    step: 2,
    title: 'Get API Token',
    description: 'Copy the bot token provided by BotFather',
    instructions: [
      'After creating the bot, BotFather gives you a token like: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
      'Copy this token — you\'ll paste it in the LifeOS config',
      'Keep this token secret! Anyone with it can control your bot',
      'If you need to regenerate, use /token in BotFather',
    ],
    copyable: '/token',
  },
  {
    step: 3,
    title: 'Set Webhook',
    description: 'Configure webhook URL so Telegram forwards messages to LifeOS',
    instructions: [
      'Enter your webhook URL in the bot config (e.g., https://your-lifeos.com/api/telegram/webhook)',
      'Click "Set Webhook" to register with Telegram',
      'Or use this curl command manually:',
      '',
      'curl -F "url=https://YOUR_URL/api/telegram/webhook" https://api.telegram.org/bot<TOKEN>/setWebhook',
    ],
    copyable: 'curl -F "url=https://YOUR_URL/api/telegram/webhook" https://api.telegram.org/bot<TOKEN>/setWebhook',
  },
  {
    step: 4,
    title: 'Link Telegram Account',
    description: 'Authorize your Telegram user to access your LifeOS data',
    instructions: [
      'Start a conversation with your bot on Telegram',
      'Send /start to the bot',
      'The bot will display your Telegram user ID',
      'Add this user ID to the authorized users list in LifeOS',
      'Alternatively, click "Link Account" to auto-link your Telegram account',
    ],
    copyable: '/start',
  },
  {
    step: 5,
    title: 'Test Connection',
    description: 'Send a test message to verify everything works end-to-end',
    instructions: [
      'Click "Test Connection" below to verify the bot token is valid',
      'Send a message like /help to your bot in Telegram',
      'Check the Activity Log to see the interaction',
      'If the bot doesn\'t respond, check webhook URL and server logs',
    ],
    copyable: '/help',
  },
];

export function BotSetupGuide() {
  const { config, testConnection, setWebhook, setSetupProgress, setupProgress } = useTelegramBot();
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(STEPS.map((s) => ({ step: s.step, status: 'pending' as const })));
  const [testing, setTesting] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; botName: string; error?: string } | null>(null);

  // Mark step status
  const markStep = useCallback((step: number, status: StepStatus['status'], detail?: string) => {
    setStepStatuses((prev) =>
      prev.map((s) => (s.step === step ? { ...s, status, detail } : s)),
    );
  }, []);

  // Mark steps based on current config
  const getStepStatus = (step: number): StepStatus['status'] => {
    if (step === 1) return config.botToken ? 'completed' : setupProgress >= 1 ? 'active' : 'pending';
    if (step === 2) return config.botToken ? 'completed' : 'pending';
    if (step === 3) return config.webhookUrl ? 'completed' : config.botToken ? 'active' : 'pending';
    if (step === 4) return config.authorizedUsers.length > 0 ? 'completed' : config.webhookUrl ? 'active' : 'pending';
    if (step === 5) return testResult?.ok ? 'completed' : config.authorizedUsers.length > 0 ? 'active' : 'pending';
    return 'pending';
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection();
      setTestResult(result);
      if (result.ok) {
        markStep(5, 'completed', `Connected to @${result.botName}`);
        setSetupProgress(5);
      } else {
        markStep(5, 'error', result.error);
      }
    } catch {
      setTestResult({ ok: false, botName: '', error: 'Connection failed' });
      markStep(5, 'error', 'Connection failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSetWebhook = async () => {
    setWebhookResult(null);
    const ok = await setWebhook();
    if (ok) {
      setWebhookResult({ ok: true, message: 'Webhook set successfully!' });
      markStep(3, 'completed');
      setSetupProgress(Math.max(setupProgress, 3));
    } else {
      setWebhookResult({ ok: false, message: 'Failed to set webhook. Check URL and token.' });
      markStep(3, 'error', 'Failed');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-4">
      {/* Progress Overview */}
      <div className="bg-black/40 rounded-xl border border-white/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white">Setup Progress</h3>
          <span className="text-xs text-zinc-400">
            Step {Math.min(setupProgress + 1, 5)} of 5
          </span>
        </div>
        <div className="flex gap-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                getStepStatus(i + 1) === 'completed'
                  ? 'bg-emerald-400'
                  : getStepStatus(i + 1) === 'active'
                    ? 'bg-[#0088cc]'
                    : getStepStatus(i + 1) === 'error'
                      ? 'bg-red-400'
                      : 'bg-white/10'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Steps */}
      {STEPS.map((stepData) => {
        const status = getStepStatus(stepData.step);
        const isActive = status === 'active';
        const isCompleted = status === 'completed';
        const isError = status === 'error';

        return (
          <div
            key={stepData.step}
            className={`rounded-xl border transition-all ${
              isActive
                ? 'border-[#0088cc]/50 bg-[#0088cc]/5'
                : isCompleted
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : isError
                    ? 'border-red-500/30 bg-red-500/5'
                    : 'border-white/10 bg-black/20'
            }`}
          >
            {/* Step Header */}
            <button
              className="w-full flex items-center gap-3 p-4 text-left"
              onClick={() => {
                // Could expand/collapse steps — for now always show
              }}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  isCompleted
                    ? 'bg-emerald-400 text-black'
                    : isActive
                      ? 'bg-[#0088cc] text-white'
                      : isError
                        ? 'bg-red-400 text-white'
                        : 'bg-white/10 text-zinc-400'
                }`}
              >
                {isCompleted ? '✓' : isError ? '!' : stepData.step}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-white">{stepData.title}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">{stepData.description}</p>
              </div>
              <div className="shrink-0">
                {isCompleted ? (
                  <span className="text-emerald-400 text-xs font-medium">✅ Done</span>
                ) : isActive ? (
                  <span className="text-[#0088cc] text-xs font-medium">● Active</span>
                ) : isError ? (
                  <span className="text-red-400 text-xs font-medium">✗ Error</span>
                ) : (
                  <span className="text-zinc-500 text-xs">○ Pending</span>
                )}
              </div>
            </button>

            {/* Step Content — always visible for simplicity */}
            <div className="px-4 pb-4 space-y-2">
              {/* Instructions */}
              <div className="space-y-1.5">
                {stepData.instructions.map((instruction, i) => {
                  if (!instruction) return <div key={i} className="h-2" />;
                  const isCommand = instruction.startsWith('/') || instruction.startsWith('curl');
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-zinc-600 text-xs mt-0.5 shrink-0">{i + 1}.</span>
                      {isCommand ? (
                        <div className="flex-1 flex items-center gap-2 bg-[#1a1a2e] rounded px-2 py-1.5">
                          <code className="text-xs text-emerald-400 break-all flex-1">{instruction}</code>
                          <button
                            onClick={() => copyToClipboard(instruction)}
                            className="text-zinc-500 hover:text-white text-xs shrink-0"
                            title="Copy"
                          >
                            📋
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-300">{instruction}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Copy-paste command */}
              <div className="bg-[#1a1a2e] rounded-lg p-3 border border-white/5">
                <div className="flex items-center justify-between">
                  <code className="text-xs text-[#0088cc] break-all flex-1">{stepData.copyable}</code>
                  <button
                    onClick={() => copyToClipboard(stepData.copyable)}
                    className="text-xs text-zinc-400 hover:text-white ml-3 shrink-0 px-2 py-1 bg-white/5 rounded"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Step-specific actions */}
              {stepData.step === 3 && isActive && (
                <button
                  onClick={handleSetWebhook}
                  className="w-full py-2 bg-[#0088cc] text-white text-sm rounded-lg font-medium hover:bg-[#0099dd] transition-colors"
                >
                  Set Webhook
                </button>
              )}
              {stepData.step === 3 && webhookResult && (
                <p className={`text-xs ${webhookResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {webhookResult.message}
                </p>
              )}
              {stepData.step === 5 && isActive && (
                <button
                  onClick={handleTestConnection}
                  disabled={testing || !config.botToken}
                  className="w-full py-2 bg-[#0088cc] text-white text-sm rounded-lg font-medium hover:bg-[#0099dd] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </button>
              )}
              {stepData.step === 5 && testResult && (
                <p className={`text-xs ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {testResult.ok
                    ? `✅ Connected to @${testResult.botName}`
                    : `❌ ${testResult.error}`}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {/* Skip / Reset */}
      <div className="flex justify-between items-center pt-2">
        <p className="text-[10px] text-zinc-500">
          Token is stored locally and never sent to third-party servers.
        </p>
        <button
          onClick={() => setSetupProgress(0)}
          className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
        >
          Reset Setup
        </button>
      </div>
    </div>
  );
}