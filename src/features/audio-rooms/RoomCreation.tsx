/**
 * RoomCreation — Create a new audio room
 *
 * Room name, topic, type selector, privacy, max participants,
 * ambient track selection, quick start.
 */

import { useState } from 'react';
import { useAudioRooms, ROOM_TYPES, AMBIENT_TRACKS } from './useAudioRooms';
import type { RoomType } from '../../stores/audioRoomStore';

interface RoomCreationProps {
  onClose: () => void;
}

export function RoomCreation({ onClose }: RoomCreationProps) {
  const { createRoom, joinRoom } = useAudioRooms();

  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [type, setType] = useState<RoomType>('social');
  const [privacy, setPrivacy] = useState<'open' | 'friends' | 'guild'>('open');
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [ambientTrack, setAmbientTrack] = useState<string>('tavern');

  const selectedType = ROOM_TYPES.find(rt => rt.id === type);

  const handleCreate = () => {
    if (!name.trim()) return;
    createRoom(
      name.trim(),
      topic.trim() || `Let's hang out!`,
      type,
      privacy,
      maxParticipants,
      ambientTrack
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-stone-900 rounded-2xl border border-amber-700/30 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-stone-700/50 flex items-center justify-between">
          <h2 className="text-amber-200 font-bold text-lg">🍺 Create a Room</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-white transition-colors text-xl">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Room Name */}
          <div>
            <label className="text-stone-400 text-sm mb-1 block">Room Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2.5 bg-stone-800 rounded-lg border border-stone-700 text-stone-200 text-sm focus:border-amber-500/50 focus:outline-none"
              placeholder="Give your room a name..."
              maxLength={50}
            />
          </div>

          {/* Topic */}
          <div>
            <label className="text-stone-400 text-sm mb-1 block">Topic</label>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              className="w-full px-3 py-2.5 bg-stone-800 rounded-lg border border-stone-700 text-stone-200 text-sm focus:border-amber-500/50 focus:outline-none"
              placeholder="What's this room about?"
              maxLength={100}
            />
          </div>

          {/* Room Type */}
          <div>
            <label className="text-stone-400 text-sm mb-2 block">Room Type</label>
            <div className="grid grid-cols-1 gap-2">
              {ROOM_TYPES.map(rt => (
                <button
                  key={rt.id}
                  onClick={() => {
                    setType(rt.id);
                    setAmbientTrack(rt.defaultAmbient);
                    setMaxParticipants(rt.defaultMaxParticipants);
                  }}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    type === rt.id
                      ? `bg-gradient-to-r ${rt.bgGradient} border-amber-500/50`
                      : 'bg-stone-800 border-stone-700 hover:border-amber-500/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{rt.icon}</span>
                    <div>
                      <div className="text-white font-medium text-sm">{rt.name}</div>
                      <div className="text-stone-400 text-xs">{rt.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Privacy */}
          <div>
            <label className="text-stone-400 text-sm mb-2 block">Privacy</label>
            <div className="flex gap-2">
              {([
                { id: 'open' as const, icon: '🌐', label: 'Open', desc: 'Anyone can join' },
                { id: 'friends' as const, icon: '👥', label: 'Friends', desc: 'Friends only' },
                { id: 'guild' as const, icon: '🏰', label: 'Guild', desc: 'Guild members only' },
              ]).map(p => (
                <button
                  key={p.id}
                  onClick={() => setPrivacy(p.id)}
                  className={`flex-1 p-3 rounded-lg text-center border transition-all ${
                    privacy === p.id
                      ? 'bg-amber-600/20 border-amber-500/50 text-amber-200'
                      : 'bg-stone-800 border-stone-700 text-stone-400'
                  }`}
                >
                  <div className="text-lg">{p.icon}</div>
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="text-xs">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Max Participants */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-stone-400 text-sm">Max Participants</label>
              <span className="text-amber-300 text-sm font-bold">{maxParticipants}</span>
            </div>
            <input
              type="range"
              min={2}
              max={25}
              value={maxParticipants}
              onChange={e => setMaxParticipants(parseInt(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>

          {/* Ambient Track */}
          <div>
            <label className="text-stone-400 text-sm mb-2 block">Background Ambiance</label>
            <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
              {AMBIENT_TRACKS.map(track => (
                <button
                  key={track.id}
                  onClick={() => setAmbientTrack(track.id)}
                  className={`p-2 rounded-lg text-left border transition-all text-xs ${
                    ambientTrack === track.id
                      ? 'bg-amber-600/20 border-amber-500/50 text-amber-200'
                      : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-amber-500/30'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{track.icon}</span>
                    <span className="font-medium">{track.name}</span>
                  </div>
                  <div className="text-stone-500 text-[10px] mt-0.5">{track.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-stone-700 text-stone-400 hover:text-stone-200 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim()}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 text-amber-100 font-semibold hover:from-amber-500 hover:to-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-900/30"
            >
              🚪 Create Room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}