import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { getRandomWord, WORDS } from '../data/words';
import type { Guess, LetterStatus, GameState, KeyboardStatus } from '../types';
import { GAME_CONFIG } from '../types';

const WORD_LENGTH = GAME_CONFIG.WORD_LENGTH;
const MAX_GUESSES = GAME_CONFIG.MAX_GUESSES;

// Module-level timeout tracking for cleanup
let shakeTimeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Clears any existing shake timeout and sets a new one.
 * This prevents memory leaks and ensures only one timeout is active at a time.
 */
const setShakeTimeout = (callback: () => void, duration: number): void => {
  if (shakeTimeoutId !== null) {
    clearTimeout(shakeTimeoutId);
  }
  shakeTimeoutId = setTimeout(() => {
    shakeTimeoutId = null;
    callback();
  }, duration);
};

/**
 * Clears any pending shake timeout. Call this when cleaning up the store.
 */
export const clearShakeTimeout = (): void => {
  if (shakeTimeoutId !== null) {
    clearTimeout(shakeTimeoutId);
    shakeTimeoutId = null;
  }
};

interface GameStoreState {
  // Core game state
  solution: string;
  guesses: Guess[];
  currentGuess: string;
  viewerGuess: string;
  gameOver: boolean;
  won: boolean;
  shake: boolean;
  message: string;

  // Game mode and role
  isViewer: boolean;

  // Actions
  setCurrentGuess: (guess: string) => void;
  setViewerGuess: (guess: string) => void;
  clearViewerGuess: () => void;
  submitGuess: () => boolean;
  submitWord: (word: string) => boolean;
  newGame: () => void;
  setShake: (shake: boolean) => void;
  setMessage: (message: string) => void;
  setIsViewer: (isViewer: boolean) => void;

  // State sync (for multiplayer)
  getGameState: () => GameState;
  setGameState: (state: Partial<GameState>) => void;

  // Utilities
  isValidWord: (word: string) => boolean;
  getLetterStatus: (guess: string, solutionWord: string) => LetterStatus[];
  getKeyboardStatus: () => KeyboardStatus;
}

/**
 * Two-pass algorithm to determine letter statuses.
 * Correctly handles duplicate letters by:
 * 1. First marking exact position matches (green)
 * 2. Then marking wrong-position matches (yellow) with remaining letters
 */
const getLetterStatus = (guess: string, solutionWord: string): LetterStatus[] => {
  const result: LetterStatus[] = Array(WORD_LENGTH).fill('absent') as LetterStatus[];
  const solutionArray: (string | null)[] = solutionWord.split('');
  const guessArray = guess.split('');

  // Pass 1: Find exact matches
  guessArray.forEach((letter, i) => {
    if (letter === solutionArray[i]) {
      result[i] = 'correct';
      solutionArray[i] = null;
    }
  });

  // Pass 2: Find wrong-position matches
  guessArray.forEach((letter, i) => {
    if (result[i] === 'correct') return;
    const foundIndex = solutionArray.findIndex((s) => s === letter);
    if (foundIndex !== -1) {
      result[i] = 'present';
      solutionArray[foundIndex] = null;
    }
  });

  return result;
};

const isValidWord = (word: string): boolean => {
  return WORDS.includes(word.toLowerCase());
};

/**
 * Zustand store for core game state.
 *
 * Benefits over previous useWordle hook:
 * - subscribeWithSelector allows components to subscribe to specific state slices
 * - getState() allows accessing game state outside React (in WebRTC callbacks)
 * - No need for useRef patterns to get latest state in callbacks
 * - Cleaner action definitions separated from React lifecycle
 */
export const useGameStore = create<GameStoreState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    solution: getRandomWord(),
    guesses: [],
    currentGuess: '',
    viewerGuess: '',
    gameOver: false,
    won: false,
    shake: false,
    message: '',
    isViewer: false,

    // Simple setters
    setCurrentGuess: (guess) => set({ currentGuess: guess }),
    setViewerGuess: (guess) => set({ viewerGuess: guess }),
    clearViewerGuess: () => set({ viewerGuess: '' }),
    setShake: (shake) => set({ shake }),
    setMessage: (message) => set({ message }),
    setIsViewer: (isViewer) => set({ isViewer }),

    // Submit current guess
    submitGuess: () => {
      const { currentGuess, solution, guesses, gameOver, isViewer } = get();

      if (gameOver || isViewer) return false;
      if (currentGuess.length !== WORD_LENGTH) {
        set({ message: 'Not enough letters', shake: true });
        setShakeTimeout(() => set({ shake: false, message: '' }), GAME_CONFIG.SHAKE_DURATION_MS);
        return false;
      }

      if (!isValidWord(currentGuess)) {
        set({ message: 'Not in word list', shake: true });
        setShakeTimeout(() => set({ shake: false, message: '' }), GAME_CONFIG.SHAKE_DURATION_MS);
        return false;
      }

      const letterStatus = getLetterStatus(currentGuess, solution);
      const newGuess: Guess = { word: currentGuess, status: letterStatus };
      const newGuesses = [...guesses, newGuess];

      const isWin = currentGuess === solution;
      const isLoss = newGuesses.length >= MAX_GUESSES && !isWin;

      set({
        guesses: newGuesses,
        currentGuess: '',
        won: isWin,
        gameOver: isWin || isLoss,
        message: isWin ? 'Excellent!' : isLoss ? `The word was ${solution}` : '',
      });

      return true;
    },

    // Submit a specific word (for accepting viewer suggestions)
    submitWord: (word) => {
      const { solution, guesses, gameOver, isViewer } = get();

      if (gameOver || isViewer) return false;
      if (word.length !== WORD_LENGTH) return false;
      if (!isValidWord(word)) return false;

      const letterStatus = getLetterStatus(word, solution);
      const newGuess: Guess = { word, status: letterStatus };
      const newGuesses = [...guesses, newGuess];

      const isWin = word === solution;
      const isLoss = newGuesses.length >= MAX_GUESSES && !isWin;

      set({
        guesses: newGuesses,
        currentGuess: '',
        won: isWin,
        gameOver: isWin || isLoss,
        message: isWin ? 'Excellent!' : isLoss ? `The word was ${solution}` : '',
      });

      return true;
    },

    // Start a new game
    newGame: () => {
      // Clear any pending shake timeout to prevent stale state updates
      clearShakeTimeout();
      set({
        solution: getRandomWord(),
        guesses: [],
        currentGuess: '',
        viewerGuess: '',
        gameOver: false,
        won: false,
        shake: false,
        message: '',
      });
    },

    // Get full game state for multiplayer sync
    getGameState: () => {
      const { solution, guesses, currentGuess, gameOver, won, message } = get();
      return { solution, guesses, currentGuess, gameOver, won, message };
    },

    // Set game state from external source (for viewer)
    setGameState: (state) => {
      set((current) => ({
        ...current,
        ...(state.solution !== undefined && { solution: state.solution }),
        ...(state.guesses !== undefined && { guesses: state.guesses }),
        ...(state.currentGuess !== undefined && { currentGuess: state.currentGuess }),
        ...(state.gameOver !== undefined && { gameOver: state.gameOver }),
        ...(state.won !== undefined && { won: state.won }),
        ...(state.message !== undefined && { message: state.message }),
      }));
    },

    // Utilities (exposed for external use)
    isValidWord,
    getLetterStatus,

    // Get keyboard letter statuses
    getKeyboardStatus: () => {
      const { guesses } = get();
      const status: KeyboardStatus = {};

      guesses.forEach((guess) => {
        guess.word.split('').forEach((letter, i) => {
          const currentStatus = guess.status[i];
          const existingStatus = status[letter];

          if (currentStatus === 'correct') {
            status[letter] = 'correct';
          } else if (currentStatus === 'present' && existingStatus !== 'correct') {
            status[letter] = 'present';
          } else if (!existingStatus) {
            status[letter] = 'absent';
          }
        });
      });

      return status;
    },
  }))
);

// Selector hooks for fine-grained subscriptions
export const useSolution = () => useGameStore((state) => state.solution);
export const useGuesses = () => useGameStore((state) => state.guesses);
export const useCurrentGuess = () => useGameStore((state) => state.currentGuess);
export const useViewerGuess = () => useGameStore((state) => state.viewerGuess);
export const useGameOver = () => useGameStore((state) => state.gameOver);
export const useWon = () => useGameStore((state) => state.won);
export const useShake = () => useGameStore((state) => state.shake);
export const useMessage = () => useGameStore((state) => state.message);
export const useIsViewer = () => useGameStore((state) => state.isViewer);

// Constants
export const MAX_GUESSES_COUNT = MAX_GUESSES;
export const WORD_LENGTH_COUNT = WORD_LENGTH;
