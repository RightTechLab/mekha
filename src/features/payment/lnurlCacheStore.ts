import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { fetchLnurlPayParams, requestInvoice } from '../../lib/lightning';

const CACHE_KEY = 'mekha.lnurl_cache';
const CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

export interface LnurlCache {
  callback: string;
  minSendable: number;
  maxSendable: number;
  fetchedAt: number;
}

interface LnurlCacheStore {
  cache: LnurlCache | null;
  loading: boolean;
  error: string | null;
  loadFromStorage: () => Promise<void>;
  prefetch: (lnAddress?: string) => Promise<void>;
  invalidate: () => void;
  getCacheStatus: () => { ready: boolean; minutesAgo: number | null };
  requestInvoiceWithCache: (amountMsat: number, lnAddress: string) => Promise<string>;
}

export const useLnurlCacheStore = create<LnurlCacheStore>((set, get) => ({
  cache: null,
  loading: false,
  error: null,

  loadFromStorage: async () => {
    try {
      const stored = await SecureStore.getItemAsync(CACHE_KEY);
      if (stored) {
        const parsed: LnurlCache = JSON.parse(stored);
        // Only use if not expired
        if (Date.now() - parsed.fetchedAt < CACHE_MAX_AGE_MS) {
          set({ cache: parsed });
        }
      }
    } catch {
      // Ignore parse errors
    }
  },

  prefetch: async (lnAddress?: string) => {
    const address = lnAddress ?? (await SecureStore.getItemAsync('mekha.ln_address'));
    if (!address) {
      set({ error: 'ยังไม่ได้ตั้งค่า Lightning Address' });
      return;
    }

    set({ loading: true, error: null });
    try {
      const params = await fetchLnurlPayParams(address);
      const newCache: LnurlCache = {
        callback: params.callback,
        minSendable: params.minSendable,
        maxSendable: params.maxSendable,
        fetchedAt: Date.now(),
      };
      set({ cache: newCache, loading: false });
      await SecureStore.setItemAsync(CACHE_KEY, JSON.stringify(newCache));
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? 'ไม่สามารถเชื่อมต่อ Lightning ได้' });
    }
  },

  invalidate: () => {
    set({ cache: null });
    SecureStore.deleteItemAsync(CACHE_KEY).catch(() => {});
  },

  getCacheStatus: () => {
    const { cache, loading } = get();
    if (loading) return { ready: false, minutesAgo: null };
    if (!cache) return { ready: false, minutesAgo: null };
    const age = Date.now() - cache.fetchedAt;
    if (age >= CACHE_MAX_AGE_MS) return { ready: false, minutesAgo: null };
    return { ready: true, minutesAgo: Math.floor(age / 60000) };
  },

  requestInvoiceWithCache: async (amountMsat: number, lnAddress: string): Promise<string> => {
    const { cache, prefetch, invalidate } = get();
    const isCacheValid = cache && (Date.now() - cache.fetchedAt < CACHE_MAX_AGE_MS);

    if (isCacheValid) {
      // Try using cached callback directly (skip step 1)
      try {
        const invoice = await requestInvoice(cache.callback, amountMsat);
        return invoice;
      } catch (e: any) {
        // If step 2 fails, callback may have changed — invalidate and retry once
        console.log('[LNURL Cache] Step 2 failed with cached callback, re-fetching step 1');
        invalidate();
        // Re-fetch step 1
        const params = await fetchLnurlPayParams(lnAddress);
        const newCache: LnurlCache = {
          callback: params.callback,
          minSendable: params.minSendable,
          maxSendable: params.maxSendable,
          fetchedAt: Date.now(),
        };
        set({ cache: newCache });
        await SecureStore.setItemAsync(CACHE_KEY, JSON.stringify(newCache));
        // Retry step 2 with fresh callback
        return await requestInvoice(params.callback, amountMsat);
      }
    }

    // No valid cache — do full flow
    const params = await fetchLnurlPayParams(lnAddress);
    const newCache: LnurlCache = {
      callback: params.callback,
      minSendable: params.minSendable,
      maxSendable: params.maxSendable,
      fetchedAt: Date.now(),
    };
    set({ cache: newCache });
    await SecureStore.setItemAsync(CACHE_KEY, JSON.stringify(newCache));
    return await requestInvoice(params.callback, amountMsat);
  },
}));
