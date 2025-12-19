import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Keyboard from './Keyboard';
import type { KeyboardStatus } from '../types';

describe('Keyboard', () => {
  const defaultProps = {
    onKeyPress: vi.fn(),
    keyboardStatus: {} as KeyboardStatus,
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render all letter keys', () => {
      render(<Keyboard {...defaultProps} />);

      const expectedLetters = 'QWERTYUIOPASDFGHJKLZXCVBNM'.split('');
      expectedLetters.forEach((letter) => {
        expect(screen.getByRole('button', { name: letter })).toBeInTheDocument();
      });
    });

    it('should render Enter and Backspace keys', () => {
      render(<Keyboard {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Submit guess' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete letter' })).toBeInTheDocument();
    });

    it('should display backspace symbol', () => {
      render(<Keyboard {...defaultProps} />);

      const backspace = screen.getByRole('button', { name: 'Delete letter' });
      expect(backspace).toHaveTextContent('⌫');
    });

    it('should render 3 keyboard rows', () => {
      render(<Keyboard {...defaultProps} />);

      const rows = document.querySelectorAll('.keyboard-row');
      expect(rows).toHaveLength(3);
    });
  });

  describe('key press handling', () => {
    it('should call onKeyPress when letter key is clicked', () => {
      const onKeyPress = vi.fn();
      render(<Keyboard {...defaultProps} onKeyPress={onKeyPress} />);

      fireEvent.click(screen.getByRole('button', { name: 'A' }));
      expect(onKeyPress).toHaveBeenCalledWith('A');
    });

    it('should call onKeyPress with ENTER when Enter is clicked', () => {
      const onKeyPress = vi.fn();
      render(<Keyboard {...defaultProps} onKeyPress={onKeyPress} />);

      fireEvent.click(screen.getByRole('button', { name: 'Submit guess' }));
      expect(onKeyPress).toHaveBeenCalledWith('ENTER');
    });

    it('should call onKeyPress with BACKSPACE when Backspace is clicked', () => {
      const onKeyPress = vi.fn();
      render(<Keyboard {...defaultProps} onKeyPress={onKeyPress} />);

      fireEvent.click(screen.getByRole('button', { name: 'Delete letter' }));
      expect(onKeyPress).toHaveBeenCalledWith('BACKSPACE');
    });

    it('should not call onKeyPress when disabled', () => {
      const onKeyPress = vi.fn();
      render(<Keyboard {...defaultProps} onKeyPress={onKeyPress} disabled />);

      fireEvent.click(screen.getByRole('button', { name: 'A' }));
      expect(onKeyPress).not.toHaveBeenCalled();
    });
  });

  describe('key status styling', () => {
    it('should apply correct status class to keys', () => {
      const keyboardStatus: KeyboardStatus = {
        A: 'correct',
        B: 'present',
        C: 'absent',
      };
      render(<Keyboard {...defaultProps} keyboardStatus={keyboardStatus} />);

      expect(screen.getByRole('button', { name: 'A, correct' })).toHaveClass('correct');
      expect(screen.getByRole('button', { name: 'B, in word' })).toHaveClass('present');
      expect(screen.getByRole('button', { name: 'C, not in word' })).toHaveClass('absent');
    });

    it('should not have status class for unguessed keys', () => {
      render(<Keyboard {...defaultProps} keyboardStatus={{}} />);

      const keyA = screen.getByRole('button', { name: 'A' });
      expect(keyA).not.toHaveClass('correct');
      expect(keyA).not.toHaveClass('present');
      expect(keyA).not.toHaveClass('absent');
    });
  });

  describe('accessibility', () => {
    it('should have keyboard group role', () => {
      render(<Keyboard {...defaultProps} />);

      const keyboard = screen.getByRole('group', { name: 'Keyboard' });
      expect(keyboard).toBeInTheDocument();
    });

    it('should have correct aria-label for letter with correct status', () => {
      const keyboardStatus: KeyboardStatus = { A: 'correct' };
      render(<Keyboard {...defaultProps} keyboardStatus={keyboardStatus} />);

      expect(screen.getByRole('button', { name: 'A, correct' })).toBeInTheDocument();
    });

    it('should have correct aria-label for letter with present status', () => {
      const keyboardStatus: KeyboardStatus = { B: 'present' };
      render(<Keyboard {...defaultProps} keyboardStatus={keyboardStatus} />);

      expect(screen.getByRole('button', { name: 'B, in word' })).toBeInTheDocument();
    });

    it('should have correct aria-label for letter with absent status', () => {
      const keyboardStatus: KeyboardStatus = { C: 'absent' };
      render(<Keyboard {...defaultProps} keyboardStatus={keyboardStatus} />);

      expect(screen.getByRole('button', { name: 'C, not in word' })).toBeInTheDocument();
    });

    it('should disable all keys when keyboard is disabled', () => {
      render(<Keyboard {...defaultProps} disabled />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe('wide keys', () => {
    it('should apply wide class to ENTER key', () => {
      render(<Keyboard {...defaultProps} />);

      const enterKey = screen.getByRole('button', { name: 'Submit guess' });
      expect(enterKey).toHaveClass('wide');
    });

    it('should apply wide class to BACKSPACE key', () => {
      render(<Keyboard {...defaultProps} />);

      const backspaceKey = screen.getByRole('button', { name: 'Delete letter' });
      expect(backspaceKey).toHaveClass('wide');
    });

    it('should not apply wide class to letter keys', () => {
      render(<Keyboard {...defaultProps} />);

      const letterKey = screen.getByRole('button', { name: 'A' });
      expect(letterKey).not.toHaveClass('wide');
    });
  });

  describe('disabled state', () => {
    it('should apply disabled class to keyboard when disabled', () => {
      render(<Keyboard {...defaultProps} disabled />);

      const keyboard = screen.getByRole('group', { name: 'Keyboard' });
      expect(keyboard).toHaveClass('disabled');
    });

    it('should not apply disabled class when not disabled', () => {
      render(<Keyboard {...defaultProps} disabled={false} />);

      const keyboard = screen.getByRole('group', { name: 'Keyboard' });
      expect(keyboard).not.toHaveClass('disabled');
    });
  });
});
