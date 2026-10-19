import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'id.simrt.warga',
  appName: 'SIM-RT Warga',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#0F766E',
      sound: 'beep.wav',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0F766E',
    },
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
