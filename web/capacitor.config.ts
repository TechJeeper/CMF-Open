import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cmfkit.appstore',
  appName: 'CMF App Store',
  webDir: 'dist',
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
    },
  },
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: 'Scanning for CMF Watch...',
        cancel: 'Cancel',
        availableDevices: 'Available devices',
        noDeviceFound: 'No CMF Watch found',
      },
    },
  },
};

export default config;
