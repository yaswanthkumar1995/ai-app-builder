import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { config } from '../config';

interface User {
  id: string;
  email: string;
  name: string;
  username?: string;
  firstname?: string;
  lastname?: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string, firstname?: string, lastname?: string) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (emailOrUsername: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await fetch(`${config.apiGatewayUrl}/api/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ emailOrUsername, password }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 403 && errorData.requiresVerification) {
              const error = new Error(errorData.error || 'Email verification required');
              (error as any).requiresVerification = true;
              throw error;
            }
            throw new Error(errorData.error || 'Login failed');
          }

          const data = await response.json();

          if (!data.token) {
            throw new Error('No token received from login response');
          }

          set({
            token: data.token,
            isAuthenticated: true,
          });

          await get().fetchCurrentUser();

          set({ isLoading: false });
        } catch (error) {
          set({
            isLoading: false,
            user: null,
            token: null,
            isAuthenticated: false,
          });
          throw error;
        }
      },

  register: async (email: string, password: string, username: string, firstname?: string, lastname?: string) => {
        set({ isLoading: true });
        try {
          const trimmedUsername = username.trim();
          const fullName = [firstname, lastname]
            .filter((part): part is string => !!part && part.trim().length > 0)
            .map((part) => part.trim())
            .join(' ');
          const derivedName = fullName.length >= 2 ? fullName : trimmedUsername;

          const response = await fetch(`${config.apiGatewayUrl}/api/auth/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email,
              password,
              name: derivedName,
              username: trimmedUsername,
              firstname,
              lastname
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Registration failed');
          }

          await response.json();
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      updateProfile: async (updates: Partial<User>) => {
        const { token, user } = get();
        if (!token) {
          throw new Error('No token available');
        }

        try {
          const response = await fetch(`${config.apiGatewayUrl}/api/auth/profile`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Profile update failed');
          }

          const data = await response.json();
          set({
            user: data.user,
          });
        } catch (error) {
          throw error;
        }
      },

      fetchCurrentUser: async () => {
        const { token, logout } = get();

        if (!token) {
          set({ user: null, isAuthenticated: false });
          return;
        }

        try {
          const response = await fetch(`${config.apiGatewayUrl}/api/auth/me`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            if (response.status === 401) {
              logout();
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to fetch user information');
          }

          const data = await response.json();
          set({
            user: data.user,
            isAuthenticated: true,
          });
        } catch (error) {
          console.error('❌ Failed to fetch current user:', error);
          throw error;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      refreshToken: async () => {
        const { token } = get();
        if (!token) {
          throw new Error('No token available for refresh');
        }

        try {
          const response = await fetch(`${config.apiGatewayUrl}/api/auth/refresh`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (!data.token) {
              throw new Error('No token received from refresh');
            }
            set({ token: data.token, isAuthenticated: true });
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ Token refreshed successfully');
            }
            await get().fetchCurrentUser();
            return data.token;
          } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Token refresh failed');
          }
        } catch (error) {
          console.error('❌ Token refresh failed:', error);
          // Token refresh failed, logout user
          get().logout();
          throw error;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
