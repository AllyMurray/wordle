import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALLOWED_GUESSES } from './allowedGuesses';
import { getRandomWord, isValidGuess, WORDS } from './words';

describe('Wordle dictionaries', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('contains the complete pinned allowed-guess dictionary', () => {
    expect(ALLOWED_GUESSES.size).toBe(14_855);
    expect([...ALLOWED_GUESSES].every((word) => /^[a-z]{5}$/.test(word))).toBe(true);
  });

  it('accepts dictionary guesses that are not selected as solutions', () => {
    expect(WORDS).not.toContain('adieu');
    expect(isValidGuess('ADIEU')).toBe(true);
  });

  it('still chooses solutions only from the curated answer pool', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(WORDS).toContain(getRandomWord().toLowerCase());

    vi.mocked(Math.random).mockReturnValue(0.999_999);
    expect(WORDS).toContain(getRandomWord().toLowerCase());
  });

  it('rejects unknown or malformed guesses', () => {
    expect(isValidGuess('zzzzz')).toBe(false);
    expect(isValidGuess('four')).toBe(false);
    expect(isValidGuess('sixsix')).toBe(false);
  });
});
