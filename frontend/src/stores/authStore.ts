import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type UserRole = 'ADMIN' | 'DESIGNER' | 'CONSULTANT';

export interface AuthState {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthActions {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  subscribeToAuthChanges: () => () => void;
}

export type AuthStore = AuthState & AuthActions;

/**
 * Extract role from Supabase user JWT app_metadata.
 */
function extractRole(user: User | null): UserRole | null {
  if (!user) return null;
  const role = user.app_metadata?.role as UserRole | undefined;
  if (role && ['ADMIN', 'DESIGNER', 'CONSULTANT'].includes(role)) {
    return role;
  }
  return null;
}

export const useAuthStore = create<AuthStore>((set) => ({
  // State
  user: null,
  role: null,
  isAuthenticated: false,
  isLoading: true,

  // Actions
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    const user = data.user;
    set({
      user,
      role: extractRole(user),
      isAuthenticated: !!user,
      isLoading: false,
    });
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    set({
      user: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  subscribeToAuthChanges: () => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      set({
        user,
        role: extractRole(user),
        isAuthenticated: !!user,
        isLoading: false,
      });
    });
    return () => {
      data.subscription.unsubscribe();
    };
  },
}));
