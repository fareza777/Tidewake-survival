import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fajar.tidewake',
  appName: 'Tidewake: Island Survival',
  webDir: 'dist',
  android: { backgroundColor: '#0b0a14', allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 600, backgroundColor: '#0b0a14', showSpinner: false, launchFadeOutDuration: 250 },
  },
};

export default config;
