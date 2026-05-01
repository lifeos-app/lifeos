import { useState } from 'react';
import type { TimelineFilters as FiltersType } from './useTimelineData';

const DOMAIN_CONFIG: { key: string; label: string; icon: string; color: string }[] = [
  { key: 'habit', label: 'Habits', icon: '🔥', color: '#A855F7' },
  { key: 'health', label: 'Health', icon: '❤️', color: '#22C55E' },
  { key: 'finance', label: 'Finances', icon: '💰', color: '#FACC15' },
  { key: 'goal', label: 'Goals', icon: '🎯', color: '#3B82F6' },
  { key: 'achievement', label: 'Achievements', icon: '🏆', color: '#F59E0B' },
  { key: 'journal', label: 'Journal', icon: '📝', color: '#EC4899' },
  { key: 'social', label: 'Social', icon: '👥', color: '#F472B6' },
  { key: 'milestone', label: 'Milestones', icon: '⭐', color: '#00D4FF' },
];

const DATE_RANGE_OPTIONS: { key: FiltersType['dateRange']; label: string }[] = [
  { key: 'week', label: 'Last Week' },
  { key: 'month', label: 'Last Month' },
  { key: 'quarter', label: 'Last Quarter' },
  { key: 'year', label: 'Last Year' },
  { key: 'all', label: 'All Time' },
];

interface TimelineFiltersProps {
  filters: FiltersType;
  onChange: (filters: FiltersType) => void;
  domainCounts: Record<string, number>;
  show: boolean;
  onToggle: () => void;
}

export default function TimelineFilters({ filters, onChange, domainCounts, show, onToggle }: TimelineFiltersProps) {
  const [searchQuery, setSearchQuery] = useState(filters.searchQuery);

  const updateFilter = <K extends keyof FiltersType>(key: K, value: FiltersType[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const toggleDomain = (domain: string) => {
    const newDomains = { ...filters.domains };
    newDomains[domain] = !newDomains[domain];
    onChange({ ...filters, domains: newDomains });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onChange({ ...filters, searchQuery: query });
  };

  return (
    <>
      {/* ─── Mobile overlay backdrop ─── */}
      {show && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={onToggle}
        />
      )}

      {/* ─── Sidebar ─── */}
      <div
        className={`
          fixed md:relative z-50 md:z-auto
          transition-transform duration-300 ease-in-out
          ${show ? 'translate-x-0' : '-translate-x-full md:-translate-x-full'}
        `}
        style={{
          width: '280px',
          minWidth: '280px',
          background: 'rgba(10,22,40,0.98)',
          borderRight: '1px solid rgba(30,58,91,0.5)',
          backdropFilter: 'blur(20px)',
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        <div className="p-4 space-y-6">
          {/* ─── Header ─── */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold" style={{ color: '#00D4FF' }}>
              _filters
            </h2>
            <button
              onClick={onToggle}
              className="md:hidden p-1 rounded-lg text-sm"
              style={{ color: '#8BA4BE', background: 'rgba(30,58,91,0.6)' }}
            >
              ✕
            </button>
          </div>

          {/* ─── Search ─── */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: '#8BA4BE' }}>
              Search Events
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search timeline..."
                className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all focus:ring-2"
                style={{
                  background: 'rgba(30,58,91,0.4)',
                  border: '1px solid rgba(30,58,91,0.6)',
                  color: '#E2E8F0',
                  '--tw-ring-color': '#00D4FF',
                } as React.CSSProperties}
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
                  style={{ color: '#8BA4BE' }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* ─── Domain Toggles ─── */}
          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: '#8BA4BE' }}>
              Show Domains
            </label>
            <div className="space-y-1.5">
              {DOMAIN_CONFIG.map((domain) => (
                <button
                  key={domain.key}
                  onClick={() => toggleDomain(domain.key)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all hover:scale-[1.02]"
                  style={{
                    background: filters.domains[domain.key] ? `${domain.color}15` : 'rgba(30,58,91,0.2)',
                    border: `1px solid ${filters.domains[domain.key] ? domain.color + '40' : 'rgba(30,58,91,0.4)'}`,
                    opacity: filters.domains[domain.key] ? 1 : 0.5,
                  }}
                >
                  <span className="text-base">{domain.icon}</span>
                  <span className="flex-1 text-left font-medium" style={{ color: filters.domains[domain.key] ? '#E2E8F0' : '#5A7A9A' }}>
                    {domain.label}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{
                    background: 'rgba(30,58,91,0.6)',
                    color: '#8BA4BE',
                  }}>
                    {domainCounts[domain.key] || 0}
                  </span>
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center text-xs"
                    style={{
                      background: filters.domains[domain.key] ? domain.color : 'rgba(30,58,91,0.6)',
                      color: filters.domains[domain.key] ? '#050E1A' : '#5A7A9A',
                    }}
                  >
                    {filters.domains[domain.key] ? '✓' : ''}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ─── Importance Threshold ─── */}
          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: '#8BA4BE' }}>
              Minimum Importance: {filters.importanceThreshold}
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={filters.importanceThreshold}
              onChange={(e) => updateFilter('importanceThreshold', parseInt(e.target.value))}
              className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #00D4FF 0%, #00D4FF ${(filters.importanceThreshold - 1) * 25}%, rgba(30,58,91,0.6) ${(filters.importanceThreshold - 1) * 25}%, rgba(30,58,91,0.6) 100%)`,
              }}
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: '#5A7A9A' }}>
              <span>All</span>
              <span>⭐ Notable</span>
              <span>🔥 Major</span>
            </div>
          </div>

          {/* ─── Date Range ─── */}
          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: '#8BA4BE' }}>
              Date Range
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DATE_RANGE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  onClick={() => updateFilter('dateRange', option.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: filters.dateRange === option.key ? 'rgba(0,212,255,0.2)' : 'rgba(30,58,91,0.4)',
                    border: `1px solid ${filters.dateRange === option.key ? 'rgba(0,212,255,0.4)' : 'rgba(30,58,91,0.4)'}`,
                    color: filters.dateRange === option.key ? '#00D4FF' : '#8BA4BE',
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── Quick Actions ─── */}
          <div className="pt-2 border-t" style={{ borderColor: 'rgba(30,58,91,0.5)' }}>
            <button
              onClick={() => onChange({
                domains: { habit: true, health: true, finance: true, goal: true, achievement: true, journal: true, social: true, milestone: true },
                importanceThreshold: 1,
                dateRange: 'all',
                searchQuery: '',
              })}
              className="w-full px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-[1.02]"
              style={{
                background: 'rgba(30,58,91,0.4)',
                border: '1px solid rgba(30,58,91,0.6)',
                color: '#8BA4BE',
              }}
            >
              Reset All Filters
            </button>
          </div>
        </div>
      </div>
    </>
  );
}