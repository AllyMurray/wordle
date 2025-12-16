import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useUIStore } from './uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    // Reset the store to initial state
    act(() => {
      useUIStore.setState({
        gameMode: null,
        suggestionStatus: null,
        isStatsOpen: false,
      });
    });
  });

  describe('initial state', () => {
    it('should have correct default values', () => {
      const state = useUIStore.getState();

      expect(state.gameMode).toBeNull();
      expect(state.suggestionStatus).toBeNull();
      expect(state.isStatsOpen).toBe(false);
    });
  });

  describe('gameMode', () => {
    it('should set game mode to solo', () => {
      const { setGameMode } = useUIStore.getState();

      act(() => setGameMode('solo'));

      expect(useUIStore.getState().gameMode).toBe('solo');
    });

    it('should set game mode to multiplayer', () => {
      const { setGameMode } = useUIStore.getState();

      act(() => setGameMode('multiplayer'));

      expect(useUIStore.getState().gameMode).toBe('multiplayer');
    });

    it('should set game mode to null', () => {
      const { setGameMode } = useUIStore.getState();

      act(() => setGameMode('solo'));
      act(() => setGameMode(null));

      expect(useUIStore.getState().gameMode).toBeNull();
    });
  });

  describe('suggestionStatus', () => {
    it('should set suggestion status to pending', () => {
      const { setSuggestionStatus } = useUIStore.getState();

      act(() => setSuggestionStatus('pending'));

      expect(useUIStore.getState().suggestionStatus).toBe('pending');
    });

    it('should set suggestion status to accepted', () => {
      const { setSuggestionStatus } = useUIStore.getState();

      act(() => setSuggestionStatus('accepted'));

      expect(useUIStore.getState().suggestionStatus).toBe('accepted');
    });

    it('should set suggestion status to rejected', () => {
      const { setSuggestionStatus } = useUIStore.getState();

      act(() => setSuggestionStatus('rejected'));

      expect(useUIStore.getState().suggestionStatus).toBe('rejected');
    });

    it('should set suggestion status to invalid', () => {
      const { setSuggestionStatus } = useUIStore.getState();

      act(() => setSuggestionStatus('invalid'));

      expect(useUIStore.getState().suggestionStatus).toBe('invalid');
    });

    it('should clear suggestion status', () => {
      const { setSuggestionStatus } = useUIStore.getState();

      act(() => setSuggestionStatus('pending'));
      act(() => setSuggestionStatus(null));

      expect(useUIStore.getState().suggestionStatus).toBeNull();
    });
  });

  describe('stats modal', () => {
    it('should open stats modal', () => {
      const { openStats } = useUIStore.getState();

      act(() => openStats());

      expect(useUIStore.getState().isStatsOpen).toBe(true);
    });

    it('should close stats modal', () => {
      const { openStats, closeStats } = useUIStore.getState();

      act(() => openStats());
      expect(useUIStore.getState().isStatsOpen).toBe(true);

      act(() => closeStats());
      expect(useUIStore.getState().isStatsOpen).toBe(false);
    });
  });
});
