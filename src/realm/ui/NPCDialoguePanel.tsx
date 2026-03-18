/**
 * NPCDialoguePanel — Generic NPC interaction shell.
 * Routes to NPC-specific content by npcId.
 */

import { BlacksmithForge } from './BlacksmithForge';
import { HealerConsult } from './HealerConsult';
import { ScholarStudy } from './ScholarStudy';

interface NPCDialoguePanelProps {
  npcId: string;
  npcName: string;
  greetingLines: string[];
  onClose: () => void;
}

const NPC_DOMAINS: Record<string, string> = {
  blacksmith_npc: 'Master of Goals',
  healer_npc: 'Keeper of Wellness',
  librarian_npc: 'Keeper of Knowledge',
};

export function NPCDialoguePanel({ npcId, npcName, greetingLines, onClose }: NPCDialoguePanelProps) {
  return (
    <div className="realm-dialogue-backdrop" onClick={onClose}>
      <div className="npc-panel" onClick={e => e.stopPropagation()}>
        <div className="npc-panel-header">
          <div>
            <h2>{npcName}</h2>
            {NPC_DOMAINS[npcId] && (
              <span className="npc-panel-badge">{NPC_DOMAINS[npcId]}</span>
            )}
          </div>
          <button className="npc-panel-close" onClick={onClose}>&times;</button>
        </div>
        <div className="npc-panel-body">
          {npcId === 'blacksmith_npc' ? (
            <BlacksmithForge greetingLines={greetingLines} onClose={onClose} />
          ) : npcId === 'healer_npc' ? (
            <HealerConsult greetingLines={greetingLines} onClose={onClose} />
          ) : npcId === 'librarian_npc' ? (
            <ScholarStudy greetingLines={greetingLines} onClose={onClose} />
          ) : (
            <div className="npc-panel-narration">
              {greetingLines.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
