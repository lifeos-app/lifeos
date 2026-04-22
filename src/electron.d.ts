interface ElectronAPI {
  isElectron: boolean;
  openExternal: (url: string) => Promise<void>;
  dbQuery: (params: any) => Promise<any>;
  dbRpc: (fnName: string, fnParams: any) => Promise<any>;
  readFile: (filePath: string) => Promise<{ data: string | null; error: string | null }>;
  readMedia: (filePath: string) => Promise<{ data: any; error: string | null }>;
  listDirectory: (dirPath: string) => Promise<{ data: Array<{ name: string; path: string; is_dir: boolean; size: number }> | null; error: string | null }>;
  getAcademyOverview: () => Promise<any>;
  addXp: (params: any) => Promise<any>;
  getLifeContext: () => Promise<any>;
  getSteamStatus: () => Promise<any>;
  getAppInfo: () => Promise<any>;
  openAuthPopup: (url: string) => Promise<{ access_token: string; refresh_token: string } | null>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    __supabaseAuthCallback?: { access_token: string; refresh_token: string };
  }
}

export {};
