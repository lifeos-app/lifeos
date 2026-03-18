/**
 * AddItemSheet — Context-aware form for adding inventory items.
 * Shows different fields based on active list type (personal/business/pets/fitness).
 */

import { useState } from 'react';
import { Camera, Dog, Briefcase, Shirt, Dumbbell } from 'lucide-react';
import { useInventoryStore, type ListType, type ItemCategory, type EquipSlot, type ItemCondition } from '../../stores/useInventoryStore';

const PERSONAL_CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: 'clothing', label: 'Clothing' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'tech', label: 'Tech' },
];

const BUSINESS_CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: 'equipment', label: 'Equipment' },
  { value: 'clothing', label: 'Uniform' },
  { value: 'tech', label: 'Tech/Tools' },
  { value: 'accessories', label: 'Supplies' },
];

const FITNESS_CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: 'fitness', label: 'Gym Gear' },
  { value: 'clothing', label: 'Activewear' },
  { value: 'shoes', label: 'Training Shoes' },
  { value: 'accessories', label: 'Supplements' },
  { value: 'equipment', label: 'Equipment' },
];

const SLOTS: { value: EquipSlot; label: string }[] = [
  { value: 'head', label: 'Head' },
  { value: 'torso', label: 'Torso' },
  { value: 'legs', label: 'Legs' },
  { value: 'feet', label: 'Feet' },
  { value: 'hands', label: 'Hands' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'companion', label: 'Companion' },
];

const CONDITIONS: { value: ItemCondition; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'good', label: 'Good' },
  { value: 'worn', label: 'Worn' },
  { value: 'damaged', label: 'Damaged' },
];

const PET_SPECIES = ['Dog', 'Cat', 'Bird', 'Fish', 'Rabbit', 'Reptile', 'Other'];

interface AddItemSheetProps {
  defaultListType?: ListType;
  defaultSlot?: EquipSlot;
  onClose: () => void;
}

export function AddItemSheet({ defaultListType = 'personal', defaultSlot, onClose }: AddItemSheetProps) {
  const { addItem } = useInventoryStore();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [listType] = useState<ListType>(defaultListType);
  const [category, setCategory] = useState<ItemCategory>(
    defaultListType === 'pets' ? 'pet' :
    defaultListType === 'business' ? 'equipment' :
    defaultListType === 'fitness' ? 'fitness' : 'clothing'
  );
  const [slot, setSlot] = useState<EquipSlot | ''>(defaultSlot || '');
  const [brand, setBrand] = useState('');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [condition, setCondition] = useState<ItemCondition>('good');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');

  // Pet-specific
  const [petName, setPetName] = useState('');
  const [species, setSpecies] = useState('Dog');
  const [breed, setBreed] = useState('');
  const [petBirthday, setPetBirthday] = useState('');
  const [vetName, setVetName] = useState('');
  const [vetPhone, setVetPhone] = useState('');

  // Business-specific
  const [businessName, setBusinessName] = useState('');
  const [taxDeductible, setTaxDeductible] = useState(true);
  const [purchaseDate, setPurchaseDate] = useState('');

  const categories = listType === 'business' ? BUSINESS_CATEGORIES
    : listType === 'fitness' ? FITNESS_CATEGORIES
    : PERSONAL_CATEGORIES;

  const headerIcon = listType === 'pets' ? <Dog size={18} /> 
    : listType === 'business' ? <Briefcase size={18} />
    : listType === 'fitness' ? <Dumbbell size={18} />
    : <Shirt size={18} />;

  const headerLabel = listType === 'pets' ? 'Add Pet'
    : listType === 'business' ? 'Add Business Equipment'
    : listType === 'fitness' ? 'Add Fitness Gear'
    : 'Add Personal Item';

  const handleSubmit = async () => {
    const itemName = listType === 'pets' ? (petName.trim() || name.trim()) : name.trim();
    if (!itemName) return;
    setSaving(true);

    const metadata: Record<string, unknown> = {};
    if (listType === 'pets') {
      metadata.species = species;
      metadata.breed = breed;
      metadata.birthday = petBirthday;
      metadata.vet_name = vetName;
      metadata.vet_phone = vetPhone;
    }
    if (listType === 'business') {
      metadata.business_name = businessName;
      metadata.tax_deductible = taxDeductible;
      metadata.purchase_date = purchaseDate;
    }

    await addItem({
      name: itemName,
      category: listType === 'pets' ? 'pet' : category,
      list_type: listType,
      slot: listType === 'pets' ? 'companion' : (slot || undefined),
      brand: brand.trim() || undefined,
      color: color.trim() || undefined,
      size: size.trim() || undefined,
      condition,
      purchase_price: price ? parseFloat(price) : undefined,
      description: notes.trim() || undefined,
      metadata,
    });

    setSaving(false);
    onClose();
  };

  return (
    <div className="add-item-form">
      {/* Context header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: '#D4AF37' }}>
        {headerIcon}
        <span style={{ fontSize: 14, fontWeight: 600 }}>{headerLabel}</span>
      </div>

      {/* ═══ PET FORM ═══ */}
      {listType === 'pets' ? (
        <>
          <div className="add-item-field">
            <label>Pet Name *</label>
            <input type="text" placeholder="e.g. Max, Luna" value={petName} onChange={e => setPetName(e.target.value)} autoFocus />
          </div>
          <div className="add-item-row">
            <div className="add-item-field">
              <label>Species</label>
              <select value={species} onChange={e => setSpecies(e.target.value)}>
                {PET_SPECIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="add-item-field">
              <label>Breed</label>
              <input type="text" placeholder="e.g. Labrador, Persian" value={breed} onChange={e => setBreed(e.target.value)} />
            </div>
          </div>
          <div className="add-item-row">
            <div className="add-item-field">
              <label>Birthday</label>
              <input type="date" value={petBirthday} onChange={e => setPetBirthday(e.target.value)} />
            </div>
            <div className="add-item-field">
              <label>Color/Markings</label>
              <input type="text" placeholder="e.g. Black & white" value={color} onChange={e => setColor(e.target.value)} />
            </div>
          </div>
          <div className="add-item-row">
            <div className="add-item-field">
              <label>Vet Name</label>
              <input type="text" placeholder="Dr. Smith" value={vetName} onChange={e => setVetName(e.target.value)} />
            </div>
            <div className="add-item-field">
              <label>Vet Phone</label>
              <input type="tel" placeholder="04XX XXX XXX" value={vetPhone} onChange={e => setVetPhone(e.target.value)} />
            </div>
          </div>
          <div className="add-item-field">
            <label>Notes</label>
            <textarea placeholder="Feeding schedule, allergies, medications..." value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>
        </>
      ) : (
        <>
          {/* ═══ STANDARD FORM (Personal / Business / Fitness) ═══ */}
          
          {/* Photo placeholder */}
          <div className="add-item-photo">
            <Camera size={20} />
            <span>Add photo (coming soon)</span>
          </div>

          {/* Name */}
          <div className="add-item-field">
            <label>Name *</label>
            <input
              type="text"
              placeholder={listType === 'business' ? 'e.g. Pressure washer, Mop set' : listType === 'fitness' ? 'e.g. Resistance bands, Whey protein' : 'e.g. Nike Air Max 90'}
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Category + Condition */}
          <div className="add-item-row">
            <div className="add-item-field">
              <label>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value as ItemCategory)}>
                {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="add-item-field">
              <label>Condition</label>
              <select value={condition} onChange={e => setCondition(e.target.value as ItemCondition)}>
                {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          {/* Business-specific fields */}
          {listType === 'business' && (
            <>
              <div className="add-item-row">
                <div className="add-item-field">
                  <label>Business</label>
                  <input type="text" placeholder="e.g. My Business" value={businessName} onChange={e => setBusinessName(e.target.value)} />
                </div>
                <div className="add-item-field">
                  <label>Purchase Date</label>
                  <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                </div>
              </div>
              <div className="add-item-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={taxDeductible} onChange={e => setTaxDeductible(e.target.checked)} style={{ width: 16, height: 16 }} />
                  Tax deductible
                </label>
              </div>
            </>
          )}

          {/* Equipment Slot (personal/fitness only) */}
          {listType !== 'business' && (
            <div className="add-item-row">
              <div className="add-item-field">
                <label>Equipment Slot</label>
                <select value={slot} onChange={e => setSlot(e.target.value as EquipSlot | '')}>
                  <option value="">None</option>
                  {SLOTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="add-item-field">
                <label>Brand</label>
                <input type="text" placeholder="e.g. Nike, Apple" value={brand} onChange={e => setBrand(e.target.value)} />
              </div>
            </div>
          )}

          {/* Brand for business (no slot) */}
          {listType === 'business' && (
            <div className="add-item-row">
              <div className="add-item-field">
                <label>Brand/Manufacturer</label>
                <input type="text" placeholder="e.g. Karcher, Dyson" value={brand} onChange={e => setBrand(e.target.value)} />
              </div>
              <div className="add-item-field">
                <label>Model/Size</label>
                <input type="text" placeholder="e.g. K5 Premium" value={size} onChange={e => setSize(e.target.value)} />
              </div>
            </div>
          )}

          {/* Color + Size (personal/fitness) */}
          {listType !== 'business' && (
            <div className="add-item-row">
              <div className="add-item-field">
                <label>Color</label>
                <input type="text" placeholder="e.g. Black" value={color} onChange={e => setColor(e.target.value)} />
              </div>
              <div className="add-item-field">
                <label>Size</label>
                <input type="text" placeholder="e.g. L, 42, US 10" value={size} onChange={e => setSize(e.target.value)} />
              </div>
            </div>
          )}

          {/* Price */}
          <div className="add-item-field">
            <label>{listType === 'business' ? 'Purchase Price (for depreciation)' : 'Purchase Price'}</label>
            <input type="number" placeholder="$0.00" value={price} onChange={e => setPrice(e.target.value)} step="0.01" />
          </div>

          {/* Notes */}
          <div className="add-item-field">
            <label>Notes</label>
            <textarea placeholder={listType === 'business' ? 'Warranty info, serial number, maintenance notes...' : 'Any additional details...'} value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>
        </>
      )}

      {/* Submit */}
      <button className="add-item-submit" onClick={handleSubmit} disabled={!(listType === 'pets' ? petName.trim() : name.trim()) || saving}>
        {saving ? 'Adding...' : listType === 'pets' ? 'Add Pet' : 'Add to Inventory'}
      </button>
    </div>
  );
}
