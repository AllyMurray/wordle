import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BoggleBoard } from './BoggleBoard';
import type { BoggleBoard as BoggleBoardType } from '../types';

const board: BoggleBoardType = {
  grid: [
    ['Qu', 'A', 'T', 'S'],
    ['D', 'O', 'G', 'E'],
    ['R', 'A', 'T', 'S'],
    ['B', 'I', 'R', 'D'],
  ],
  size: 4,
};

const renderBoard = (overrides: Partial<React.ComponentProps<typeof BoggleBoard>> = {}) => {
  const props: React.ComponentProps<typeof BoggleBoard> = {
    board,
    selectedPath: [],
    currentWord: '',
    onTileSelect: vi.fn(),
    onSubmit: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  };

  render(<BoggleBoard {...props} />);
  return props;
};

describe('BoggleBoard keyboard controls', () => {
  it('selects a focused tile with Enter', () => {
    const props = renderBoard();

    fireEvent.keyDown(screen.getByRole('gridcell', { name: 'Qu, row 1, column 1' }), {
      key: 'Enter',
    });

    expect(props.onTileSelect).toHaveBeenCalledWith({ row: 0, col: 0 });
  });

  it('submits a valid word when the final selected tile is activated again', () => {
    const props = renderBoard({
      selectedPath: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
      ],
      currentWord: 'QUA',
    });

    fireEvent.keyDown(
      screen.getByRole('gridcell', { name: 'A, row 1, column 2, selected' }),
      { key: ' ' }
    );

    expect(props.onSubmit).toHaveBeenCalledOnce();
  });

  it('moves focus between tiles with arrow keys', () => {
    renderBoard();
    const firstTile = screen.getByRole('gridcell', { name: 'Qu, row 1, column 1' });
    firstTile.focus();

    fireEvent.keyDown(firstTile, { key: 'ArrowRight' });

    expect(screen.getByRole('gridcell', { name: 'A, row 1, column 2' })).toHaveFocus();
  });

  it('provides explicit clear and submit controls', () => {
    const props = renderBoard({ currentWord: 'QUA' });

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit word' }));

    expect(props.onClear).toHaveBeenCalledOnce();
    expect(props.onSubmit).toHaveBeenCalledOnce();
  });
});
