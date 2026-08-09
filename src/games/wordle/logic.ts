import type { LetterStatus } from './types';
import { isValidGuess } from './words';

const WORD_LENGTH = 5;

/**
 * Check if a word is in the word list.
 */
export function isValidWord(word: string): boolean {
  return isValidGuess(word);
}

/**
 * Calculate letter statuses for a guess against the solution.
 * Returns array of statuses: 'correct', 'present', or 'absent'.
 *
 * Two-pass algorithm to correctly handle duplicate letters:
 * 1. First pass: mark exact position matches (correct)
 * 2. Second pass: mark wrong-position matches (present) with remaining letters
 */
export function getLetterStatus(guess: string, solution: string): LetterStatus[] {
  const result: LetterStatus[] = Array(WORD_LENGTH).fill('absent');
  const solutionChars: (string | null)[] = solution.toUpperCase().split('');
  const guessChars = guess.toUpperCase().split('');

  // First pass: mark correct letters
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessChars[i] === solutionChars[i]) {
      result[i] = 'correct';
      solutionChars[i] = null; // Mark as used
    }
  }

  // Second pass: mark present letters
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === 'correct') continue;

    const guessChar = guessChars[i];
    const idx = solutionChars.indexOf(guessChar ?? '');
    if (idx !== -1) {
      result[i] = 'present';
      solutionChars[idx] = null; // Mark as used
    }
  }

  return result;
}
