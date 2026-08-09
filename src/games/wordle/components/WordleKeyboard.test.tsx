import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WordleKeyboard } from './WordleKeyboard';

describe('WordleKeyboard status keys', () => {
  const onKey = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it('maps correct, present, and absent letters to their semantic styles', () => {
    render(
      <WordleKeyboard
        keyboardStatus={{ A: 'correct', B: 'present', C: 'absent' }}
        onKey={onKey}
        onEnter={vi.fn()}
        onBackspace={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'A, correct position' }))
      .toHaveClass('keyboard-key--correct');
    expect(screen.getByRole('button', { name: 'B, in word but wrong position' }))
      .toHaveClass('keyboard-key--present');
    expect(screen.getByRole('button', { name: 'C, not in word' }))
      .toHaveClass('keyboard-key--absent');
  });

  it('keeps an absent greyed-out letter usable', () => {
    render(
      <WordleKeyboard
        keyboardStatus={{ C: 'absent' }}
        onKey={onKey}
        onEnter={vi.fn()}
        onBackspace={vi.fn()}
      />
    );

    const absentKey = screen.getByRole('button', { name: 'C, not in word' });
    expect(absentKey).not.toBeDisabled();
    fireEvent.click(absentKey);
    expect(onKey).toHaveBeenCalledWith('C');
  });
});
