import { create } from 'zustand';
import type { GameMode, SuggestionStatus } from '../types';

export type Theme = 'dark' | 'light';

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

  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

/**
 * Gets the initial theme from localStorage or system preference.
 */
function getInitialTheme(): Theme {
  // Check localStorage first
  const stored = localStorage.getItem('wordle-theme');
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }

  // Fall back to system preference
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }

  return 'dark';
}

/**
 * Applies theme to the document root element.
 */
function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('wordle-theme', theme);
}

/**
 * Zustand store for UI state.
 *
 * Separates UI concerns (modals, game mode selection, theme) from
 * game logic and multiplayer state.
 */
export const useUIStore = create<UIState>((set, get) => ({
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

  // Theme
  theme: getInitialTheme(),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    set({ theme: newTheme });
  },
}));

// Apply initial theme on load
applyTheme(useUIStore.getState().theme);

// Selector hooks
export const useGameMode = () => useUIStore((state) => state.gameMode);
export const useSuggestionStatus = () => useUIStore((state) => state.suggestionStatus);
export const useIsStatsOpen = () => useUIStore((state) => state.isStatsOpen);
export const useTheme = () => useUIStore((state) => state.theme);
export const useToggleTheme = () => useUIStore((state) => state.toggleTheme);
