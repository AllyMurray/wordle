import { useState, useCallback, useEffect, useRef } from 'react';
import { getRandomWord, WORDS } from '../data/words';
import type {
  Guess,
  LetterStatus,
  GameState,
  KeyboardStatus,
  UseWordleOptions,
  UseWordleReturn,
} from '../types';
import { GAME_CONFIG } from '../types';

const WORD_LENGTH = GAME_CONFIG.WORD_LENGTH;
const MAX_GUESSES = GAME_CONFIG.MAX_GUESSES;

export const useWordle = (options: UseWordleOptions = {}): UseWordleReturn => {
  const { isViewer = false, onStateChange, onViewerGuessChange } = options;

  const [solution, setSolution] = useState(() => getRandomWord());
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [viewerGuess, setViewerGuess] = useState(''); // Viewer's local suggestion
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [shake, setShake] = useState(false);
  const [message, setMessage] = useState('');

  const onStateChangeRef = useRef(onStateChange);
  const onViewerGuessChangeRef = useRef(onViewerGuessChange);

  // Update refs in effect to avoid setting during render
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    onViewerGuessChangeRef.current = onViewerGuessChange;
  }, [onViewerGuessChange]);

  // Check if a word is valid (in word list)
  const isValidWord = useCallback((word: string): boolean => {
    return WORDS.includes(word.toLowerCase());
  }, []);

  /**
   * Determines the status of each letter in a guess compared to the solution.
   *
   * Uses a two-pass algorithm to correctly handle duplicate letters:
   *
   * Example: solution="APPLE", guess="PAPAL"
   * - Pass 1: P at position 2 matches exactly → marked 'correct'
   * - Pass 2: P at position 0 finds remaining P → marked 'present'
   *           A at position 1 finds A → marked 'present'
   *           A at position 3 finds no remaining A → stays 'absent'
   *           L at position 4 finds L → marked 'present'
   * - Result: ['present', 'present', 'correct', 'absent', 'present']
   *
   * Why two passes? A single pass could incorrectly mark a letter as 'present'
   * when a later occurrence is an exact match. By processing exact matches first,
   * we ensure correct letters are never "stolen" by earlier present matches.
   *
   * @param guess - The player's guessed word (uppercase)
   * @param solutionWord - The target word to compare against (uppercase)
   * @returns Array of letter statuses: 'correct' (green), 'present' (yellow), or 'absent' (gray)
   */
  const getLetterStatus = useCallback((guess: string, solutionWord: string): LetterStatus[] => {
    // Initialize all letters as 'absent' - they'll be upgraded as matches are found
    const result: LetterStatus[] = Array(WORD_LENGTH).fill('absent') as LetterStatus[];

    // Create a mutable copy of solution letters to track which have been matched
    // Letters are set to null once used to prevent double-counting duplicates
    const solutionArray: (string | null)[] = solutionWord.split('');
    const guessArray = guess.split('');

    // PASS 1: Find exact position matches (green/correct)
    // These take highest priority and must be identified first
    guessArray.forEach((letter, i) => {
      if (letter === solutionArray[i]) {
        result[i] = 'correct';
        // Mark this solution letter as consumed so it can't match again
        solutionArray[i] = null;
      }
    });

    // PASS 2: Find wrong-position matches (yellow/present)
    // Only check letters that weren't exact matches
    guessArray.forEach((letter, i) => {
      // Skip letters already marked correct in pass 1
      if (result[i] === 'correct') return;

      // Search for this letter among remaining (non-null) solution letters
      const foundIndex = solutionArray.findIndex(s => s === letter);
      if (foundIndex !== -1) {
        result[i] = 'present';
        // Consume this solution letter to prevent duplicate matches
        // e.g., guessing "ALLOY" against "APPLE" - only first L gets 'present'
        solutionArray[foundIndex] = null;
      }
      // Letters not found remain 'absent' (their initial value)
    });

    return result;
  }, []);

  // Get full game state for syncing
  const getGameState = useCallback((): GameState => ({
    solution,
    guesses,
    currentGuess,
    gameOver,
    won,
    message,
  }), [solution, guesses, currentGuess, gameOver, won, message]);

  // Set game state from external source (for viewer)
  const setGameState = useCallback((state: Partial<GameState>): void => {
    if (state.solution !== undefined) setSolution(state.solution);
    if (state.guesses !== undefined) setGuesses(state.guesses);
    if (state.currentGuess !== undefined) setCurrentGuess(state.currentGuess);
    if (state.gameOver !== undefined) setGameOver(state.gameOver);
    if (state.won !== undefined) setWon(state.won);
    if (state.message !== undefined) setMessage(state.message);
  }, []);

  // Notify state changes (for host to sync with viewer)
  useEffect(() => {
    if (onStateChangeRef.current && !isViewer) {
      onStateChangeRef.current(getGameState());
    }
  }, [solution, guesses, currentGuess, gameOver, won, message, isViewer, getGameState]);

  // Handle keyboard input
  const handleKeyPress = useCallback((key: string): void | 'submit-suggestion' => {
    if (gameOver) return;

    // Viewer typing for suggestions
    if (isViewer) {
      if (key === 'ENTER') {
        // Viewer presses enter to submit suggestion (handled by App.tsx)
        return 'submit-suggestion';
      } else if (key === 'BACKSPACE') {
        setViewerGuess(prev => prev.slice(0, -1));
      } else if (viewerGuess.length < WORD_LENGTH && /^[A-Z]$/.test(key)) {
        setViewerGuess(prev => prev + key);
      }
      return;
    }

    // Host input handling
    if (key === 'ENTER') {
      if (currentGuess.length !== WORD_LENGTH) {
        setMessage('Not enough letters');
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setMessage('');
        }, GAME_CONFIG.SHAKE_DURATION_MS);
        return;
      }

      if (!isValidWord(currentGuess)) {
        setMessage('Not in word list');
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setMessage('');
        }, GAME_CONFIG.SHAKE_DURATION_MS);
        return;
      }

      const letterStatus = getLetterStatus(currentGuess, solution);
      const newGuess: Guess = { word: currentGuess, status: letterStatus };
      const newGuesses = [...guesses, newGuess];
      setGuesses(newGuesses);
      setCurrentGuess('');

      if (currentGuess === solution) {
        setWon(true);
        setGameOver(true);
        setMessage('Excellent!');
      } else if (newGuesses.length >= MAX_GUESSES) {
        setGameOver(true);
        setMessage(`The word was ${solution}`);
      }
    } else if (key === 'BACKSPACE') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (currentGuess.length < WORD_LENGTH && /^[A-Z]$/.test(key)) {
      setCurrentGuess(prev => prev + key);
    }
  }, [currentGuess, viewerGuess, gameOver, guesses, solution, isValidWord, getLetterStatus, isViewer]);

  // Get keyboard letter statuses for coloring
  const getKeyboardStatus = useCallback((): KeyboardStatus => {
    const status: KeyboardStatus = {};

    guesses.forEach(guess => {
      guess.word.split('').forEach((letter, i) => {
        const currentStatus = guess.status[i];
        const existingStatus = status[letter];

        // Priority: correct > present > absent
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
  }, [guesses]);

  // Submit a specific word (used by host to accept viewer suggestions)
  const submitWord = useCallback((word: string): boolean => {
    if (gameOver || isViewer) return false;
    if (word.length !== WORD_LENGTH) return false;
    if (!isValidWord(word)) return false;

    const letterStatus = getLetterStatus(word, solution);
    const newGuess: Guess = { word, status: letterStatus };
    const newGuesses = [...guesses, newGuess];
    setGuesses(newGuesses);
    setCurrentGuess('');

    if (word === solution) {
      setWon(true);
      setGameOver(true);
      setMessage('Excellent!');
    } else if (newGuesses.length >= MAX_GUESSES) {
      setGameOver(true);
      setMessage(`The word was ${solution}`);
    }
    return true;
  }, [gameOver, guesses, solution, isValidWord, getLetterStatus, isViewer]);

  // Clear viewer guess (when suggestion is accepted/rejected or game state changes)
  const clearViewerGuess = useCallback((): void => {
    setViewerGuess('');
  }, []);

  // Notify when viewer guess changes
  useEffect(() => {
    if (isViewer && onViewerGuessChangeRef.current) {
      onViewerGuessChangeRef.current(viewerGuess);
    }
  }, [viewerGuess, isViewer]);

  // Start a new game
  const newGame = useCallback((): void => {
    setSolution(getRandomWord());
    setGuesses([]);
    setCurrentGuess('');
    setViewerGuess('');
    setGameOver(false);
    setWon(false);
    setMessage('');
  }, []);

  return {
    solution,
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
    isValidWord,
    maxGuesses: MAX_GUESSES,
    wordLength: WORD_LENGTH
  };
};
