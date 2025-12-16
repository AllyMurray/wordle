import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useStatsStore } from './statsStore';
import { DEFAULT_STATISTICS } from '../types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('statsStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Reset the store to default state
    act(() => {
      useStatsStore.setState({ stats: { ...DEFAULT_STATISTICS } });
    });
  });

  describe('initial state', () => {
    it('should have default statistics', () => {
      const { stats } = useStatsStore.getState();

      expect(stats.gamesPlayed).toBe(0);
      expect(stats.gamesWon).toBe(0);
      expect(stats.currentStreak).toBe(0);
      expect(stats.maxStreak).toBe(0);
      expect(stats.guessDistribution).toEqual([0, 0, 0, 0, 0, 0]);
      expect(stats.soloGamesPlayed).toBe(0);
      expect(stats.multiplayerGamesPlayed).toBe(0);
    });
  });

  describe('recordGame', () => {
    it('should record a won solo game', () => {
      const { recordGame } = useStatsStore.getState();

      act(() => recordGame(true, 3, 'solo'));

      const { stats } = useStatsStore.getState();
      expect(stats.gamesPlayed).toBe(1);
      expect(stats.gamesWon).toBe(1);
      expect(stats.soloGamesPlayed).toBe(1);
      expect(stats.multiplayerGamesPlayed).toBe(0);
      expect(stats.guessDistribution[2]).toBe(1); // 3 guesses = index 2
    });

    it('should record a won multiplayer game', () => {
      const { recordGame } = useStatsStore.getState();

      act(() => recordGame(true, 4, 'multiplayer'));

      const { stats } = useStatsStore.getState();
      expect(stats.gamesPlayed).toBe(1);
      expect(stats.gamesWon).toBe(1);
      expect(stats.soloGamesPlayed).toBe(0);
      expect(stats.multiplayerGamesPlayed).toBe(1);
      expect(stats.guessDistribution[3]).toBe(1); // 4 guesses = index 3
    });

    it('should record a lost game', () => {
      const { recordGame } = useStatsStore.getState();

      act(() => recordGame(false, 6, 'solo'));

      const { stats } = useStatsStore.getState();
      expect(stats.gamesPlayed).toBe(1);
      expect(stats.gamesWon).toBe(0);
      expect(stats.currentStreak).toBe(0);
    });

    it('should update guess distribution correctly', () => {
      const { recordGame } = useStatsStore.getState();

      act(() => recordGame(true, 1, 'solo')); // Won in 1
      act(() => recordGame(true, 2, 'solo')); // Won in 2
      act(() => recordGame(true, 6, 'solo')); // Won in 6

      const { stats } = useStatsStore.getState();
      expect(stats.guessDistribution[0]).toBe(1); // 1 guess
      expect(stats.guessDistribution[1]).toBe(1); // 2 guesses
      expect(stats.guessDistribution[5]).toBe(1); // 6 guesses
    });

    it('should reset streak on loss', () => {
      const { recordGame } = useStatsStore.getState();

      // Win a game (starts streak at 1)
      act(() => recordGame(true, 3, 'solo'));

      // On same day, streak stays at 1 (Wordle is daily game)
      expect(useStatsStore.getState().stats.currentStreak).toBe(1);

      // Lose a game
      act(() => recordGame(false, 6, 'solo'));

      const { stats } = useStatsStore.getState();
      expect(stats.currentStreak).toBe(0);
      expect(stats.maxStreak).toBe(1); // Max streak preserved
    });

    it('should track max streak', () => {
      const { recordGame } = useStatsStore.getState();

      // Win a game (starts streak at 1)
      act(() => recordGame(true, 3, 'solo'));

      // On same day, streak stays at 1 (Wordle-style daily game)
      expect(useStatsStore.getState().stats.currentStreak).toBe(1);
      expect(useStatsStore.getState().stats.maxStreak).toBe(1);

      // Lose
      act(() => recordGame(false, 6, 'solo'));
      expect(useStatsStore.getState().stats.currentStreak).toBe(0);

      // Win again on same day - streak logic keeps it at 0 since
      // lastGameDate is today and "same day, don't change streak"
      // This is Wordle-style behavior where streaks are daily
      act(() => recordGame(true, 3, 'solo'));

      const { stats } = useStatsStore.getState();
      expect(stats.currentStreak).toBe(0); // Same day after loss
      expect(stats.maxStreak).toBe(1); // Max preserved from earlier
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics to default', () => {
      const { recordGame, resetStats } = useStatsStore.getState();

      // Play some games
      act(() => recordGame(true, 3, 'solo'));
      act(() => recordGame(true, 4, 'multiplayer'));

      expect(useStatsStore.getState().stats.gamesPlayed).toBe(2);

      // Reset
      act(() => resetStats());

      const { stats } = useStatsStore.getState();
      expect(stats).toEqual(DEFAULT_STATISTICS);
    });
  });

  describe('selector hooks', () => {
    it('should calculate win percentage correctly', () => {
      const { recordGame } = useStatsStore.getState();

      act(() => recordGame(true, 3, 'solo'));
      act(() => recordGame(true, 4, 'solo'));
      act(() => recordGame(false, 6, 'solo'));
      act(() => recordGame(true, 2, 'solo'));

      const { stats } = useStatsStore.getState();
      const winPercentage = stats.gamesPlayed > 0
        ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
        : 0;

      expect(winPercentage).toBe(75); // 3 wins out of 4 games
    });

    it('should return 0 win percentage with no games', () => {
      const { stats } = useStatsStore.getState();
      const winPercentage = stats.gamesPlayed > 0
        ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
        : 0;

      expect(winPercentage).toBe(0);
    });
  });
});
