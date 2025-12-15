import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWordle } from './useWordle';
import * as wordsModule from '../data/words';

// Mock the words module
vi.mock('../data/words', () => ({
  getRandomWord: vi.fn(() => 'CRANE'),
  WORDS: ['crane', 'apple', 'grape', 'lemon', 'melon', 'pearl', 'slate', 'trace', 'arise', 'stare'],
}));

describe('useWordle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(wordsModule.getRandomWord).mockReturnValue('CRANE');
  });

  describe('initial state', () => {
    it('should initialize with correct default values', () => {
      const { result } = renderHook(() => useWordle());

      expect(result.current.solution).toBe('CRANE');
      expect(result.current.guesses).toEqual([]);
      expect(result.current.currentGuess).toBe('');
      expect(result.current.viewerGuess).toBe('');
      expect(result.current.gameOver).toBe(false);
      expect(result.current.won).toBe(false);
      expect(result.current.shake).toBe(false);
      expect(result.current.message).toBe('');
      expect(result.current.maxGuesses).toBe(6);
      expect(result.current.wordLength).toBe(5);
    });
  });

  describe('handleKeyPress - letter input', () => {
    it('should add letters to current guess', () => {
      const { result } = renderHook(() => useWordle());

      act(() => {
        result.current.handleKeyPress('A');
      });
      expect(result.current.currentGuess).toBe('A');

      act(() => {
        result.current.handleKeyPress('P');
      });
      expect(result.current.currentGuess).toBe('AP');
    });

    it('should not add more than 5 letters', () => {
      const { result } = renderHook(() => useWordle());

      act(() => result.current.handleKeyPress('A'));
      act(() => result.current.handleKeyPress('P'));
      act(() => result.current.handleKeyPress('P'));
      act(() => result.current.handleKeyPress('L'));
      act(() => result.current.handleKeyPress('E'));

      expect(result.current.currentGuess).toBe('APPLE');

      act(() => result.current.handleKeyPress('X'));
      expect(result.current.currentGuess).toBe('APPLE');
    });

    it('should only accept uppercase letters A-Z', () => {
      const { result } = renderHook(() => useWordle());

      act(() => result.current.handleKeyPress('1'));
      act(() => result.current.handleKeyPress('!'));
      act(() => result.current.handleKeyPress(' '));

      expect(result.current.currentGuess).toBe('');

      act(() => result.current.handleKeyPress('A'));
      expect(result.current.currentGuess).toBe('A');
    });
  });

  describe('handleKeyPress - backspace', () => {
    it('should remove last letter on backspace', () => {
      const { result } = renderHook(() => useWordle());

      act(() => result.current.handleKeyPress('A'));
      act(() => result.current.handleKeyPress('B'));
      act(() => result.current.handleKeyPress('BACKSPACE'));

      expect(result.current.currentGuess).toBe('A');
    });

    it('should handle backspace on empty guess', () => {
      const { result } = renderHook(() => useWordle());

      act(() => result.current.handleKeyPress('BACKSPACE'));
      expect(result.current.currentGuess).toBe('');
    });
  });

  describe('handleKeyPress - enter (submit guess)', () => {
    it('should reject guess with less than 5 letters', () => {
      const { result } = renderHook(() => useWordle());

      act(() => result.current.handleKeyPress('A'));
      act(() => result.current.handleKeyPress('P'));
      act(() => result.current.handleKeyPress('P'));
      act(() => result.current.handleKeyPress('ENTER'));

      expect(result.current.guesses).toHaveLength(0);
      expect(result.current.message).toBe('Not enough letters');
      expect(result.current.shake).toBe(true);
    });

    it('should reject word not in word list', () => {
      const { result } = renderHook(() => useWordle());

      act(() => result.current.handleKeyPress('X'));
      act(() => result.current.handleKeyPress('X'));
      act(() => result.current.handleKeyPress('X'));
      act(() => result.current.handleKeyPress('X'));
      act(() => result.current.handleKeyPress('X'));
      act(() => result.current.handleKeyPress('ENTER'));

      expect(result.current.guesses).toHaveLength(0);
      expect(result.current.message).toBe('Not in word list');
    });

    it('should accept valid word and add to guesses', () => {
      const { result } = renderHook(() => useWordle());

      act(() => result.current.handleKeyPress('A'));
      act(() => result.current.handleKeyPress('P'));
      act(() => result.current.handleKeyPress('P'));
      act(() => result.current.handleKeyPress('L'));
      act(() => result.current.handleKeyPress('E'));
      act(() => result.current.handleKeyPress('ENTER'));

      expect(result.current.guesses).toHaveLength(1);
      expect(result.current.guesses[0]?.word).toBe('APPLE');
      expect(result.current.currentGuess).toBe('');
    });
  });

  describe('game over conditions', () => {
    it('should win when guessing correct word', () => {
      const { result } = renderHook(() => useWordle());

      act(() => result.current.submitWord('CRANE'));

      expect(result.current.won).toBe(true);
      expect(result.current.gameOver).toBe(true);
      expect(result.current.message).toBe('Excellent!');
    });

    it('should lose after 6 incorrect guesses', () => {
      const { result } = renderHook(() => useWordle());
      const words = ['APPLE', 'GRAPE', 'LEMON', 'MELON', 'PEARL', 'SLATE'];

      words.forEach(word => {
        act(() => result.current.submitWord(word));
      });

      expect(result.current.gameOver).toBe(true);
      expect(result.current.won).toBe(false);
      expect(result.current.message).toBe('The word was CRANE');
    });

    it('should not accept input after game over', () => {
      const { result } = renderHook(() => useWordle());

      // Win the game
      act(() => result.current.submitWord('CRANE'));

      // Try to input more
      act(() => result.current.handleKeyPress('A'));

      expect(result.current.currentGuess).toBe('');
    });
  });

  describe('getLetterStatus - letter status algorithm', () => {
    it('should mark all correct letters as correct', () => {
      const { result } = renderHook(() => useWordle());

      act(() => result.current.submitWord('CRANE'));

      const status = result.current.guesses[0]?.status;
      expect(status).toEqual(['correct', 'correct', 'correct', 'correct', 'correct']);
    });

    it('should mark absent letters correctly', () => {
      const { result } = renderHook(() => useWordle());

      // Solution is CRANE, guessing LEMON
      // L-absent, E-present, M-absent, O-absent, N-present
      act(() => result.current.submitWord('LEMON'));

      const status = result.current.guesses[0]?.status;
      expect(status).toEqual(['absent', 'present', 'absent', 'absent', 'present']);
    });

    it('should mark present letters correctly', () => {
      const { result } = renderHook(() => useWordle());

      // Solution is CRANE, guessing TRACE
      // T-absent (not in CRANE), R-correct (pos 1), A-correct (pos 2), C-present (pos 0 in CRANE), E-correct (pos 4)
      act(() => result.current.submitWord('TRACE'));

      const status = result.current.guesses[0]?.status;
      expect(status).toEqual(['absent', 'correct', 'correct', 'present', 'correct']);
    });

    it('should handle duplicate letters - only mark as present if enough in solution', () => {
      const { result } = renderHook(() => useWordle());

      // Solution is CRANE (one A), guessing ARISE
      // A-present (pos 0, A is at pos 2 in CRANE), R-correct (pos 1), I-absent, S-absent, E-correct (pos 4)
      act(() => result.current.submitWord('ARISE'));

      const status = result.current.guesses[0]?.status;
      expect(status).toEqual(['present', 'correct', 'absent', 'absent', 'correct']);
    });

    it('should prioritize correct over present for duplicate letters', () => {
      const { result } = renderHook(() => useWordle());

      // Solution is CRANE, guessing STARE
      // S(0) vs C -> absent
      // T(1) vs R -> absent
      // A(2) vs A -> correct!
      // R(3) vs N -> present (R is at position 1 in CRANE)
      // E(4) vs E -> correct!
      act(() => result.current.submitWord('STARE'));

      const status = result.current.guesses[0]?.status;
      expect(status).toEqual(['absent', 'absent', 'correct', 'present', 'correct']);
    });
  });

  describe('getKeyboardStatus', () => {
    it('should return empty object with no guesses', () => {
      const { result } = renderHook(() => useWordle());
      expect(result.current.getKeyboardStatus()).toEqual({});
    });

    it('should track letter statuses after guesses', () => {
      const { result } = renderHook(() => useWordle());

      act(() => result.current.submitWord('APPLE'));

      const status = result.current.getKeyboardStatus();
      expect(status['A']).toBeDefined();
      expect(status['P']).toBeDefined();
      expect(status['L']).toBeDefined();
      expect(status['E']).toBeDefined();
    });

    it('should prioritize correct over present in keyboard status', () => {
      const { result } = renderHook(() => useWordle());

      // First guess - TRACE has C as present (not in correct position)
      act(() => result.current.submitWord('TRACE'));

      // Second guess - CRANE has C in correct position
      act(() => result.current.submitWord('CRANE'));

      const status = result.current.getKeyboardStatus();
      expect(status['C']).toBe('correct');
      expect(status['R']).toBe('correct');
      expect(status['A']).toBe('correct');
    });
  });

  describe('isValidWord', () => {
    it('should return true for valid words', () => {
      const { result } = renderHook(() => useWordle());
      expect(result.current.isValidWord('crane')).toBe(true);
      expect(result.current.isValidWord('apple')).toBe(true);
    });

    it('should return false for invalid words', () => {
      const { result } = renderHook(() => useWordle());
      expect(result.current.isValidWord('xxxxx')).toBe(false);
      expect(result.current.isValidWord('zzzzz')).toBe(false);
    });
  });

  describe('submitWord', () => {
    it('should submit a valid word', () => {
      const { result } = renderHook(() => useWordle());

      let success = false;
      act(() => {
        success = result.current.submitWord('APPLE');
      });

      expect(success).toBe(true);
      expect(result.current.guesses).toHaveLength(1);
      expect(result.current.guesses[0]?.word).toBe('APPLE');
    });

    it('should reject invalid word', () => {
      const { result } = renderHook(() => useWordle());

      let success = true;
      act(() => {
        success = result.current.submitWord('XXXXX');
      });

      expect(success).toBe(false);
      expect(result.current.guesses).toHaveLength(0);
    });

    it('should reject word with wrong length', () => {
      const { result } = renderHook(() => useWordle());

      let success = true;
      act(() => {
        success = result.current.submitWord('APP');
      });

      expect(success).toBe(false);
      expect(result.current.guesses).toHaveLength(0);
    });

    it('should not submit when game is over', () => {
      const { result } = renderHook(() => useWordle());

      // Win the game first
      act(() => result.current.submitWord('CRANE'));

      let success = true;
      act(() => {
        success = result.current.submitWord('APPLE');
      });

      expect(success).toBe(false);
      expect(result.current.guesses).toHaveLength(1);
    });
  });

  describe('newGame', () => {
    it('should reset all game state', () => {
      const { result } = renderHook(() => useWordle());

      act(() => result.current.submitWord('APPLE'));
      expect(result.current.guesses).toHaveLength(1);

      act(() => result.current.newGame());

      expect(result.current.guesses).toEqual([]);
      expect(result.current.currentGuess).toBe('');
      expect(result.current.gameOver).toBe(false);
      expect(result.current.won).toBe(false);
      expect(result.current.message).toBe('');
    });
  });

  describe('getGameState and setGameState', () => {
    it('should return current game state', () => {
      const { result } = renderHook(() => useWordle());

      const state = result.current.getGameState();

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
      const { result } = renderHook(() => useWordle());

      act(() => {
        result.current.setGameState({
          solution: 'HELLO',
          guesses: [{ word: 'WORLD', status: ['absent', 'absent', 'absent', 'correct', 'absent'] }],
          gameOver: false,
          won: false,
          message: '',
        });
      });

      expect(result.current.solution).toBe('HELLO');
      expect(result.current.guesses).toHaveLength(1);
    });
  });

  describe('viewer mode', () => {
    it('should handle viewer guess input separately', () => {
      const { result } = renderHook(() => useWordle({ isViewer: true }));

      act(() => result.current.handleKeyPress('A'));
      act(() => result.current.handleKeyPress('B'));

      expect(result.current.viewerGuess).toBe('AB');
      expect(result.current.currentGuess).toBe('');
    });

    it('should return submit-suggestion on enter in viewer mode', () => {
      const { result } = renderHook(() => useWordle({ isViewer: true }));

      act(() => result.current.handleKeyPress('A'));
      act(() => result.current.handleKeyPress('P'));
      act(() => result.current.handleKeyPress('P'));
      act(() => result.current.handleKeyPress('L'));
      act(() => result.current.handleKeyPress('E'));

      let returnValue: void | 'submit-suggestion';
      act(() => {
        returnValue = result.current.handleKeyPress('ENTER');
      });

      expect(returnValue!).toBe('submit-suggestion');
    });

    it('should clear viewer guess', () => {
      const { result } = renderHook(() => useWordle({ isViewer: true }));

      act(() => result.current.handleKeyPress('A'));
      act(() => result.current.handleKeyPress('P'));
      act(() => result.current.handleKeyPress('P'));
      act(() => result.current.handleKeyPress('L'));
      act(() => result.current.handleKeyPress('E'));

      expect(result.current.viewerGuess).toBe('APPLE');

      act(() => result.current.clearViewerGuess());

      expect(result.current.viewerGuess).toBe('');
    });

    it('should not allow submitWord in viewer mode', () => {
      const { result } = renderHook(() => useWordle({ isViewer: true }));

      let success = true;
      act(() => {
        success = result.current.submitWord('APPLE');
      });

      expect(success).toBe(false);
    });
  });

  describe('callbacks', () => {
    it('should call onStateChange when state changes (host mode)', () => {
      const onStateChange = vi.fn();
      const { result } = renderHook(() => useWordle({ onStateChange }));

      act(() => result.current.handleKeyPress('A'));

      expect(onStateChange).toHaveBeenCalled();
    });

    it('should call onViewerGuessChange when viewer types', () => {
      const onViewerGuessChange = vi.fn();
      renderHook(() => useWordle({ isViewer: true, onViewerGuessChange }));

      expect(onViewerGuessChange).toHaveBeenCalledWith('');
    });
  });
});
