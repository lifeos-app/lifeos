/**
 * ShareCard — Generates a shareable PNG profile card using Canvas.
 * Shows character avatar, level, top streaks, weekly XP, app branding.
 * Pure client-side rendering, no external API.
 */

import { useRef, useCallback } from 'react';
import { Share2 } from 'lucide-react';
import { getLadder } from '../../lib/gamification/ladder';
import type { LadderKey } from '../../lib/gamification/ladder';
import type { PublicProfile } from '../../lib/social/types';

interface Props {
  profile: PublicProfile;
  weeklyXP?: number;
  topStreaks?: { name: string; days: number }[];
}

const W = 600;
const H = 340;
const BG = '#050E1A';
const CARD_BG = '#0F2D4A';
const ACCENT = '#00D4FF';
const GREEN = '#39FF14';
const MUTED = '#5A7A9A';
const TEXT = '#ffffff';

export function ShareCard({ profile, weeklyXP = 0, topStreaks = [] }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = W;
    canvas.height = H;

    // Background
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // Card border
    ctx.strokeStyle = '#1A3A5C';
    ctx.lineWidth = 2;
    roundRect(ctx, 16, 16, W - 32, H - 32, 16);
    ctx.stroke();
    ctx.fillStyle = CARD_BG;
    ctx.fill();

    // Accent line at top
    const ladder = getLadder(profile.ladder as LadderKey | null);
    const accentColor = ladder?.color ?? ACCENT;
    ctx.fillStyle = accentColor;
    ctx.fillRect(16, 16, W - 32, 4);

    // Avatar circle
    ctx.beginPath();
    ctx.arc(80, 90, 36, 0, Math.PI * 2);
    ctx.fillStyle = `${accentColor}30`;
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Level number in avatar
    ctx.fillStyle = TEXT;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${profile.level}`, 80, 90);

    // Display name
    ctx.textAlign = 'left';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = TEXT;
    ctx.fillText(profile.display_name || 'Adventurer', 130, 70);

    // Ladder rank
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = accentColor;
    const ladderDisplay = ladder ? `${ladder.icon} ${profile.ladder_rank ?? ladder.name}` : `Level ${profile.level}`;
    ctx.fillText(ladderDisplay, 130, 95);

    // Bio
    if (profile.bio) {
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = MUTED;
      const bioText = profile.bio.length > 80 ? profile.bio.slice(0, 77) + '...' : profile.bio;
      ctx.fillText(bioText, 40, 135);
    }

    // Stats section
    const statY = 160;
    const stats = [
      { label: 'Weekly XP', value: weeklyXP.toLocaleString(), color: GREEN },
      { label: 'Level', value: `${profile.level}`, color: accentColor },
      { label: 'Total XP', value: profile.total_xp?.toLocaleString() ?? '0', color: TEXT },
    ];

    stats.forEach((stat, i) => {
      const x = 40 + (i * 180);
      ctx.fillStyle = '#0A1628';
      roundRect(ctx, x, statY, 160, 50, 8);
      ctx.fill();

      ctx.font = '10px system-ui, sans-serif';
      ctx.fillStyle = MUTED;
      ctx.textAlign = 'center';
      ctx.fillText(stat.label, x + 80, statY + 18);

      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillStyle = stat.color;
      ctx.fillText(stat.value, x + 80, statY + 40);
    });

    // Streaks section
    if (topStreaks.length > 0) {
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillStyle = MUTED;
      ctx.textAlign = 'left';
      ctx.fillText('TOP STREAKS', 40, 235);

      const streakNames = topStreaks.slice(0, 3).map(s => `${s.name} (${s.days}d)`).join('  •  ');
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = '#F97316';
      ctx.fillText(streakNames, 40, 255);
    }

    // Branding
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillStyle = ACCENT;
    ctx.textAlign = 'right';
    ctx.fillText('LifeOS', W - 32, 38);

    ctx.font = '9px system-ui, sans-serif';
    ctx.fillStyle = MUTED;
    ctx.fillText('The Operating System for Human Life', W - 32, 54);

    // Bottom hermetic quote
    ctx.textAlign = 'center';
    ctx.font = 'italic 9px system-ui, sans-serif';
    ctx.fillStyle = '#1A3A5C';
    ctx.fillText('AS ABOVE, SO BELOW', W / 2, H - 28);
  }, [profile, weeklyXP, topStreaks]);

  const handleShare = useCallback(() => {
    generateImage();
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `lifeos-${profile.display_name || 'profile'}.png`, { type: 'image/png' });

      // Try native share first, fall back to download
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        navigator.share({
          files: [file],
          title: `${profile.display_name} on LifeOS`,
          text: `${profile.display_name} — Level ${profile.level} on LifeOS`,
        }).catch(() => {/* user cancelled */});
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lifeos-${profile.display_name || 'profile'}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }, 'image/png');
  }, [generateImage, profile]);

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ display: 'none' }}
      />
      <button
        onClick={handleShare}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 14px',
          background: 'rgba(0,212,255,0.1)',
          border: '1px solid rgba(0,212,255,0.25)',
          borderRadius: 8,
          color: '#00D4FF',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <Share2 size={14} />
        Share Card
      </button>
    </div>
  );
}

/** Round-rect path helper */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export default ShareCard;