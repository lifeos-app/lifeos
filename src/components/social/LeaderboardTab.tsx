/**
 * LeaderboardTab — Global XP leaderboard with weekly reset + domain ladders.
 *
 * Shows:
 * 1. Weekly XP leaderboard (top users by XP earned this week)
 * 2. Domain ladder rankings (builder, scholar, innovator, etc.)
 * 3. User's own position highlighted
 *
 * "The worthy ascend. The rhythm of effort reveals the master."
 */

import { useState, useEffect, useMemo } from 'react';
import { Trophy, TrendingUp, Flame, Crown, Medal, ArrowUp, ArrowDown, Minus, Award } from 'lucide-react';
import { supabase } from '../../lib/data-access';
import { useUserStore } from '../../stores/useUserStore';
import { useGamificationContext } from '../../lib/gamification/context';
import { LADDERS, getLadder, type LadderKey } from '../../lib/gamification/ladder';
import { HermeticPrincipleBar } from '../shared/HermeticPrincipleBar';

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_xp: number;
  weekly_xp: number;
  level: number;
  ladder: LadderKey | null;
  ladder_rank: string | null;
  rank: number;
  xp_change: number; // positive = climbing
}

interface DomainEntry {
  ladder_key: LadderKey;
  display_name: string;
  level: number;
  weekly_xp: number;
}

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday start
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

export function LeaderboardTab() {
  const user = useUserStore(s => s.user);
  const gamCtx = useGamificationContext();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [domainView, setDomainView] = useState<LadderKey>('builder');
  const [domainEntries, setDomainEntries] = useState<DomainEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'weekly' | 'domain'>('weekly');

  useEffect(() => {
    loadLeaderboard();
  }, []);

  useEffect(() => {
    if (tab === 'domain') loadDomainLeaderboard();
  }, [tab, domainView]);

  async function loadLeaderboard() {
    setLoading(true);
    try {
      const weekStart = getWeekStart();
      // Get global leaderboard (weekly XP)
      const { data: profiles, error } = await supabase
        .from('public_profiles')
        .select('user_id, display_name, avatar_url, total_xp, level, ladder, ladder_rank')
        .gte('updated_at', weekStart)
        .order('total_xp', { ascending: false })
        .limit(50);

      if (error || !profiles) {
        // Fallback: fetch without date filter (all-time leaderboard)
        const { data: allProfiles } = await supabase
          .from('public_profiles')
          .select('user_id, display_name, avatar_url, total_xp, level, ladder, ladder_rank')
          .order('total_xp', { ascending: false })
          .limit(50);
        if (allProfiles) {
          setLeaderboard(allProfiles.map((p: any, i: number) => ({
            ...p,
            weekly_xp: 0,
            rank: i + 1,
            xp_change: 0,
          })));
        }
      } else {
        setLeaderboard(profiles.map((p: any, i: number) => ({
          ...p,
          weekly_xp: p.total_xp || 0,
          rank: i + 1,
          xp_change: 0,
        })));
      }
    } catch {
      // Offline/solo mode — show just the current user
    }
    setLoading(false);
  }

  async function loadDomainLeaderboard() {
    try {
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('user_id, display_name, level, ladder, total_xp')
        .eq('ladder', domainView)
        .order('total_xp', { ascending: false })
        .limit(20);

      if (profiles) {
        setDomainEntries(profiles.map((p: any) => ({
          ladder_key: p.ladder,
          display_name: p.display_name || 'Adventurer',
          level: p.level || 1,
          weekly_xp: p.total_xp || 0,
        })));
      }
    } catch {
      // Offline — show empty
    }
  }

  const myRank = leaderboard.findIndex(e => e.user_id === user?.id) + 1;

  const RankIcon = ({ rank }: { rank: number }) => {
    if (rank === 1) return <Crown size={14} color="#FFD700" />;
    if (rank === 2) return <Medal size={14} color="#C0C0C0" />;
    if (rank === 3) return <Medal size={14} color="#CD7F32" />;
    return <span style={{ fontSize: 12, color: '#5A7A9A', fontWeight: 600 }}>{rank}</span>;
  };

  return (
    <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #FFD700 0%, #F97316 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Trophy size={18} color="#050E1A" />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Leaderboard</div>
          <div style={{ fontSize: 11, color: '#5A7A9A' }}>
            {tab === 'weekly' ? 'Weekly XP rankings' : `${getLadder(domainView)?.name || domainView} ladder`}
          </div>
        </div>
        {myRank > 0 && (
          <div style={{
            marginLeft: 'auto', padding: '4px 10px',
            background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)',
            borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#00D4FF',
          }}>
            #{myRank}
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setTab('weekly')}
          style={{
            flex: 1, padding: '8px 0',
            background: tab === 'weekly' ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${tab === 'weekly' ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: 10, color: tab === 'weekly' ? '#00D4FF' : '#8BA4BE',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <TrendingUp size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Weekly XP
        </button>
        <button
          onClick={() => setTab('domain')}
          style={{
            flex: 1, padding: '8px 0',
            background: tab === 'domain' ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${tab === 'domain' ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: 10, color: tab === 'domain' ? '#00D4FF' : '#8BA4BE',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <Award size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Domain Ladders
        </button>
      </div>

      {/* Domain ladder selector (only in domain tab) */}
      {tab === 'domain' && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {Object.entries(LADDERS).map(([key, def]) => (
            <button
              key={key}
              onClick={() => setDomainView(key as LadderKey)}
              style={{
                padding: '4px 10px',
                background: domainView === key ? `${def.color}15` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${domainView === key ? `${def.color}30` : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 6, fontSize: 10, fontWeight: 600,
                color: domainView === key ? def.color : '#8BA4BE',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {def.icon} {def.name}
            </button>
          ))}
        </div>
      )}

      {/* Leaderboard entries */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#5A7A9A', fontSize: 13 }}>
          Loading the ranks...
        </div>
      ) : (tab === 'weekly' ? leaderboard : domainEntries).length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#5A7A9A', fontSize: 13 }}>
          {tab === 'weekly'
            ? 'No adventurers have earned XP this week. Be the first!'
            : `No ${getLadder(domainView)?.name || domainView} ranked yet.`}
        </div>
      ) : tab === 'weekly' ? (
        /* Weekly XP Leaderboard */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {leaderboard.slice(0, 25).map((entry) => {
            const isMe = entry.user_id === user?.id;
            const ladder = getLadder(entry.ladder);
            return (
              <div key={entry.user_id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                background: isMe ? 'rgba(0,212,255,0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isMe ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)'}`,
                borderRadius: 10,
              }}>
                <div style={{ width: 28, textAlign: 'center' }}>
                  <RankIcon rank={entry.rank} />
                </div>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: ladder ? `${ladder.color}20` : 'rgba(255,255,255,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, color: ladder?.color ?? '#8BA4BE',
                }}>
                  {entry.level}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isMe ? '#00D4FF' : '#fff' }}>
                    {entry.display_name || 'Adventurer'}{isMe ? ' (you)' : ''}
                  </div>
                  <div style={{ fontSize: 10, color: '#5A7A9A' }}>
                    {ladder ? `${ladder.icon} ${entry.ladder_rank || ladder.name}` : `Level ${entry.level}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Orbitron, monospace', color: isMe ? '#39FF14' : '#fff' }}>
                    {(entry.weekly_xp || entry.total_xp || 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 9, color: '#5A7A9A' }}>XP</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Domain Ladder Rankings */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {domainEntries.map((entry, idx) => (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: 10,
            }}>
              <div style={{ width: 28, textAlign: 'center' }}>
                <RankIcon rank={idx + 1} />
              </div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#fff' }}>
                {entry.display_name}
              </div>
              <div style={{ fontSize: 11, color: '#8BA4BE' }}>
                Lv. {entry.level}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'Orbitron, monospace', color: getLadder(domainView)?.color ?? '#00D4FF' }}>
                {entry.weekly_xp.toLocaleString()} XP
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hermetic footer */}
      <HermeticPrincipleBar domain="dashboard" />
    </div>
  );
}