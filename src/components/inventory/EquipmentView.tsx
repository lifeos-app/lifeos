/**
 * EquipmentView — RPG-style body silhouette with equipment slots
 */

import { useEffect, useState } from 'react';
import {
  Swords, Crown, Shirt, Footprints, Hand, Watch, Dog, Gem,
} from 'lucide-react';
import { useInventoryStore, type EquipSlot, type InventoryItem } from '../../stores/useInventoryStore';
import { BottomSheet } from '../BottomSheet';
import { ItemDetail } from './ItemDetail';
import './inventory.css';

const SLOT_CONFIG: { id: EquipSlot; label: string; icon: typeof Crown }[] = [
  { id: 'head', label: 'Head', icon: Crown },
  { id: 'torso', label: 'Torso', icon: Shirt },
  { id: 'legs', label: 'Legs', icon: Footprints },
  { id: 'feet', label: 'Feet', icon: Footprints },
  { id: 'hands', label: 'Hands', icon: Hand },
  { id: 'accessories', label: 'Gear', icon: Watch },
  { id: 'companion', label: 'Companion', icon: Dog },
];

export function EquipmentView() {
  const items = useInventoryStore(s => s.items);
  const fetchAll = useInventoryStore(s => s.fetchAll);
  const getEquippedBySlot = useInventoryStore(s => s.getEquippedBySlot);
  const equipItem = useInventoryStore(s => s.equipItem);
  const unequipItem = useInventoryStore(s => s.unequipItem);
  const [selectedSlot, setSelectedSlot] = useState<EquipSlot | null>(null);
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const equippedCount = items.filter(i => i.is_equipped).length;
  const totalSlots = SLOT_CONFIG.length;

  const handleSlotClick = (slot: EquipSlot) => {
    const equipped = getEquippedBySlot(slot);
    if (equipped) {
      setDetailItem(equipped);
    } else {
      setSelectedSlot(slot);
    }
  };

  const handleEquipFromPicker = async (item: InventoryItem, slot: EquipSlot) => {
    await equipItem(item.id, slot);
    setSelectedSlot(null);
  };

  // Items that could fit in the selected slot
  const slotItems = selectedSlot
    ? items.filter(i => {
        // Match by slot field or by sensible category defaults
        if (i.slot === selectedSlot) return true;
        if (!i.slot && !i.is_equipped) {
          // Auto-match category to slot
          const catMap: Record<string, EquipSlot[]> = {
            clothing: ['head', 'torso', 'legs'],
            shoes: ['feet'],
            accessories: ['hands', 'accessories'],
            tech: ['accessories', 'hands'],
            pet: ['companion'],
            fitness: ['accessories', 'hands'],
            equipment: ['hands', 'accessories'],
          };
          return catMap[i.category]?.includes(selectedSlot) ?? false;
        }
        return false;
      })
    : [];

  return (
    <div className="equipment-view">
      <div className="equipment-view-header">
        <div className="equipment-view-title">
          <Swords size={16} />
          <span>Equipment</span>
        </div>
        <div className="equipment-stats">
          <span>
            <Gem size={11} />
            <span className="stat-gold">{equippedCount}/{totalSlots}</span> equipped
          </span>
        </div>
      </div>

      <div className="equip-body-container">
        {/* Simplified body silhouette */}
        <svg className="equip-body-svg" viewBox="0 0 200 300">
          <path d="M100 8 C115 8 118 20 118 28 C118 40 112 48 100 52 C88 48 82 40 82 28 C82 20 85 8 100 8Z" />
          <path d="M82 55 L68 65 L50 70 L40 90 L38 140 L50 142 L56 130 L64 150 L68 155 L74 148 L78 165 L72 250 L70 280 L72 290 L90 292 L92 282 L90 245 L95 180 L100 170 L105 180 L110 245 L108 282 L110 292 L128 290 L130 280 L128 250 L122 165 L126 148 L132 155 L136 150 L144 130 L150 142 L162 140 L160 90 L150 70 L132 65 L118 55 Z" />
        </svg>

        {/* Equipment slots arranged around body */}
        {SLOT_CONFIG.map(slot => {
          const equipped = getEquippedBySlot(slot.id);
          const Icon = slot.icon;
          return (
            <div
              key={slot.id}
              className={`equip-slot ${equipped ? 'equipped' : ''}`}
              data-slot={slot.id}
              onClick={() => handleSlotClick(slot.id)}
            >
              <div className="equip-slot-circle">
                <Icon size={20} />
              </div>
              <span className="equip-slot-label">{slot.label}</span>
              {equipped && (
                <span className="equip-slot-item-name">{equipped.name}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Slot Picker Bottom Sheet */}
      <BottomSheet
        open={!!selectedSlot}
        onClose={() => setSelectedSlot(null)}
        title={`Equip ${selectedSlot ? SLOT_CONFIG.find(s => s.id === selectedSlot)?.label : ''}`}
        icon={<Swords size={16} />}
      >
        {slotItems.length === 0 ? (
          <div className="inv-empty">
            <div className="inv-empty-icon">
              <Swords size={24} />
            </div>
            <h4>No items available</h4>
            <p>Add items to your inventory first, then equip them here.</p>
          </div>
        ) : (
          <div className="slot-picker-grid">
            {slotItems.map(item => {
              const color = item.color || '#D4AF37';
              return (
                <div
                  key={item.id}
                  className="slot-picker-item"
                  onClick={() => handleEquipFromPicker(item, selectedSlot!)}
                >
                  <div className="spi-icon" style={{ background: `${color}15` }}>
                    <SlotIcon category={item.category} color={color} />
                  </div>
                  <div>
                    <div className="spi-name">{item.name}</div>
                    <div className="spi-meta">{item.brand || item.category}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </BottomSheet>

      {/* Item Detail Sheet */}
      <BottomSheet
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        title={detailItem?.name || ''}
      >
        {detailItem && (
          <ItemDetail
            item={detailItem}
            onClose={() => setDetailItem(null)}
          />
        )}
      </BottomSheet>
    </div>
  );
}

// Helper: icon by category
function SlotIcon({ category, color }: { category: string; color: string }) {
  const iconProps = { size: 16, color };
  switch (category) {
    case 'clothing': return <Shirt {...iconProps} />;
    case 'shoes': return <Footprints {...iconProps} />;
    case 'accessories': return <Watch {...iconProps} />;
    case 'tech': return <Watch {...iconProps} />;
    case 'pet': return <Dog {...iconProps} />;
    case 'fitness': return <Swords {...iconProps} />;
    default: return <Gem {...iconProps} />;
  }
}
