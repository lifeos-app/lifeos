import type { LifeChapter } from './useTimelineData';

interface LifeChaptersProps {
  chapters: LifeChapter[];
  onChapterClick: (chapter: LifeChapter) => void;
}

export default function LifeChapters({ chapters, onChapterClick }: LifeChaptersProps) {
  if (chapters.length === 0) return null;

  return (
    <div className="mb-8 ml-12 md:ml-16 space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">📖</span>
        <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#8B5CF6' }}>
          Life Chapters
        </h3>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }}>
          {chapters.length}
        </span>
      </div>

      <div className="space-y-3">
        {chapters.map((chapter, index) => (
          <div key={chapter.id}>
            {/* ─── Transition marker ─── */}
            {index > 0 && (
              <div className="flex items-center gap-2 py-2">
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(139,92,246,0.3), transparent)' }} />
                <span className="text-xs" style={{ color: '#5A7A9A' }}>↕ chapter transition</span>
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(139,92,246,0.3), transparent)' }} />
              </div>
            )}

            {/* ─── Chapter card ─── */}
            <button
              onClick={() => onChapterClick(chapter)}
              className="w-full text-left rounded-xl p-4 transition-all duration-200 hover:scale-[1.01] hover:shadow-lg group"
              style={{
                background: `linear-gradient(135deg, ${chapter.color}10, ${chapter.color}05)`,
                border: `1px solid ${chapter.color}25`,
                boxShadow: `0 0 20px ${chapter.color}08`,
              }}
            >
              {/* ─── Chapter index & date range ─── */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: `${chapter.color}20`,
                      color: chapter.color,
                    }}
                  >
                    Ch.{index + 1}
                  </span>
                  <span className="text-xs" style={{ color: '#5A7A9A' }}>
                    {formatChapterDate(chapter.startDate)}
                    {chapter.endDate ? ` — ${formatChapterDate(chapter.endDate)}` : ' — Present'}
                  </span>
                </div>
                <span className="text-xs" style={{ color: '#5A7A9A' }}>
                  {chapter.eventCount} events
                </span>
              </div>

              {/* ─── Chapter title ─── */}
              <h4 className="text-base font-bold mb-1 group-hover:translate-x-1 transition-transform" style={{ color: '#E2E8F0' }}>
                {chapter.title}
              </h4>

              {/* ─── Summary ─── */}
              <p className="text-xs leading-relaxed mb-2" style={{ color: '#8BA4BE' }}>
                {chapter.summary}
              </p>

              {/* ─── Domain tags ─── */}
              <div className="flex flex-wrap gap-1.5">
                {chapter.dominantDomains.map((domain) => (
                  <span
                    key={domain}
                    className="text-xs px-2 py-0.5 rounded-full capitalize"
                    style={{
                      background: `${getDomainColor(domain)}15`,
                      color: getDomainColor(domain),
                      border: `1px solid ${getDomainColor(domain)}30`,
                    }}
                  >
                    {getDomainIcon(domain)} {domain}
                  </span>
                ))}
              </div>

              {/* ─── Ongoing badge ─── */}
              {!chapter.endDate && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22C55E' }} />
                  <span className="text-xs font-medium" style={{ color: '#22C55E' }}>
                    Current Chapter
                  </span>
                </div>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ───

const DOMAIN_COLORS: Record<string, string> = {
  habit: '#A855F7',
  health: '#22C55E',
  finance: '#FACC15',
  goal: '#3B82F6',
  achievement: '#F59E0B',
  journal: '#EC4899',
  social: '#F472B6',
  milestone: '#00D4FF',
};

const DOMAIN_ICONS: Record<string, string> = {
  habit: '🔥',
  health: '❤️',
  finance: '💰',
  goal: '🎯',
  achievement: '🏆',
  journal: '📝',
  social: '👥',
  milestone: '⭐',
};

function getDomainColor(domain: string): string {
  return DOMAIN_COLORS[domain] || '#8BA4BE';
}

function getDomainIcon(domain: string): string {
  return DOMAIN_ICONS[domain] || '📌';
}

function formatChapterDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}