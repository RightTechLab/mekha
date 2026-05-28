import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { runMigrations } from '../src/db/migrations';
import { useLnurlCacheStore } from '../src/features/payment/lnurlCacheStore';

const queryClient = new QueryClient();

export default function RootLayout() {
  useEffect(() => {
    runMigrations();
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
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
        <StatusBar style="dark" />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
