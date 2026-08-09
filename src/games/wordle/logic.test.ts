import { describe, it, expect } from 'vitest';
import { getLetterStatus, isValidWord } from './logic';

describe('getLetterStatus', () => {
  it('should mark all correct letters', () => {
    const result = getLetterStatus('APPLE', 'APPLE');
    expect(result).toEqual(['correct', 'correct', 'correct', 'correct', 'correct']);
  });

  it('should mark absent letters', () => {
    const result = getLetterStatus('XXXXX', 'APPLE');
    expect(result).toEqual(['absent', 'absent', 'absent', 'absent', 'absent']);
  });

  it('should mark present letters', () => {
    const result = getLetterStatus('ELPPA', 'APPLE');
    // E is present (in position 4), L is present, P is correct, P is present, A is present
    expect(result).toEqual(['present', 'present', 'correct', 'present', 'present']);
  });

  it('should handle duplicate letters correctly', () => {
    // ALLOY guessed against APPLE
    // A: correct (position 0)
    // L: present (one L in APPLE at position 3)
    // L: absent (only one L in APPLE, already used)
    // O: absent
    // Y: absent
    const result = getLetterStatus('ALLOY', 'APPLE');
    expect(result).toEqual(['correct', 'present', 'absent', 'absent', 'absent']);
  });

  it('should prioritize correct over present for duplicates', () => {
    // LLLLL guessed against APPLE (only one L in solution at position 3)
    const result = getLetterStatus('LLLLL', 'APPLE');
    expect(result).toEqual(['absent', 'absent', 'absent', 'correct', 'absent']);
  });

  it('should handle case insensitively', () => {
    const result = getLetterStatus('apple', 'APPLE');
    expect(result).toEqual(['correct', 'correct', 'correct', 'correct', 'correct']);
  });
});

describe('isValidWord', () => {
  it('should return true for valid words', () => {
    expect(isValidWord('APPLE')).toBe(true);
    expect(isValidWord('CRANE')).toBe(true);
  });

  it('accepts valid guesses outside the curated solution list', () => {
    expect(isValidWord('ADIEU')).toBe(true);
    expect(isValidWord('AUDIO')).toBe(true);
    expect(isValidWord('NYMPH')).toBe(true);
  });

  it('should return false for invalid words', () => {
    expect(isValidWord('XXXXX')).toBe(false);
    expect(isValidWord('ZZZZZ')).toBe(false);
  });

  it('should be case insensitive', () => {
    expect(isValidWord('apple')).toBe(true);
    expect(isValidWord('Apple')).toBe(true);
    expect(isValidWord('APPLE')).toBe(true);
  });
});
