import { create } from 'zustand';
import type { GameMode, SuggestionStatus } from '../types';

interface UIState {
  // Game mode selection
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;

  // Suggestion status for viewer
  suggestionStatus: SuggestionStatus;
  setSuggestionStatus: (status: SuggestionStatus) => void;

  // Stats modal
  isStatsOpen: boolean;
  openStats: () => void;
  closeStats: () => void;
}

/**
 * Zustand store for UI state.
 *
 * Separates UI concerns (modals, game mode selection) from
 * game logic and multiplayer state.
 */
export const useUIStore = create<UIState>((set) => ({
  // Game mode
  gameMode: null,
  setGameMode: (mode) => set({ gameMode: mode }),

  // Suggestion status
  suggestionStatus: null,
  setSuggestionStatus: (status) => set({ suggestionStatus: status }),

  // Stats modal
  isStatsOpen: false,
  openStats: () => set({ isStatsOpen: true }),
  closeStats: () => set({ isStatsOpen: false }),
}));

// Selector hooks
export const useGameMode = () => useUIStore((state) => state.gameMode);
export const useSuggestionStatus = () => useUIStore((state) => state.suggestionStatus);
export const useIsStatsOpen = () => useUIStore((state) => state.isStatsOpen);
