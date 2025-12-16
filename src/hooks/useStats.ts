import { useState, useCallback, useEffect } from 'react';
import type { GameStatistics, GameMode } from '../types';
import {
  loadStatistics,
  saveStatistics,
  recordGameResult,
  DEFAULT_STATISTICS,
} from '../types';

export interface UseStatsReturn {
  // Statistics data
  stats: GameStatistics;

  // Win percentage (0-100)
  winPercentage: number;

  // Record a game result
  recordGame: (won: boolean, guessCount: number, gameMode: Exclude<GameMode, null>) => void;

  // Reset all statistics
  resetStats: () => void;

  // Max value in guess distribution (for rendering bar chart)
  maxDistributionValue: number;
}

export const useStats = (): UseStatsReturn => {
  const [stats, setStats] = useState<GameStatistics>(() => loadStatistics());

  // Sync stats to localStorage whenever they change
  useEffect(() => {
    saveStatistics(stats);
  }, [stats]);

  // Calculate win percentage
  const winPercentage =
    stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;

  // Calculate max distribution value for bar chart scaling
  const maxDistributionValue = Math.max(...stats.guessDistribution, 1);

  // Record a completed game
  const recordGame = useCallback(
    (won: boolean, guessCount: number, gameMode: Exclude<GameMode, null>): void => {
      setStats((currentStats) => recordGameResult(currentStats, won, guessCount, gameMode));
    },
    []
  );

  // Reset all statistics
  const resetStats = useCallback((): void => {
    setStats({ ...DEFAULT_STATISTICS });
  }, []);

  return {
    stats,
    winPercentage,
    recordGame,
    resetStats,
    maxDistributionValue,
  };
};
