import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useGameAnnouncements } from './useGameAnnouncements';

describe('useGameAnnouncements', () => {
  it('announces the actual validation error', () => {
    const { result } = renderHook(() =>
      useGameAnnouncements({
        guesses: [],
        gameOver: false,
        won: false,
        shake: true,
        message: 'Not enough letters',
      })
    );

    expect(result.current).toBe('Not enough letters');
  });

  it('describes each submitted letter without relying on colour', () => {
    const { result } = renderHook(() =>
      useGameAnnouncements({
        guesses: [
          {
            word: 'CRANE',
            status: ['correct', 'present', 'absent', 'absent', 'correct'],
          },
        ],
        gameOver: false,
        won: false,
        shake: false,
        message: '',
      })
    );

    expect(result.current).toContain('C, correct position');
    expect(result.current).toContain('R, wrong position');
    expect(result.current).toContain('A, not in word');
  });

  it('announces the completed game result', () => {
    const { result } = renderHook(() =>
      useGameAnnouncements({
        guesses: [{ word: 'CRANE', status: Array(5).fill('correct') }],
        gameOver: true,
        won: true,
        shake: false,
        message: 'Excellent!',
      })
    );

    expect(result.current).toBe('Congratulations! You won in 1 guess!');
  });
});
