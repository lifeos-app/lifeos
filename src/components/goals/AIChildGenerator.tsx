/**
 * AIChildGenerator — AI-powered epic/goal generation from parent objectives/epics.
 *
 * Similar UX to GoalTaskGenerator: trigger button → modal with LLM suggestions
 * → user selects → creates goals in Supabase.
 */

import { useState } from 'react';
import { Sparkles, Loader2, Check, X, Edit2 } from 'lucide-react';
import { callLLMJson } from '../../lib/llm-proxy';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { showToast } from '../Toast';
import { getEffectiveUserId } from '../../lib/local-db';
import { logger } from '../../utils/logger';
import './AIChildGenerator.css';

interface AIChildGeneratorProps {
  parentId: string;
  parentTitle: string;
  parentDescription: string | null;
  parentCategory: 'objective' | 'epic';
  childCategory: 'epic' | 'goal';
  existingChildren: Array<{ title: string }>;
  targetDate?: string | null;
  onCreated: () => void;
}

interface GeneratedChild {
  title: string;
  description: string;
  icon: string;
}

export function AIChildGenerator({
  parentId,
  parentTitle,
  parentDescription,
  parentCategory,
  childCategory,
  existingChildren,
  targetDate,
  onCreated,
}: AIChildGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [items, setItems] = useState<(GeneratedChild & { id: string; selected: boolean })[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const handleGenerate = async () => {
    setGenerating(true);
    setItems([]);

    try {
      const existingList = existingChildren.map(c => c.title).join(', ');
      const prompt = `You are a goal planning assistant. Given this ${parentCategory}:

Title: "${parentTitle}"
${parentDescription ? `Description: ${parentDescription}` : ''}
${targetDate ? `Target date: ${targetDate}` : ''}
${existingList ? `Existing ${childCategory}s: ${existingList}` : ''}

Suggest 2-4 new ${childCategory}s that would help achieve this ${parentCategory}. Each should:
- Be specific and measurable
- Not duplicate existing ${childCategory}s
- Be logically scoped as a ${childCategory}

Return ONLY a JSON array:
[{ "title": "...", "description": "Brief description of this ${childCategory}", "icon": "emoji" }]

No markdown, no explanation, just the JSON array.`;

      const result = await callLLMJson<GeneratedChild[]>(prompt, { timeoutMs: 15000 });

      if (!Array.isArray(result) || result.length === 0) {
        throw new Error('Invalid response format');
      }

      setItems(result.slice(0, 4).map((item, i) => ({
        title: String(item.title || '').trim(),
        description: String(item.description || '').trim(),
        icon: String(item.icon || '🎯').trim(),
        id: `gen-${i}`,
        selected: true,
      })).filter(item => item.title.length > 0));

    } catch (err) {
      showToast(`Failed to generate ${childCategory}s`, '⚠️', '#F43F5E');
      logger.error('[AIChildGenerator] Generation failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleCreate = async () => {
    const selected = items.filter(i => i.selected);
    if (selected.length === 0) {
      showToast('Select at least one item', '⚠️', '#F97316');
      return;
    }

    setCreating(true);
    const { createGoal } = useGoalsStore.getState();

    try {
      const userId = getEffectiveUserId();
      let created = 0;

      for (const item of selected) {
        const ok = await createGoal({
          user_id: userId,
          title: item.title,
          description: item.description,
          icon: item.icon,
          category: childCategory,
          parent_goal_id: parentId,
          status: 'active',
          progress: 0,
          target_date: targetDate || null,
        } as any);
        if (ok) created++;
      }

      showToast(`Created ${created} ${childCategory}${created > 1 ? 's' : ''}`, '✨', '#39FF14');
      setOpen(false);
      setItems([]);
      onCreated();

    } catch (err) {
      showToast(`Failed to create ${childCategory}s`, '⚠️', '#F43F5E');
      logger.error('[AIChildGenerator] Creation failed:', err);
    } finally {
      setCreating(false);
    }
  };

  const toggleItem = (id: string) => {
    setItems(items.map(i => i.id === id ? { ...i, selected: !i.selected } : i));
  };

  const updateTitle = (id: string, newTitle: string) => {
    setItems(items.map(i => i.id === id ? { ...i, title: newTitle } : i));
    setEditingId(null);
  };

  const selectedCount = items.filter(i => i.selected).length;
  const label = childCategory === 'epic' ? 'Epics' : 'Goals';

  if (!open) {
    return (
      <button
        className="acg-trigger-btn"
        onClick={() => { setOpen(true); handleGenerate(); }}
        title={`Generate ${label.toLowerCase()} using AI`}
      >
        <Sparkles size={14} />
        <span>Generate {label}</span>
      </button>
    );
  }

  return (
    <div className="acg-modal-backdrop" onClick={() => !generating && !creating && setOpen(false)}>
      <div className="acg-modal" onClick={e => e.stopPropagation()}>
        <div className="acg-header">
          <div className="acg-header-content">
            <div className="acg-icon"><Sparkles size={18} /></div>
            <div className="acg-header-text">
              <h3 className="acg-title">Generate {label}</h3>
              <p className="acg-subtitle">For: {parentTitle}</p>
            </div>
          </div>
          <button className="acg-close-btn" onClick={() => setOpen(false)} disabled={generating || creating} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="acg-content">
          {generating && (
            <div className="acg-loading">
              <Loader2 size={28} className="spin" />
              <p>Generating {label.toLowerCase()}...</p>
            </div>
          )}

          {!generating && items.length === 0 && (
            <div className="acg-empty">
              <p>Click Generate to create suggestions</p>
            </div>
          )}

          {!generating && items.length > 0 && (
            <>
              <div className="acg-items">
                {items.map(item => (
                  <div key={item.id} className={`acg-item ${item.selected ? 'selected' : ''}`}>
                    <button className="acg-checkbox" onClick={() => toggleItem(item.id)} aria-label={item.selected ? 'Deselect' : 'Select'}>
                      {item.selected ? <Check size={14} /> : <div className="acg-checkbox-empty" />}
                    </button>

                    <span className="acg-item-icon">{item.icon}</span>

                    <div className="acg-item-content">
                      {editingId === item.id ? (
                        <input
                          className="acg-edit-input"
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          onBlur={() => updateTitle(item.id, editTitle)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') updateTitle(item.id, editTitle);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                        />
                      ) : (
                        <div className="acg-item-title">{item.title}</div>
                      )}
                      {item.description && <div className="acg-item-desc">{item.description}</div>}
                    </div>

                    <button className="acg-edit-btn" onClick={() => { setEditingId(item.id); setEditTitle(item.title); }} aria-label="Edit title">
                      <Edit2 size={13} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="acg-footer">
                <button className="acg-regenerate-btn" onClick={handleGenerate} disabled={generating || creating}>
                  <Sparkles size={14} />
                  <span>Regenerate</span>
                </button>

                <div className="acg-actions">
                  <button className="acg-cancel-btn" onClick={() => setOpen(false)} disabled={creating}>Cancel</button>
                  <button className="acg-create-btn" onClick={handleCreate} disabled={creating || selectedCount === 0}>
                    {creating ? (
                      <><Loader2 size={14} className="spin" /><span>Creating...</span></>
                    ) : (
                      <><Check size={14} /><span>Create {selectedCount} {childCategory}{selectedCount !== 1 ? 's' : ''}</span></>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
