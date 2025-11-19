import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

type NwcState = {
  nwcUrl: string | undefined;
  setNwcUrl: (url: string) => void;
};

export const useNwcStore = create<NwcState>()((set) => ({
  nwcUrl: undefined,
  setNwcUrl: (url) => set({ nwcUrl: url }),
}));

type BalanceState = {
  allThbReceive: number;
  isLoaded: boolean;
  setAllThbReceive: (amount: number) => void;
  loadAllThbReceive: () => Promise<void>;
};

const ALL_THB_RECEIVE_STORAGE_KEY = "allThbReceive";

export const useBalanceStore = create<BalanceState>()((set, get) => ({
  allThbReceive: 0,
  isLoaded: false,

  setAllThbReceive: async (amount) => {
    try {
      // Save to SecureStore
      await SecureStore.setItemAsync(
        ALL_THB_RECEIVE_STORAGE_KEY,
        amount.toString(),
      );
      // Update state
      set({ allThbReceive: amount });
      // console.log("Saved allThbReceive to SecureStore:", amount);
    } catch (error) {
      console.error("Error saving allThbReceive to SecureStore:", error);
      // Still update state even if storage fails
      set({ allThbReceive: amount });
    }
  },

  loadAllThbReceive: async () => {
    try {
      const storedValue = await SecureStore.getItemAsync(
        ALL_THB_RECEIVE_STORAGE_KEY,
      );
      if (storedValue !== null) {
        const amount = parseFloat(storedValue);
        if (!isNaN(amount)) {
          set({ allThbReceive: amount, isLoaded: true });
          // console.log("Loaded allThbReceive from SecureStore:", amount);
        } else {
          set({ allThbReceive: 0, isLoaded: true });
        }
      } else {
        set({ allThbReceive: 0, isLoaded: true });
      }
    } catch (error) {
      console.error("Error loading allThbReceive from SecureStore:", error);
      set({ allThbReceive: 0, isLoaded: true });
    }
  },
}));
