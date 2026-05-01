/**
 * PlayerProfileCard — Remote player profile popup
 *
 * Shows character preview, name, level, class, and action buttons.
 * Wired up: Whisper (DM), Add Friend (partner request), View Profile, Challenge.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import type { RemotePlayer } from '../multiplayer/types';
import { drawCharacter } from '../renderer/drawCharacter';
import { sendMessage } from '../../lib/social/messaging';
import { sendFriendRequest } from '../../lib/social/partnerships';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

interface PlayerProfileCardProps {
  player: RemotePlayer;
  onClose: () => void;
  /** Current user ID (for sending DMs/friend requests) */
  currentUserId?: string;
  /** Callback when whisper is initiated — opens DM conversation */
  onWhisper?: (userId: string, name: string) => void;
  /** Callback when friend request is sent */
  onAddFriend?: (userId: string) => void;
  /** Callback to view full public profile */
  onViewProfile?: (userId: string) => void;
  /** Callback to send a challenge invite */
  onChallenge?: (userId: string, name: string, challengeType: string) => void;
}

type CompeteType = 'streak_compare' | 'xp_today' | 'habit_count';

const STATUS_LABELS: Record<string, string> = {
  active: '\u{1F7E2} Online',
  idle: '\u{1F7E1} Idle',
  afk: '\u{26AA} AFK',
};

const CHALLENGE_TYPES: Array<{ id: CompeteType; label: string; icon: string; description: string }> = [
  { id: 'streak_compare', label: 'Streak Battle', icon: '🔥', description: 'Compare current streaks' },
  { id: 'xp_today', label: 'XP Race', icon: '⚡', description: 'Who earned more XP today?' },
  { id: 'habit_count', label: 'Habit Challenge', icon: '✅', description: 'Who logs more habits today?' },
];

// ═══════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════

export function PlayerProfileCard({
  player,
  onClose,
  currentUserId,
  onWhisper,
  onAddFriend,
  onViewProfile,
  onChallenge,
}: PlayerProfileCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showChallengeMenu, setShowChallengeMenu] = useState(false);
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  const [sendingFriendRequest, setSendingFriendRequest] = useState(false);
  const [challengeSent, setChallengeSent] = useState<string | null>(null);

  // Draw character on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = 80 * dpr;
    canvas.height = 100 * dpr;
    canvas.style.width = '80px';
    canvas.style.height = '100px';
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    ctx.clearRect(0, 0, 80, 100);
    drawCharacter({
      ctx,
      cx: 40,
      cy: 60,
      unit: 2,
      skinTone: player.skinTone,
      hairColor: player.hairColor,
      bodyColor: player.bodyColor,
      classIcon: player.classIcon,
      name: '',
      level: player.level,
      direction: 'down',
      isMoving: false,
      mood: 3,
      bestStreak: 0,
      showName: false,
      showClassIcon: false,
    });
  }, [player]);

  const handleBackdrop = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  // Whisper — opens DM conversation
  const handleWhisper = useCallback(async () => {
    if (currentUserId && !onWhisper) {
      // Create a DM conversation by sending initial system message
      try {
        await sendMessage(currentUserId, player.userId, '', 'system', { initiated_from: 'realm_whisper' });
      } catch {
        // Non-critical
      }
    }
    onWhisper?.(player.userId, player.name);
  }, [onWhisper, player.userId, player.name, currentUserId]);

  // Add Friend — sends partner request via partnerships.ts
  const handleAddFriend = useCallback(async () => {
    if (sendingFriendRequest || friendRequestSent) return;
    setSendingFriendRequest(true);

    try {
      if (currentUserId && !onAddFriend) {
        await sendFriendRequest(currentUserId, player.userId, 'Let\'s be friends! 👋');
      }
      onAddFriend?.(player.userId);
      setFriendRequestSent(true);
    } catch {
      // Handle error silently — UI already shows sent state
    } finally {
      setSendingFriendRequest(false);
    }
  }, [onAddFriend, player.userId, currentUserId, sendingFriendRequest, friendRequestSent]);

  // View Profile — shows PublicProfileCard
  const handleViewProfile = useCallback(() => {
    onViewProfile?.(player.userId);
  }, [onViewProfile, player.userId]);

  // Challenge — sends friendly competition invite
  const handleChallenge = useCallback((type: CompeteType) => {
    onChallenge?.(player.userId, player.name, type);
    setChallengeSent(type);
    setShowChallengeMenu(false);
    // Reset after 3s
    setTimeout(() => setChallengeSent(null), 3000);
  }, [onChallenge, player.userId, player.name]);

  return (
    <div className="realm-profile-backdrop" onClick={handleBackdrop}>
      <div className="realm-profile-card">
        <button className="realm-profile-close" onClick={onClose}>&times;</button>

        <canvas ref={canvasRef} className="realm-profile-canvas" />

        <div className="realm-profile-info">
          <div className="realm-profile-name">
            {player.classIcon} {player.name}
          </div>
          <div className="realm-profile-level">Level {player.level}</div>
          <div className="realm-profile-status">
            {STATUS_LABELS[player.status] || player.status}
          </div>
        </div>

        <div className="realm-profile-actions">
          {/* Whisper — DM via messaging.ts */}
          <button
            className="realm-profile-btn realm-profile-btn--whisper"
            onClick={handleWhisper}
            title="Open direct message"
          >
            💬 Whisper
          </button>

          {/* Add Friend — partner request via partnerships.ts */}
          <button
            className={`realm-profile-btn realm-profile-btn--friend ${
              friendRequestSent ? 'realm-profile-btn--sent' : ''
            }`}
            onClick={handleAddFriend}
            disabled={sendingFriendRequest || friendRequestSent}
            title={friendRequestSent ? 'Request sent!' : 'Send friend request'}
          >
            {friendRequestSent ? '✅ Sent!' : sendingFriendRequest ? '⏳ Sending...' : '🤝 Add Friend'}
          </button>

          {/* View Profile — PublicProfileCard */}
          <button
            className="realm-profile-btn realm-profile-btn--profile"
            onClick={handleViewProfile}
            title="View public profile"
          >
            👤 Profile
          </button>

          {/* Challenge — friendly competition */}
          <div className="realm-profile-challenge">
            <button
              className="realm-profile-btn realm-profile-btn--challenge"
              onClick={() => setShowChallengeMenu(!showChallengeMenu)}
              disabled={!!challengeSent}
            >
              {challengeSent ? '🎯 Challenged!' : '⚔️ Challenge'}
            </button>
            {showChallengeMenu && (
              <div className="realm-profile-challenge-menu">
                {CHALLENGE_TYPES.map(ct => (
                  <button
                    key={ct.id}
                    className="realm-profile-challenge-option"
                    onClick={() => handleChallenge(ct.id)}
                  >
                    <span className="realm-profile-challenge-icon">{ct.icon}</span>
                    <div className="realm-profile-challenge-detail">
                      <span className="realm-profile-challenge-label">{ct.label}</span>
                      <span className="realm-profile-challenge-desc">{ct.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inline styles for new challenge UI elements */}
      <style>{`
        .realm-profile-btn--whisper,
        .realm-profile-btn--friend,
        .realm-profile-btn--profile,
        .realm-profile-btn--challenge {
          font-size: 0.85rem;
          padding: 0.4rem 0.85rem;
          border-radius: 0.5rem;
          border: 1px solid rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.08);
          color: white;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }
        .realm-profile-btn--whisper:hover { background: rgba(59,130,246,0.25); }
        .realm-profile-btn--friend:hover { background: rgba(34,197,94,0.25); }
        .realm-profile-btn--sent { opacity: 0.7; cursor: default; }
        .realm-profile-btn--profile:hover { background: rgba(168,130,246,0.25); }
        .realm-profile-btn--challenge:hover { background: rgba(239,68,68,0.25); }
        .realm-profile-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .realm-profile-challenge {
          position: relative;
        }
        .realm-profile-challenge-menu {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 0.75rem;
          padding: 0.5rem;
          min-width: 200px;
          z-index: 50;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          margin-bottom: 0.5rem;
        }
        .realm-profile-challenge-option {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          border: none;
          background: transparent;
          color: white;
          cursor: pointer;
          width: 100%;
          text-align: left;
          transition: background 0.1s;
        }
        .realm-profile-challenge-option:hover {
          background: rgba(255,255,255,0.08);
        }
        .realm-profile-challenge-icon { font-size: 1.2rem; }
        .realm-profile-challenge-detail { display: flex; flex-direction: column; }
        .realm-profile-challenge-label { font-weight: 600; font-size: 0.85rem; }
        .realm-profile-challenge-desc { font-size: 0.7rem; opacity: 0.6; }
      `}</style>
    </div>
  );
}