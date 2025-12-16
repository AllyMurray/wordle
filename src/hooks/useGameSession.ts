import { useEffect, useCallback } from 'react';
import { WORDS } from '../data/words';
import {
  useGameStore,
  useMultiplayerStore,
  useUIStore,
  registerGameStateCallback,
  registerSuggestionResponseCallback,
  MAX_GUESSES_COUNT,
  WORD_LENGTH_COUNT,
} from '../stores';
import type {
  GameMode,
  SuggestionStatus,
  Guess,
  KeyboardStatus,
} from '../types';

// Return type for useGameSession hook
export interface UseGameSessionReturn {
  // Game state
  gameMode: GameMode;
  guesses: Guess[];
  currentGuess: string;
  viewerGuess: string;
  gameOver: boolean;
  won: boolean;
  shake: boolean;
  message: string;
  maxGuesses: number;
  wordLength: number;
  suggestionStatus: SuggestionStatus;

  // Multiplayer state
  isHost: boolean;
  isViewer: boolean;
  partnerConnected: boolean;
  sessionCode: string;
  sessionPin: string;
  connectionStatus: string;
  errorMessage: string;
  pendingSuggestion: { word: string } | null;

  // Keyboard
  handleKeyPress: (key: string) => void | 'submit-suggestion';
  getKeyboardStatus: () => KeyboardStatus;

  // Game session actions
  handlePlaySolo: () => void;
  handleHost: (pin?: string) => void;
  handleJoin: (code: string, pin?: string) => void;
  handleLeave: () => void;
  handleNewGame: () => void;
  handleAcceptSuggestion: () => void;
  handleRejectSuggestion: () => void;
}

/**
 * Main game session orchestration hook.
 *
 * This hook coordinates between the game store, multiplayer store, and UI store.
 * It's been refactored to use Zustand stores instead of the previous
 * useWordle/useMultiplayer hooks.
 *
 * Key changes from previous implementation:
 * - Uses store selectors instead of hook return values
 * - Registers callbacks directly with multiplayerStore module
 * - No more useRef patterns for callbacks
 */
export const useGameSession = (): UseGameSessionReturn => {
  // Game store
  const solution = useGameStore((s) => s.solution);
  const guesses = useGameStore((s) => s.guesses);
  const currentGuess = useGameStore((s) => s.currentGuess);
  const viewerGuess = useGameStore((s) => s.viewerGuess);
  const gameOver = useGameStore((s) => s.gameOver);
  const won = useGameStore((s) => s.won);
  const shake = useGameStore((s) => s.shake);
  const message = useGameStore((s) => s.message);

  const setCurrentGuess = useGameStore((s) => s.setCurrentGuess);
  const setViewerGuess = useGameStore((s) => s.setViewerGuess);
  const clearViewerGuess = useGameStore((s) => s.clearViewerGuess);
  const submitGuess = useGameStore((s) => s.submitGuess);
  const submitWord = useGameStore((s) => s.submitWord);
  const newGame = useGameStore((s) => s.newGame);
  const setIsViewer = useGameStore((s) => s.setIsViewer);
  const getGameState = useGameStore((s) => s.getGameState);
  const setGameState = useGameStore((s) => s.setGameState);
  const getKeyboardStatus = useGameStore((s) => s.getKeyboardStatus);

  // Multiplayer store
  const role = useMultiplayerStore((s) => s.role);
  const sessionCode = useMultiplayerStore((s) => s.sessionCode);
  const sessionPin = useMultiplayerStore((s) => s.sessionPin);
  const connectionStatus = useMultiplayerStore((s) => s.connectionStatus);
  const errorMessage = useMultiplayerStore((s) => s.errorMessage);
  const partnerConnected = useMultiplayerStore((s) => s.partnerConnected);
  const pendingSuggestion = useMultiplayerStore((s) => s.pendingSuggestion);

  const hostGame = useMultiplayerStore((s) => s.hostGame);
  const joinGame = useMultiplayerStore((s) => s.joinGame);
  const leaveSession = useMultiplayerStore((s) => s.leaveSession);
  const sendGameState = useMultiplayerStore((s) => s.sendGameState);
  const sendSuggestion = useMultiplayerStore((s) => s.sendSuggestion);
  const clearSuggestion = useMultiplayerStore((s) => s.clearSuggestion);
  const acceptSuggestion = useMultiplayerStore((s) => s.acceptSuggestion);
  const rejectSuggestion = useMultiplayerStore((s) => s.rejectSuggestion);

  // UI store
  const gameMode = useUIStore((s) => s.gameMode);
  const setGameMode = useUIStore((s) => s.setGameMode);
  const suggestionStatus = useUIStore((s) => s.suggestionStatus);
  const setSuggestionStatus = useUIStore((s) => s.setSuggestionStatus);

  const isHost = role === 'host';
  const isViewer = role === 'viewer';

  // Update game store's isViewer state when role changes
  useEffect(() => {
    setIsViewer(isViewer);
  }, [isViewer, setIsViewer]);

  // Handle viewer guess changes - validate and send to host as suggestion
  const handleViewerGuessChange = useCallback(
    (guess: string): void => {
      if (guess.length === WORD_LENGTH_COUNT) {
        if (WORDS.includes(guess.toLowerCase())) {
          setSuggestionStatus(null);
          sendSuggestion(guess);
        } else {
          setSuggestionStatus('invalid');
          clearSuggestion();
        }
      } else {
        setSuggestionStatus(null);
        clearSuggestion();
      }
    },
    [sendSuggestion, clearSuggestion, setSuggestionStatus]
  );

  // Register callback for receiving game state (viewer)
  useEffect(() => {
    if (isViewer) {
      registerGameStateCallback((state) => {
        setGameState(state);
        clearViewerGuess();
        setSuggestionStatus(null);
      });
    }
  }, [isViewer, setGameState, clearViewerGuess, setSuggestionStatus]);

  // Register callback for suggestion responses (viewer)
  useEffect(() => {
    if (isViewer) {
      registerSuggestionResponseCallback((accepted) => {
        setSuggestionStatus(accepted ? 'accepted' : 'rejected');
        if (!accepted) {
          clearViewerGuess();
        }
        setTimeout(() => setSuggestionStatus(null), 1500);
      });
    }
  }, [isViewer, clearViewerGuess, setSuggestionStatus]);

  // Send initial state when viewer connects (host)
  useEffect(() => {
    if (isHost && partnerConnected) {
      sendGameState(getGameState());
    }
  }, [isHost, partnerConnected, sendGameState, getGameState]);

  // Send game state updates when game state changes (host)
  useEffect(() => {
    if (isHost && partnerConnected) {
      sendGameState(getGameState());
    }
    // Only trigger on actual game state changes, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solution, guesses, currentGuess, gameOver, won, message]);

  // Handle key press (both host and viewer)
  const handleKeyPress = useCallback(
    (key: string): void | 'submit-suggestion' => {
      if (gameOver) return;

      // Viewer typing for suggestions
      if (isViewer) {
        if (key === 'ENTER') {
          return 'submit-suggestion';
        } else if (key === 'BACKSPACE') {
          const newGuess = viewerGuess.slice(0, -1);
          setViewerGuess(newGuess);
          handleViewerGuessChange(newGuess);
        } else if (viewerGuess.length < WORD_LENGTH_COUNT && /^[A-Z]$/.test(key)) {
          const newGuess = viewerGuess + key;
          setViewerGuess(newGuess);
          handleViewerGuessChange(newGuess);
        }
        return;
      }

      // Host input handling
      if (key === 'ENTER') {
        submitGuess();
      } else if (key === 'BACKSPACE') {
        setCurrentGuess(currentGuess.slice(0, -1));
      } else if (currentGuess.length < WORD_LENGTH_COUNT && /^[A-Z]$/.test(key)) {
        setCurrentGuess(currentGuess + key);
      }
    },
    [
      gameOver,
      isViewer,
      viewerGuess,
      currentGuess,
      setViewerGuess,
      setCurrentGuess,
      submitGuess,
      handleViewerGuessChange,
    ]
  );

  // Handle physical keyboard input
  const handleKeyDown = useCallback(
    (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Enter') {
        const result = handleKeyPress('ENTER');
        if (result === 'submit-suggestion' && viewerGuess.length === WORD_LENGTH_COUNT) {
          if (WORDS.includes(viewerGuess.toLowerCase())) {
            setSuggestionStatus('pending');
          }
        }
      } else if (e.key === 'Backspace') {
        handleKeyPress('BACKSPACE');
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        handleKeyPress(e.key.toUpperCase());
      }
    },
    [handleKeyPress, viewerGuess, setSuggestionStatus]
  );

  useEffect(() => {
    if (gameMode) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, gameMode]);

  // Game session action handlers
  const handlePlaySolo = useCallback((): void => {
    setGameMode('solo');
  }, [setGameMode]);

  const handleHost = useCallback(
    (pin?: string): void => {
      hostGame(pin);
      setGameMode('multiplayer');
    },
    [hostGame, setGameMode]
  );

  const handleJoin = useCallback(
    (code: string, pin?: string): void => {
      joinGame(code, pin);
      setGameMode('multiplayer');
    },
    [joinGame, setGameMode]
  );

  const handleLeave = useCallback((): void => {
    leaveSession();
    setGameMode(null);
    newGame();
  }, [leaveSession, setGameMode, newGame]);

  const handleNewGame = useCallback((): void => {
    newGame();
    // State update triggers the useEffect above to send to viewer
  }, [newGame]);

  const handleAcceptSuggestion = useCallback((): void => {
    const word = acceptSuggestion();
    if (word) {
      submitWord(word);
    }
  }, [acceptSuggestion, submitWord]);

  const handleRejectSuggestion = useCallback((): void => {
    rejectSuggestion();
  }, [rejectSuggestion]);

  return {
    // Game state
    gameMode,
    guesses,
    currentGuess,
    viewerGuess,
    gameOver,
    won,
    shake,
    message,
    maxGuesses: MAX_GUESSES_COUNT,
    wordLength: WORD_LENGTH_COUNT,
    suggestionStatus,

    // Multiplayer state
    isHost,
    isViewer,
    partnerConnected,
    sessionCode,
    sessionPin,
    connectionStatus,
    errorMessage,
    pendingSuggestion,

    // Keyboard
    handleKeyPress,
    getKeyboardStatus,

    // Game session actions
    handlePlaySolo,
    handleHost,
    handleJoin,
    handleLeave,
    handleNewGame,
    handleAcceptSuggestion,
    handleRejectSuggestion,
  };
};
