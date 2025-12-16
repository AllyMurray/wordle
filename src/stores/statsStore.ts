import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameStatistics, GameMode } from '../types';
import { DEFAULT_STATISTICS, recordGameResult, STATS_STORAGE_KEY } from '../types';

interface StatsState {
  // Statistics data
  stats: GameStatistics;

  // Actions
  recordGame: (won: boolean, guessCount: number, gameMode: Exclude<GameMode, null>) => void;
  resetStats: () => void;
}

/**
 * Zustand store for game statistics with automatic localStorage persistence.
 *
 * Benefits over previous useStats hook:
 * - No manual useEffect for localStorage sync - persist middleware handles it
 * - Can access stats outside React with statsStore.getState()
 * - Components can subscribe to specific slices to avoid re-renders
 */
export const useStatsStore = create<StatsState>()(
  persist(
    (set) => ({
      stats: { ...DEFAULT_STATISTICS },

      recordGame: (won, guessCount, gameMode) => {
        set((state) => ({
          stats: recordGameResult(state.stats, won, guessCount, gameMode),
        }));
      },

      resetStats: () => {
        set({ stats: { ...DEFAULT_STATISTICS } });
      },
    }),
    {
      name: STATS_STORAGE_KEY,
      // Only persist the stats object, not the actions
      partialize: (state) => ({ stats: state.stats }),
    }
  )
);

// Selector hooks for fine-grained subscriptions
// Components using these will only re-render when their specific data changes

export const useStats = () => useStatsStore((state) => state.stats);
export const useRecordGame = () => useStatsStore((state) => state.recordGame);
export const useResetStats = () => useStatsStore((state) => state.resetStats);

// Derived selectors
export const useWinPercentage = () =>
  useStatsStore((state) =>
    state.stats.gamesPlayed > 0
      ? Math.round((state.stats.gamesWon / state.stats.gamesPlayed) * 100)
      : 0
  );

export const useMaxDistributionValue = () =>
  useStatsStore((state) => Math.max(...state.stats.guessDistribution, 1));
