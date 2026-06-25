import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useColorScheme } from 'nativewind';
import { runMigrations } from '../src/db/migrations';
import { getSetting } from '../src/db/repositories/transactionRepo';
import { useLnurlCacheStore } from '../src/features/payment/lnurlCacheStore';
import { normalizeThemePreference, THEME_SETTING_KEY } from '../src/constants/theme';

const queryClient = new QueryClient();
let migrationsReady = false;

export default function RootLayout() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (!migrationsReady) {
    runMigrations();
    migrationsReady = true;
  }

  useEffect(() => {
    setColorScheme(normalizeThemePreference(getSetting(THEME_SETTING_KEY)));
  }, [setColorScheme]);

  useEffect(() => {
    // Pre-fetch LNURL step 1 on app startup
    const initLnurlCache = async () => {
      const store = useLnurlCacheStore.getState();
      await store.loadFromStorage();
      // If no valid cache, prefetch
      const { ready } = store.getCacheStatus();
      if (!ready) {
        store.prefetch();
      }
    };
    initLnurlCache();
  }, []);

  // Background refresh: check cache age every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      const store = useLnurlCacheStore.getState();
      const { ready } = store.getCacheStatus();
      if (!ready) {
        store.prefetch();
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF' }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
