import { create } from 'zustand';
import type { UserRole } from '../../types';

interface SessionStore {
  role: UserRole | null;
  isAuthenticated: boolean;
  setRole: (role: UserRole) => void;
  setAuthenticated: (authenticated: boolean) => void;
  logout: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  role: null,
  isAuthenticated: false,

  setRole: (role) => set({ role }),
  setAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),
  logout: () => set({ role: null, isAuthenticated: false }),
}));
