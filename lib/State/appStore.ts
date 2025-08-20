import { create } from "zustand";

type NwcState = {
  nwcUrl: string | undefined;
  setNwcUrl: (url: string) => void;
};

export const useNwcStore = create<NwcState>()((set) => ({
  nwcUrl: undefined,
  setNwcUrl: (url) => set({ nwcUrl: url }),
}));
