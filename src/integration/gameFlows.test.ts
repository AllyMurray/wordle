import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameSession } from '../hooks/useGameSession';
import { useGameStore } from '../stores/gameStore';
import { useMultiplayerStore } from '../stores/multiplayerStore';
import { useStatsStore } from '../stores/statsStore';
import { useUIStore } from '../stores/uiStore';
import * as wordsModule from '../data/words';

/**
 * Integration tests for complete user flows.
 * These tests simulate real user interactions through the game session
 * without requiring a browser (lighter-weight than E2E tests).
 */

// Mock the words module with a known word list
vi.mock('../data/words', () => ({
  getRandomWord: vi.fn(() => 'CRANE'),
  WORDS: [
    'crane', 'apple', 'grape', 'lemon', 'melon', 'pearl', 'slate',
    'trace', 'arise', 'stare', 'hello', 'world', 'plane', 'train',
    'brain', 'drain', 'grain', 'plain', 'spain', 'chain',
  ],
}));

// Type for the result object from renderHook
type GameSessionResult = { current: ReturnType<typeof useGameSession> };

// Helper to type a word character by character (each keystroke in separate act)
// Takes the result object so we get fresh handleKeyPress reference in each act
const typeWord = (result: GameSessionResult, word: string): void => {
  word.split('').forEach((letter) => {
    act(() => {
      result.current.handleKeyPress(letter);
    });
  });
};

// Helper to submit a word (type + enter)
const submitWord = (result: GameSessionResult, word: string): void => {
  typeWord(result, word);
  act(() => {
    result.current.handleKeyPress('ENTER');
  });
};

describe('Integration: Solo Game Completion Flow', () => {
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

      useStatsStore.setState({
        stats: {
          gamesPlayed: 0,
          gamesWon: 0,
          currentStreak: 0,
          maxStreak: 0,
          guessDistribution: [0, 0, 0, 0, 0, 0],
          lastGameDate: null,
          soloGamesPlayed: 0,
          multiplayerGamesPlayed: 0,
        },
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should complete a winning game in 1 guess', () => {
    const { result } = renderHook(() => useGameSession());

    // Start solo game
    act(() => {
      result.current.handlePlaySolo();
    });
    expect(result.current.gameMode).toBe('solo');

    // Guess the correct word immediately
    submitWord(result,'CRANE');

    expect(result.current.won).toBe(true);
    expect(result.current.gameOver).toBe(true);
    expect(result.current.guesses).toHaveLength(1);
    expect(result.current.guesses[0]?.word).toBe('CRANE');
    expect(result.current.guesses[0]?.status).toEqual([
      'correct', 'correct', 'correct', 'correct', 'correct',
    ]);
    expect(result.current.message).toBe('Excellent!');
  });

  it('should complete a winning game in multiple guesses', () => {
    const { result } = renderHook(() => useGameSession());

    // Start solo game
    act(() => {
      result.current.handlePlaySolo();
    });

    // First guess - wrong word
    submitWord(result,'APPLE');
    expect(result.current.guesses).toHaveLength(1);
    expect(result.current.gameOver).toBe(false);

    // Second guess - shares some letters with CRANE
    submitWord(result,'TRACE');
    expect(result.current.guesses).toHaveLength(2);
    expect(result.current.gameOver).toBe(false);

    // Third guess - correct!
    submitWord(result,'CRANE');
    expect(result.current.won).toBe(true);
    expect(result.current.gameOver).toBe(true);
    expect(result.current.guesses).toHaveLength(3);
  });

  it('should complete a losing game after 6 wrong guesses', () => {
    const { result } = renderHook(() => useGameSession());

    // Start solo game
    act(() => {
      result.current.handlePlaySolo();
    });

    // Make 6 wrong guesses
    const wrongWords = ['APPLE', 'GRAPE', 'LEMON', 'MELON', 'PEARL', 'SLATE'];
    wrongWords.forEach((word) => {
      submitWord(result,word);
    });

    expect(result.current.won).toBe(false);
    expect(result.current.gameOver).toBe(true);
    expect(result.current.guesses).toHaveLength(6);
    expect(result.current.message).toBe('The word was CRANE');
  });

  it('should track letter statuses correctly across guesses', () => {
    const { result } = renderHook(() => useGameSession());

    act(() => {
      result.current.handlePlaySolo();
    });

    // Guess "TRACE" - T absent, R present, A present, C present, E correct
    submitWord(result,'TRACE');

    const guess = result.current.guesses[0];
    expect(guess?.word).toBe('TRACE');
    // TRACE vs CRANE:
    // T (pos 0) is not in CRANE -> absent
    // R (pos 1) is at position 1 in CRANE -> correct
    // A (pos 2) is at position 2 in CRANE -> correct
    // C (pos 3) is at position 0 in CRANE -> present (wrong position)
    // E (pos 4) is at position 4 in CRANE -> correct
    expect(guess?.status).toEqual(['absent', 'correct', 'correct', 'present', 'correct']);

    // Check keyboard status reflects the guess
    const keyboardStatus = result.current.getKeyboardStatus();
    expect(keyboardStatus['T']).toBe('absent');
    expect(keyboardStatus['R']).toBe('correct');
    expect(keyboardStatus['A']).toBe('correct');
    expect(keyboardStatus['C']).toBe('present');
    expect(keyboardStatus['E']).toBe('correct');
  });

  it('should handle backspace during input', () => {
    const { result } = renderHook(() => useGameSession());

    act(() => {
      result.current.handlePlaySolo();
    });

    // Type "APP" then backspace then "LE"
    act(() => result.current.handleKeyPress('A'));
    act(() => result.current.handleKeyPress('P'));
    act(() => result.current.handleKeyPress('P'));
    act(() => result.current.handleKeyPress('BACKSPACE'));
    act(() => result.current.handleKeyPress('L'));
    act(() => result.current.handleKeyPress('E'));

    expect(result.current.currentGuess).toBe('APLE');
  });

  it('should reject invalid words', () => {
    const { result } = renderHook(() => useGameSession());

    act(() => {
      result.current.handlePlaySolo();
    });

    // Try to submit "XXXXX" which is not in word list
    submitWord(result,'XXXXX');

    expect(result.current.guesses).toHaveLength(0);
    expect(result.current.message).toBe('Not in word list');
    expect(result.current.shake).toBe(true);
  });

  it('should reject incomplete words', () => {
    const { result } = renderHook(() => useGameSession());

    act(() => {
      result.current.handlePlaySolo();
    });

    // Try to submit "APP" (only 3 letters)
    typeWord(result,'APP');
    act(() => result.current.handleKeyPress('ENTER'));

    expect(result.current.guesses).toHaveLength(0);
    expect(result.current.message).toBe('Not enough letters');
  });

  it('should allow starting a new game after completion', () => {
    const { result } = renderHook(() => useGameSession());

    // Play and win a game
    act(() => {
      result.current.handlePlaySolo();
    });
    submitWord(result,'CRANE');
    expect(result.current.gameOver).toBe(true);

    // Start new game
    act(() => {
      result.current.handleNewGame();
    });

    expect(result.current.gameOver).toBe(false);
    expect(result.current.won).toBe(false);
    expect(result.current.guesses).toHaveLength(0);
    expect(result.current.currentGuess).toBe('');
    expect(result.current.message).toBe('');
  });

  it('should allow returning to lobby mid-game', () => {
    const { result } = renderHook(() => useGameSession());

    // Start game and make a guess
    act(() => {
      result.current.handlePlaySolo();
    });
    submitWord(result,'APPLE');
    expect(result.current.guesses).toHaveLength(1);

    // Leave game
    act(() => {
      result.current.handleLeave();
    });

    expect(result.current.gameMode).toBe(null);
    expect(result.current.guesses).toHaveLength(0);
  });
});

describe('Integration: Statistics Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(wordsModule.getRandomWord).mockReturnValue('CRANE');

    // Reset all stores
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

      useStatsStore.setState({
        stats: {
          gamesPlayed: 0,
          gamesWon: 0,
          currentStreak: 0,
          maxStreak: 0,
          guessDistribution: [0, 0, 0, 0, 0, 0],
          lastGameDate: null,
          soloGamesPlayed: 0,
          multiplayerGamesPlayed: 0,
        },
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should record a winning game correctly', () => {
    // Record a win in 3 guesses
    act(() => {
      useStatsStore.getState().recordGame(true, 3, 'solo');
    });

    const stats = useStatsStore.getState().stats;
    expect(stats.gamesPlayed).toBe(1);
    expect(stats.gamesWon).toBe(1);
    expect(stats.soloGamesPlayed).toBe(1);
    expect(stats.guessDistribution[2]).toBe(1); // Index 2 = 3 guesses
    expect(stats.currentStreak).toBe(1);
    expect(stats.maxStreak).toBe(1);
  });

  it('should record a losing game correctly', () => {
    act(() => {
      useStatsStore.getState().recordGame(false, 6, 'solo');
    });

    const stats = useStatsStore.getState().stats;
    expect(stats.gamesPlayed).toBe(1);
    expect(stats.gamesWon).toBe(0);
    expect(stats.currentStreak).toBe(0);
    expect(stats.guessDistribution).toEqual([0, 0, 0, 0, 0, 0]); // No distribution for losses
  });

  it('should track guess distribution across multiple games', () => {
    // Win in 1 guess
    act(() => {
      useStatsStore.getState().recordGame(true, 1, 'solo');
    });
    // Win in 3 guesses
    act(() => {
      useStatsStore.getState().recordGame(true, 3, 'solo');
    });
    // Win in 6 guesses
    act(() => {
      useStatsStore.getState().recordGame(true, 6, 'solo');
    });
    // Win in 3 guesses again
    act(() => {
      useStatsStore.getState().recordGame(true, 3, 'solo');
    });

    const stats = useStatsStore.getState().stats;
    expect(stats.gamesPlayed).toBe(4);
    expect(stats.gamesWon).toBe(4);
    expect(stats.guessDistribution[0]).toBe(1); // 1 game won in 1 guess
    expect(stats.guessDistribution[2]).toBe(2); // 2 games won in 3 guesses
    expect(stats.guessDistribution[5]).toBe(1); // 1 game won in 6 guesses
  });

  it('should track multiplayer games separately from solo', () => {
    act(() => {
      useStatsStore.getState().recordGame(true, 4, 'solo');
    });
    act(() => {
      useStatsStore.getState().recordGame(true, 2, 'multiplayer');
    });
    act(() => {
      useStatsStore.getState().recordGame(false, 6, 'multiplayer');
    });

    const stats = useStatsStore.getState().stats;
    expect(stats.gamesPlayed).toBe(3);
    expect(stats.soloGamesPlayed).toBe(1);
    expect(stats.multiplayerGamesPlayed).toBe(2);
  });

  it('should reset streak on loss', () => {
    // Build a streak
    act(() => {
      useStatsStore.getState().recordGame(true, 3, 'solo');
    });

    let stats = useStatsStore.getState().stats;
    expect(stats.currentStreak).toBe(1);

    // Lose a game
    act(() => {
      useStatsStore.getState().recordGame(false, 6, 'solo');
    });

    stats = useStatsStore.getState().stats;
    expect(stats.currentStreak).toBe(0);
    expect(stats.maxStreak).toBe(1); // Max streak preserved
  });

  it('should calculate win percentage correctly', () => {
    // Win 3, lose 1
    act(() => {
      useStatsStore.getState().recordGame(true, 2, 'solo');
      useStatsStore.getState().recordGame(true, 4, 'solo');
      useStatsStore.getState().recordGame(false, 6, 'solo');
      useStatsStore.getState().recordGame(true, 3, 'solo');
    });

    const stats = useStatsStore.getState().stats;
    const winPercentage = Math.round((stats.gamesWon / stats.gamesPlayed) * 100);
    expect(winPercentage).toBe(75); // 3/4 = 75%
  });

  it('should reset statistics correctly', () => {
    // Play some games
    act(() => {
      useStatsStore.getState().recordGame(true, 3, 'solo');
      useStatsStore.getState().recordGame(true, 4, 'multiplayer');
    });

    // Reset
    act(() => {
      useStatsStore.getState().resetStats();
    });

    const stats = useStatsStore.getState().stats;
    expect(stats.gamesPlayed).toBe(0);
    expect(stats.gamesWon).toBe(0);
    expect(stats.currentStreak).toBe(0);
    expect(stats.maxStreak).toBe(0);
    expect(stats.guessDistribution).toEqual([0, 0, 0, 0, 0, 0]);
    expect(stats.soloGamesPlayed).toBe(0);
    expect(stats.multiplayerGamesPlayed).toBe(0);
  });
});

describe('Integration: Multiplayer Host/Join Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(wordsModule.getRandomWord).mockReturnValue('CRANE');

    // Reset all stores
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

      useStatsStore.setState({
        stats: {
          gamesPlayed: 0,
          gamesWon: 0,
          currentStreak: 0,
          maxStreak: 0,
          guessDistribution: [0, 0, 0, 0, 0, 0],
          lastGameDate: null,
          soloGamesPlayed: 0,
          multiplayerGamesPlayed: 0,
        },
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should set up host mode correctly', () => {
    const mockHostGame = vi.fn();
    act(() => {
      useMultiplayerStore.setState({
        hostGame: mockHostGame,
      } as unknown as Parameters<typeof useMultiplayerStore.setState>[0]);
    });

    const { result } = renderHook(() => useGameSession());

    act(() => {
      result.current.handleHost();
    });

    expect(mockHostGame).toHaveBeenCalled();
    expect(result.current.gameMode).toBe('multiplayer');
  });

  it('should set up host mode with PIN', () => {
    const mockHostGame = vi.fn();
    act(() => {
      useMultiplayerStore.setState({
        hostGame: mockHostGame,
      } as unknown as Parameters<typeof useMultiplayerStore.setState>[0]);
    });

    const { result } = renderHook(() => useGameSession());

    act(() => {
      result.current.handleHost('1234');
    });

    expect(mockHostGame).toHaveBeenCalledWith('1234');
  });

  it('should set up join mode correctly', () => {
    const mockJoinGame = vi.fn();
    act(() => {
      useMultiplayerStore.setState({
        joinGame: mockJoinGame,
      } as unknown as Parameters<typeof useMultiplayerStore.setState>[0]);
    });

    const { result } = renderHook(() => useGameSession());

    act(() => {
      result.current.handleJoin('ABCDEF-123456');
    });

    expect(mockJoinGame).toHaveBeenCalledWith('ABCDEF-123456', undefined);
    expect(result.current.gameMode).toBe('multiplayer');
  });

  it('should set up join mode with PIN', () => {
    const mockJoinGame = vi.fn();
    act(() => {
      useMultiplayerStore.setState({
        joinGame: mockJoinGame,
      } as unknown as Parameters<typeof useMultiplayerStore.setState>[0]);
    });

    const { result } = renderHook(() => useGameSession());

    act(() => {
      result.current.handleJoin('ABCDEF-123456', '5678');
    });

    expect(mockJoinGame).toHaveBeenCalledWith('ABCDEF-123456', '5678');
  });

  it('should handle host receiving viewer suggestion', () => {
    const mockAcceptSuggestion = vi.fn(() => 'APPLE');
    const mockRejectSuggestion = vi.fn();

    act(() => {
      useMultiplayerStore.setState({
        role: 'host',
        partnerConnected: true,
        pendingSuggestion: { word: 'APPLE' },
        acceptSuggestion: mockAcceptSuggestion,
        rejectSuggestion: mockRejectSuggestion,
      } as unknown as Parameters<typeof useMultiplayerStore.setState>[0]);
      useUIStore.setState({ gameMode: 'multiplayer' });
    });

    const { result } = renderHook(() => useGameSession());

    // Host sees pending suggestion
    expect(result.current.pendingSuggestion).toEqual({ word: 'APPLE' });

    // Host accepts suggestion
    act(() => {
      result.current.handleAcceptSuggestion();
    });

    expect(mockAcceptSuggestion).toHaveBeenCalled();
    expect(result.current.guesses).toHaveLength(1);
    expect(result.current.guesses[0]?.word).toBe('APPLE');
  });

  it('should handle host rejecting viewer suggestion', () => {
    const mockRejectSuggestion = vi.fn();

    act(() => {
      useMultiplayerStore.setState({
        role: 'host',
        partnerConnected: true,
        pendingSuggestion: { word: 'APPLE' },
        rejectSuggestion: mockRejectSuggestion,
      } as unknown as Parameters<typeof useMultiplayerStore.setState>[0]);
      useUIStore.setState({ gameMode: 'multiplayer' });
    });

    const { result } = renderHook(() => useGameSession());

    act(() => {
      result.current.handleRejectSuggestion();
    });

    expect(mockRejectSuggestion).toHaveBeenCalled();
  });

  it('should handle viewer typing suggestions', () => {
    const mockSendSuggestion = vi.fn();

    act(() => {
      useMultiplayerStore.setState({
        role: 'viewer',
        connectionStatus: 'connected',
        partnerConnected: true,
        sendSuggestion: mockSendSuggestion,
      } as unknown as Parameters<typeof useMultiplayerStore.setState>[0]);
      useUIStore.setState({ gameMode: 'multiplayer' });
    });

    const { result } = renderHook(() => useGameSession());

    // Viewer types a word
    typeWord(result,'APPLE');

    expect(result.current.viewerGuess).toBe('APPLE');
    expect(mockSendSuggestion).toHaveBeenCalledWith('APPLE');
  });

  it('should set invalid status for non-dictionary words', () => {
    const mockClearSuggestion = vi.fn();

    act(() => {
      useMultiplayerStore.setState({
        role: 'viewer',
        connectionStatus: 'connected',
        clearSuggestion: mockClearSuggestion,
      } as unknown as Parameters<typeof useMultiplayerStore.setState>[0]);
      useUIStore.setState({ gameMode: 'multiplayer' });
    });

    const { result } = renderHook(() => useGameSession());

    // Viewer types an invalid word
    typeWord(result,'XXXXX');

    expect(result.current.suggestionStatus).toBe('invalid');
    expect(mockClearSuggestion).toHaveBeenCalled();
  });

  it('should leave multiplayer session correctly', () => {
    const mockLeaveSession = vi.fn();

    act(() => {
      useMultiplayerStore.setState({
        role: 'host',
        connectionStatus: 'connected',
        sessionCode: 'ABCDEF-123456',
        leaveSession: mockLeaveSession,
      } as unknown as Parameters<typeof useMultiplayerStore.setState>[0]);
      useUIStore.setState({ gameMode: 'multiplayer' });
    });

    const { result } = renderHook(() => useGameSession());

    act(() => {
      result.current.handleLeave();
    });

    expect(mockLeaveSession).toHaveBeenCalled();
    expect(result.current.gameMode).toBe(null);
  });

  it('should sync game state to viewer', () => {
    const mockSendGameState = vi.fn();

    act(() => {
      useMultiplayerStore.setState({
        role: 'host',
        partnerConnected: false,
        sendGameState: mockSendGameState,
      } as unknown as Parameters<typeof useMultiplayerStore.setState>[0]);
      useUIStore.setState({ gameMode: 'multiplayer' });
    });

    renderHook(() => useGameSession());

    // Simulate partner connecting
    act(() => {
      useMultiplayerStore.setState({ partnerConnected: true });
    });

    expect(mockSendGameState).toHaveBeenCalled();
  });

  it('should display connection status for host waiting for partner', () => {
    act(() => {
      useMultiplayerStore.setState({
        role: 'host',
        connectionStatus: 'connected',
        sessionCode: 'ABCDEF-123456',
        partnerConnected: false,
      });
      useUIStore.setState({ gameMode: 'multiplayer' });
    });

    const { result } = renderHook(() => useGameSession());

    expect(result.current.isHost).toBe(true);
    expect(result.current.partnerConnected).toBe(false);
    expect(result.current.sessionCode).toBe('ABCDEF-123456');
  });

  it('should display connection status for viewer', () => {
    act(() => {
      useMultiplayerStore.setState({
        role: 'viewer',
        connectionStatus: 'connecting',
      });
      useUIStore.setState({ gameMode: 'multiplayer' });
    });

    const { result } = renderHook(() => useGameSession());

    expect(result.current.isViewer).toBe(true);
    expect(result.current.connectionStatus).toBe('connecting');
  });

  it('should handle viewer receiving game state updates', () => {
    act(() => {
      useMultiplayerStore.setState({ role: 'viewer' });
      useUIStore.setState({ gameMode: 'multiplayer' });
    });

    renderHook(() => useGameSession());

    // Simulate receiving game state update
    act(() => {
      useGameStore.setState({
        guesses: [
          { word: 'APPLE', status: ['absent', 'absent', 'absent', 'absent', 'present'] },
        ],
        currentGuess: '',
        gameOver: false,
        won: false,
        message: '',
      });
    });

    expect(useGameStore.getState().guesses).toHaveLength(1);
  });
});
