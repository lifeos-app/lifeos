/**
 * HolyHermesOracle — AI Spiritual Assistant on the Dashboard
 *
 * Two modes:
 * 1. PASSIVE (default): Today's Hermetic principle with cross-tradition correspondences
 * 2. ACTIVE (user asks): Inline chat → LLM proxy → PRINCIPLE + CORRESPONDENCE + PRACTICE + MIRACLE
 *
 * "The lips of wisdom are closed, except to the ears of understanding."
 */

import { useState, useMemo, useCallback } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { callLLMProxy } from '../lib/llm-proxy';

const PRINCIPLES = [
  { name: 'MENTALISM', axiom: 'The All is Mind', quote: 'THE UNIVERSE IS MENTAL — HELD IN THE MIND OF THE ALL.',
    correspondence: 'Hinduism: Brahman. Kabbalah: Ein Sof. Buddhism: Cittamatra.' },
  { name: 'CORRESPONDENCE', axiom: 'As Above, So Below', quote: 'AS ABOVE SO BELOW; AS BELOW SO ABOVE.',
    correspondence: 'Hermeticism: As Above So Below. Hinduism: Macrocosm/Microcosm. Christianity: On Earth as in Heaven.' },
  { name: 'VIBRATION', axiom: 'Nothing Rests; Everything Moves', quote: 'NOTHING RESTS; EVERYTHING MOVES; EVERYTHING VIBRATES.',
    correspondence: 'Sufism: Dhikr. Taoism: Qi. Christianity: Word/Logos.' },
  { name: 'POLARITY', axiom: 'Everything is Dual', quote: 'EVERYTHING IS DUAL; EVERYTHING HAS POLES.',
    correspondence: 'Taoism: Yin/Yang. Hinduism: Shiva/Shakti. Zoroastrianism: Ahura/Angra.' },
  { name: 'RHYTHM', axiom: 'Everything Flows', quote: 'EVERYTHING FLOWS, OUT AND IN; THE PENDULUM SWING MANIFESTS IN EVERYTHING.',
    correspondence: 'Buddhism: Samsara. Stoicism: Cycles. Hinduism: Yugas.' },
  { name: 'CAUSE & EFFECT', axiom: 'Every Cause Has Its Effect', quote: 'EVERY CAUSE HAS ITS EFFECT; EVERY EFFECT HAS ITS CAUSE.',
    correspondence: 'Buddhism: Karma. Christianity: Reap what you sow. Hermeticism: Law of Compensation.' },
  { name: 'GENDER', axiom: 'Gender is in Everything', quote: 'GENDER IS IN EVERYTHING; EVERYTHING HAS ITS MASCULINE AND FEMININE PRINCIPLES.',
    correspondence: 'Taoism: Yin/Yang. Hinduism: Ardhanarishvara. Alchemy: Solve et Coagula.' },
];

const SYSTEM_PROMPT = `You are Holy Hermes — the Oracle of the Crossroads.
You draw on sacred wisdom from 28+ traditions and 7 Hermetic principles.
When asked a question, respond in this EXACT format:

**THE PRINCIPLE:** [Which Hermetic principle is at work — Mentalism, Correspondence, Vibration, Polarity, Rhythm, Cause/Effect, Gender]

**THE CORRESPONDENCE:** [What does this pattern look like across traditions? Connect at least 2 traditions.]

**THE PRACTICE:** [A concrete Hermetic operation to move from stuck to unstuck]

**THE MIRACLE:** [The insight that dissolves the apparent contradiction]

Keep responses under 150 words. Be direct. Speak with weight.`;

const STORAGE_KEY = 'holy-hermes-oracle-history';

function getDailyIndex(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return dayOfYear % PRINCIPLES.length;
}

function loadHistory(): { q: string; a: string }[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveHistory(h: { q: string; a: string }[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h.slice(-10)));
}

const S = {
  card: { background: 'linear-gradient(135deg, #0F2D4A 0%, #0a1f35 100%)', border: '1px solid #1A3A5C', borderRadius: 16, padding: '20px 24px', position: 'relative' as const, overflow: 'hidden' as const },
  glow: (top: number, right: number) => ({ position: 'absolute' as const, top, right, width: 80, height: 80, background: 'radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' as const }),
  header: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconWrap: { width: 32, height: 32, borderRadius: 8, background: 'rgba(0,212,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  nameRow: { fontSize: 11, fontWeight: 600, color: '#00D4FF', textTransform: 'uppercase' as const, letterSpacing: 1.2 },
  axiomRow: { fontSize: 13, color: '#8BA4BE', marginTop: 1 },
  quote: { margin: '0 0 10px 0', padding: '0 0 0 14px', borderLeft: '2px solid rgba(0,212,255,0.3)', fontSize: 14, fontStyle: 'italic', color: '#5A7A9A', lineHeight: 1.6 },
  corr: { margin: '0 0 14px 0', fontSize: 12, color: '#8BA4BE', lineHeight: 1.5 },
  inputRow: { display: 'flex', gap: 8, marginTop: 12 },
  input: { flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid #1A3A5C', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, fontFamily: 'Poppins, sans-serif', outline: 'none' },
  btn: (disabled: boolean) => ({ width: 36, height: 36, borderRadius: 8, border: 'none', background: disabled ? '#1A3A5C' : '#00D4FF', color: disabled ? '#5A7A9A' : '#050E1A', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer' }),
  response: { background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.1)', borderRadius: 10, padding: 12, marginTop: 10, fontSize: 13, color: '#8BA4BE', lineHeight: 1.6, whiteSpace: 'pre-wrap' as const },
  historyItem: { fontSize: 12, color: '#5A7A9A', padding: '6px 0', cursor: 'pointer', borderBottom: '1px solid rgba(26,58,92,0.4)' },
};

export function HolyHermesOracle() {
  const today = useMemo(() => PRINCIPLES[getDailyIndex()], []);
  const [mode, setMode] = useState<'passive' | 'active'>('passive');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [history, setHistory] = useState(loadHistory);

  const askOracle = useCallback(async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setMode('active');
    const q = query.trim();
    setQuery('');
    try {
      const res = await callLLMProxy([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: q },
      ]);
      setResponse(res.content);
      const updated = [...history, { q, a: res.content }].slice(-10);
      setHistory(updated);
      saveHistory(updated);
    } catch {
      setResponse('The Oracle is silent. Try again later.');
    }
    setLoading(false);
  }, [query, loading, history]);

  return (
    <div style={S.card}>
      <div style={S.glow(-20, -20)} aria-hidden="true" />

      <div style={S.header}>
        <div style={S.iconWrap}><Sparkles size={16} color="#00D4FF" /></div>
        <div>
          <div style={S.nameRow}>HOLY HERMES ORACLE</div>
          <div style={S.axiomRow}>{today.name} — {today.axiom}</div>
        </div>
      </div>

      {mode === 'passive' ? (
        <>
          <blockquote style={S.quote}>"{today.quote}"<footer style={{ fontSize: 11, color: '#5A7A9A', marginTop: 4, fontStyle: 'normal' }}>- The Kybalion</footer></blockquote>
          <p style={S.corr}>{today.correspondence}</p>
          {history.length > 0 && <div style={{ fontSize: 11, color: '#5A7A9A', marginBottom: 6 }}>Recent questions:</div>}
          {history.slice(-3).reverse().map((h, i) => (
            <div key={i} style={S.historyItem} onClick={() => { setQuery(h.q); setMode('active'); }}>? {h.q}</div>
          ))}
        </>
      ) : (
        <>
          {response && <div style={S.response}>{response}</div>}
          {loading && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, color: '#5A7A9A' }}><Loader2 size={14} className="spin" /> Consulting the Oracle...</div>}
        </>
      )}

      <div style={S.inputRow}>
        <input
          style={S.input}
          placeholder="Ask the Oracle..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && askOracle()}
          onFocus={() => setMode('active')}
          aria-label="Ask Holy Hermes a question"
        />
        <button style={S.btn(loading || !query.trim())} onClick={askOracle} disabled={loading || !query.trim()} aria-label="Send question">
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}