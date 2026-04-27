/**
 * TabButton — Reusable tab button for Academy header.
 */

import React from 'react';

export function TabButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      aria-label={label}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
        borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500,
        background: active ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
        color: active ? '#00D4FF' : '#8BA4BE',
        cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      {icon} {label}
    </button>
  );
}