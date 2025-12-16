import { memo } from 'react';
import type { KeyboardStatus, LetterStatus } from '../types';
import './Keyboard.css';

const KEYBOARD_ROWS: readonly (readonly string[])[] = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE'],
] as const;

interface KeyboardProps {
  onKeyPress: (key: string) => void;
  keyboardStatus: KeyboardStatus;
  disabled?: boolean;
}

const getKeyStatusLabel = (status: LetterStatus | ''): string => {
  switch (status) {
    case 'correct':
      return ', correct';
    case 'present':
      return ', in word';
    case 'absent':
      return ', not in word';
    default:
      return '';
  }
};

const getKeyAriaLabel = (key: string, status: LetterStatus | ''): string => {
  if (key === 'ENTER') {
    return 'Submit guess';
  }
  if (key === 'BACKSPACE') {
    return 'Delete letter';
  }
  return `${key}${getKeyStatusLabel(status)}`;
};

const Keyboard = memo(({ onKeyPress, keyboardStatus, disabled = false }: KeyboardProps) => {
  const handleClick = (key: string): void => {
    if (disabled) return;
    onKeyPress(key);
  };

  return (
    <div
      className={`keyboard ${disabled ? 'disabled' : ''}`}
      role="group"
      aria-label="Keyboard"
    >
      {KEYBOARD_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="keyboard-row" role="group">
          {row.map((key) => {
            const status = (keyboardStatus[key] ?? '') as LetterStatus | '';
            const isWide = key === 'ENTER' || key === 'BACKSPACE';

            return (
              <button
                key={key}
                className={`key ${status} ${isWide ? 'wide' : ''}`}
                onClick={() => handleClick(key)}
                disabled={disabled}
                aria-label={getKeyAriaLabel(key, status)}
                type="button"
              >
                {key === 'BACKSPACE' ? '⌫' : key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
});

Keyboard.displayName = 'Keyboard';

export default Keyboard;
