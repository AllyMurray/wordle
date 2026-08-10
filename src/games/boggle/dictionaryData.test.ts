import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dictionaryPath = resolve(process.cwd(), 'public/data/boggle-words.txt');

describe('Boggle dictionary data', () => {
  it('contains a broad, clean and unique real-word list', () => {
    const words = readFileSync(dictionaryPath, 'utf8').trim().split(/\s+/);

    expect(words.length).toBeGreaterThan(170_000);
    expect(new Set(words).size).toBe(words.length);
    expect(words.every((word) => /^[a-z]{3,17}$/.test(word))).toBe(true);
    expect(words).toEqual(expect.arrayContaining(['house', 'planet', 'testing', 'zyzzyva']));
  });
});
