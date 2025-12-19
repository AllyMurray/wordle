import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameSession } from './useGameSession';
import { useGameStore } from '../stores/gameStore';
import { useMultiplayerStore } from '../stores/multiplayerStore';
import { useUIStore } from '../stores/uiStore';
import * as wordsModule from '../data/words';
import * as multiplayerStoreModule from '../stores/multiplayerStore';

// Mock the words module
vi.mock('../data/words', () => ({
  getRandomWord: vi.fn(() => 'CRANE'),
  WORDS: ['crane', 'apple', 'grape', 'lemon', 'melon', 'pearl', 'slate', 'trace', 'arise', 'stare', 'hello', 'world'],
}));

describe('useGameSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(wordsModule.getRandomWord).mockReturnValue('CRANE');

    // Reset all stores to initial state
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

      useMultiplayerStore.setState({
        role: null,
        connectionStatus: 'disconnected',
        sessionCode: '',
        sessionPin: '',
        errorMessage: '',
        partnerConnected: false,
        pendingSuggestion: null,
      });

      useUIStore.setState({
        gameMode: null,
        isStatsOpen: false,
        suggestionStatus: null,
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial return values', () => {
    it('should return correct initial game state', () => {
      const { result } = renderHook(() => useGameSession());

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

    it('should return correct initial multiplayer state', () => {
      const { result } = renderHook(() => useGameSession());

      expect(result.current.isHost).toBe(false);
      expect(result.current.isViewer).toBe(false);
      expect(result.current.partnerConnected).toBe(false);
      expect(result.current.sessionCode).toBe('');
      expect(result.current.sessionPin).toBe('');
      expect(result.current.connectionStatus).toBe('disconnected');
      expect(result.current.errorMessage).toBe('');
      expect(result.current.pendingSuggestion).toBe(null);
    });

    it('should return correct initial UI state', () => {
      const { result } = renderHook(() => useGameSession());

      expect(result.current.gameMode).toBe(null);
      expect(result.current.suggestionStatus).toBe(null);
    });

    it('should return handler functions', () => {
      const { result } = renderHook(() => useGameSession());

      expect(typeof result.current.handleKeyPress).toBe('function');
      expect(typeof result.current.getKeyboardStatus).toBe('function');
      expect(typeof result.current.handlePlaySolo).toBe('function');
      expect(typeof result.current.handleHost).toBe('function');
      expect(typeof result.current.handleJoin).toBe('function');
      expect(typeof result.current.handleLeave).toBe('function');
      expect(typeof result.current.handleNewGame).toBe('function');
      expect(typeof result.current.handleAcceptSuggestion).toBe('function');
      expect(typeof result.current.handleRejectSuggestion).toBe('function');
    });
  });

  describe('handlePlaySolo', () => {
    it('should set game mode to solo', () => {
      const { result } = renderHook(() => useGameSession());

      act(() => {
        result.current.handlePlaySolo();
      });

      expect(result.current.gameMode).toBe('solo');
    });
  });

  describe('handleHost', () => {
    it('should call hostGame and set game mode to multiplayer', () => {
      const hostGameSpy = vi.fn();
      act(() => {
        useMultiplayerStore.setState({ hostGame: hostGameSpy } as unknown as Parameters<typeof useMultiplayerStore.setState>[0]);
      });

      const { result } = renderHook(() => useGameSession());

      act(() => {
        result.current.handleHost();
      });

      expect(hostGameSpy).toHaveBeenCalled();
      expect(result.current.gameMode).toBe('multiplayer');
    });

    it('should pass PIN to hostGame when provided', () => {
      const hostGameSpy = vi.fn();
      act(() => {
        useMultiplayerStore.setState({ hostGame: hostGameSpy } as unknown as Parameters<typeof useMultiplayerStore.setState>[0]);
      });

      const { result } = renderHook(() => useGameSession());

      act(() => {
        result.current.handleHost('1234');
      });

      expect(hostGameSpy).toHaveBeenCalledWith('1234');
    });
  });

  describe('handleJoin', () => {
    it('should call joinGame and set game mode to multiplayer', () => {
      const joinGameSpy = vi.fn();
      act(() => {
        useMultiplayerStore.setState({ joinGame: joinGameSpy } as unknown as Parameters<typeof useMultiplayerStore.setState>[0]);
      });

      const { result } = renderHook(() => useGameSession());

      act(() => {
        result.current.handleJoin('ABC123');
      });

      expect(joinGameSpy).toHaveBeenCalledWith('ABC123', undefined);
      expect(result.current.gameMode).toBe('multiplayer');
    });

    it('should pass code and PIN to joinGame', () => {
      const joinGameSpy = vi.fn();
      act(() => {
        useMultiplayerStore.setState({ joinGame: joinGameSpy } as unknown as Parameters<typeof useMultiplayerStore.setState>[0]);
      });

      const { result } = renderHook(() => useGameSession());

      act(() => {
        result.current.handleJoin('ABC123', '5678');
      });

      expect(joinGameSpy).toHaveBeenCalledWith('ABC123', '5678');
    });
  });

  describe('handleLeave', () => {
    it('should leave session and reset game mode', () => {
      const leaveSessionSpy = vi.fn();
      act(() => {
        useMultiplayerStore.setState({ leaveSession: leaveSessionSpy } as unknown as Parameters<typeof useMultiplayerStore.setState>[0]);
        useUIStore.setState({ gameMode: 'multiplayer' });
      });

      const { result } = renderHook(() => useGameSession());

      act(() => {
        result.current.handleLeave();
      });

      expect(leaveSessionSpy).toHaveBeenCalled();
      expect(result.current.gameMode).toBe(null);
    });

    it('should start a new game on leave', () => {
      act(() => {
        useUIStore.setState({ gameMode: 'multiplayer' });
        useGameStore.setState({
          guesses: [{ word: 'APPLE', status: ['absent', 'absent', 'absent', 'absent', 'present'] }],
          currentGuess: 'TEST',
        });
      });

      const { result } = renderHook(() => useGameSession());

      act(() => {
        result.current.handleLeave();
      });

      expect(result.current.guesses).toEqual([]);
      expect(result.current.currentGuess).toBe('');
    });
  });

  describe('handleNewGame', () => {
    it('should reset game state', () => {
      act(() => {
        useGameStore.setState({
          guesses: [{ word: 'APPLE', status: ['absent', 'absent', 'absent', 'absent', 'present'] }],
          currentGuess: 'GR',
          gameOver: true,
          won: false,
          message: 'The word was CRANE',
        });
      });

      const { result } = renderHook(() => useGameSession());

      act(() => {
        result.current.handleNewGame();
      });

      expect(result.current.guesses).toEqual([]);
      expect(result.current.currentGuess).toBe('');
      expect(result.current.gameOver).toBe(false);
      expect(result.current.message).toBe('');
    });
  });

  describe('handleKeyPress - host mode', () => {
    beforeEach(() => {
      act(() => {
        useMultiplayerStore.setState({ role: 'host' });
        useUIStore.setState({ gameMode: 'solo' });
      });
    });

    it('should add letter to current guess', () => {
      const { result } = renderHook(() => useGameSession());

      act(() => {
        result.current.handleKeyPress('A');
      });

      expect(result.current.currentGuess).toBe('A');
    });

    it('should add multiple letters', () => {
      const { result } = renderHook(() => useGameSession());

      act(() => result.current.handleKeyPress('A'));
      act(() => result.current.handleKeyPress('P'));
      act(() => result.current.handleKeyPress('P'));

      expect(result.current.currentGuess).toBe('APP');
    });

    it('should not add more than 5 letters', () => {
      const { result } = renderHook(() => useGameSession());

      'APPLE'.split('').forEach((letter) => {
        act(() => result.current.handleKeyPress(letter));
      });
      act(() => result.current.handleKeyPress('X'));

      expect(result.current.currentGuess).toBe('APPLE');
    });

    it('should remove letter on BACKSPACE', () => {
      const { result } = renderHook(() => useGameSession());

      act(() => result.current.handleKeyPress('A'));
      act(() => result.current.handleKeyPress('P'));
      act(() => result.current.handleKeyPress('BACKSPACE'));

      expect(result.current.currentGuess).toBe('A');
    });

    it('should submit guess on ENTER with valid word', () => {
      const { result } = renderHook(() => useGameSession());

      'APPLE'.split('').forEach((letter) => {
        act(() => result.current.handleKeyPress(letter));
      });
      act(() => result.current.handleKeyPress('ENTER'));

      expect(result.current.guesses).toHaveLength(1);
      expect(result.current.guesses[0]?.word).toBe('APPLE');
      expect(result.current.currentGuess).toBe('');
    });

    it('should reject invalid word on ENTER', () => {
      const { result } = renderHook(() => useGameSession());

      'XXXXX'.split('').forEach((letter) => {
        act(() => result.current.handleKeyPress(letter));
      });
      act(() => result.current.handleKeyPress('ENTER'));

      expect(result.current.guesses).toHaveLength(0);
      expect(result.current.message).toBe('Not in word list');
    });

    it('should reject short word on ENTER', () => {
      const { result } = renderHook(() => useGameSession());

      act(() => {
        result.current.handleKeyPress('A');
        result.current.handleKeyPress('P');
        result.current.handleKeyPress('ENTER');
      });

      expect(result.current.guesses).toHaveLength(0);
      expect(result.current.message).toBe('Not enough letters');
    });

    it('should not accept input when game is over', () => {
      act(() => {
        useGameStore.setState({ gameOver: true });
      });

      const { result } = renderHook(() => useGameSession());

      act(() => {
        result.current.handleKeyPress('A');
      });

      expect(result.current.currentGuess).toBe('');
    });
  });

  describe('handleKeyPress - viewer mode', () => {
    beforeEach(() => {
      act(() => {
        useMultiplayerStore.setState({ role: 'viewer' });
        useUIStore.setState({ gameMode: 'multiplayer' });
      });
    });

    it('should add letter to viewer guess', () => {
      const { result } = renderHook(() => useGameSession());

      act(() => {
        result.current.handleKeyPress('A');
      });

      expect(result.current.viewerGuess).toBe('A');
    });

    it('should remove letter on BACKSPACE', () => {
      const { result } = renderHook(() => useGameSession());

      act(() => result.current.handleKeyPress('A'));
      act(() => result.current.handleKeyPress('P'));
      act(() => result.current.handleKeyPress('BACKSPACE'));

      expect(result.current.viewerGuess).toBe('A');
    });

    it('should return submit-suggestion on ENTER', () => {
      const { result } = renderHook(() => useGameSession());

      let returnValue: void | 'submit-suggestion';
      act(() => {
        returnValue = result.current.handleKeyPress('ENTER');
      });

      expect(returnValue!).toBe('submit-suggestion');
    });

    it('should send suggestion when valid 5-letter word is typed', () => {
      const sendSuggestionSpy = vi.fn();
      act(() => {
        useMultiplayerStore.setState({
          role: 'viewer',
          sendSuggestion: sendSuggestionSpy,
        } as unknown as Parameters<typeof useMultiplayerStore.setState>[0]);
      });

      const { result } = renderHook(() => useGameSession());

      'APPLE'.split('').forEach((letter) => {
        act(() => result.current.handleKeyPress(letter));
      });

      expect(sendSuggestionSpy).toHaveBeenCalledWith('APPLE');
    });

    it('should set suggestion status to invalid for non-word', () => {
      const clearSuggestionSpy = vi.fn();
      act(() => {
        useMultiplayerStore.setState({
          role: 'viewer',
          clearSuggestion: clearSuggestionSpy,
        } as unknown as Parameters<typeof useMultiplayerStore.setState>[0]);
      });

      const { result } = renderHook(() => useGameSession());

      'XXXXX'.split('').forEach((letter) => {
        act(() => result.current.handleKeyPress(letter));
      });

      expect(result.current.suggestionStatus).toBe('invalid');
      expect(clearSuggestionSpy).toHaveBeenCalled();
    });

    it('should not add input when game is over', () => {
      act(() => {
        useGameStore.setState({ gameOver: true });
      });

      const { result } = renderHook(() => useGameSession());

      act(() => {
        result.current.handleKeyPress('A');
      });

      expect(result.current.viewerGuess).toBe('');
    });
  });

  describe('handleAcceptSuggestion', () => {
    it('should accept suggestion and submit word', () => {
      const acceptSuggestionSpy = vi.fn(() => 'APPLE');
      act(() => {
        useMultiplayerStore.setState({
          role: 'host',
          acceptSuggestion: acceptSuggestionSpy,
          pendingSuggestion: { word: 'APPLE' },
        } as unknown as Parameters<typeof useMultiplayerStore.setState>[0]);
      });

      const { result } = renderHook(() => useGameSession());

      act(() => {
        result.current.handleAcceptSuggestion();
      });

      expect(acceptSuggestionSpy).toHaveBeenCalled();
      expect(result.current.guesses).toHaveLength(1);
      expect(result.current.guesses[0]?.word).toBe('APPLE');
    });

    it('should not submit if acceptSuggestion returns null', () => {
      const acceptSuggestionSpy = vi.fn(() => null);
      act(() => {
        useMultiplayerStore.setState({
          role: 'host',
          acceptSuggestion: acceptSuggestionSpy,
        } as unknown as Parameters<typeof useMultiplayerStore.setState>[0]);
      });

      const { result } = renderHook(() => useGameSession());

      act(() => {
        result.current.handleAcceptSuggestion();
      });

      expect(result.current.guesses).toHaveLength(0);
    });
  });

  describe('handleRejectSuggestion', () => {
    it('should call rejectSuggestion', () => {
      const rejectSuggestionSpy = vi.fn();
      act(() => {
        useMultiplayerStore.setState({
          role: 'host',
          rejectSuggestion: rejectSuggestionSpy,
          pendingSuggestion: { word: 'APPLE' },
        } as unknown as Parameters<typeof useMultiplayerStore.setState>[0]);
      });

      const { result } = renderHook(() => useGameSession());

      act(() => {
        result.current.handleRejectSuggestion();
      });

      expect(rejectSuggestionSpy).toHaveBeenCalled();
    });
  });

  describe('role-based properties', () => {
    it('should set isHost to true when role is host', () => {
      act(() => {
        useMultiplayerStore.setState({ role: 'host' });
      });

      const { result } = renderHook(() => useGameSession());

      expect(result.current.isHost).toBe(true);
      expect(result.current.isViewer).toBe(false);
    });

    it('should set isViewer to true when role is viewer', () => {
      act(() => {
        useMultiplayerStore.setState({ role: 'viewer' });
      });

      const { result } = renderHook(() => useGameSession());

      expect(result.current.isHost).toBe(false);
      expect(result.current.isViewer).toBe(true);
    });

    it('should sync isViewer with game store', () => {
      act(() => {
        useMultiplayerStore.setState({ role: 'viewer' });
      });

      renderHook(() => useGameSession());

      expect(useGameStore.getState().isViewer).toBe(true);
    });
  });

  describe('getKeyboardStatus', () => {
    it('should return keyboard status from game store', () => {
      const { result } = renderHook(() => useGameSession());

      act(() => {
        // Submit a guess to create some keyboard status
        useGameStore.getState().setCurrentGuess('APPLE');
        useGameStore.getState().submitGuess();
      });

      const status = result.current.getKeyboardStatus();

      expect(status['A']).toBeDefined();
      expect(status['P']).toBeDefined();
      expect(status['L']).toBeDefined();
      expect(status['E']).toBeDefined();
    });
  });

  describe('keyboard event handling', () => {
    it('should add keyboard listener when game mode is set', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      act(() => {
        useUIStore.setState({ gameMode: 'solo' });
      });

      renderHook(() => useGameSession());

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should remove keyboard listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      act(() => {
        useUIStore.setState({ gameMode: 'solo' });
      });

      const { unmount } = renderHook(() => useGameSession());
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should not add keyboard listener when game mode is null', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      addEventListenerSpy.mockClear();

      act(() => {
        useUIStore.setState({ gameMode: null });
      });

      renderHook(() => useGameSession());

      const keydownCalls = addEventListenerSpy.mock.calls.filter(
        (call) => call[0] === 'keydown'
      );
      expect(keydownCalls).toHaveLength(0);
    });
  });

  describe('game state callback registration', () => {
    it('should register game state callback for viewer', () => {
      const registerSpy = vi.spyOn(multiplayerStoreModule, 'registerGameStateCallback');

      act(() => {
        useMultiplayerStore.setState({ role: 'viewer' });
      });

      renderHook(() => useGameSession());

      expect(registerSpy).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should register suggestion response callback for viewer', () => {
      const registerSpy = vi.spyOn(multiplayerStoreModule, 'registerSuggestionResponseCallback');

      act(() => {
        useMultiplayerStore.setState({ role: 'viewer' });
      });

      renderHook(() => useGameSession());

      expect(registerSpy).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('host game state sync', () => {
    it('should send game state when partner connects', () => {
      const sendGameStateSpy = vi.fn();
      act(() => {
        useMultiplayerStore.setState({
          role: 'host',
          partnerConnected: false,
          sendGameState: sendGameStateSpy,
        } as unknown as Parameters<typeof useMultiplayerStore.setState>[0]);
      });

      renderHook(() => useGameSession());

      // Partner connects
      act(() => {
        useMultiplayerStore.setState({ partnerConnected: true });
      });

      expect(sendGameStateSpy).toHaveBeenCalled();
    });
  });

  describe('winning and losing', () => {
    it('should update won and gameOver when winning', () => {
      const { result } = renderHook(() => useGameSession());

      // Guess the correct word
      'CRANE'.split('').forEach((letter) => {
        act(() => result.current.handleKeyPress(letter));
      });
      act(() => result.current.handleKeyPress('ENTER'));

      expect(result.current.won).toBe(true);
      expect(result.current.gameOver).toBe(true);
    });

    it('should update gameOver after 6 incorrect guesses', () => {
      const { result } = renderHook(() => useGameSession());
      const words = ['APPLE', 'GRAPE', 'LEMON', 'MELON', 'PEARL', 'SLATE'];

      act(() => {
        words.forEach((word) => {
          useGameStore.getState().setCurrentGuess(word);
          useGameStore.getState().submitGuess();
        });
      });

      expect(result.current.gameOver).toBe(true);
      expect(result.current.won).toBe(false);
    });
  });
});
