// Kingdom View — Premium Political Dashboard
// Australia data researched Feb 2026

import { useState } from 'react';
import { Crown, Users, Building2, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import './kingdom.css';

interface PartyColors {
  bg: string;
  border: string;
  text: string;
  glow: string;
}

const PARTY_COLORS: Record<string, PartyColors> = {
  'Liberal-National Coalition': { bg: 'rgba(37,99,235,0.15)', border: 'rgba(37,99,235,0.4)', text: '#60A5FA', glow: '0 0 20px rgba(37,99,235,0.3)' },
  'Liberal': { bg: 'rgba(37,99,235,0.15)', border: 'rgba(37,99,235,0.4)', text: '#60A5FA', glow: '0 0 20px rgba(37,99,235,0.3)' },
  'LNP': { bg: 'rgba(37,99,235,0.15)', border: 'rgba(37,99,235,0.4)', text: '#60A5FA', glow: '0 0 20px rgba(37,99,235,0.3)' },
  'Labor': { bg: 'rgba(220,38,38,0.15)', border: 'rgba(220,38,38,0.4)', text: '#F87171', glow: '0 0 20px rgba(220,38,38,0.3)' },
};

const STATE_ICONS: Record<string, string> = {
  'NSW': '🏙️',
  'VIC': '🏛️',
  'QLD': '☀️',
  'WA': '⛏️',
  'SA': '🍷',
  'TAS': '🌲',
};

function getPartyColors(party: string): PartyColors {
  return PARTY_COLORS[party] || { bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.3)', text: '#9CA3AF', glow: 'none' };
}

export function KingdomView() {
  const [showSeats, setShowSeats] = useState(true);

  // Data accurate as of February 2026
  // Federal: Labor won 2025 election in a landslide. Dutton lost his seat.
  // Opposition: Sussan Ley replaced Dutton, then Angus Taylor replaced Ley (Feb 13, 2026)
  const kingdom = {
    name: 'Commonwealth of Australia',
    flag: '🇦🇺',
    coatOfArms: '🦘',
    king: {
      title: 'Prime Minister',
      name: 'Anthony Albanese',
      party: 'Labor',
      since: 'May 2022',
      term: '2nd term (re-elected May 2025)',
    },
    opposition: {
      title: 'Opposition Leader',
      name: 'Angus Taylor',
      party: 'Liberal',
      since: 'Feb 2026',
    },
    nextElection: 'By May 2028',
    parliament: {
      // 2025 federal election results — House of Representatives
      total: 150,
      seats: [
        { party: 'Labor', count: 94, color: '#DC2626' },
        { party: 'Coalition', count: 43, color: '#2563EB' },
        { party: 'Independents', count: 10, color: '#8B5CF6' },
        { party: 'Greens', count: 1, color: '#16A34A' },
        { party: 'Other', count: 2, color: '#6B7280' },
      ],
    },
    states: [
      // NSW: Chris Minns (Labor). Opposition: Kellie Sloane (Liberal, since Nov 2025)
      { state: 'NSW', name: 'Chris Minns', party: 'Labor' },
      // VIC: Jacinta Allan (Labor). Opposition: Brad Battin (Liberal, since Dec 2024)
      { state: 'VIC', name: 'Jacinta Allan', party: 'Labor' },
      // QLD: David Crisafulli (LNP) — won Oct 2025 election
      { state: 'QLD', name: 'David Crisafulli', party: 'LNP' },
      // WA: Roger Cook (Labor) — won March 2025 election
      { state: 'WA', name: 'Roger Cook', party: 'Labor' },
      // SA: Peter Malinauskas (Labor) — caretaker, election 21 March 2026
      { state: 'SA', name: 'Peter Malinauskas', party: 'Labor', note: 'Election 21 Mar 2026' },
      // TAS: Jeremy Rockliff (Liberal)
      { state: 'TAS', name: 'Jeremy Rockliff', party: 'Liberal' },
    ] as Array<{ state: string; name: string; party: string; note?: string }>,
  };

  const pmColors = getPartyColors(kingdom.king.party);
  const oppColors = getPartyColors(kingdom.opposition.party);

  return (
    <div className="kingdom-view">
      {/* ── Hero Banner ── */}
      <div className="kingdom-hero">
        <div className="kingdom-hero__bg" />
        <div className="kingdom-hero__content">
          <div className="kingdom-hero__flag">{kingdom.flag}</div>
          <div className="kingdom-hero__text">
            <h1 className="kingdom-hero__title">{kingdom.name}</h1>
            <p className="kingdom-hero__subtitle">
              {kingdom.coatOfArms} Political Leadership Dashboard
            </p>
          </div>
        </div>
        <div className="kingdom-hero__stripe" />
      </div>

      {/* ── Prime Minister — Large Hero Card ── */}
      <div className="kingdom-pm-card" style={{
        borderColor: pmColors.border,
        boxShadow: pmColors.glow,
      }}>
        <div className="kingdom-pm-card__crown"><Crown size={14} /></div>
        <div className="kingdom-pm-card__crown-glow" />
        <div className="kingdom-pm-card__header">
          <Crown size={18} className="kingdom-pm-card__icon" />
          <span className="kingdom-pm-card__label">Prime Minister</span>
        </div>
        <h2 className="kingdom-pm-card__name">{kingdom.king.name}</h2>
        <div className="kingdom-pm-card__detail">Since {kingdom.king.since} · {kingdom.king.term}</div>
        <span className="kingdom-party-badge" style={{
          background: pmColors.bg,
          borderColor: pmColors.border,
          color: pmColors.text,
        }}>
          {kingdom.king.party}
        </span>
        <div className="kingdom-pm-card__election">
          ⏳ Next Election: <strong>{kingdom.nextElection}</strong>
        </div>
      </div>

      {/* ── Parliament Composition ── */}
      <div className="kingdom-parliament">
        <button
          className="kingdom-parliament__toggle"
          onClick={() => setShowSeats(!showSeats)}
        >
          <div className="kingdom-parliament__toggle-left">
            <Building2 size={15} />
            <span>House of Representatives</span>
            <span className="kingdom-parliament__total">{kingdom.parliament.total} seats</span>
          </div>
          {showSeats ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showSeats && (
          <div className="kingdom-parliament__content">
            {/* Seat bar */}
            <div className="kingdom-seat-bar">
              {kingdom.parliament.seats.map(s => (
                <div
                  key={s.party}
                  className="kingdom-seat-bar__segment"
                  style={{
                    width: `${(s.count / kingdom.parliament.total) * 100}%`,
                    background: s.color,
                  }}
                  title={`${s.party}: ${s.count}`}
                />
              ))}
            </div>
            {/* Legend */}
            <div className="kingdom-seat-legend">
              {kingdom.parliament.seats.map(s => (
                <div key={s.party} className="kingdom-seat-legend__item">
                  <span className="kingdom-seat-legend__dot" style={{ background: s.color }} />
                  <span className="kingdom-seat-legend__label">{s.party}</span>
                  <span className="kingdom-seat-legend__count">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Opposition Leader ── */}
      <div className="kingdom-opposition-card" style={{
        borderColor: oppColors.border,
      }}>
        <div className="kingdom-opposition-card__header">
          <Users size={15} />
          <span>{kingdom.opposition.title}</span>
        </div>
        <div className="kingdom-opposition-card__name">{kingdom.opposition.name}</div>
        <div className="kingdom-opposition-card__since">Since {kingdom.opposition.since}</div>
        <span className="kingdom-party-badge" style={{
          background: oppColors.bg,
          borderColor: oppColors.border,
          color: oppColors.text,
        }}>
          {kingdom.opposition.party}
        </span>
      </div>

      {/* ── State Premiers — 2-Column Grid ── */}
      <div className="kingdom-states-section">
        <div className="kingdom-section-header">
          <MapPin size={15} />
          <span>State &amp; Territory Premiers</span>
        </div>
        <div className="kingdom-states-grid">
          {kingdom.states.map((s, i) => {
            const pc = getPartyColors(s.party);
            return (
              <div
                key={s.state}
                className="kingdom-state-card"
                style={{
                  borderColor: pc.border,
                  animationDelay: `${i * 0.08}s`,
                }}
              >
                <div className="kingdom-state-card__top">
                  <span className="kingdom-state-card__icon">{STATE_ICONS[s.state] || '🏛️'}</span>
                  <span className="kingdom-state-card__code">{s.state}</span>
                </div>
                <div className="kingdom-state-card__name">{s.name}</div>
                <span className="kingdom-party-badge kingdom-party-badge--sm" style={{
                  background: pc.bg,
                  borderColor: pc.border,
                  color: pc.text,
                }}>
                  {s.party}
                </span>
                {s.note && (
                  <div className="kingdom-state-card__note">📅 {s.note}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="kingdom-footer">
        <div className="kingdom-footer__text">
          🌏 More nations coming soon
        </div>
        <div className="kingdom-footer__hint">
          Track political leadership across multiple countries
        </div>
      </div>
    </div>
  );
}
