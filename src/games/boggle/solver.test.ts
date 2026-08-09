import { describe, it, expect, beforeAll } from 'vitest';
import { isValidPath, getWordFromPath, findAllWords, validateWord } from './solver';
import { initializeDictionary } from './dictionary';
import type { BoggleBoard } from './types';

describe('isValidPath', () => {
  it('should accept valid adjacent path', () => {
    const path = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
    ];
    expect(isValidPath(path)).toBe(true);
  });

  it('should accept diagonal adjacency', () => {
    const path = [
      { row: 0, col: 0 },
      { row: 1, col: 1 },
      { row: 2, col: 2 },
    ];
    expect(isValidPath(path)).toBe(true);
  });

  it('should reject non-adjacent tiles', () => {
    const path = [
      { row: 0, col: 0 },
      { row: 0, col: 2 }, // Skipped column 1
    ];
    expect(isValidPath(path)).toBe(false);
  });

  it('should reject revisited tiles', () => {
    const path = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 0 }, // Revisited
    ];
    expect(isValidPath(path)).toBe(false);
  });

  it('should reject empty path', () => {
    expect(isValidPath([])).toBe(false);
  });

  it('should accept single tile path', () => {
    const path = [{ row: 0, col: 0 }];
    expect(isValidPath(path)).toBe(true);
  });
});

describe('getWordFromPath', () => {
  it('should build word from path', () => {
    const board: BoggleBoard = {
      grid: [
        ['C', 'A', 'T', 'S'],
        ['D', 'O', 'G', 'E'],
        ['R', 'A', 'T', 'S'],
        ['B', 'I', 'R', 'D'],
      ],
      size: 4,
    };

    const path = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ];

    expect(getWordFromPath(board, path)).toBe('CAT');
  });

  it('should handle Qu tiles', () => {
    const board: BoggleBoard = {
      grid: [
        ['Qu', 'I', 'T', 'E'],
        ['A', 'B', 'C', 'D'],
        ['E', 'F', 'G', 'H'],
        ['I', 'J', 'K', 'L'],
      ],
      size: 4,
    };

    const path = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ];

    expect(getWordFromPath(board, path)).toBe('QUIT');
  });
});

describe('findAllWords', () => {
  beforeAll(() => {
    initializeDictionary(['CAT', 'DOG', 'RAT', 'QUIT', 'QUA', 'PLANETS']);
  });

  it('should find words on a simple board', () => {
    const board: BoggleBoard = {
      grid: [
        ['C', 'A', 'T', 'S'],
        ['D', 'O', 'G', 'E'],
        ['R', 'A', 'T', 'S'],
        ['B', 'I', 'R', 'D'],
      ],
      size: 4,
    };

    const words = findAllWords(board);

    // Should find common words
    expect(words).toContain('CAT');
    expect(words).toContain('DOG');
    expect(words).toContain('RAT');
  });

  it('should not return words shorter than 3 letters', () => {
    const board: BoggleBoard = {
      grid: [
        ['A', 'B', 'C', 'D'],
        ['E', 'F', 'G', 'H'],
        ['I', 'J', 'K', 'L'],
        ['M', 'N', 'O', 'P'],
      ],
      size: 4,
    };

    const words = findAllWords(board);

    // All words should be 3+ letters
    for (const word of words) {
      expect(word.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('finds words longer than five letters', () => {
    const board: BoggleBoard = {
      grid: [
        ['P', 'L', 'A', 'N'],
        ['X', 'X', 'S', 'E'],
        ['X', 'X', 'X', 'T'],
        ['X', 'X', 'X', 'X'],
      ],
      size: 4,
    };

    expect(findAllWords(board)).toContain('PLANETS');
  });

  it('accepts a three-letter word formed from a Qu tile and one neighbour', () => {
    const board: BoggleBoard = {
      grid: [
        ['Qu', 'A', 'X', 'X'],
        ['X', 'X', 'X', 'X'],
        ['X', 'X', 'X', 'X'],
        ['X', 'X', 'X', 'X'],
      ],
      size: 4,
    };

    expect(
      validateWord(board, [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
      ])
    ).toEqual({ valid: true, word: 'QUA' });
  });
});
