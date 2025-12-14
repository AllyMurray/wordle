import { useState, useCallback, useEffect, useRef } from 'react';
import { getRandomWord, WORDS } from '../data/words';

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;

export const useWordle = (options = {}) => {
  const { isViewer = false, onStateChange } = options;

  const [solution, setSolution] = useState(() => getRandomWord());
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [shake, setShake] = useState(false);
  const [message, setMessage] = useState('');

  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  // Check if a word is valid (in word list)
  const isValidWord = useCallback((word) => {
    return WORDS.includes(word.toLowerCase());
  }, []);

  // Get letter status for coloring tiles
  const getLetterStatus = useCallback((guess, solution) => {
    const result = Array(WORD_LENGTH).fill('absent');
    const solutionArray = solution.split('');
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
  const getGameState = useCallback(() => ({
    solution,
    guesses,
    currentGuess,
    gameOver,
    won,
    message,
  }), [solution, guesses, currentGuess, gameOver, won, message]);

  // Set game state from external source (for viewer)
  const setGameState = useCallback((state) => {
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
  const handleKeyPress = useCallback((key) => {
    if (gameOver) return;
    if (isViewer) return; // Viewers cannot make guesses

    if (key === 'ENTER') {
      if (currentGuess.length !== WORD_LENGTH) {
        setMessage('Not enough letters');
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setMessage('');
        }, 500);
        return;
      }

      if (!isValidWord(currentGuess)) {
        setMessage('Not in word list');
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setMessage('');
        }, 500);
        return;
      }

      const letterStatus = getLetterStatus(currentGuess, solution);
      const newGuess = { word: currentGuess, status: letterStatus };
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
  }, [currentGuess, gameOver, guesses, solution, isValidWord, getLetterStatus, isViewer]);

  // Get keyboard letter statuses for coloring
  const getKeyboardStatus = useCallback(() => {
    const status = {};

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

  // Start a new game
  const newGame = useCallback(() => {
    setSolution(getRandomWord());
    setGuesses([]);
    setCurrentGuess('');
    setGameOver(false);
    setWon(false);
    setMessage('');
  }, []);

  return {
    solution,
    guesses,
    currentGuess,
    gameOver,
    won,
    shake,
    message,
    handleKeyPress,
    getKeyboardStatus,
    newGame,
    getGameState,
    setGameState,
    maxGuesses: MAX_GUESSES,
    wordLength: WORD_LENGTH
  };
};
