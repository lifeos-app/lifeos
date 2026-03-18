export interface JournalEntry {
  id: string; user_id: string; date: string; title: string; content: string;
  mood: number | null; energy: number | null; tags: string;
  created_at: string; updated_at: string; is_deleted: boolean; sync_status: string;
  image_url?: string | null;
}

export const MOODS = [
  { value: 1, emoji: '😫', label: 'Rough', color: '#F43F5E' },
  { value: 2, emoji: '😐', label: 'Okay', color: '#94A3B8' },
  { value: 3, emoji: '🙂', label: 'Good', color: '#3B82F6' },
  { value: 4, emoji: '😊', label: 'Great', color: '#10B981' },
  { value: 5, emoji: '🤩', label: 'Amazing', color: '#A855F7' },
];

export const ENERGY_ICONS_DATA = [
  { value: 1, label: 'Very Low' },
  { value: 2, label: 'Low' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'High' },
  { value: 5, label: 'Charged' },
];

export const TAG_PRESETS = ['gratitude', 'reflection', 'goals', 'work', 'personal', 'dream'];

export const TEMPLATES: Record<string, string> = {
  gratitude: `**3 Things I'm Grateful For Today:**

1. 
2. 
3. 
`,
  reflection: `**What went well?**


**What could improve?**

`,
};

export const PAGE_SIZE = 20;
