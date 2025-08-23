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
  setAllThbReceive: (amount: number) => void;
};

export const useBalanceStore = create<BalanceState>()((set) => ({
  allThbReceive: 0,
  setAllThbReceive: (amount) => set({ allThbReceive: amount }),
}));
