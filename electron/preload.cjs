/**
 * LifeOS Electron Preload Script
 *
 * Exposes a secure bridge between the renderer (React app) and the main process
 * via contextBridge. The renderer accesses these through `window.electronAPI`.
 *
 * contextIsolation: true — the renderer cannot directly access Node.js or ipcRenderer.
 * All communication goes through the defined channels.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Identity ──
  isElectron: true,

  // ── Shell ──
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // ── Database CRUD ──
  // Unified query — mirrors Tauri's db_query and Flask's unified_crud.
  // Accepts a QueryParams object, returns a Supabase-compatible response.
  dbQuery: (params) => ipcRenderer.invoke('db:query', params),

  // RPC calls (e.g. get_table_columns)
  dbRpc: (fnName, fnParams) => ipcRenderer.invoke('db:rpc', fnName, fnParams),

  // ── File Operations ──
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  readMedia: (filePath) => ipcRenderer.invoke('file:media', filePath),
  listDirectory: (dirPath) => ipcRenderer.invoke('file:list', dirPath),

  // ── Academy ──
  getAcademyOverview: () => ipcRenderer.invoke('academy:overview'),

  // ── XP System ──
  addXp: (params) => ipcRenderer.invoke('xp:add', params),

  // ── Life Context ──
  getLifeContext: () => ipcRenderer.invoke('context:get'),

  // ── Steam ──
  getSteamStatus: () => ipcRenderer.invoke('steam:status'),

  // ── App Info ──
  getAppInfo: () => ipcRenderer.invoke('app:info'),

  // ── Command Center ──
  checkServiceHealth: (port) => ipcRenderer.invoke('cc:check-service', port),
  getSystemMetrics:   () => ipcRenderer.invoke('cc:system-metrics'),
  getClaudeSessions:  () => ipcRenderer.invoke('cc:claude-sessions'),
  launchService:      (serviceId) => ipcRenderer.invoke('cc:launch-service', serviceId),
  checkFederationNode:(host) => ipcRenderer.invoke('cc:check-federation', host),
  getObsidianSync:    () => ipcRenderer.invoke('cc:obsidian-sync'),
});
