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

  // Get letter status for coloring tiles
  const getLetterStatus = useCallback((guess: string, solutionWord: string): LetterStatus[] => {
    const result: LetterStatus[] = Array(WORD_LENGTH).fill('absent') as LetterStatus[];
    const solutionArray: (string | null)[] = solutionWord.split('');
    const guessArray = guess.split('');

    // First pass: mark correct letters (green)
    guessArray.forEach((letter, i) => {
      if (letter === solutionArray[i]) {
        result[i] = 'correct';
        solutionArray[i] = null; // Mark as used
      }
    });

    // Second pass: mark present letters (yellow)
    guessArray.forEach((letter, i) => {
      if (result[i] === 'correct') return;

      const foundIndex = solutionArray.findIndex(s => s === letter);
      if (foundIndex !== -1) {
        result[i] = 'present';
        solutionArray[foundIndex] = null; // Mark as used
      }
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
