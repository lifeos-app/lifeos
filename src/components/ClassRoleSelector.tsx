// LifeOS — Class & Role Selector (RPG Character Creation)
// Two-screen flow: Class (ESBI quadrant) → Role (archetype)
import { useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import {
  CLASS_NAMES,
  CLASS_ICONS,
  CLASS_DESCRIPTIONS,
  ROLE_ARCHETYPES,
  type ClassKey,
  type RoleKey,
} from '../lib/gamification/class-quests';
import './ClassRoleSelector.css';

interface ClassRoleSelectorProps {
  onComplete: (classKey: ClassKey, roleKey: RoleKey) => void;
  initialClass?: ClassKey;
  initialRole?: RoleKey;
}

type Screen = 'class' | 'role';

export function ClassRoleSelector({
  onComplete,
  initialClass,
  initialRole,
}: ClassRoleSelectorProps) {
  const [screen, setScreen] = useState<Screen>('class');
  const [selectedClass, setSelectedClass] = useState<ClassKey | null>(initialClass || null);
  const [selectedRole, setSelectedRole] = useState<RoleKey | null>(initialRole || null);

  const handleClassSelect = (classKey: ClassKey) => {
    setSelectedClass(classKey);
  };

  const handleClassContinue = () => {
    if (selectedClass) {
      setScreen('role');
    }
  };

  const handleRoleSelect = (roleKey: RoleKey) => {
    setSelectedRole(roleKey);
  };

  const handleConfirm = () => {
    if (selectedClass && selectedRole) {
      onComplete(selectedClass, selectedRole);
    }
  };

  const classes: ClassKey[] = ['E', 'S', 'B', 'I'];
  const roles = Object.keys(ROLE_ARCHETYPES) as RoleKey[];

  return (
    <div className="crs-container">
      <div className="crs-content">
        {/* ── CLASS SCREEN ── */}
        {screen === 'class' && (
          <>
            <div className="crs-header">
              <Sparkles size={24} className="crs-header-icon" />
              <h1 className="crs-title">Choose Your Path</h1>
              <p className="crs-subtitle">Select the economic quadrant that defines you</p>
            </div>

            <div className="crs-class-grid">
              {classes.map((cls) => (
                <button
                  key={cls}
                  className={`crs-class-card ${selectedClass === cls ? 'selected' : ''}`}
                  onClick={() => handleClassSelect(cls)}
                >
                  <div className="crs-class-card__icon">{CLASS_ICONS[cls]}</div>
                  <div className="crs-class-card__name">{CLASS_NAMES[cls]}</div>
                  <div className="crs-class-card__desc">{CLASS_DESCRIPTIONS[cls]}</div>
                </button>
              ))}
            </div>

            <button
              className="crs-continue-btn"
              onClick={handleClassContinue}
              disabled={!selectedClass}
            >
              Continue <ArrowRight size={18} />
            </button>
          </>
        )}

        {/* ── ROLE SCREEN ── */}
        {screen === 'role' && (
          <>
            <div className="crs-header">
              <Sparkles size={24} className="crs-header-icon" />
              <h1 className="crs-title">What Drives You?</h1>
              <p className="crs-subtitle">Pick the archetype that resonates with you</p>
            </div>

            <div className="crs-role-grid">
              {roles.map((role) => {
                const archetype = ROLE_ARCHETYPES[role];
                return (
                  <button
                    key={role}
                    className={`crs-role-card ${selectedRole === role ? 'selected' : ''}`}
                    onClick={() => handleRoleSelect(role)}
                  >
                    <div className="crs-role-card__icon">{archetype.icon}</div>
                    <div className="crs-role-card__name">{role}</div>
                    <div className="crs-role-card__desc">{archetype.description}</div>
                  </button>
                );
              })}
            </div>

            <div className="crs-footer">
              <button
                className="crs-back-btn"
                onClick={() => setScreen('class')}
              >
                ← Back
              </button>
              <button
                className="crs-confirm-btn"
                onClick={handleConfirm}
                disabled={!selectedRole}
              >
                Confirm <ArrowRight size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
