/**
 * AudioRoom — Inside an audio room view
 *
 * Speaker circle layout, mute/unmute, raise hand, room chat,
 * ambient audio controls, pomodoro timer, leave room.
 * Cozy tavern aesthetic.
 */

import { useState, useEffect } from 'react';
import { useAudioRooms, ROOM_TYPES, AMBIENT_TRACKS } from './useAudioRooms';

export function AudioRoom() {
  const {
    activeRoom,
    isInRoom,
    isMuted,
    isSpeakerOn,
    speakerVolume,
    ambientVolume,
    isHandRaised,
    isHost,
    isConnecting,
    roomMessages,
    pomodoro,
    toggleMic,
    toggleSpeaker,
    setSpeakerVolume,
    setAmbientVolume,
    raiseHand,
    lowerHand,
    leaveRoom,
    sendMessage,
    startPomodoro,
    pausePomodoro,
    resetPomodoro,
  } = useAudioRooms();

  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pomoTime, setPomoTime] = useState(pomodoro.secondsLeft);

  if (!activeRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-400">
        No active room
      </div>
    );
  }

  const typeInfo = ROOM_TYPES.find(rt => rt.id === activeRoom.type);
  const host = activeRoom.participants.find(p => p.role === 'host');
  const speakers = activeRoom.participants.filter(p => p.role === 'speaker');
  const listeners = activeRoom.participants.filter(p => p.role === 'listener');

  const handleSendMessage = () => {
    if (chatInput.trim()) {
      sendMessage(chatInput.trim());
      setChatInput('');
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Pomodoro timer tick
  useEffect(() => {
    if (!pomodoro.isRunning) return;
    const interval = setInterval(() => {
      setPomoTime(prev => {
        if (prev <= 0) {
          pausePomodoro();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pomodoro.isRunning, pausePomodoro]);

  if (isConnecting) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-950/20 via-stone-950/50 to-stone-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-5xl animate-pulse">🔊</div>
          <h2 className="text-amber-200 font-bold text-xl">Connecting...</h2>
          <p className="text-stone-400 text-sm">Setting up audio connection</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-950/20 via-stone-950/50 to-stone-950 flex flex-col">
      {/* Room header */}
      <div className={`bg-gradient-to-r ${typeInfo?.bgGradient || 'from-stone-800/20'} px-4 py-3 border-b border-stone-700/30`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{typeInfo?.icon || '🏠'}</span>
            <div>
              <h2 className="text-white font-bold text-sm">{activeRoom.name}</h2>
              <p className="text-stone-400 text-xs">{activeRoom.topic}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400">{activeRoom.participants.length}/{activeRoom.maxParticipants}</span>
            <button onClick={leaveRoom} className="px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg text-xs font-medium border border-red-600/30 hover:bg-red-600/30 transition-all">
              Leave
            </button>
          </div>
        </div>
      </div>

      {/* Pomodoro timer for co-working rooms */}
      {activeRoom.type === 'coworking' && (
        <div className="bg-stone-900/60 px-4 py-2 border-b border-stone-700/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${pomodoro.currentPhase === 'work' ? 'bg-red-400' : 'bg-emerald-400'} ${pomodoro.isRunning ? 'animate-pulse' : ''}`} />
            <span className="text-xs font-mono text-stone-300">{formatTime(pomoTime)}</span>
            <span className="text-xs text-stone-400">{pomodoro.currentPhase === 'work' ? 'Focus' : 'Break'}</span>
          </div>
          <div className="flex gap-1">
            {!pomodoro.isRunning ? (
              <button onClick={() => startPomodoro()} className="px-2 py-1 bg-emerald-600/20 text-emerald-400 rounded text-xs">▶ Start</button>
            ) : (
              <button onClick={pausePomodoro} className="px-2 py-1 bg-amber-600/20 text-amber-400 rounded text-xs">⏸ Pause</button>
            )}
            <button onClick={resetPomodoro} className="px-2 py-1 bg-stone-800 text-stone-400 rounded text-xs">↺ Reset</button>
          </div>
        </div>
      )}

      {/* Speaker circles */}
      <div className="flex-1 p-4 overflow-y-auto">
        {/* Host */}
        {host && (
          <div className="text-center mb-4">
            <p className="text-stone-400 text-xs mb-2">Host</p>
            <div className="relative inline-block">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-4 ${
                host.isSpeaking ? 'border-amber-400 shadow-lg shadow-amber-400/30 animate-pulse' : 'border-amber-600/30'
              }`} style={{ backgroundColor: host.avatarColor }}>
                {host.name.charAt(0)}
              </div>
              {host.isMuted && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-red-500/80 flex items-center justify-center text-xs">🔇</div>
              )}
              {host.isSpeaking && (
                <div className="absolute inset-0 rounded-full border-4 border-amber-400 animate-ping opacity-30" />
              )}
            </div>
            <p className="text-stone-200 text-sm mt-1">{host.name}</p>
          </div>
        )}

        {/* Speakers */}
        {speakers.length > 0 && (
          <div className="mb-4">
            <p className="text-stone-400 text-xs mb-2 text-center">Speakers</p>
            <div className="flex flex-wrap justify-center gap-4">
              {speakers.map(p => (
                <div key={p.userId} className="text-center">
                  <div className="relative">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-2 ${
                      p.isSpeaking ? 'border-emerald-400 shadow-lg shadow-emerald-400/30' : 'border-stone-600'
                    }`} style={{ backgroundColor: p.avatarColor }}>
                      {p.name.charAt(0)}
                    </div>
                    {p.isMuted && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-red-500/80 flex items-center justify-center text-xs">🔇</div>
                    )}
                    {p.isSpeaking && (
                      <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-30" />
                    )}
                  </div>
                  <p className="text-stone-300 text-xs mt-1">{p.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Listeners */}
        {listeners.length > 0 && (
          <div className="mb-4">
            <p className="text-stone-400 text-xs mb-2 text-center">Listening</p>
            <div className="flex flex-wrap justify-center gap-2">
              {listeners.map(p => (
                <div key={p.userId} className="text-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border border-stone-700 opacity-70" style={{ backgroundColor: p.avatarColor }}>
                    {p.name.charAt(0)}
                  </div>
                  <p className="text-stone-400 text-[10px] mt-0.5">{p.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Raised hand indicator */}
        {isHandRaised && (
          <div className="text-center py-2">
            <span className="text-amber-400 text-sm animate-bounce inline-block">✋ Hand raised</span>
          </div>
        )}
      </div>

      {/* Chat (collapsible) */}
      {showChat && (
        <div className="border-t border-stone-700/50 bg-stone-900/40 max-h-64 overflow-y-auto">
          <div className="p-3 space-y-2">
            {roomMessages.length === 0 ? (
              <p className="text-stone-500 text-sm text-center py-4">No messages yet. Say hello!</p>
            ) : (
              roomMessages.map(msg => (
                <div key={msg.id} className="flex gap-2">
                  <span className="text-amber-400 text-xs font-medium shrink-0">{msg.username}:</span>
                  <span className="text-stone-300 text-xs">{msg.message}</span>
                </div>
              ))
            )}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
            className="p-3 border-t border-stone-700/30 flex gap-2"
          >
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              className="flex-1 px-3 py-2 bg-stone-800 rounded-lg border border-stone-700 text-stone-200 text-sm"
              placeholder="Say something..."
            />
            <button type="submit" className="px-3 py-2 bg-amber-600 rounded-lg text-amber-100 text-sm">Send</button>
          </form>
        </div>
      )}

      {/* Controls bar */}
      <div className="sticky bottom-0 bg-stone-900 border-t border-stone-700/50 px-4 py-3">
        <div className="flex items-center justify-between max-w-md mx-auto">
          {/* Mic */}
          <button
            onClick={toggleMic}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all ${
              isMuted
                ? 'bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30'
                : 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 hover:bg-emerald-600/30'
            }`}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>

          {/* Speaker */}
          <button
            onClick={toggleSpeaker}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all ${
              isSpeakerOn
                ? 'bg-amber-600/20 text-amber-400 border border-amber-600/30'
                : 'bg-stone-800 text-stone-500 border border-stone-700'
            }`}
          >
            {isSpeakerOn ? '🔊' : '🔈'}
          </button>

          {/* Raise hand */}
          <button
            onClick={isHandRaised ? lowerHand : raiseHand}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all ${
              isHandRaised
                ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50 animate-pulse'
                : 'bg-stone-800 text-stone-400 border border-stone-700 hover:border-amber-500/30'
            }`}
          >
            ✋
          </button>

          {/* Chat toggle */}
          <button
            onClick={() => setShowChat(!showChat)}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all ${
              showChat
                ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                : 'bg-stone-800 text-stone-400 border border-stone-700'
            }`}
          >
            💬
          </button>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all ${
              showSettings
                ? 'bg-stone-700 text-stone-200 border border-stone-600'
                : 'bg-stone-800 text-stone-400 border border-stone-700'
            }`}
          >
            ⚙️
          </button>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="mt-3 pt-3 border-t border-stone-700/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-stone-400 text-sm">Speaker Volume</span>
              <input
                type="range"
                min={0}
                max={100}
                value={speakerVolume}
                onChange={e => setSpeakerVolume(parseInt(e.target.value))}
                className="w-32 accent-amber-500"
              />
              <span className="text-stone-400 text-sm w-8">{speakerVolume}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-400 text-sm">Ambient Volume</span>
              <input
                type="range"
                min={0}
                max={100}
                value={ambientVolume}
                onChange={e => setAmbientVolume(parseInt(e.target.value))}
                className="w-32 accent-amber-500"
              />
              <span className="text-stone-400 text-sm w-8">{ambientVolume}%</span>
            </div>
            {activeRoom.ambientTrack && activeRoom.ambientTrack !== 'none' && (
              <div className="text-stone-400 text-sm">
                🎵 Now playing: {AMBIENT_TRACKS.find(t => t.id === activeRoom.ambientTrack)?.name || activeRoom.ambientTrack}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}