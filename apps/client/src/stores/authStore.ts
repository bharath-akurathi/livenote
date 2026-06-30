import { create } from 'zustand';
import type { User } from '../types';
import { auth, setAccessToken } from '../lib/api';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  login: async (email, password) => {
    const { data } = await auth.login({ email, password });
    setAccessToken(data.accessToken);
    set({ user: data.user });
  },

  register: async (email, name, password) => {
    const { data } = await auth.register({ email, name, password });
    setAccessToken(data.accessToken);
    set({ user: data.user });
  },

  logout: async () => {
    await auth.logout();
    setAccessToken(null);
    set({ user: null });
  },

  // Call on app mount to restore session via refresh cookie
  bootstrap: async () => {
    try {
      const { data } = await auth.refresh();
      setAccessToken(data.accessToken);
      set({ user: data.user });
    } catch {
      setAccessToken(null);
      set({ user: null });
    } finally {
      set({ loading: false });
    }
  },
}));
