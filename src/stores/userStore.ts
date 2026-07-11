import { create } from 'zustand';
import type { User, Credits } from '../types';
import { mockUser, mockCredits } from '../lib/mocks/data.mock';

interface UserState {
  user: User | null;
  credits: Credits | null;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: mockUser,
  credits: mockCredits,
  isAuthenticated: true, // Mock authenticated state for now
  login: () => set({ user: mockUser, credits: mockCredits, isAuthenticated: true }),
  logout: () => set({ user: null, credits: null, isAuthenticated: false }),
}));
