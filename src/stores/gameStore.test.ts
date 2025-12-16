import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useGameStore } from './gameStore';
import * as wordsModule from '../data/words';

// Mock the words module
vi.mock('../data/words', () => ({
  getRandomWord: vi.fn(() => 'CRANE'),
  WORDS: ['crane', 'apple', 'grape', 'lemon', 'melon', 'pearl', 'slate', 'trace', 'arise', 'stare'],
}));

describe('gameStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(wordsModule.getRandomWord).mockReturnValue('CRANE');
    // Reset the store to initial state before each test
    act(() => {
      useGameStore.setState({
        solution: 'CRANE',
        guesses: [],
        currentGuess: '',
        viewerGuess: '',
        gameOver: false,
        won: false,
        shake: false,
        message: '',
        isViewer: false,
      });
    });
  });

  describe('initial state', () => {
    it('should have correct default values', () => {
      const state = useGameStore.getState();

      expect(state.solution).toBe('CRANE');
      expect(state.guesses).toEqual([]);
      expect(state.currentGuess).toBe('');
      expect(state.viewerGuess).toBe('');
      expect(state.gameOver).toBe(false);
      expect(state.won).toBe(false);
      expect(state.shake).toBe(false);
      expect(state.message).toBe('');
    });
  });

  describe('setCurrentGuess', () => {
    it('should update current guess', () => {
      const { setCurrentGuess } = useGameStore.getState();

      act(() => setCurrentGuess('A'));
      expect(useGameStore.getState().currentGuess).toBe('A');

      act(() => setCurrentGuess('AP'));
      expect(useGameStore.getState().currentGuess).toBe('AP');
    });
  });

  describe('setViewerGuess', () => {
    it('should update viewer guess', () => {
      const { setViewerGuess } = useGameStore.getState();

      act(() => setViewerGuess('AB'));
      expect(useGameStore.getState().viewerGuess).toBe('AB');
    });
  });

  describe('clearViewerGuess', () => {
    it('should clear viewer guess', () => {
      const { setViewerGuess, clearViewerGuess } = useGameStore.getState();

      act(() => setViewerGuess('APPLE'));
      expect(useGameStore.getState().viewerGuess).toBe('APPLE');

      act(() => clearViewerGuess());
      expect(useGameStore.getState().viewerGuess).toBe('');
    });
  });

  describe('submitGuess', () => {
    it('should reject guess with less than 5 letters', () => {
      const { setCurrentGuess, submitGuess } = useGameStore.getState();

      act(() => setCurrentGuess('APP'));
      act(() => submitGuess());

      const state = useGameStore.getState();
      expect(state.guesses).toHaveLength(0);
      expect(state.message).toBe('Not enough letters');
      expect(state.shake).toBe(true);
    });

    it('should reject word not in word list', () => {
      const { setCurrentGuess, submitGuess } = useGameStore.getState();

      act(() => setCurrentGuess('XXXXX'));
      act(() => submitGuess());

      const state = useGameStore.getState();
      expect(state.guesses).toHaveLength(0);
      expect(state.message).toBe('Not in word list');
    });

    it('should accept valid word and add to guesses', () => {
      const { setCurrentGuess, submitGuess } = useGameStore.getState();

      act(() => setCurrentGuess('APPLE'));
      act(() => submitGuess());

      const state = useGameStore.getState();
      expect(state.guesses).toHaveLength(1);
      expect(state.guesses[0]?.word).toBe('APPLE');
      expect(state.currentGuess).toBe('');
    });

    it('should not submit when in viewer mode', () => {
      act(() => {
        useGameStore.setState({ isViewer: true });
      });

      const { setCurrentGuess, submitGuess } = useGameStore.getState();

      act(() => setCurrentGuess('APPLE'));
      const result = submitGuess();

      expect(result).toBe(false);
      expect(useGameStore.getState().guesses).toHaveLength(0);
    });
  });

  describe('submitWord', () => {
    it('should submit a valid word', () => {
      const { submitWord } = useGameStore.getState();

      let success = false;
      act(() => {
        success = submitWord('APPLE');
      });

      expect(success).toBe(true);
      const state = useGameStore.getState();
      expect(state.guesses).toHaveLength(1);
      expect(state.guesses[0]?.word).toBe('APPLE');
    });

    it('should reject invalid word', () => {
      const { submitWord } = useGameStore.getState();

      let success = true;
      act(() => {
        success = submitWord('XXXXX');
      });

      expect(success).toBe(false);
      expect(useGameStore.getState().guesses).toHaveLength(0);
    });

    it('should reject word with wrong length', () => {
      const { submitWord } = useGameStore.getState();

      let success = true;
      act(() => {
        success = submitWord('APP');
      });

      expect(success).toBe(false);
      expect(useGameStore.getState().guesses).toHaveLength(0);
    });

    it('should not submit when game is over', () => {
      const { submitWord } = useGameStore.getState();

      // Win the game first
      act(() => submitWord('CRANE'));

      let success = true;
      act(() => {
        success = submitWord('APPLE');
      });

      expect(success).toBe(false);
      expect(useGameStore.getState().guesses).toHaveLength(1);
    });

    it('should not submit when in viewer mode', () => {
      act(() => {
        useGameStore.setState({ isViewer: true });
      });

      const { submitWord } = useGameStore.getState();

      let success = true;
      act(() => {
        success = submitWord('APPLE');
      });

      expect(success).toBe(false);
      expect(useGameStore.getState().guesses).toHaveLength(0);
    });
  });

  describe('game over conditions', () => {
    it('should win when guessing correct word', () => {
      const { submitWord } = useGameStore.getState();

      act(() => submitWord('CRANE'));

      const state = useGameStore.getState();
      expect(state.won).toBe(true);
      expect(state.gameOver).toBe(true);
      expect(state.message).toBe('Excellent!');
    });

    it('should lose after 6 incorrect guesses', () => {
      const { submitWord } = useGameStore.getState();
      const words = ['APPLE', 'GRAPE', 'LEMON', 'MELON', 'PEARL', 'SLATE'];

      words.forEach((word) => {
        act(() => submitWord(word));
      });

      const state = useGameStore.getState();
      expect(state.gameOver).toBe(true);
      expect(state.won).toBe(false);
      expect(state.message).toBe('The word was CRANE');
    });
  });

  describe('letter status algorithm', () => {
    it('should mark all correct letters as correct', () => {
      const { submitWord } = useGameStore.getState();

      act(() => submitWord('CRANE'));

      const status = useGameStore.getState().guesses[0]?.status;
      expect(status).toEqual(['correct', 'correct', 'correct', 'correct', 'correct']);
    });

    it('should mark absent letters correctly', () => {
      const { submitWord } = useGameStore.getState();

      // Solution is CRANE, guessing LEMON
      // L-absent, E-present, M-absent, O-absent, N-present
      act(() => submitWord('LEMON'));

      const status = useGameStore.getState().guesses[0]?.status;
      expect(status).toEqual(['absent', 'present', 'absent', 'absent', 'present']);
    });

    it('should mark present letters correctly', () => {
      const { submitWord } = useGameStore.getState();

      // Solution is CRANE, guessing TRACE
      // T-absent, R-correct, A-correct, C-present, E-correct
      act(() => submitWord('TRACE'));

      const status = useGameStore.getState().guesses[0]?.status;
      expect(status).toEqual(['absent', 'correct', 'correct', 'present', 'correct']);
    });

    it('should handle duplicate letters - only mark as present if enough in solution', () => {
      const { submitWord } = useGameStore.getState();

      // Solution is CRANE (one A), guessing ARISE
      // A-present, R-correct, I-absent, S-absent, E-correct
      act(() => submitWord('ARISE'));

      const status = useGameStore.getState().guesses[0]?.status;
      expect(status).toEqual(['present', 'correct', 'absent', 'absent', 'correct']);
    });

    it('should prioritize correct over present for duplicate letters', () => {
      const { submitWord } = useGameStore.getState();

      // Solution is CRANE, guessing STARE
      // S-absent, T-absent, A-correct, R-present, E-correct
      act(() => submitWord('STARE'));

      const status = useGameStore.getState().guesses[0]?.status;
      expect(status).toEqual(['absent', 'absent', 'correct', 'present', 'correct']);
    });
  });

  describe('getKeyboardStatus', () => {
    it('should return empty object with no guesses', () => {
      const { getKeyboardStatus } = useGameStore.getState();
      expect(getKeyboardStatus()).toEqual({});
    });

    it('should track letter statuses after guesses', () => {
      const { submitWord, getKeyboardStatus } = useGameStore.getState();

      act(() => submitWord('APPLE'));

      const status = getKeyboardStatus();
      expect(status['A']).toBeDefined();
      expect(status['P']).toBeDefined();
      expect(status['L']).toBeDefined();
      expect(status['E']).toBeDefined();
    });

    it('should prioritize correct over present in keyboard status', () => {
      const { submitWord, getKeyboardStatus } = useGameStore.getState();

      // First guess - TRACE has C as present
      act(() => submitWord('TRACE'));

      // Second guess - CRANE has C in correct position
      act(() => submitWord('CRANE'));

      const status = getKeyboardStatus();
      expect(status['C']).toBe('correct');
      expect(status['R']).toBe('correct');
      expect(status['A']).toBe('correct');
    });
  });

  describe('isValidWord', () => {
    it('should return true for valid words', () => {
      const { isValidWord } = useGameStore.getState();
      expect(isValidWord('crane')).toBe(true);
      expect(isValidWord('apple')).toBe(true);
    });

    it('should return false for invalid words', () => {
      const { isValidWord } = useGameStore.getState();
      expect(isValidWord('xxxxx')).toBe(false);
      expect(isValidWord('zzzzz')).toBe(false);
    });
  });

  describe('newGame', () => {
    it('should reset all game state', () => {
      const { submitWord, newGame } = useGameStore.getState();

      act(() => submitWord('APPLE'));
      expect(useGameStore.getState().guesses).toHaveLength(1);

      act(() => newGame());

      const state = useGameStore.getState();
      expect(state.guesses).toEqual([]);
      expect(state.currentGuess).toBe('');
      expect(state.gameOver).toBe(false);
      expect(state.won).toBe(false);
      expect(state.message).toBe('');
    });
  });

  describe('getGameState and setGameState', () => {
    it('should return current game state', () => {
      const { getGameState } = useGameStore.getState();

      const state = getGameState();

      expect(state).toEqual({
        solution: 'CRANE',
        guesses: [],
        currentGuess: '',
        gameOver: false,
        won: false,
        message: '',
      });
    });

    it('should set game state from external source', () => {
      const { setGameState } = useGameStore.getState();

      act(() => {
        setGameState({
          solution: 'HELLO',
          guesses: [{ word: 'WORLD', status: ['absent', 'absent', 'absent', 'correct', 'absent'] }],
          gameOver: false,
          won: false,
          message: '',
        });
      });

      const state = useGameStore.getState();
      expect(state.solution).toBe('HELLO');
      expect(state.guesses).toHaveLength(1);
    });
  });
});
