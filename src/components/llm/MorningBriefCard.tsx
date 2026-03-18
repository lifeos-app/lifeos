/**
 * MorningBriefCard
 *
 * Beautiful card layout for the LLM-generated morning brief.
 * Shows schedule preview, active quests, streak status, partner updates.
 * Has a "Start my day" button that navigates to the most important item.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sun, Calendar, CheckSquare, Flame, DollarSign,
  Users, Target, ArrowRight, X, Sparkles, Zap, PartyPopper,
} from 'lucide-react';
import type { LLMMorningBrief } from '../../lib/llm/morning-brief';
import { EmojiIcon } from '../../lib/emoji-icon';

// ── COMPONENT ──────────────────────────────────────────────────────────────────

interface MorningBriefCardProps {
  brief: LLMMorningBrief;
  onDismiss?: () => void;
  compact?: boolean;
}

export function MorningBriefCard({ brief, onDismiss, compact = false }: MorningBriefCardProps) {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleStartDay = () => {
    if (brief.primaryAction) {
      navigate(brief.primaryAction.path);
    } else {
      navigate('/');
    }
    onDismiss?.();
  };

  const PRIORITY_DOT: Record<string, string> = {
    urgent: '#EF4444',
    high:   '#F97316',
    medium: '#EAB308',
    low:    '#6B7280',
  };

  // ── COMPACT (inside chat panel) ──
  if (compact) {
    return (
      <div style={{
        background:   'linear-gradient(135deg, rgba(0,212,255,0.07) 0%, rgba(124,92,252,0.04) 100%)',
        border:       '1px solid rgba(0,212,255,0.18)',
        borderRadius: 14,
        padding:      16,
        opacity:      visible ? 1 : 0,
        transform:    visible ? 'translateY(0)' : 'translateY(12px)',
        transition:   'all 0.4s ease',
        marginTop:    8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Sun size={16} style={{ color: '#FACC15' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: '#E8F0FE' }}>{brief.greeting}</span>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <StatPill icon={<CheckSquare size={10} />} label={`${brief.activeQuests.length} quest${brief.activeQuests.length !== 1 ? 's' : ''}`} color="#00D4FF" />
          {brief.streakStatus.days > 0 && (
            <StatPill icon={<Flame size={10} />} label={`${brief.streakStatus.days}d streak`} color="#F97316" />
          )}
          {brief.xpToday > 0 && (
            <StatPill icon={<Zap size={10} />} label={`+${brief.xpToday} XP today`} color="#FACC15" />
          )}
        </div>

        {/* Focus */}
        <p style={{ fontSize: 12, color: '#8BA4BE', margin: '0 0 12px', lineHeight: 1.5 }}>
          {brief.suggestedFocus}
        </p>

        {/* Start button */}
        <button onClick={handleStartDay} style={{
          background:   'linear-gradient(135deg, #00D4FF 0%, #0088CC 100%)',
          border:       'none',
          borderRadius: 8,
          padding:      '7px 16px',
          color:        '#fff',
          fontSize:     12,
          fontWeight:   600,
          cursor:       'pointer',
          display:      'flex',
          alignItems:   'center',
          gap:          5,
        }}>
          {brief.primaryAction?.label ?? 'Start my day'} <ArrowRight size={12} />
        </button>
      </div>
    );
  }

  // ── FULL CARD (on dashboard) ──
  return (
    <div style={{
      background:     'linear-gradient(135deg, rgba(0,212,255,0.06) 0%, rgba(124,92,252,0.04) 100%)',
      border:         '1px solid rgba(0,212,255,0.15)',
      borderRadius:   18,
      overflow:       'hidden',
      opacity:        visible ? 1 : 0,
      transform:      visible ? 'translateY(0)' : 'translateY(20px)',
      transition:     'all 0.5s cubic-bezier(0.4,0,0.2,1)',
      marginBottom:   20,
    }}>
      {/* Header */}
      <div style={{
        padding:      '16px 20px',
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(0,212,255,0.08)',
        background:   'rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sun size={20} style={{ color: '#FACC15' }} />
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#E8F0FE' }}>
              {brief.greeting}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: '#5A7A9A' }}>{brief.date}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {brief.xpToday > 0 && (
            <div style={{
              display:      'flex',
              alignItems:   'center',
              gap:          5,
              background:   'rgba(0,212,255,0.1)',
              border:       '1px solid rgba(0,212,255,0.2)',
              borderRadius: 8,
              padding:      '4px 10px',
              fontSize:     12,
              fontWeight:   700,
              color:        '#00D4FF',
            }}>
              <Zap size={12} /> +{brief.xpToday} XP today
            </div>
          )}
          {onDismiss && (
            <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5A7A9A', padding: 4 }}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Grid sections */}
      <div style={{
        display:     'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap:         1,
        background:  'rgba(0,212,255,0.04)',
      }}>
        {/* Schedule */}
        <BriefSection icon={<Calendar size={14} style={{ color: '#A855F7' }} />} title="Today" delay={150}>
          {brief.todaySchedule.length === 0 ? (
            <p style={{ fontSize: 12, color: '#5A7A9A', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}><PartyPopper size={12} />Free day</p>
          ) : (
            brief.todaySchedule.slice(0, 3).map((ev, i) => (
              <div key={i} style={{ fontSize: 12, color: '#C5D5E8', marginBottom: 4 }}>
                <span style={{ color: '#A855F7', fontWeight: 600 }}>{ev.time}</span>{' '}
                {ev.title}
              </div>
            ))
          )}
        </BriefSection>

        {/* Active Quests */}
        <BriefSection icon={<CheckSquare size={14} style={{ color: '#00D4FF' }} />} title="Quests" delay={250}>
          {brief.activeQuests.length === 0 ? (
            <p style={{ fontSize: 12, color: '#5A7A9A', margin: 0 }}>No active quests</p>
          ) : (
            brief.activeQuests.slice(0, 3).map((q, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: PRIORITY_DOT[q.priority] ?? '#6B7280', flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontSize: 12, color: '#C5D5E8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <EmojiIcon emoji={q.icon} size={12} fallbackAsText /> {q.title}
                </span>
                <span style={{ fontSize: 10, color: '#00D4FF', flexShrink: 0 }}>+{q.reward_xp}</span>
              </div>
            ))
          )}
        </BriefSection>

        {/* Streak */}
        <BriefSection icon={<Flame size={14} style={{ color: '#F97316' }} />} title="Streak" delay={350}>
          {brief.streakStatus.days > 0 ? (
            <>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#F97316', margin: '0 0 4px' }}>
                {brief.streakStatus.days}
                <span style={{ fontSize: 13, fontWeight: 400, color: '#8BA4BE', marginLeft: 4 }}>days</span>
              </p>
              {brief.streakStatus.label && (
                <p style={{ fontSize: 11, color: '#F97316', margin: 0 }}>{brief.streakStatus.label}</p>
              )}
            </>
          ) : (
            <p style={{ fontSize: 12, color: '#5A7A9A', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}><Flame size={12} color="#F97316" />Start your streak today</p>
          )}
        </BriefSection>

        {/* Finance */}
        {brief.financeSummary && (
          <BriefSection icon={<DollarSign size={14} style={{ color: '#22C55E' }} />} title="This Week" delay={450}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div>
                <p style={{ fontSize: 10, color: '#5A7A9A', margin: '0 0 2px' }}>Income</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#22C55E', margin: 0 }}>
                  ${brief.financeSummary.income.toFixed(0)}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: '#5A7A9A', margin: '0 0 2px' }}>Expenses</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#EF4444', margin: 0 }}>
                  ${brief.financeSummary.expenses.toFixed(0)}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: '#5A7A9A', margin: '0 0 2px' }}>Net</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: brief.financeSummary.net >= 0 ? '#22C55E' : '#EF4444', margin: 0 }}>
                  ${brief.financeSummary.net.toFixed(0)}
                </p>
              </div>
            </div>
          </BriefSection>
        )}

        {/* Partners */}
        {brief.partnerUpdates.length > 0 && (
          <BriefSection icon={<Users size={14} style={{ color: '#EC4899' }} />} title="Partners" delay={550}>
            {brief.partnerUpdates.map((upd, i) => (
              <p key={i} style={{ fontSize: 12, color: '#C5D5E8', margin: '0 0 4px' }}>
                {upd}
              </p>
            ))}
          </BriefSection>
        )}
      </div>

      {/* Focus suggestion */}
      <div style={{
        padding:      '14px 20px',
        borderTop:    '1px solid rgba(0,212,255,0.06)',
        display:      'flex',
        alignItems:   'flex-start',
        gap:          10,
      }}>
        <Target size={14} style={{ color: '#00D4FF', marginTop: 2, flexShrink: 0 }} />
        <p style={{ fontSize: 12, color: '#C5D5E8', margin: 0, lineHeight: 1.6, flex: 1 }}>
          {brief.suggestedFocus}
        </p>
      </div>

      {/* Motivational note + Start button */}
      <div style={{
        padding:        '0 20px 16px',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        gap:            12,
        flexWrap:       'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={13} style={{ color: '#7C5CFC' }} />
          <p style={{ fontSize: 12, color: '#8BA4BE', margin: 0 }}>{brief.motivationalNote}</p>
        </div>
        <button
          onClick={handleStartDay}
          style={{
            background:   'linear-gradient(135deg, #00D4FF 0%, #0088CC 100%)',
            border:       'none',
            borderRadius: 8,
            padding:      '8px 20px',
            color:        '#fff',
            fontSize:     13,
            fontWeight:   600,
            cursor:       'pointer',
            display:      'flex',
            alignItems:   'center',
            gap:          6,
            flexShrink:   0,
            transition:   'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.03)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,212,255,0.3)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {brief.primaryAction?.label ?? 'Start my day'} <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ── SUB-COMPONENTS ─────────────────────────────────────────────────────────────

function StatPill({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <span style={{
      fontSize:     11,
      color,
      background:   `${color}14`,
      border:       `1px solid ${color}30`,
      borderRadius: 20,
      padding:      '3px 10px',
      display:      'flex',
      alignItems:   'center',
      gap:          4,
    }}>
      {icon} {label}
    </span>
  );
}

function BriefSection({
  icon, title, children, delay,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  delay: number;
}) {
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVis(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div style={{
      padding:    '14px 16px',
      background: '#0A1628',
      opacity:    vis ? 1 : 0,
      transform:  vis ? 'translateY(0)' : 'translateY(8px)',
      transition: 'all 0.35s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 700, color: '#5A7A9A', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}
