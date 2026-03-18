/**
 * EquipmentTab — Wrapper for the Equipment & Inventory system within Health page.
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { ArrowLeft } from 'lucide-react';
import { EquipmentView, InventoryList } from '../../components/inventory';
import { useInventoryStore } from '../../stores/useInventoryStore';

// Lazy load MiniCharacter to prevent crashes if Realm/RPG data isn't ready
const MiniCharacter = lazy(() => import('../../realm/ui/MiniCharacter').then(m => ({ default: m.MiniCharacter })));

const SLOT_POSITIONS: { slot: string; label: string; top: string; left: string }[] = [
  { slot: 'head', label: 'Head', top: '5%', left: '50%' },
  { slot: 'torso', label: 'Body', top: '40%', left: '12%' },
  { slot: 'hands', label: 'Shield', top: '40%', left: '88%' },
  { slot: 'accessories', label: 'Weapon', top: '70%', left: '88%' },
  { slot: 'accessory', label: 'Accessory', top: '70%', left: '12%' },
  { slot: 'mount', label: 'Mount', top: '90%', left: '50%' },
];

export function EquipmentTab() {
  const navigate = useNavigate();
  const location = useLocation();
  const showBackButton = location.pathname.startsWith('/character/');
  const items = useInventoryStore(s => s.items);
  const equipped = items.filter(i => i.is_equipped);

  return (
    <div className="h-fade-up">
      {showBackButton && (
        <button
          onClick={() => navigate('/character')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', marginBottom: 12,
            background: 'rgba(15, 45, 74, 0.4)', border: '1px solid rgba(26, 58, 92, 0.6)',
            borderRadius: 8, color: '#8BA4BE', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <ArrowLeft size={14} /> Back to Character
        </button>
      )}

      {/* Character preview with equipment slots */}
      <div style={{ position: 'relative', width: 200, height: 220, margin: '0 auto 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 20 }}>
          <Suspense fallback={<div style={{ width: 160, height: 160, borderRadius: '50%', background: 'rgba(100,100,100,0.15)' }} />}>
            <MiniCharacter
              size={160}
              animate
              showLevel
              showName
              fps={30}
              onClick={() => navigate('/character?tab=realm')}
            />
          </Suspense>
        </div>
        {SLOT_POSITIONS.map(sp => {
          const filled = equipped.some(i => i.slot === sp.slot);
          return (
            <div
              key={sp.slot}
              title={sp.label}
              style={{
                position: 'absolute',
                top: sp.top,
                left: sp.left,
                transform: 'translate(-50%, -50%)',
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: `2px solid ${filled ? '#D4AF37' : 'rgba(255,255,255,0.2)'}`,
                background: filled ? 'rgba(212,175,55,0.3)' : 'transparent',
              }}
            />
          );
        })}
      </div>

      <EquipmentView />
      <InventoryList />
    </div>
  );
}
