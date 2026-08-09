import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import type { GameStatistics, GameMode } from '../types';
import { DEFAULT_STATISTICS, recordGameResult, STATS_STORAGE_KEY } from '../types';

interface StatsState {
  // Wordle statistics data (kept as `stats` for persisted-state compatibility)
  stats: GameStatistics;
  boggleStats: BoggleStatistics;

  // Actions
  recordGame: (won: boolean, guessCount: number, gameMode: Exclude<GameMode, null>) => void;
  recordBoggleGame: (score: number, wordsFound: number, gameMode: Exclude<GameMode, null>) => void;
  resetStats: () => void;
}

export interface BoggleStatistics {
  gamesPlayed: number;
  soloGamesPlayed: number;
  multiplayerGamesPlayed: number;
  bestScore: number;
  mostWords: number;
  totalScore: number;
  averageScore: number;
}

export const DEFAULT_BOGGLE_STATISTICS: BoggleStatistics = {
  gamesPlayed: 0,
  soloGamesPlayed: 0,
  multiplayerGamesPlayed: 0,
  bestScore: 0,
  mostWords: 0,
  totalScore: 0,
  averageScore: 0,
};

const countSchema = z.number().finite().int().nonnegative();
const WordleStatisticsSchema = z.strictObject({
  gamesPlayed: countSchema,
  gamesWon: countSchema,
  currentStreak: countSchema,
  maxStreak: countSchema,
  guessDistribution: z.tuple([
    countSchema,
    countSchema,
    countSchema,
    countSchema,
    countSchema,
    countSchema,
  ]),
  lastGameDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  soloGamesPlayed: countSchema,
  multiplayerGamesPlayed: countSchema,
});
const BoggleStatisticsSchema = z.strictObject({
  gamesPlayed: countSchema,
  soloGamesPlayed: countSchema,
  multiplayerGamesPlayed: countSchema,
  bestScore: countSchema,
  mostWords: countSchema,
  totalScore: countSchema,
  averageScore: z.number().finite().nonnegative(),
});

export const migrateStatsState = (persistedState: unknown) => {
  const state =
    typeof persistedState === 'object' && persistedState !== null
      ? (persistedState as Record<string, unknown>)
      : {};
  const stats = WordleStatisticsSchema.safeParse(state.stats);
  const boggleStats = BoggleStatisticsSchema.safeParse(state.boggleStats);

  return {
    stats: stats.success ? stats.data : { ...DEFAULT_STATISTICS },
    boggleStats: boggleStats.success
      ? boggleStats.data
      : { ...DEFAULT_BOGGLE_STATISTICS },
  };
};

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
      boggleStats: { ...DEFAULT_BOGGLE_STATISTICS },

      recordGame: (won, guessCount, gameMode) => {
        set((state) => ({
          stats: recordGameResult(state.stats, won, guessCount, gameMode),
        }));
      },

      recordBoggleGame: (score, wordsFound, gameMode) => {
        set((state) => {
          const gamesPlayed = state.boggleStats.gamesPlayed + 1;
          const totalScore = state.boggleStats.totalScore + score;

          return {
            boggleStats: {
              ...state.boggleStats,
              gamesPlayed,
              bestScore: Math.max(state.boggleStats.bestScore, score),
              mostWords: Math.max(state.boggleStats.mostWords, wordsFound),
              totalScore,
              averageScore: totalScore / gamesPlayed,
              soloGamesPlayed: gameMode === 'solo'
                ? state.boggleStats.soloGamesPlayed + 1
                : state.boggleStats.soloGamesPlayed,
              multiplayerGamesPlayed: gameMode === 'multiplayer'
                ? state.boggleStats.multiplayerGamesPlayed + 1
                : state.boggleStats.multiplayerGamesPlayed,
            },
          };
        });
      },

      resetStats: () => {
        set({
          stats: { ...DEFAULT_STATISTICS },
          boggleStats: { ...DEFAULT_BOGGLE_STATISTICS },
        });
      },
    }),
    {
      name: STATS_STORAGE_KEY,
      version: 1,
      migrate: migrateStatsState,
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...migrateStatsState(persistedState),
      }),
      // Only persist statistics, not actions.
      partialize: (state) => ({
        stats: state.stats,
        boggleStats: state.boggleStats,
      }),
    }
  )
);

// Selector hooks for fine-grained subscriptions
// Components using these will only re-render when their specific data changes

export const useStats = () => useStatsStore((state) => state.stats);
export const useBoggleStats = () => useStatsStore((state) => state.boggleStats);
export const useRecordGame = () => useStatsStore((state) => state.recordGame);
export const useRecordBoggleGame = () => useStatsStore((state) => state.recordBoggleGame);
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
