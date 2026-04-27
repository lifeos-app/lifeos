/**
 * CheatsheetsView — Grid of cheatsheet cards + detail viewer.
 */

import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CHEATSHEETS } from '../../data/academy-manifest';
import { readAcademyFile } from '../../lib/academy-data';

export function CheatsheetsView({ activeId, onSelect }: {
  activeId: string | null; onSelect: (id: string | null) => void;
}) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeId) return;
    const cs = CHEATSHEETS.find(c => c.id === activeId);
    if (!cs) return;
    setLoading(true);
    readAcademyFile(cs.path).then(md => { setContent(md); setLoading(false); });
  }, [activeId]);

  if (activeId) {
    const cs = CHEATSHEETS.find(c => c.id === activeId);
    return (
      <div style={{ paddingBottom: 24 }}>
        <button onClick={() => onSelect(null)} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
          borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.06)',
          color: '#8BA4BE', cursor: 'pointer', marginBottom: 16, fontSize: 13,
        }}>
          <ChevronLeft size={14} /> All Cheatsheets
        </button>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
          {cs?.icon} {cs?.title} Cheatsheet
        </h2>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#5A7A9A' }}>Loading...</div>
        ) : (
          <div className="academy-lesson-content" style={{
            background: 'rgba(255,255,255,0.02)', borderRadius: 12,
            padding: '24px 28px', border: '1px solid rgba(255,255,255,0.06)',
            lineHeight: 1.7, fontSize: 14, color: '#D0D0D0',
          }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginTop: 24, marginBottom: 10 }}>{children}</h1>,
                h2: ({ children }) => <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E0E0E0', marginTop: 20, marginBottom: 8 }}>{children}</h2>,
                h3: ({ children }) => <h3 style={{ fontSize: 15, fontWeight: 600, color: '#C0C0C0', marginTop: 16, marginBottom: 6 }}>{children}</h3>,
                code: ({ className, children, ...props }) => {
                  const isInline = !className;
                  if (isInline) return <code style={{ background: 'rgba(0,212,255,0.1)', color: '#00D4FF', padding: '1px 5px', borderRadius: 3, fontSize: '0.9em', fontFamily: "'JetBrains Mono', monospace" }}>{children}</code>;
                  return <code className={className} style={{ display: 'block', background: '#0A1628', padding: '12px 16px', borderRadius: 8, overflowX: 'auto', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.5, border: '1px solid rgba(255,255,255,0.06)', color: '#E0E0E0' }} {...props}>{children}</code>;
                },
                pre: ({ children }) => <pre style={{ margin: '12px 0', background: 'transparent' }}>{children}</pre>,
                a: ({ href, children }) => <a href={href} target="_blank" rel="noopener" style={{ color: '#00D4FF' }}>{children}</a>,
                table: ({ children }) => <div style={{ overflowX: 'auto', marginBottom: 12 }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>{children}</table></div>,
                th: ({ children }) => <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '2px solid rgba(255,255,255,0.1)', color: '#00D4FF', fontWeight: 600 }}>{children}</th>,
                td: ({ children }) => <td style={{ padding: '5px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{children}</td>,
                strong: ({ children }) => <strong style={{ color: '#fff' }}>{children}</strong>,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 16 }}>
        Quick Reference Cheatsheets
      </h2>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12,
      }}>
        {CHEATSHEETS.map(cs => (
          <button
            key={cs.id}
            onClick={() => onSelect(cs.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 8, padding: '20px 16px', borderRadius: 12, cursor: 'pointer',
              background: `linear-gradient(135deg, ${cs.color}10, ${cs.color}05)`,
              border: `1px solid ${cs.color}30`,
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 32 }}>{cs.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#E0E0E0' }}>
              {cs.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}