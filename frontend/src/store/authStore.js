import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/services/api';
import { connectSocket, disconnectSocket } from '@/services/socket';

let initPromise = null;

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isLoading: false,
      isInitialized: false,
      isDark: true,

      // Initialize — verify stored token
      initAuth: () => {
        if (get().isInitialized) return Promise.resolve();
        // Share a single in-flight initialization so React StrictMode's
        // double-invoked effect (and any concurrent callers) never run two
        // /auth/me requests or two socket connects at the same time.
        if (initPromise) return initPromise;
        initPromise = (async () => {
          const token = get().accessToken;
          if (!token) {
            set({ isInitialized: true });
            return;
          }
          try {
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            const { data } = await api.get('/auth/me');
            connectSocket(token);
            set({ user: data.data, isInitialized: true });
          } catch {
            set({ user: null, accessToken: null, isInitialized: true });
            delete api.defaults.headers.common['Authorization'];
          }
        })();
        return initPromise;
      },

      setTokens: (accessToken) => {
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        set({ accessToken });
      },

      setUser: (user) => set({ user }),

      login: (user, accessToken) => {
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        set({ user, accessToken, isInitialized: true });
        connectSocket(accessToken);
      },

      logout: () => {
        delete api.defaults.headers.common['Authorization'];
        set({ user: null, accessToken: null });
        disconnectSocket();
      },

      updateUser: (updates) => set((s) => ({ user: { ...s.user, ...updates } })),

      toggleDark: () => set((s) => ({ isDark: !s.isDark })),

      // Helpers
      isAuthenticated: () => !!get().user && !!get().accessToken,
      isRole: (role) => get().user?.role === role,
    }),
    {
      name: 'skillhub-auth',
      version: 2,
      migrate: (persistedState, version) => {
        // v2: premium dark theme is the default look
        if (version < 2) return { ...persistedState, isDark: true };
        return persistedState;
      },
      partialize: (s) => ({ accessToken: s.accessToken, isDark: s.isDark }),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          api.defaults.headers.common['Authorization'] = `Bearer ${state.accessToken}`;
        }
      },
    }
  )
);
