// LifeOS Social — War Declaration Flow
// Choose target guild, war type, duration, wager, message, and animation

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Swords, X, ChevronRight, CheckCircle, AlertTriangle, Flame } from 'lucide-react';
import { WAR_TYPE_CONFIG } from '../../stores/guildWarStore';
import type { WarType } from '../../stores/guildWarStore';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

interface WarDeclarationProps {
  challengerGuildId: string;
  challengerGuildName: string;
  onDeclare: (params: {
    defender_guild_id: string;
    type: WarType;
    duration_days?: number;
    message?: string;
    wager_description?: string;
  }) => void;
  onClose: () => void;
}

interface GuildOption {
  id: string;
  name: string;
  icon: string;
  member_count: number;
}

// ═══════════════════════════════════════════════════
// STEP CONFIG
// ═══════════════════════════════════════════════════

type Step = 'target' | 'type' | 'details' | 'confirm';

const STEPS: { id: Step; label: string; icon: string }[] = [
  { id: 'target', label: 'Choose Target', icon: '🎯' },
  { id: 'type', label: 'War Type', icon: '⚔️' },
  { id: 'details', label: 'Details', icon: '📝' },
  { id: 'confirm', label: 'Declare!', icon: '🔥' },
];

// ═══════════════════════════════════════════════════
// DURATION OPTIONS
// ═══════════════════════════════════════════════════

const DURATION_OPTIONS = [
  { value: 3, label: '3 Days', icon: '⚡' },
  { value: 5, label: '5 Days', icon: '🔥' },
  { value: 7, label: '7 Days', icon: '⚔️' },
  { value: 14, label: '14 Days', icon: '🏔️' },
  { value: 30, label: '30 Days', icon: '👑' },
];

// ═══════════════════════════════════════════════════
// WAGER PRESETS
// ═══════════════════════════════════════════════════

const WAGER_PRESETS = [
  { label: 'Bragging Rights', description: 'Winner gets eternal glory!', wager: '' },
  { label: 'XP Challenge', description: 'Loser sends 200 XP to the winner\'s guild fund', wager: '200 XP to winner\'s guild' },
  { label: 'Title Match', description: 'Winner earns the "Warlord" title', wager: '"Warlord" title on the line' },
  { label: 'Custom', description: 'Set your own stakes', wager: '' },
];

// ═══════════════════════════════════════════════════
// DECLARATION ANIMATION
// ═══════════════════════════════════════════════════

function DeclarationAnimation({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 800);
    const t3 = setTimeout(() => setPhase(3), 1400);
    const t4 = setTimeout(() => onComplete(), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onComplete]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      gap: 16,
    }}>
      <div style={{
        fontSize: phase >= 1 ? 48 : 0,
        transition: 'font-size 0.4s ease-out',
        textAlign: 'center',
      }}>
        {phase < 2 ? '⚔️' : phase < 3 ? '🔥' : '🏆'}
      </div>
      <div style={{
        fontSize: phase >= 1 ? 20 : 0,
        fontWeight: 800,
        color: phase >= 2 ? '#F97316' : '#F9FAFB',
        transition: 'all 0.4s ease-out',
        textAlign: 'center',
      }}>
        {phase < 2 ? 'Declaring War...' : phase < 3 ? 'CHALLENGE SENT!' : 'Let the battle begin!'}
      </div>
      <div style={{
        fontSize: 14,
        color: '#94A3B8',
        opacity: phase >= 3 ? 1 : 0,
        transition: 'opacity 0.4s',
      }}>
        The defending guild has 24 hours to respond
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

export function WarDeclaration({ challengerGuildId, challengerGuildName, onDeclare, onClose }: WarDeclarationProps) {
  const [currentStep, setCurrentStep] = useState<Step>('target');
  const [showAnimation, setShowAnimation] = useState(false);

  // Target
  const [targetGuildId, setTargetGuildId] = useState<string>('');
  const [targetGuildName, setTargetGuildName] = useState('');
  const [availableGuilds, setAvailableGuilds] = useState<GuildOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingGuilds, setLoadingGuilds] = useState(true);

  // War type
  const [warType, setWarType] = useState<WarType>('xp_race');

  // Details
  const [durationDays, setDurationDays] = useState(7);
  const [message, setMessage] = useState('');
  const [selectedWager, setSelectedWager] = useState(0); // index into WAGER_PRESETS
  const [customWager, setCustomWager] = useState('');

  // Load available guilds (excluding own)
  useEffect(() => {
    const loadGuilds = async () => {
      setLoadingGuilds(true);
      try {
        const { supabase } = await import('../../lib/data-access');
        const { data } = await supabase
          .from('goal_groups')
          .select('id, name, icon, member_count')
          .neq('id', challengerGuildId)
          .limit(30);

        if (data) {
          setAvailableGuilds(data.map((g: any) => ({
            id: g.id,
            name: g.name,
            icon: g.icon || '🏰',
            member_count: g.member_count || 0,
          })));
        }
      } catch (err) {
        // Demo fallback
        setAvailableGuilds([
          { id: 'demo1', name: 'Iron Titans', icon: '🏋️', member_count: 12 },
          { id: 'demo2', name: 'Phoenix Rising', icon: '🔥', member_count: 8 },
          { id: 'demo3', name: 'Night Owls', icon: '🦉', member_count: 15 },
          { id: 'demo4', name: 'Morning Glory', icon: '🌅', member_count: 6 },
          { id: 'demo5', name: 'Storm Riders', icon: '⛈️', member_count: 10 },
        ]);
      } finally {
        setLoadingGuilds(false);
      }
    };
    void loadGuilds();
  }, [challengerGuildId]);

  const filteredGuilds = useMemo(() => {
    if (!searchQuery.trim()) return availableGuilds;
    const q = searchQuery.toLowerCase();
    return availableGuilds.filter((g) => g.name.toLowerCase().includes(q));
  }, [availableGuilds, searchQuery]);

  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 'target': return targetGuildId !== '';
      case 'type': return warType !== '';
      case 'details': return durationDays > 0;
      case 'confirm': return true;
      default: return false;
    }
  }, [currentStep, targetGuildId, warType, durationDays]);

  const handleNext = useCallback(() => {
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  }, [stepIndex]);

  const handleBack = useCallback(() => {
    const prevIndex = stepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  }, [stepIndex]);

  const handleDeclare = useCallback(() => {
    const wager = selectedWager === WAGER_PRESETS.length - 1
      ? customWager
      : WAGER_PRESETS[selectedWager].wager;

    onDeclare({
      defender_guild_id: targetGuildId,
      type: warType,
      duration_days: durationDays,
      message: message.trim() || undefined,
      wager_description: wager || undefined,
    });
    setShowAnimation(true);
  }, [targetGuildId, warType, durationDays, message, selectedWager, customWager, onDeclare]);

  const selectTarget = (guild: GuildOption) => {
    setTargetGuildId(guild.id);
    setTargetGuildName(guild.name);
  };

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════

  if (showAnimation) {
    return (
      <div className="wd-overlay" style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="wd-modal" style={modalStyle}>
          <DeclarationAnimation onComplete={onClose} />
        </div>
      </div>
    );
  }

  return (
    <div className="wd-overlay" style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="wd-modal" style={modalStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Swords size={20} style={{ color: '#F97316' }} />
            <span style={{ fontSize: 18, fontWeight: 700, color: '#F9FAFB' }}>Declare War</span>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>
            <X size={18} />
          </button>
        </div>

        {/* Step Progress */}
        <div style={stepBarStyle}>
          {STEPS.map((step, i) => {
            const isActive = step.id === currentStep;
            const isComplete = i < stepIndex;
            return (
              <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                <div style={stepDotStyle(isActive, isComplete)}>
                  {isComplete ? '✓' : step.icon}
                </div>
                <span style={{
                  fontSize: 10,
                  color: isActive ? '#F97316' : isComplete ? '#22C55E' : '#64748B',
                  fontWeight: isActive ? 700 : 400,
                  whiteSpace: 'nowrap',
                }}>
                  {step.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: isComplete ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)', borderRadius: 1, marginLeft: 4 }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div style={contentStyle}>
          {/* TARGET STEP */}
          {currentStep === 'target' && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F9FAFB', marginBottom: 4 }}>
                🎯 Who are you challenging?
              </div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12 }}>
                Select a guild to challenge to a friendly competition
              </div>
              <input
                type="text"
                placeholder="Search guilds..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={searchInputStyle}
              />
              {loadingGuilds ? (
                <div style={{ textAlign: 'center', padding: 32, color: '#64748B' }}>
                  Loading guilds...
                </div>
              ) : (
                <div style={guildListStyle}>
                  {filteredGuilds.map((guild) => {
                    const isSelected = guild.id === targetGuildId;
                    return (
                      <button
                        key={guild.id}
                        onClick={() => selectTarget(guild)}
                        className="wd-guild-option"
                        style={{
                          ...guildOptionStyle,
                          border: isSelected ? '1px solid rgba(249,115,22,0.4)' : '1px solid rgba(255,255,255,0.06)',
                          background: isSelected ? 'rgba(249,115,22,0.08)' : 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <span style={{ fontSize: 24 }}>{guild.icon}</span>
                        <div style={{ flex: 1, textAlign: 'left' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? '#F97316' : '#F9FAFB' }}>
                            {guild.name}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>
                            {guild.member_count} members
                          </div>
                        </div>
                        {isSelected && <CheckCircle size={18} style={{ color: '#F97316' }} />}
                      </button>
                    );
                  })}
                  {filteredGuilds.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>
                      No guilds found matching "{searchQuery}"
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* WAR TYPE STEP */}
          {currentStep === 'type' && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F9FAFB', marginBottom: 4 }}>
                ⚔️ What kind of battle?
              </div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 16 }}>
                Choose the competition type — each measures different skills
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(Object.entries(WAR_TYPE_CONFIG) as [WarType, typeof WAR_TYPE_CONFIG[WarType]][]).map(([type, config]) => {
                  const isSelected = type === warType;
                  return (
                    <button
                      key={type}
                      onClick={() => setWarType(type)}
                      className="wd-type-card"
                      style={{
                        ...typeCardStyle,
                        border: isSelected ? `1px solid ${config.color}55` : '1px solid rgba(255,255,255,0.06)',
                        background: isSelected ? `${config.color}0D` : 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <span style={{ fontSize: 24 }}>{config.icon}</span>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? config.color : '#F9FAFB' }}>
                          {config.label}
                        </div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>
                          {config.description}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>
                        ~{config.defaultDays}d
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* DETAILS STEP */}
          {currentStep === 'details' && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F9FAFB', marginBottom: 4 }}>
                📝 Set the terms
              </div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 16 }}>
                How long should the war last? Optional message and wager
              </div>

              {/* Duration */}
              <label style={labelStyle}>Duration</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {DURATION_OPTIONS.map((opt) => {
                  const isSelected = durationDays === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setDurationDays(opt.value)}
                      style={{
                        ...durationBtnStyle,
                        border: isSelected ? '1px solid rgba(249,115,22,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        background: isSelected ? 'rgba(249,115,22,0.1)' : 'transparent',
                        color: isSelected ? '#F97316' : '#94A3B8',
                      }}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Wager */}
              <label style={labelStyle}>Wager (Optional)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {WAGER_PRESETS.map((w, i) => {
                  const isSelected = selectedWager === i;
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedWager(i)}
                      style={{
                        ...wagerBtnStyle,
                        border: isSelected ? '1px solid rgba(249,115,22,0.3)' : '1px solid rgba(255,255,255,0.06)',
                        background: isSelected ? 'rgba(249,115,22,0.06)' : 'transparent',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? '#F97316' : '#F9FAFB' }}>
                        {w.label}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        {w.description}
                      </div>
                    </button>
                  );
                })}
                {selectedWager === WAGER_PRESETS.length - 1 && (
                  <input
                    type="text"
                    placeholder="Describe your custom wager..."
                    value={customWager}
                    onChange={(e) => setCustomWager(e.target.value)}
                    style={{ ...searchInputStyle, fontSize: 12, marginTop: 4 }}
                  />
                )}
              </div>

              {/* Message */}
              <label style={labelStyle}>Message (Optional)</label>
              <textarea
                placeholder="Send a friendly challenge message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={200}
                style={textareaStyle}
              />
              <div style={{ fontSize: 10, color: '#64748B', textAlign: 'right' }}>
                {message.length}/200
              </div>
            </>
          )}

          {/* CONFIRM STEP */}
          {currentStep === 'confirm' && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F9FAFB', marginBottom: 12 }}>
                🔥 Confirm War Declaration
              </div>

              <div style={summaryStyle}>
                <div style={summaryRowStyle}>
                  <span style={{ color: '#94A3B8', fontSize: 12 }}>Challenger</span>
                  <span style={{ fontWeight: 600, color: '#EF4444' }}>{challengerGuildName}</span>
                </div>
                <div style={summaryRowStyle}>
                  <span style={{ color: '#94A3B8', fontSize: 12 }}>Defender</span>
                  <span style={{ fontWeight: 600, color: '#3B82F6' }}>{targetGuildName}</span>
                </div>
                <div style={summaryRowStyle}>
                  <span style={{ color: '#94A3B8', fontSize: 12 }}>War Type</span>
                  <span style={{ fontWeight: 600, color: WAR_TYPE_CONFIG[warType].color }}>
                    {WAR_TYPE_CONFIG[warType].icon} {WAR_TYPE_CONFIG[warType].label}
                  </span>
                </div>
                <div style={summaryRowStyle}>
                  <span style={{ color: '#94A3B8', fontSize: 12 }}>Duration</span>
                  <span style={{ fontWeight: 600, color: '#F9FAFB' }}>{durationDays} days</span>
                </div>
                {(selectedWager !== 0 || customWager) && (
                  <div style={summaryRowStyle}>
                    <span style={{ color: '#94A3B8', fontSize: 12 }}>Wager</span>
                    <span style={{ fontWeight: 600, color: '#FACC15' }}>
                      {selectedWager === WAGER_PRESETS.length - 1
                        ? customWager
                        : WAGER_PRESETS[selectedWager].wager}
                    </span>
                  </div>
                )}
                {message && (
                  <div style={{ ...summaryRowStyle, flexDirection: 'column', gap: 4 }}>
                    <span style={{ color: '#94A3B8', fontSize: 12 }}>Message</span>
                    <span style={{ fontStyle: 'italic', color: '#D1D5DB', fontSize: 12 }}>"{message}"</span>
                  </div>
                )}
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(249,115,22,0.06)',
                border: '1px solid rgba(249,115,22,0.2)',
                marginTop: 12,
              }}>
                <AlertTriangle size={14} style={{ color: '#F97316', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#F97316' }}>
                  The defending guild has 24 hours to accept or decline. Once accepted, the battle begins!
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          {stepIndex > 0 && (
            <button onClick={handleBack} style={backBtnStyle}>
              Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {currentStep !== 'confirm' ? (
            <button
              onClick={handleNext}
              disabled={!canProceed}
              style={nextBtnStyle(canProceed)}
            >
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleDeclare}
              className="wd-declare-btn"
              style={declareBtnStyle}
            >
              <Flame size={14} /> Declare War! 🔥
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  backdropFilter: 'blur(4px)',
};

const modalStyle: React.CSSProperties = {
  background: '#111318',
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.08)',
  padding: 0,
  maxWidth: 480,
  width: '90vw',
  maxHeight: '85vh',
  overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#94A3B8',
  cursor: 'pointer',
  padding: 4,
};

const stepBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '12px 20px',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
};

function stepDotStyle(active: boolean, complete: boolean): React.CSSProperties {
  return {
    width: 24,
    height: 24,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    background: active ? 'rgba(249,115,22,0.15)' : complete ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
    border: active ? '1px solid rgba(249,115,22,0.3)' : complete ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.08)',
    flexShrink: 0,
  };
}

const contentStyle: React.CSSProperties = {
  padding: '20px',
  minHeight: 280,
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  color: '#F9FAFB',
  fontSize: 13,
  outline: 'none',
  marginBottom: 12,
  boxSizing: 'border-box',
};

const guildListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  maxHeight: 240,
  overflowY: 'auto',
};

const guildOptionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 14px',
  borderRadius: 10,
  cursor: 'pointer',
  background: 'rgba(255,255,255,0.02)',
  textAlign: 'left',
  transition: 'all 0.15s',
};

const typeCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '14px 16px',
  borderRadius: 10,
  cursor: 'pointer',
  background: 'rgba(255,255,255,0.02)',
  textAlign: 'left',
  transition: 'all 0.15s',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#94A3B8',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

const durationBtnStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  transition: 'all 0.15s',
};

const wagerBtnStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 8,
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'all 0.15s',
};

const textareaStyle: React.CSSProperties = {
  ...searchInputStyle,
  resize: 'vertical',
  minHeight: 60,
  marginBottom: 4,
};

const summaryStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.02)',
  borderRadius: 12,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const summaryRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '16px 20px',
  borderTop: '1px solid rgba(255,255,255,0.06)',
};

const backBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'transparent',
  color: '#94A3B8',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
};

function nextBtnStyle(enabled: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: 8,
    border: enabled ? '1px solid rgba(249,115,22,0.4)' : '1px solid rgba(255,255,255,0.06)',
    background: enabled ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)',
    color: enabled ? '#F97316' : '#4B5563',
    cursor: enabled ? 'pointer' : 'default',
    fontSize: 13,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  };
}

const declareBtnStyle: React.CSSProperties = {
  padding: '10px 24px',
  borderRadius: 10,
  border: '1px solid rgba(249,115,22,0.5)',
  background: 'rgba(249,115,22,0.2)',
  color: '#F97316',
  cursor: 'pointer',
  fontSize: 15,
  fontWeight: 800,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  boxShadow: '0 0 20px rgba(249,115,22,0.15)',
};

export const warDeclarationStyles = `
.wd-guild-option:hover {
  background: rgba(255,255,255,0.05) !important;
}

.wd-type-card:hover {
  background: rgba(255,255,255,0.05) !important;
}

.wd-declare-btn:hover {
  box-shadow: 0 0 30px rgba(249,115,22,0.3) !important;
  transform: scale(1.02);
}

.wd-declare-btn:active {
  transform: scale(0.98) !important;
}
`;