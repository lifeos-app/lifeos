/**
 * JournalEditor — The entry editor: title, mood, energy, content (with voice-to-text),
 * templates, tags, and save/delete actions.
 */

import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import {
  Loader2, X, Save, Check, Tag, Mic, MicOff,
  Heart, MessageCircle, Lightbulb,
  Battery, BatteryLow, BatteryMedium, BatteryFull, BatteryCharging,
} from 'lucide-react';
import { MOODS, TAG_PRESETS, TEMPLATES } from './types';
import type { JournalEntry } from './types';
import remarkGfm from 'remark-gfm';
import { logger } from '../../utils/logger';

const ReactMarkdown = lazy(() => import('react-markdown'));

const ENERGY_ICONS = [
  { value: 1, Icon: BatteryLow, label: 'Very Low' },
  { value: 2, Icon: Battery, label: 'Low' },
  { value: 3, Icon: BatteryMedium, label: 'Medium' },
  { value: 4, Icon: BatteryFull, label: 'High' },
  { value: 5, Icon: BatteryCharging, label: 'Charged' },
];

interface JournalEditorProps {
  entry: JournalEntry | null;
  title: string;
  content: string;
  mood: number | null;
  energy: number | null;
  tags: string;
  imageUrl: string | null;
  generatingImage: boolean;
  saving: boolean;
  saved: boolean;
  onTitleChange: (v: string) => void;
  onContentChange: (v: string) => void;
  onMoodChange: (v: number) => void;
  onEnergyChange: (v: number) => void;
  onTagsChange: (v: string) => void;
  onSave: (overrides?: Partial<JournalEntry>) => void;
  onDelete: (id: string) => void;
}

export function JournalEditor({
  entry, title, content, mood, energy, tags,
  imageUrl, generatingImage, saving, saved,
  onTitleChange, onContentChange, onMoodChange, onEnergyChange, onTagsChange,
  onSave, onDelete,
}: JournalEditorProps) {
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);

  // Voice-to-text state
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setVoiceSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-AU';

      recognition.onresult = (event: any) => {
        let interimText = '';
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i]?.[0]?.transcript;
          if (event.results[i].isFinal) {
            finalText += transcript + ' ';
          } else {
            interimText += transcript;
          }
        }
        if (finalText) {
          onContentChange(content + finalText);
          setInterimTranscript('');
        } else {
          setInterimTranscript(interimText);
        }
      };

      recognition.onerror = (event: any) => {
        logger.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
    }
    return () => { if (recognitionRef.current) recognitionRef.current.stop(); };
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setInterimTranscript('');
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const applyTemplate = (templateKey: 'gratitude' | 'reflection') => {
    const template = TEMPLATES[templateKey];
    onContentChange(template);
    onSave({ content: template });
  };

  const addTagPreset = (tag: string) => {
    const currentTags = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (!currentTags.includes(tag.toLowerCase())) {
      const newTags = [...currentTags, tag].join(', ');
      onTagsChange(newTags);
      onSave({ tags: newTags });
    }
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const tagPills = tags.split(',').map(t => t.trim()).filter(Boolean);

  return (
    <div className="jnl-editor" style={mood ? {
      borderTop: `4px solid ${MOODS.find(m => m.value === mood)?.color}`,
    } : undefined}>
      {/* Journal Image */}
      {(imageUrl || generatingImage) && (
        <div className="jnl-image-banner">
          {generatingImage && !imageUrl && (
            <div className="jnl-image-loading">
              <Loader2 size={20} className="spin" />
              <span>Generating your journal illustration...</span>
            </div>
          )}
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Journal illustration"
              className="jnl-banner-image"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </div>
      )}

      {/* Title */}
      <input className="jnl-title-input" placeholder="Entry title..."
        value={title} onChange={e => onTitleChange(e.target.value)} />

      {/* Mood & Energy */}
      <div className="jnl-selectors">
        <div className="jnl-selector">
          <label id="mood-label">Mood</label>
          <div className="jnl-mood-row" role="radiogroup" aria-labelledby="mood-label">
            {MOODS.map(m => (
              <button key={m.value} className={`jnl-mood-btn ${mood === m.value ? 'active' : ''}`}
                onClick={() => onMoodChange(m.value)}
                aria-label={`Mood: ${m.label}`} aria-pressed={mood === m.value} title={m.label}
                style={mood === m.value ? { borderColor: m.color, backgroundColor: m.color + '15' } : undefined}>
                <span className="jnl-mood-emoji" aria-hidden="true">{m.emoji}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="jnl-selector">
          <label id="energy-label">Energy</label>
          <div className="jnl-energy-row" role="radiogroup" aria-labelledby="energy-label">
            {ENERGY_ICONS.map(e => (
              <button key={e.value} className={`jnl-energy-btn ${energy === e.value ? 'active' : ''}`}
                onClick={() => onEnergyChange(e.value)}
                aria-label={`Energy: ${e.label}`} aria-pressed={energy === e.value} title={e.label}>
                <e.Icon size={20} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Templates */}
      <div className="jnl-templates">
        <label>Quick Templates</label>
        <div className="jnl-template-row">
          <button className="jnl-template-btn" onClick={() => applyTemplate('gratitude')}>
            <Heart size={12} /> Gratitude
          </button>
          <button className="jnl-template-btn" onClick={() => applyTemplate('reflection')}>
            <MessageCircle size={12} /> Reflection
          </button>
        </div>
      </div>

      {/* Content with Voice-to-Text */}
      <div className="jnl-content-section">
        <div className="jnl-content-header">
          <label>Entry</label>
          <div className="jnl-content-tools">
            <span className="jnl-word-count">{wordCount} words</span>
            {voiceSupported && (
              <button
                className={`jnl-voice-btn ${isRecording ? 'recording' : ''}`}
                onClick={toggleRecording}
                title={isRecording ? 'Stop recording' : 'Start voice input'}
              >
                {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
                {isRecording ? 'Stop' : 'Voice'}
              </button>
            )}
            <button
              className={`jnl-preview-toggle ${showMarkdownPreview ? 'active' : ''}`}
              onClick={() => setShowMarkdownPreview(!showMarkdownPreview)}
              title="Toggle markdown preview"
            >
              {showMarkdownPreview ? 'Edit' : 'Preview'}
            </button>
          </div>
        </div>
        {showMarkdownPreview ? (
          <div className="jnl-content-preview">
            <Suspense fallback={<div style={{ padding: '16px', color: '#8BA4BE' }}>Loading preview...</div>}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content || '*Nothing to preview...*'}
              </ReactMarkdown>
            </Suspense>
          </div>
        ) : (
          <div className="jnl-content-wrapper">
            <textarea className="jnl-content" placeholder="What's on your mind today...&#10;&#10;**Supports markdown:** *italic*, **bold**, # headers, - lists"
              value={content} onChange={e => onContentChange(e.target.value)} rows={12} />
            {isRecording && interimTranscript && (
              <div className="jnl-interim-transcript">{interimTranscript}</div>
            )}
          </div>
        )}
        {!voiceSupported && (
          <p className="jnl-voice-unsupported">
            <Lightbulb size={12} /> Voice input not supported in this browser. Try Chrome, Edge, or Safari.
          </p>
        )}
      </div>

      {/* Tags */}
      <div className="jnl-tags-section">
        <Tag size={14} />
        <input className="jnl-tags-input" placeholder="Tags (comma separated)..."
          value={tags} onChange={e => onTagsChange(e.target.value)} />
      </div>
      <div className="jnl-tag-presets">
        {TAG_PRESETS.map(preset => (
          <button
            key={preset}
            className={`jnl-tag-preset-btn ${tagPills.map(t => t.toLowerCase()).includes(preset.toLowerCase()) ? 'active' : ''}`}
            onClick={() => addTagPreset(preset)}
          >
            #{preset}
          </button>
        ))}
      </div>
      {tagPills.length > 0 && (
        <div className="jnl-tag-pills">
          {tagPills.map((t, i) => (
            <span key={i} className="jnl-tag-pill">#{t}</span>
          ))}
        </div>
      )}

      {/* Manual save + delete */}
      <div className="jnl-actions">
        <button className="jnl-save-btn" onClick={() => onSave()}>
          <Save size={14} /> Save Entry
        </button>
        {entry && (
          <button className="jnl-delete-btn" onClick={() => onDelete(entry.id)} aria-label="Delete this entry">
            <X size={14} /> Delete
          </button>
        )}
      </div>
    </div>
  );
}
