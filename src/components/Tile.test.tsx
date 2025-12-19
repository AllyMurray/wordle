import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Tile from './Tile';

describe('Tile', () => {
  describe('rendering', () => {
    it('should render an empty tile', () => {
      render(<Tile letter="" position={0} wordLength={5} />);

      const tile = screen.getByRole('gridcell');
      expect(tile).toBeInTheDocument();
      expect(tile).toHaveTextContent('');
      expect(tile).toHaveClass('tile');
      expect(tile).not.toHaveClass('filled');
    });

    it('should render a tile with a letter', () => {
      render(<Tile letter="A" position={0} wordLength={5} />);

      const tile = screen.getByRole('gridcell');
      expect(tile).toHaveTextContent('A');
      expect(tile).toHaveClass('tile');
      expect(tile).toHaveClass('filled');
    });

    it('should render a tile with correct status', () => {
      render(<Tile letter="A" status="correct" position={0} wordLength={5} />);

      const tile = screen.getByRole('gridcell');
      expect(tile).toHaveClass('correct');
      expect(tile).not.toHaveClass('filled');
    });

    it('should render a tile with present status', () => {
      render(<Tile letter="B" status="present" position={1} wordLength={5} />);

      const tile = screen.getByRole('gridcell');
      expect(tile).toHaveClass('present');
    });

    it('should render a tile with absent status', () => {
      render(<Tile letter="C" status="absent" position={2} wordLength={5} />);

      const tile = screen.getByRole('gridcell');
      expect(tile).toHaveClass('absent');
    });
  });

  describe('accessibility', () => {
    it('should have aria-readonly attribute', () => {
      render(<Tile letter="A" position={0} wordLength={5} />);

      const tile = screen.getByRole('gridcell');
      expect(tile).toHaveAttribute('aria-readonly', 'true');
    });

    it('should have correct aria-label for empty tile', () => {
      render(<Tile letter="" position={0} wordLength={5} />);

      const tile = screen.getByRole('gridcell');
      expect(tile).toHaveAttribute('aria-label', 'Position 1 of 5, empty');
    });

    it('should have correct aria-label for filled tile without status', () => {
      render(<Tile letter="A" position={2} wordLength={5} />);

      const tile = screen.getByRole('gridcell');
      expect(tile).toHaveAttribute('aria-label', 'Position 3 of 5, A');
    });

    it('should have correct aria-label for correct status', () => {
      render(<Tile letter="A" status="correct" position={0} wordLength={5} />);

      const tile = screen.getByRole('gridcell');
      expect(tile).toHaveAttribute('aria-label', 'Position 1 of 5, A, correct position');
    });

    it('should have correct aria-label for present status', () => {
      render(<Tile letter="B" status="present" position={1} wordLength={5} />);

      const tile = screen.getByRole('gridcell');
      expect(tile).toHaveAttribute('aria-label', 'Position 2 of 5, B, in word but wrong position');
    });

    it('should have correct aria-label for absent status', () => {
      render(<Tile letter="C" status="absent" position={4} wordLength={5} />);

      const tile = screen.getByRole('gridcell');
      expect(tile).toHaveAttribute('aria-label', 'Position 5 of 5, C, not in word');
    });
  });

  describe('animation', () => {
    it('should have animation delay CSS variable when status is set', () => {
      render(<Tile letter="A" status="correct" position={2} wordLength={5} />);

      const tile = screen.getByRole('gridcell');
      expect(tile).toHaveStyle({ '--tile-delay': '200ms' });
    });

    it('should not have animation delay when status is not set', () => {
      render(<Tile letter="A" position={2} wordLength={5} />);

      const tile = screen.getByRole('gridcell');
      expect(tile.style.getPropertyValue('--tile-delay')).toBe('');
    });

    it('should calculate animation delay based on position', () => {
      render(<Tile letter="D" status="present" position={4} wordLength={5} />);

      const tile = screen.getByRole('gridcell');
      expect(tile).toHaveStyle({ '--tile-delay': '400ms' });
    });
  });
});
