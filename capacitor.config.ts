import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lifeos.teddybot',
  appName: 'LifeOS',
  webDir: 'dist',
  // Plugins config
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/LifeOSDatabase',
      iosIsEncryption: false,
      iosKeychainPrefix: 'lifeos',
      androidIsEncryption: false,
      electronIsEncryption: false,
      electronWindowsLocation: 'C:\\ProgramData\\LifeOSDatabase',
      electronMacLocation: '/Volumes/LifeOSDatabase',
      electronLinuxLocation: 'home',
    },
  },
};

export default config;
