/**
 * IntegrationGuides — Setup guides for popular integrations
 *
 * Strava, Apple Health, Google Fit, Google Calendar, banking,
 * and custom webhook templates. Each guide has step-by-step
 * instructions with copy-paste URLs.
 */

import { useState } from 'react';
import { usePublicApi } from './usePublicApi';

type GuideId = 'strava' | 'apple-health' | 'google-fit' | 'google-calendar' | 'banking' | 'custom';

interface Guide {
  id: GuideId;
  name: string;
  icon: string;
  color: string;
  description: string;
}

const GUIDES: Guide[] = [
  { id: 'strava', name: 'Strava', icon: '🏃', color: '#FC4C02', description: 'Sync your runs, rides, and swims automatically' },
  { id: 'apple-health', name: 'Apple Health', icon: '❤️', color: '#FF2D55', description: 'Health Auto Export or CSV import from Health app' },
  { id: 'google-fit', name: 'Google Fit', icon: '🏃‍♂️', color: '#4285F4', description: 'OAuth flow or manual export from Google Fit' },
  { id: 'google-calendar', name: 'Google Calendar', icon: '📅', color: '#4285F4', description: 'Two-way sync with Google Calendar' },
  { id: 'banking', name: 'Banking', icon: '🏦', color: '#10B981', description: 'CSV import or Open Banking webhooks' },
  { id: 'custom', name: 'Custom', icon: '🔧', color: '#8B5CF6', description: 'Generic webhook template for any service' },
];

export function IntegrationGuides() {
  const api = usePublicApi();
  const [activeGuide, setActiveGuide] = useState<GuideId>('strava');
  const [copied, setCopied] = useState<string | null>(null);

  const baseUrl = api.apiBase;
  const activeKey = api.keys.find(k => k.enabled);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const CopyButton = ({ text, id }: { text: string; id: string }) => (
    <button
      onClick={() => handleCopy(text, id)}
      className="px-3 py-1 bg-white/5 text-gray-400 rounded text-xs hover:bg-white/10 transition ml-2 shrink-0"
    >
      {copied === id ? '✓ Copied' : 'Copy'}
    </button>
  );

  const renderGuide = () => {
    switch (activeGuide) {
      case 'strava':
        return (
          <div className="space-y-4">
            <div className="bg-[#FC4C02]/10 border border-[#FC4C02]/20 rounded-xl p-5">
              <h3 className="text-lg font-bold mb-1">Strava Integration</h3>
              <p className="text-sm text-gray-400">
                Automatically sync your Strava activities to LifeOS. Each activity
                creates both a health metrics entry and a schedule event.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-white">Setup Steps</h4>

              <Step number={1} title="Create an API Key">
                <p className="text-sm text-gray-400">
                  Go to the API Keys tab and generate a key with <strong>write</strong> scope.
                  Copy the key — you'll need it for authentication.
                </p>
              </Step>

              <Step number={2} title="Configure Strava Webhook">
                <p className="text-sm text-gray-400 mb-2">
                  In your Strava API settings, create a push subscription pointing to:
                </p>
                <CodeBlock
                  id="strava-url"
                  code={`${baseUrl}/api/v1/webhooks/strava`}
                  copyId="strava-url"
                  copied={copied}
                  onCopy={handleCopy}
                />
              </Step>

              <Step number={3} title="Set Verify Token">
                <p className="text-sm text-gray-400 mb-2">
                  Set a verify token in Strava that matches your configuration.
                  The GET endpoint will handle the hub.challenge verification.
                </p>
              </Step>

              <Step number={4} title="Add Authorization Header">
                <p className="text-sm text-gray-400 mb-2">
                  Configure Strava to send your API key as a header
                  (or use a reverse proxy that adds it):
                </p>
                <CodeBlock
                  id="strava-auth"
                  code={`Authorization: Bearer ${activeKey ? activeKey.key : 'lk_live_YOUR_API_KEY'}`}
                  copyId="strava-auth"
                  copied={copied}
                  onCopy={handleCopy}
                />
              </Step>
            </div>

            <div className="bg-black/30 rounded-xl p-4">
              <h4 className="font-semibold text-sm mb-2">Example Strava Payload</h4>
              <pre className="text-xs font-mono text-gray-300 overflow-x-auto">{JSON.stringify({
                object_type: 'activity',
                object_id: 12345678,
                aspect_type: 'create',
                owner_id: 987654,
                activity_type: 'Run',
                activity_name: 'Morning Run',
                elapsed_time: 2700,
                distance: 5000,
                start_date: '2025-01-15T07:30:00Z',
                calories: 320,
              }, null, 2)}</pre>
            </div>
          </div>
        );

      case 'apple-health':
        return (
          <div className="space-y-4">
            <div className="bg-[#FF2D55]/10 border border-[#FF2D55]/20 rounded-xl p-5">
              <h3 className="text-lg font-bold mb-1">Apple Health Integration</h3>
              <p className="text-sm text-gray-400">
                Import health data from Apple's Health app using the
                Health Auto Export app or manual CSV export.
              </p>
            </div>

            <h4 className="font-semibold text-white">Method 1: Health Auto Export (Recommended)</h4>
            <div className="space-y-3">
              <Step number={1} title="Install Health Auto Export">
                <p className="text-sm text-gray-400">
                  Download <strong>Health Auto Export</strong> from the App Store.
                  It can automatically export Health data to webhooks.
                </p>
              </Step>

              <Step number={2} title="Configure Webhook URL">
                <p className="text-sm text-gray-400 mb-2">Set the webhook URL to:</p>
                <CodeBlock
                  id="health-url"
                  code={`${baseUrl}/api/v1/webhooks/health`}
                  copyId="health-url"
                  copied={copied}
                  onCopy={handleCopy}
                />
              </Step>

              <Step number={3} title="Add Authorization Header">
                <p className="text-sm text-gray-400 mb-2">
                  In the app's webhook settings, add the Authorization header:
                </p>
                <CodeBlock
                  id="health-auth"
                  code={`Authorization: Bearer ${activeKey ? activeKey.key : 'lk_live_YOUR_API_KEY'}`}
                  copyId="health-auth"
                  copied={copied}
                  onCopy={handleCopy}
                />
              </Step>

              <Step number={4} title="Select Data Types">
                <p className="text-sm text-gray-400">
                  Choose which data types to export: Steps, Heart Rate, Sleep,
                  Weight, Active Energy, Water, etc.
                </p>
              </Step>
            </div>

            <h4 className="font-semibold text-white mt-6">Method 2: CSV Import</h4>
            <div className="space-y-3">
              <Step number={1} title="Export Health Data">
                <p className="text-sm text-gray-400">
                  Open the Health app → Click your profile → Export Health Data.
                  You'll receive a zip file with CSV data.
                </p>
              </Step>
              <Step number={2} title="Use the API to Import">
                <p className="text-sm text-gray-400 mb-2">
                  Parse the CSV and POST individual records:
                </p>
                <CodeBlock
                  id="health-curl"
                  code={`curl -X POST ${baseUrl}/api/v1/health \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "date": "2025-01-15",
    "mood_score": 7,
    "energy_score": 8,
    "sleep_hours": 7.5,
    "weight_kg": 75.2,
    "exercise_minutes": 45,
    "steps": 8500
  }'`}
                  copyId="health-curl"
                  copied={copied}
                  onCopy={handleCopy}
                />
              </Step>
            </div>
          </div>
        );

      case 'google-fit':
        return (
          <div className="space-y-4">
            <div className="bg-[#4285F4]/10 border border-[#4285F4]/20 rounded-xl p-5">
              <h3 className="text-lg font-bold mb-1">Google Fit Integration</h3>
              <p className="text-sm text-gray-400">
                Import fitness data from Google Fit via OAuth or manual export.
              </p>
            </div>

            <h4 className="font-semibold text-white">Method 1: Google Fit API + Server</h4>
            <div className="space-y-3">
              <Step number={1} title="Set up Google Fit API">
                <p className="text-sm text-gray-400">
                  Enable the Fitness API in Google Cloud Console.
                  Create OAuth 2.0 credentials with fitness.activity.read scope.
                </p>
              </Step>
              <Step number={2} title="Build a middleware server">
                <p className="text-sm text-gray-400 mb-2">
                  Create a small service that polls Google Fit and pushes to LifeOS:
                </p>
                <CodeBlock
                  id="gfit-url"
                  code={`${baseUrl}/api/v1/webhooks/health`}
                  copyId="gfit-url"
                  copied={copied}
                  onCopy={handleCopy}
                />
              </Step>
            </div>

            <h4 className="font-semibold text-white mt-6">Method 2: Manual Export</h4>
            <CodeBlock
              id="gfit-curl"
              code={`curl -X POST ${baseUrl}/api/v1/health \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "date": "2025-01-15",
    "steps": 10000,
    "heart_rate_avg": 72,
    "exercise_minutes": 30,
    "calories_burned": 450
  }'`}
              copyId="gfit-curl"
              copied={copied}
              onCopy={handleCopy}
            />
          </div>
        );

      case 'google-calendar':
        return (
          <div className="space-y-4">
            <div className="bg-[#4285F4]/10 border border-[#4285F4]/20 rounded-xl p-5">
              <h3 className="text-lg font-bold mb-1">Google Calendar Integration</h3>
              <p className="text-sm text-gray-400">
                Two-way sync between Google Calendar and LifeOS events.
              </p>
            </div>

            <Step number={1} title="Set up Google Calendar Push Notifications">
              <p className="text-sm text-gray-400">
                Use the Google Calendar API to register a push notification channel
                that sends event changes to LifeOS.
              </p>
            </Step>

            <Step number={2} title="Configure Webhook Endpoint">
              <CodeBlock
                id="cal-url"
                code={`${baseUrl}/api/v1/webhooks/calendar`}
                copyId="cal-url"
                copied={copied}
                onCopy={handleCopy}
              />
            </Step>

            <Step number={3} title="Example Calendar Payload">
              <CodeBlock
                id="cal-curl"
                code={`curl -X POST ${baseUrl}/api/v1/webhooks/calendar \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Team Standup",
    "start_time": "2025-01-15T09:00:00",
    "end_time": "2025-01-15T09:30:00",
    "location": "Zoom",
    "calendar_id": "work@gmail.com",
    "event_type": "work",
    "source": "google-calendar"
  }'`}
                copyId="cal-curl"
                copied={copied}
                onCopy={handleCopy}
              />
            </Step>
          </div>
        );

      case 'banking':
        return (
          <div className="space-y-4">
            <div className="bg-[#10B981]/10 border border-[#10B981]/20 rounded-xl p-5">
              <h3 className="text-lg font-bold mb-1">Banking Integration</h3>
              <p className="text-sm text-gray-400">
                Import transactions from your bank via CSV or Open Banking webhooks.
              </p>
            </div>

            <h4 className="font-semibold text-white">Method 1: Open Banking Webhook</h4>
            <Step number={1} title="Configure banking API">
              <p className="text-sm text-gray-400 mb-2">
                Set your banking provider to push transaction notifications:
              </p>
              <CodeBlock
                id="bank-url"
                code={`${baseUrl}/api/v1/webhooks/banking`}
                copyId="bank-url"
                copied={copied}
                onCopy={handleCopy}
              />
            </Step>

            <Step number={2} title="Example Banking Payload">
              <CodeBlock
                id="bank-curl"
                code={`curl -X POST ${baseUrl}/api/v1/webhooks/banking \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "expense",
    "amount": 45.50,
    "description": "WOOLWORTTS 1234 MELBOURNE",
    "date": "2025-01-15",
    "merchant": "Woolworths",
    "category": "groceries",
    "reference": "TXN-2025-001234"
  }'`}
                copyId="bank-curl"
                copied={copied}
                onCopy={handleCopy}
              />
            </Step>

            <h4 className="font-semibold text-white mt-6">Method 2: CSV Import</h4>
            <p className="text-sm text-gray-400 mb-2">
              Parse your bank's CSV export and POST transactions individually:
            </p>
            <CodeBlock
              id="bank-api"
              code={`curl -X POST ${baseUrl}/api/v1/finances \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "expense",
    "amount": 45.50,
    "title": "Woolworths",
    "category": "Food",
    "date": "2025-01-15"
  }'`}
              copyId="bank-api"
              copied={copied}
              onCopy={handleCopy}
            />
          </div>
        );

      case 'custom':
        return (
          <div className="space-y-4">
            <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 rounded-xl p-5">
              <h3 className="text-lg font-bold mb-1">Custom Integration</h3>
              <p className="text-sm text-gray-400">
                Use these generic webhook templates for any service.
              </p>
            </div>

            {/* Available endpoints */}
            <h4 className="font-semibold text-white">Available Endpoints</h4>
            <div className="space-y-2">
              {[
                { method: 'POST', path: '/api/v1/health', desc: 'Log health data' },
                { method: 'POST', path: '/api/v1/habits', desc: 'Log habit completions' },
                { method: 'POST', path: '/api/v1/finances', desc: 'Log transactions' },
                { method: 'POST', path: '/api/v1/journal', desc: 'Create journal entries' },
                { method: 'POST', path: '/api/v1/schedule', desc: 'Create events' },
                { method: 'POST', path: '/api/v1/goals', desc: 'Create/update goals' },
                { method: 'GET', path: '/api/v1/stats', desc: 'Get user stats' },
                { method: 'GET', path: '/api/v1/insights', desc: 'Get AI insights' },
                { method: 'GET', path: '/api/v1/me', desc: 'Get user profile' },
              ].map((ep) => (
                <div key={ep.path} className="flex items-center gap-3 bg-black/20 rounded-lg px-4 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    ep.method === 'GET' ? 'bg-[#3B82F6]/20 text-[#3B82F6]' : 'bg-[#10B981]/20 text-[#10B981]'
                  }`}>{ep.method}</span>
                  <code className="text-sm font-mono text-gray-300 flex-1">{baseUrl}{ep.path}</code>
                  <span className="text-xs text-gray-500">{ep.desc}</span>
                </div>
              ))}
            </div>

            {/* Generic template */}
            <h4 className="font-semibold text-white mt-4">Request Template</h4>
            <CodeBlock
              id="custom-template"
              code={`# Every request needs an API key
# Send via Authorization header:
Authorization: Bearer ${activeKey ? activeKey.key : 'lk_live_YOUR_API_KEY'}

# Or via query parameter:
# ?api_key=lk_live_YOUR_API_KEY

# Rate limit: 100 requests/minute per key
# Scopes: read, write, admin

# Example: Log health data
curl -X POST ${baseUrl}/api/v1/health \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"mood_score": 7, "sleep_hours": 8}'

# Example: Log an expense
curl -X POST ${baseUrl}/api/v1/finances \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"type": "expense", "amount": 25, "title": "Coffee"}'`}
              copyId="custom-template"
              copied={copied}
              onCopy={handleCopy}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Guide selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {GUIDES.map((guide) => (
          <button
            key={guide.id}
            onClick={() => setActiveGuide(guide.id)}
            className={`p-3 rounded-xl border text-center transition ${
              activeGuide === guide.id
                ? 'border-white/20 bg-white/10'
                : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10'
            }`}
          >
            <div className="text-2xl mb-1">{guide.icon}</div>
            <div className="text-sm font-medium">{guide.name}</div>
          </button>
        ))}
      </div>

      {/* Active guide content */}
      {renderGuide()}
    </div>
  );
}

// ── Helper Components ────────────────────────────────────────────────

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-[#00D4FF]/20 text-[#00D4FF] flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
        {number}
      </div>
      <div className="flex-1">
        <h5 className="font-medium text-white mb-1">{title}</h5>
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ code, copyId, id, copied, onCopy }: {
  code: string;
  copyId: string;
  id: string;
  copied: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  return (
    <div className="relative">
      <pre className="bg-black/40 rounded-lg p-3 text-xs font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap">
        {code}
      </pre>
      <button
        onClick={() => onCopy(code, copyId)}
        className="absolute top-2 right-2 px-3 py-1 bg-white/10 text-gray-300 rounded text-xs hover:bg-white/20 transition"
      >
        {copied === copyId ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}

export default IntegrationGuides;