import { useEffect, useCallback, useState } from 'react';
import { useWordle } from './useWordle';
import { useMultiplayer } from './useMultiplayer';
import { WORDS } from '../data/words';
import type {
  GameMode,
  SuggestionStatus,
  Guess,
  KeyboardStatus,
  UseMultiplayerReturn,
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

  // Multiplayer state (exposed for UI rendering)
  multiplayer: UseMultiplayerReturn;

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

export const useGameSession = (): UseGameSessionReturn => {
  const [gameMode, setGameMode] = useState<GameMode>(null);
  const [suggestionStatus, setSuggestionStatus] = useState<SuggestionStatus>(null);

  const multiplayer = useMultiplayer();

  // Handle viewer guess changes - validate and send to host as suggestion preview
  const handleViewerGuessChange = useCallback((guess: string): void => {
    if (guess.length === 5) {
      // Validate word before sending suggestion
      if (WORDS.includes(guess.toLowerCase())) {
        setSuggestionStatus(null);
        multiplayer.sendSuggestion(guess);
      } else {
        setSuggestionStatus('invalid');
        multiplayer.clearSuggestion();
      }
    } else {
      setSuggestionStatus(null);
      multiplayer.clearSuggestion();
    }
  }, [multiplayer]);

  const {
    guesses,
    currentGuess,
    viewerGuess,
    gameOver,
    won,
    shake,
    message,
    handleKeyPress,
    getKeyboardStatus,
    newGame,
    getGameState,
    setGameState,
    submitWord,
    clearViewerGuess,
    maxGuesses,
    wordLength
  } = useWordle({
    isViewer: multiplayer.isViewer,
    onStateChange: multiplayer.isHost ? multiplayer.sendGameState : undefined,
    onViewerGuessChange: multiplayer.isViewer ? handleViewerGuessChange : undefined,
  });

  // Register callback for receiving game state (viewer)
  useEffect(() => {
    if (multiplayer.isViewer) {
      multiplayer.onGameStateReceived((state) => {
        setGameState(state);
        // Clear viewer's local guess when game state changes (word was submitted)
        clearViewerGuess();
        setSuggestionStatus(null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiplayer.isViewer, multiplayer.onGameStateReceived, setGameState, clearViewerGuess]);

  // Register callback for suggestion responses (viewer)
  useEffect(() => {
    if (multiplayer.isViewer) {
      multiplayer.onSuggestionResponse((accepted) => {
        setSuggestionStatus(accepted ? 'accepted' : 'rejected');
        if (!accepted) {
          // Clear viewer guess on rejection
          clearViewerGuess();
        }
        // Clear status after a moment
        setTimeout(() => setSuggestionStatus(null), 1500);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiplayer.isViewer, multiplayer.onSuggestionResponse, clearViewerGuess]);

  // Send initial state when viewer connects (host)
  useEffect(() => {
    if (multiplayer.isHost && multiplayer.partnerConnected) {
      multiplayer.sendGameState(getGameState());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiplayer.isHost, multiplayer.partnerConnected, multiplayer.sendGameState, getGameState]);

  // Handle physical keyboard input
  const handleKeyDown = useCallback((e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Enter') {
      const result = handleKeyPress('ENTER');
      // If viewer pressed enter with a complete word, mark as pending only if valid
      if (result === 'submit-suggestion' && viewerGuess.length === 5) {
        if (WORDS.includes(viewerGuess.toLowerCase())) {
          setSuggestionStatus('pending');
        }
        // Invalid words already have status set by handleViewerGuessChange
      }
    } else if (e.key === 'Backspace') {
      handleKeyPress('BACKSPACE');
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      handleKeyPress(e.key.toUpperCase());
    }
  }, [handleKeyPress, viewerGuess]);

  useEffect(() => {
    if (gameMode) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, gameMode]);

  // Game session action handlers
  const handlePlaySolo = useCallback((): void => {
    setGameMode('solo');
  }, []);

  const handleHost = useCallback((pin?: string): void => {
    multiplayer.hostGame(pin);
    setGameMode('multiplayer');
  }, [multiplayer]);

  const handleJoin = useCallback((code: string, pin?: string): void => {
    multiplayer.joinGame(code, pin);
    setGameMode('multiplayer');
  }, [multiplayer]);

  const handleLeave = useCallback((): void => {
    multiplayer.leaveSession();
    setGameMode(null);
    newGame();
  }, [multiplayer, newGame]);

  const handleNewGame = useCallback((): void => {
    newGame();
    // Send new game state to viewer
    if (multiplayer.isHost && multiplayer.partnerConnected) {
      setTimeout(() => {
        multiplayer.sendGameState(getGameState());
      }, 0);
    }
  }, [newGame, multiplayer, getGameState]);

  // Handle host accepting a suggestion
  const handleAcceptSuggestion = useCallback((): void => {
    const word = multiplayer.acceptSuggestion();
    if (word) {
      submitWord(word);
    }
  }, [multiplayer, submitWord]);

  // Handle host rejecting a suggestion
  const handleRejectSuggestion = useCallback((): void => {
    multiplayer.rejectSuggestion();
  }, [multiplayer]);

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
    maxGuesses,
    wordLength,
    suggestionStatus,

    // Multiplayer state
    multiplayer,

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
