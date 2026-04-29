import { useAIUsage } from '../hooks/useAIUsage';
import { useUserStore } from '../stores/useUserStore';
import { DollarSign, Cpu, Zap, BarChart3, Trash2 } from 'lucide-react';

function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email === 'tewedross12@gmail.com' || email.includes('teddyscleaning');
}

export function AIUsageStats() {
  const user = useUserStore(s => s.user);
  const { summary, clearAll } = useAIUsage();

  if (!isAdmin(user?.email)) return null;

  const models = Object.entries(summary.byModel);
  const sources = Object.entries(summary.bySource);

  return (
    <div style={{
      background: 'rgba(15,15,30,0.8)',
      borderRadius: 16,
      padding: 24,
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Cpu size={20} style={{ color: '#a78bfa' }} />
        <h3 style={{ color: '#e2e8f0', margin: 0, fontSize: 18 }}>AI Usage This Month</h3>
        <button
          onClick={clearAll}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
          title="Clear usage data"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard icon={<Zap size={16} />} label="Calls" value={summary.totalCalls.toLocaleString()} color="#10b981" />
        <StatCard icon={<Cpu size={16} />} label="Tokens In" value={formatTokens(summary.totalTokensIn)} color="#3b82f6" />
        <StatCard icon={<BarChart3 size={16} />} label="Tokens Out" value={formatTokens(summary.totalTokensOut)} color="#8b5cf6" />
        <StatCard icon={<DollarSign size={16} />} label="Est. Cost" value={formatCost(summary.totalCostCents)} color="#f59e0b" />
      </div>

      {/* By Model */}
      {models.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ color: '#94a3b8', fontSize: 13, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>By Model</h4>
          {models.map(([model, data]) => (
            <div key={model} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ color: '#cbd5e1', fontSize: 13 }}>{model}</span>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>{data.calls} calls · {formatTokens(data.tokensIn + data.tokensOut)} tokens · {formatCost(data.costCents)}</span>
            </div>
          ))}
        </div>
      )}

      {/* By Source */}
      {sources.length > 0 && (
        <div>
          <h4 style={{ color: '#94a3b8', fontSize: 13, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>By Source</h4>
          {sources.map(([source, data]) => (
            <div key={source} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ color: '#cbd5e1', fontSize: 13, textTransform: 'capitalize' }}>{source}</span>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>{data.calls} calls · {formatCost(data.costCents)}</span>
            </div>
          ))}
        </div>
      )}

      {summary.totalCalls === 0 && (
        <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 20 }}>No AI calls recorded yet. Usage will appear here as you interact with AI features.</p>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      borderRadius: 10,
      padding: '12px 14px',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      </div>
      <span style={{ color: '#e2e8f0', fontSize: 18, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function formatCost(cents: number): string {
  if (cents >= 100) return '$' + (cents / 100).toFixed(2);
  if (cents > 0) return '¢' + cents.toFixed(1);
  return '$0.00';
}