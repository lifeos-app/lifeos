interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  arch: string;
  openExternal: (url: string) => Promise<void>;
  dbQuery: (params: any) => Promise<any>;
  dbRpc: (fnName: string, fnParams: any) => Promise<any>;
  readFile: (filePath: string) => Promise<string>;
  readMedia: (filePath: string) => Promise<any>;
  listDirectory: (dirPath: string) => Promise<string[]>;
  getAcademyOverview: () => Promise<any>;
  addXp: (params: any) => Promise<any>;
  getLifeContext: () => Promise<any>;
  getSteamStatus: () => Promise<any>;
  getAppInfo: () => Promise<any>;
  getOAuthCallbackPort: never;
  openAuthPopup: (url: string) => Promise<{ access_token: string; refresh_token: string } | null>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    __supabaseAuthCallback?: { access_token: string; refresh_token: string };
  }
}

export {};