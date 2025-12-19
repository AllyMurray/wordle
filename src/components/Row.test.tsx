import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Row from './Row';
import type { Guess } from '../types';

describe('Row', () => {
  const defaultProps = {
    currentGuess: '',
    wordLength: 5,
    isCurrentRow: false,
    shake: false,
    rowNumber: 1,
    totalRows: 6,
  };

  describe('empty row', () => {
    it('should render 5 empty tiles', () => {
      render(<Row {...defaultProps} />);

      const tiles = screen.getAllByRole('gridcell');
      expect(tiles).toHaveLength(5);
      tiles.forEach((tile) => {
        expect(tile).toHaveTextContent('');
      });
    });

    it('should have correct aria-label for empty row', () => {
      render(<Row {...defaultProps} rowNumber={3} />);

      const row = screen.getByRole('row');
      expect(row).toHaveAttribute('aria-label', 'Row 3, empty.');
    });
  });

  describe('current row (being typed)', () => {
    it('should render typed letters correctly', () => {
      render(<Row {...defaultProps} isCurrentRow currentGuess="HE" />);

      const tiles = screen.getAllByRole('gridcell');
      expect(tiles[0]).toHaveTextContent('H');
      expect(tiles[1]).toHaveTextContent('E');
      expect(tiles[2]).toHaveTextContent('');
      expect(tiles[3]).toHaveTextContent('');
      expect(tiles[4]).toHaveTextContent('');
    });

    it('should have correct aria-label with current input', () => {
      render(<Row {...defaultProps} isCurrentRow currentGuess="HEL" rowNumber={2} />);

      const row = screen.getByRole('row');
      expect(row).toHaveAttribute('aria-label', 'Row 2, current row. Current input: HEL.');
    });

    it('should have correct aria-label when empty current row', () => {
      render(<Row {...defaultProps} isCurrentRow currentGuess="" rowNumber={1} />);

      const row = screen.getByRole('row');
      expect(row).toHaveAttribute('aria-label', 'Row 1, current row. Empty, type your guess.');
    });

    it('should apply shake class when shake is true', () => {
      render(<Row {...defaultProps} isCurrentRow shake />);

      const row = screen.getByRole('row');
      expect(row).toHaveClass('shake');
    });

    it('should not apply shake class when shake is false', () => {
      render(<Row {...defaultProps} isCurrentRow shake={false} />);

      const row = screen.getByRole('row');
      expect(row).not.toHaveClass('shake');
    });
  });

  describe('submitted row with guess', () => {
    const submittedGuess: Guess = {
      word: 'CRANE',
      status: ['correct', 'present', 'absent', 'absent', 'correct'],
    };

    it('should render the submitted word correctly', () => {
      render(<Row {...defaultProps} guess={submittedGuess} />);

      const tiles = screen.getAllByRole('gridcell');
      expect(tiles[0]).toHaveTextContent('C');
      expect(tiles[1]).toHaveTextContent('R');
      expect(tiles[2]).toHaveTextContent('A');
      expect(tiles[3]).toHaveTextContent('N');
      expect(tiles[4]).toHaveTextContent('E');
    });

    it('should apply correct status classes to tiles', () => {
      render(<Row {...defaultProps} guess={submittedGuess} />);

      const tiles = screen.getAllByRole('gridcell');
      expect(tiles[0]).toHaveClass('correct');
      expect(tiles[1]).toHaveClass('present');
      expect(tiles[2]).toHaveClass('absent');
      expect(tiles[3]).toHaveClass('absent');
      expect(tiles[4]).toHaveClass('correct');
    });

    it('should have correct aria-label with word description', () => {
      render(<Row {...defaultProps} guess={submittedGuess} rowNumber={1} />);

      const row = screen.getByRole('row');
      expect(row).toHaveAttribute(
        'aria-label',
        'Row 1: CRANE. C, correct position; R, wrong position; A, not in word; N, not in word; E, correct position.'
      );
    });
  });

  describe('variable word length', () => {
    it('should render correct number of tiles for different word lengths', () => {
      render(<Row {...defaultProps} wordLength={6} />);

      const tiles = screen.getAllByRole('gridcell');
      expect(tiles).toHaveLength(6);
    });

    it('should render current guess correctly with different word length', () => {
      render(<Row {...defaultProps} wordLength={4} isCurrentRow currentGuess="TEST" />);

      const tiles = screen.getAllByRole('gridcell');
      expect(tiles).toHaveLength(4);
      expect(tiles[0]).toHaveTextContent('T');
      expect(tiles[1]).toHaveTextContent('E');
      expect(tiles[2]).toHaveTextContent('S');
      expect(tiles[3]).toHaveTextContent('T');
    });
  });
});
