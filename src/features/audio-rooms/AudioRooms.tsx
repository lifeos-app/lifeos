/**
 * AudioRooms — Tavern audio rooms page
 *
 * Active rooms list with participant count and topic.
 * Create room, join room, favorites. Cozy tavern aesthetic.
 */

import { useState } from 'react';
import { useAudioRooms, ROOM_TYPES } from './useAudioRooms';
import { AudioRoom } from './AudioRoom';
import { RoomCreation } from './RoomCreation';
import type { AudioRoom as AudioRoomType } from '../../stores/audioRoomStore';

export function AudioRooms() {
  const {
    rooms,
    openRooms,
    isInRoom,
    activeRoom,
    favoriteRoomIds,
    joinRoom,
    toggleFavorite,
    roomTypes,
  } = useAudioRooms();

  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [filter, setFilter] = useState<'all' | AudioRoomType['type'] | 'favorites'>('all');

  // If in a room, show the room view
  if (isInRoom && activeRoom) {
    return <AudioRoom />;
  }

  const filteredRooms = (() => {
    let filtered = openRooms;
    if (filter === 'favorites') {
      filtered = rooms.filter(r => favoriteRoomIds.has(r.id) && r.isActive);
    } else if (filter !== 'all') {
      filtered = rooms.filter(r => r.type === filter && r.isActive);
    }
    return filtered;
  })();

  const getTypeInfo = (type: string) => ROOM_TYPES.find(rt => rt.id === type);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-950/20 via-stone-950/50 to-stone-950 p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🍺</div>
          <div>
            <h1 className="text-xl font-bold text-amber-200">The Tavern</h1>
            <p className="text-stone-400 text-sm">Voice rooms for fellowship and focus</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateRoom(true)}
          className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 rounded-lg text-amber-100 text-sm font-semibold hover:from-amber-500 hover:to-amber-600 transition-all shadow-lg shadow-amber-900/30"
        >
          + Create Room
        </button>
      </div>

      {/* Active rooms count */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-stone-400 text-sm">{openRooms.length} room{openRooms.length !== 1 ? 's' : ''} active</span>
      </div>

      {/* Room type filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
            filter === 'all'
              ? 'bg-amber-600/50 text-amber-100 border border-amber-500/50'
              : 'bg-stone-800 text-stone-400 border border-stone-700'
          }`}
        >
          All Rooms
        </button>
        <button
          onClick={() => setFilter('favorites')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
            filter === 'favorites'
              ? 'bg-amber-600/50 text-amber-100 border border-amber-500/50'
              : 'bg-stone-800 text-stone-400 border border-stone-700'
          }`}
        >
          ⭐ Favorites
        </button>
        {roomTypes.map(rt => (
          <button
            key={rt.id}
            onClick={() => setFilter(rt.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              filter === rt.id
                ? 'bg-amber-600/50 text-amber-100 border border-amber-500/50'
                : 'bg-stone-800 text-stone-400 border border-stone-700'
            }`}
          >
            {rt.icon} {rt.name}
          </button>
        ))}
      </div>

      {/* Room cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredRooms.map(room => {
          const typeInfo = getTypeInfo(room.type);
          const isFav = favoriteRoomIds.has(room.id);
          const capacityPercent = (room.participants.length / room.maxParticipants) * 100;
          const isFull = room.participants.length >= room.maxParticipants;

          return (
            <div
              key={room.id}
              className={`bg-stone-900/60 rounded-xl overflow-hidden border transition-all hover:scale-[1.01] ${
                typeInfo ? `border-stone-700/50 hover:border-amber-600/30` : 'border-stone-700/50'
              }`}
            >
              {/* Room header with type gradient */}
              <div className={`bg-gradient-to-r ${typeInfo?.bgGradient || 'from-stone-800/20 to-stone-700/20'} px-4 py-3 border-b border-stone-700/30`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{typeInfo?.icon || '🏠'}</span>
                    <div>
                      <h3 className="text-white font-semibold text-sm">{room.name}</h3>
                      <p className="text-stone-400 text-xs">{room.topic}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(room.id); }}
                    className="text-sm hover:scale-110 transition-transform"
                  >
                    {isFav ? '⭐' : '☆'}
                  </button>
                </div>
              </div>

              {/* Room details */}
              <div className="p-4 space-y-3">
                {/* Participants preview */}
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {room.participants.slice(0, 5).map(p => (
                      <div
                        key={p.userId}
                        className="w-7 h-7 rounded-full border-2 border-stone-900 flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: p.avatarColor }}
                      >
                        {p.name.charAt(0)}
                      </div>
                    ))}
                    {room.participants.length > 5 && (
                      <div className="w-7 h-7 rounded-full bg-stone-700 border-2 border-stone-900 flex items-center justify-center text-xs text-stone-300">
                        +{room.participants.length - 5}
                      </div>
                    )}
                  </div>
                  <span className="text-stone-400 text-xs">
                    {room.participants.length}/{room.maxParticipants}
                  </span>
                </div>

                {/* Capacity bar */}
                <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isFull ? 'bg-red-500' : capacityPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, capacityPercent)}%` }}
                  />
                </div>

                {/* Room info */}
                <div className="flex items-center gap-3 text-xs text-stone-400">
                  <span className={`px-2 py-0.5 rounded-full border ${
                    room.privacy === 'open' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' :
                    room.privacy === 'friends' ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' :
                    'border-amber-500/30 text-amber-400 bg-amber-500/10'
                  }`}>
                    {room.privacy}
                  </span>
                  {room.ambientTrack && room.ambientTrack !== 'none' && (
                    <span>🔊 Ambient</span>
                  )}
                  {/* Speaking indicators */}
                  {room.participants.filter(p => p.isSpeaking).length > 0 && (
                    <span className="text-emerald-400">🔴 {room.participants.filter(p => p.isSpeaking).length} speaking</span>
                  )}
                </div>

                {/* Join button */}
                <button
                  onClick={() => joinRoom(room.id)}
                  disabled={isFull}
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    isFull
                      ? 'bg-stone-800 text-stone-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-600 to-amber-700 text-amber-100 hover:from-amber-500 hover:to-amber-600 shadow-lg shadow-amber-900/20'
                  }`}
                >
                  {isFull ? 'Room Full' : '🚪 Join Room'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredRooms.length === 0 && (
        <div className="text-center py-12 text-stone-400 space-y-3">
          <div className="text-5xl">🍺</div>
          <p className="text-lg">No rooms yet</p>
          <p className="text-sm">Create one to get the tavern buzzing!</p>
          <button
            onClick={() => setShowCreateRoom(true)}
            className="px-4 py-2 bg-amber-600/20 text-amber-300 rounded-lg border border-amber-600/30"
          >
            Create a Room
          </button>
        </div>
      )}

      {/* Create Room Modal */}
      {showCreateRoom && (
        <RoomCreation onClose={() => setShowCreateRoom(false)} />
      )}
    </div>
  );
}