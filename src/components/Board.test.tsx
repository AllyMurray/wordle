import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Board from './Board';
import type { Guess } from '../types';

describe('Board', () => {
  const defaultProps = {
    guesses: [] as Guess[],
    currentGuess: '',
    maxGuesses: 6,
    wordLength: 5,
    shake: false,
  };

  describe('rendering', () => {
    it('should render the correct number of rows', () => {
      render(<Board {...defaultProps} />);

      const rows = screen.getAllByRole('row');
      expect(rows).toHaveLength(6);
    });

    it('should render the board as a grid', () => {
      render(<Board {...defaultProps} />);

      const grid = screen.getByRole('grid');
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveClass('board');
    });

    it('should render with different max guesses', () => {
      render(<Board {...defaultProps} maxGuesses={4} />);

      const rows = screen.getAllByRole('row');
      expect(rows).toHaveLength(4);
    });
  });

  describe('accessibility', () => {
    it('should have correct aria-label with no guesses', () => {
      render(<Board {...defaultProps} />);

      const grid = screen.getByRole('grid');
      expect(grid).toHaveAttribute(
        'aria-label',
        'Wordle game board. 0 of 6 guesses used.'
      );
    });

    it('should have correct aria-label with some guesses', () => {
      const guesses: Guess[] = [
        { word: 'CRANE', status: ['absent', 'absent', 'absent', 'absent', 'correct'] },
        { word: 'SLATE', status: ['correct', 'absent', 'absent', 'absent', 'correct'] },
      ];
      render(<Board {...defaultProps} guesses={guesses} />);

      const grid = screen.getByRole('grid');
      expect(grid).toHaveAttribute(
        'aria-label',
        'Wordle game board. 2 of 6 guesses used.'
      );
    });
  });

  describe('guess display', () => {
    it('should render submitted guesses correctly', () => {
      const guesses: Guess[] = [
        { word: 'CRANE', status: ['correct', 'present', 'absent', 'absent', 'correct'] },
      ];
      render(<Board {...defaultProps} guesses={guesses} />);

      // First row should have the guess
      const tiles = screen.getAllByRole('gridcell');
      expect(tiles[0]).toHaveTextContent('C');
      expect(tiles[1]).toHaveTextContent('R');
      expect(tiles[2]).toHaveTextContent('A');
      expect(tiles[3]).toHaveTextContent('N');
      expect(tiles[4]).toHaveTextContent('E');
    });

    it('should render current guess in the correct row', () => {
      const guesses: Guess[] = [
        { word: 'CRANE', status: ['absent', 'absent', 'absent', 'absent', 'absent'] },
      ];
      render(<Board {...defaultProps} guesses={guesses} currentGuess="SL" />);

      // Second row (after the submitted guess) should have current input
      const tiles = screen.getAllByRole('gridcell');
      // First row: CRANE (5 tiles)
      // Second row: SL (first 2 tiles)
      expect(tiles[5]).toHaveTextContent('S');
      expect(tiles[6]).toHaveTextContent('L');
      expect(tiles[7]).toHaveTextContent('');
    });

    it('should render multiple submitted guesses', () => {
      const guesses: Guess[] = [
        { word: 'CRANE', status: ['absent', 'absent', 'absent', 'absent', 'absent'] },
        { word: 'SLATE', status: ['correct', 'absent', 'absent', 'absent', 'correct'] },
        { word: 'STORM', status: ['correct', 'absent', 'absent', 'absent', 'absent'] },
      ];
      render(<Board {...defaultProps} guesses={guesses} />);

      const tiles = screen.getAllByRole('gridcell');
      // Check each row's first letter
      expect(tiles[0]).toHaveTextContent('C');
      expect(tiles[5]).toHaveTextContent('S');
      expect(tiles[10]).toHaveTextContent('S');
    });
  });

  describe('shake animation', () => {
    it('should only apply shake to current row', () => {
      const guesses: Guess[] = [
        { word: 'CRANE', status: ['absent', 'absent', 'absent', 'absent', 'absent'] },
      ];
      render(<Board {...defaultProps} guesses={guesses} shake />);

      const rows = screen.getAllByRole('row');
      // First row (submitted) should not shake
      expect(rows[0]).not.toHaveClass('shake');
      // Second row (current) should shake
      expect(rows[1]).toHaveClass('shake');
    });

    it('should not apply shake when shake is false', () => {
      render(<Board {...defaultProps} shake={false} currentGuess="HELLO" />);

      const rows = screen.getAllByRole('row');
      expect(rows[0]).not.toHaveClass('shake');
    });

    it('should apply shake to first row when no guesses made', () => {
      render(<Board {...defaultProps} shake currentGuess="BAD" />);

      const rows = screen.getAllByRole('row');
      expect(rows[0]).toHaveClass('shake');
    });
  });

  describe('full board', () => {
    it('should render all 6 guesses when board is full', () => {
      const guesses: Guess[] = [
        { word: 'CRANE', status: ['absent', 'absent', 'absent', 'absent', 'absent'] },
        { word: 'SLATE', status: ['absent', 'absent', 'absent', 'absent', 'absent'] },
        { word: 'STORM', status: ['absent', 'absent', 'absent', 'absent', 'absent'] },
        { word: 'GHOST', status: ['absent', 'absent', 'absent', 'absent', 'absent'] },
        { word: 'WORLD', status: ['absent', 'absent', 'absent', 'absent', 'absent'] },
        { word: 'ZEBRA', status: ['absent', 'absent', 'absent', 'absent', 'absent'] },
      ];
      render(<Board {...defaultProps} guesses={guesses} />);

      const tiles = screen.getAllByRole('gridcell');
      expect(tiles).toHaveLength(30); // 6 rows * 5 tiles
    });
  });
});
