import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { getLetterStatus } from './logic';

const upperCaseLetter = fc.integer({ min: 65, max: 90 }).map(String.fromCharCode);
const word = fc.array(upperCaseLetter, { minLength: 5, maxLength: 5 }).map((letters) =>
  letters.join('')
);

describe('Wordle scoring properties', () => {
  it('never consumes a solution letter more than once', () => {
    fc.assert(
      fc.property(word, word, (guess, solution) => {
        const statuses = getLetterStatus(guess, solution);
        expect(statuses).toHaveLength(5);

        for (const letter of new Set(guess)) {
          const matched = statuses.filter(
            (status, index) => status !== 'absent' && guess[index] === letter
          ).length;
          const available = [...solution].filter((candidate) => candidate === letter).length;
          expect(matched).toBeLessThanOrEqual(available);
        }
      }),
      { numRuns: 1_000 }
    );
  });

  it('marks exactly the equal-position letters as correct', () => {
    fc.assert(
      fc.property(word, word, (guess, solution) => {
        const statuses = getLetterStatus(guess, solution);
        statuses.forEach((status, index) => {
          expect(status === 'correct').toBe(guess[index] === solution[index]);
        });
      }),
      { numRuns: 1_000 }
    );
  });
});
