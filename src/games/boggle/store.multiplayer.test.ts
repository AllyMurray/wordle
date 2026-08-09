import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeDictionary } from './dictionary';
import { useBoggleStore } from './store';

describe('Boggle multiplayer state', () => {
  beforeAll(() => {
    initializeDictionary(['TEST']);
  });

  beforeEach(() => {
    useBoggleStore.getState().resetGame();
  });

  it('applies a host board and progress to the viewer store', async () => {
    const state = {
      board: {
        grid: [
          ['T', 'E', 'S', 'T'],
          ['A', 'R', 'E', 'A'],
          ['G', 'A', 'M', 'E'],
          ['W', 'O', 'R', 'D'],
        ],
        size: 4,
      },
      foundWords: ['TEST'],
      score: 1,
      gameOver: false,
      timeRemaining: 120,
      timedMode: true,
    };

    await useBoggleStore.getState().applyMultiplayerState(state);

    const applied = useBoggleStore.getState();
    expect(applied.board).toEqual(state.board);
    expect(applied.foundWords).toEqual(['TEST']);
    expect(applied.score).toBe(1);
    expect(applied.isLoading).toBe(false);
    expect(applied.possibleWords).toContain('TEST');
  });
});
