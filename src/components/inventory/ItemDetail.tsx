/**
 * ItemDetail — Full detail view for an inventory item inside a BottomSheet.
 */

import { useState } from 'react';
import {
  Shirt, Footprints, Watch, Dog, Dumbbell, Gem, Star,
  Heart, Trash2, Swords, ShieldOff,
} from 'lucide-react';
import { useInventoryStore, type InventoryItem, type EquipSlot } from '../../stores/useInventoryStore';

interface ItemDetailProps {
  item: InventoryItem;
  onClose: () => void;
}

export function ItemDetail({ item, onClose }: ItemDetailProps) {
  const { updateItem, deleteItem, equipItem, unequipItem, toggleFavorite, pets } = useInventoryStore();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pet = item.category === 'pet'
    ? pets.find(p => p.inventory_item_id === item.id)
    : null;

  const handleEquip = async () => {
    const slot = item.slot || guessSlot(item.category);
    if (slot) {
      await equipItem(item.id, slot);
    }
  };

  const handleUnequip = async () => {
    await unequipItem(item.id);
  };

  const handleDelete = async () => {
    await deleteItem(item.id);
    onClose();
  };

  const bgColor = item.color || getCatColor(item.category);

  return (
    <div className="item-detail">
      {/* Header */}
      <div className="item-detail-header">
        <div className="item-detail-icon" style={{ background: `${bgColor}15` }}>
          <CategoryIcon category={item.category} color={bgColor} />
        </div>
        <div className="item-detail-info">
          <h3>{item.name}</h3>
          {item.brand && <span className="item-brand">{item.brand}</span>}
        </div>
      </div>

      {/* Badges */}
      <div className="item-detail-badges">
        <span className={`item-detail-badge condition-${item.condition}`}
          style={conditionBadgeStyle(item.condition)}>
          {item.condition}
        </span>
        {item.is_equipped && (
          <span className="item-detail-badge" style={{
            background: 'rgba(212,175,55,0.15)', color: '#D4AF37'
          }}>
            ⚔ Equipped
          </span>
        )}
        {item.slot && (
          <span className="item-detail-badge" style={{
            background: 'rgba(0,212,255,0.1)', color: '#00D4FF'
          }}>
            {item.slot}
          </span>
        )}
        <span className="item-detail-badge" style={{
          background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)'
        }}>
          {item.list_type}
        </span>
      </div>

      {/* Fields Grid */}
      <div className="item-detail-fields">
        {item.category && (
          <Field label="Category" value={item.category} />
        )}
        {item.size && (
          <Field label="Size" value={item.size} />
        )}
        {item.color && (
          <Field label="Color" value={item.color} />
        )}
        {item.purchase_price != null && (
          <Field label="Price" value={`$${item.purchase_price.toFixed(2)}`} />
        )}
        {item.purchase_date && (
          <Field label="Purchased" value={new Date(item.purchase_date).toLocaleDateString('en-AU')} />
        )}
        {item.subcategory && (
          <Field label="Subcategory" value={item.subcategory} />
        )}
      </div>

      {/* Notes */}
      {item.description && (
        <div className="item-detail-notes">
          <div className="notes-label">Notes</div>
          <p>{item.description}</p>
        </div>
      )}

      {/* Pet Profile */}
      {item.category === 'pet' && item.metadata && (item.metadata as Record<string, unknown>).species && (
        <div className="pet-detail-section">
          <h4>🐾 Pet Profile</h4>
          <div className="item-detail-fields">
            {(item.metadata as Record<string, unknown>).species && (
              <Field label="Species" value={String((item.metadata as Record<string, unknown>).species)} />
            )}
            {(item.metadata as Record<string, unknown>).breed && (
              <Field label="Breed" value={String((item.metadata as Record<string, unknown>).breed)} />
            )}
          </div>
        </div>
      )}

      {/* Linked pet profile from pet_profiles table */}
      {pet && (
        <div className="pet-detail-section">
          <h4>🐾 Pet Details</h4>
          <div className="item-detail-fields">
            <Field label="Species" value={pet.species} />
            {pet.breed && <Field label="Breed" value={pet.breed} />}
            {pet.weight && <Field label="Weight" value={`${pet.weight} kg`} />}
            {pet.birthday && <Field label="Birthday" value={new Date(pet.birthday).toLocaleDateString('en-AU')} />}
            {pet.vet_name && <Field label="Vet" value={pet.vet_name} />}
            {pet.vet_phone && <Field label="Vet Phone" value={pet.vet_phone} />}
            {pet.next_vet_date && <Field label="Next Vet Visit" value={new Date(pet.next_vet_date).toLocaleDateString('en-AU')} />}
          </div>
        </div>
      )}

      {/* Actions */}
      {!confirmDelete ? (
        <div className="item-detail-actions">
          {item.is_equipped ? (
            <button className="btn-unequip" onClick={handleUnequip}>
              <ShieldOff size={14} />
              Unequip
            </button>
          ) : (
            <button className="btn-equip" onClick={handleEquip}>
              <Swords size={14} />
              Equip
            </button>
          )}
          <button
            className={`btn-fav ${item.is_favorite ? 'is-fav' : ''}`}
            onClick={() => toggleFavorite(item.id)}
          >
            <Heart size={14} fill={item.is_favorite ? '#D4AF37' : 'none'} />
          </button>
          <button className="btn-delete" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} />
          </button>
        </div>
      ) : (
        <div className="inv-confirm">
          <p>Delete "{item.name}"?</p>
          <div className="inv-confirm-buttons">
            <button className="inv-confirm-cancel" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button className="inv-confirm-delete" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="item-detail-field">
      <span className="field-label">{label}</span>
      <span className="field-value">{value}</span>
    </div>
  );
}

function CategoryIcon({ category, color }: { category: string; color: string }) {
  const p = { size: 24, color };
  switch (category) {
    case 'clothing': return <Shirt {...p} />;
    case 'shoes': return <Footprints {...p} />;
    case 'accessories': return <Watch {...p} />;
    case 'tech': return <Watch {...p} />;
    case 'pet': return <Dog {...p} />;
    case 'fitness': return <Dumbbell {...p} />;
    default: return <Gem {...p} />;
  }
}

function getCatColor(category: string): string {
  switch (category) {
    case 'clothing': return '#00D4FF';
    case 'shoes': return '#A855F7';
    case 'accessories': return '#D4AF37';
    case 'tech': return '#39FF14';
    case 'pet': return '#F97316';
    case 'fitness': return '#EF4444';
    default: return '#818CF8';
  }
}

function conditionBadgeStyle(condition: string): React.CSSProperties {
  switch (condition) {
    case 'new': return { background: 'rgba(57,255,20,0.1)', color: '#39FF14' };
    case 'good': return { background: 'rgba(0,212,255,0.1)', color: '#00D4FF' };
    case 'worn': return { background: 'rgba(253,203,110,0.1)', color: '#FDCB6E' };
    case 'damaged': return { background: 'rgba(239,68,68,0.1)', color: '#EF4444' };
    default: return { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' };
  }
}

function guessSlot(category: string): EquipSlot | null {
  switch (category) {
    case 'clothing': return 'torso';
    case 'shoes': return 'feet';
    case 'accessories': return 'accessories';
    case 'tech': return 'accessories';
    case 'pet': return 'companion';
    case 'fitness': return 'hands';
    default: return null;
  }
}
