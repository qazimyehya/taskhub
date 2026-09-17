import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  tenantName: string | null;
  setAuth: (user: User, accessToken: string, tenantName?: string) => void;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      tenantName: null,

      setAuth: (user, accessToken, tenantName) => {
        set({ user, accessToken, tenantName: tenantName || null });
      },

      setAccessToken: (token) => {
        set({ accessToken: token });
      },

      clearAuth: () => {
        set({ user: null, accessToken: null, tenantName: null });
      },

      isAuthenticated: () => {
        return !!get().accessToken && !!get().user;
      },
    }),
    {
      name: 'taskhub-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        tenantName: state.tenantName,
      }),
    }
  )
);