/**
 * Database IPC Handlers
 *
 * Registers IPC channels for database operations:
 *   db:query  → execQuery(params)   — unified CRUD
 *   db:rpc    → execRpc(fn, params) — RPC calls
 */

import { ipcMain } from 'electron';
import { execQuery, execRpc } from '../database.js';

export function registerDbHandlers() {
  // Unified CRUD — the main data channel
  ipcMain.handle('db:query', (_event, params) => {
    return execQuery(params);
  });

  // RPC calls (e.g. get_table_columns)
  ipcMain.handle('db:rpc', (_event, fnName, fnParams) => {
    return execRpc(fnName, fnParams);
  });
}