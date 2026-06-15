import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.timgent.packmeup',
  appName: 'Pack Me Up',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    allowNavigation: ['*'],
  },
};

export default config;
