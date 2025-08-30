import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";

// สร้าง adapter ให้ zustand ใช้ SecureStore
const secureStorage = {
  getItem: (name: string) => SecureStore.getItemAsync(name),
  setItem: (name: string, value: string) =>
    SecureStore.setItemAsync(name, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED, // iOS: ใช้ได้ตอนเครื่องปลดล็อก
    }),
  removeItem: (name: string) => SecureStore.deleteItemAsync(name),
};

type ProfileState = {
  profileName?: string;
  phoneNumber?: string;
  lineId?: string;
  paymentCycle?: string;
  firstPaymentDay?: string;
  premiumRate?: string;

  setProfile: (patch: Partial<ProfileState>) => void;
  resetProfile: () => void;

  hasHydrated: boolean; // flag บอกว่าอ่านค่าจาก storage เสร็จแล้ว
  setHasHydrated: (v: boolean) => void;
};

export const useProfileSecureStore = create<ProfileState>()(
  persist(
    (set) => ({
      profileName: undefined,
      phoneNumber: undefined,
      lineId: undefined,
      paymentCycle: undefined,
      firstPaymentDay: undefined,
      premiumRate: undefined,

      setProfile: (patch) => set((s) => ({ ...s, ...patch })),
      resetProfile: () =>
        set({
          profileName: undefined,
          phoneNumber: undefined,
          lineId: undefined,
          paymentCycle: undefined,
          firstPaymentDay: undefined,
          premiumRate: undefined,
        }),

      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: "profile-secure", // key ใน SecureStore
      storage: createJSONStorage(() => secureStorage),
      partialize: (s) => ({
        profileName: s.profileName,
        phoneNumber: s.phoneNumber,
        lineId: s.lineId,
        paymentCycle: s.paymentCycle,
        firstPaymentDay: s.firstPaymentDay,
        premiumRate: s.premiumRate,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true); // ตั้งค่าว่าโหลดข้อมูลเสร็จแล้ว
      },
    },
  ),
);
