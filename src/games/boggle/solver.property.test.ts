import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { BoggleBoard, Position } from './types';
import { canFormWord, findWordPath, getWordFromPath, isValidPath } from './solver';

const tile = fc.oneof(
  fc.integer({ min: 65, max: 90 }).map(String.fromCharCode),
  fc.constant('Qu')
);
const board = fc
  .array(fc.array(tile, { minLength: 4, maxLength: 4 }), {
    minLength: 4,
    maxLength: 4,
  })
  .map((grid): BoggleBoard => ({ grid, size: 4 }));

const adjacentPath = fc
  .tuple(fc.integer({ min: 0, max: 2 }), fc.integer({ min: 0, max: 2 }))
  .map(([row, col]): Position[] => [
    { row, col },
    { row: row + 1, col },
    { row: row + 1, col: col + 1 },
  ]);

describe('Boggle solver properties', () => {
  it('round-trips every word for a generated valid path', () => {
    fc.assert(
      fc.property(board, adjacentPath, (generatedBoard, path) => {
        const word = getWordFromPath(generatedBoard, path);

        expect(isValidPath(path)).toBe(true);
        expect(canFormWord(generatedBoard, word)).toBe(true);
        const foundPath = findWordPath(generatedBoard, word);
        expect(foundPath).not.toBeNull();
        expect(getWordFromPath(generatedBoard, foundPath!)).toBe(word);
      }),
      { numRuns: 500 }
    );
  });

  it('rejects paths that reuse any tile', () => {
    fc.assert(
      fc.property(adjacentPath, (path) => {
        expect(isValidPath([...path, path[0]!])).toBe(false);
      }),
      { numRuns: 200 }
    );
  });
});
