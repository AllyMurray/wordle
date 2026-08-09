import { memo, useCallback } from 'react';
import type { KeyboardStatus } from '../../../types';
import './WordleKeyboard.css';

interface WordleKeyboardProps {
  keyboardStatus: KeyboardStatus;
  onKey: (key: string) => void;
  onEnter: () => void;
  onBackspace: () => void;
  disabled?: boolean;
}

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
];

const getKeyAriaLabel = (
  key: string,
  status: KeyboardStatus[string] | undefined
): string => {
  if (key === 'BACK') return 'Backspace';
  if (key === 'ENTER') return 'Enter';
  if (status === 'correct') return `${key}, correct position`;
  if (status === 'present') return `${key}, in word but wrong position`;
  if (status === 'absent') return `${key}, not in word`;
  return key;
};

export const WordleKeyboard = memo(function WordleKeyboard({
  keyboardStatus,
  onKey,
  onEnter,
  onBackspace,
  disabled,
}: WordleKeyboardProps) {
  const handleClick = useCallback(
    (key: string) => {
      if (disabled) return;

      if (key === 'ENTER') {
        onEnter();
      } else if (key === 'BACK') {
        onBackspace();
      } else {
        onKey(key);
      }
    },
    [disabled, onEnter, onBackspace, onKey]
  );

  return (
    <div className="wordle-keyboard" role="group" aria-label="Keyboard">
      {KEYBOARD_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="keyboard-row">
          {row.map((key) => {
            const status = keyboardStatus[key];
            const isWide = key === 'ENTER' || key === 'BACK';

            return (
              <button
                key={key}
                className={`keyboard-key ${status ? `keyboard-key--${status}` : ''} ${isWide ? 'keyboard-key--wide' : ''}`}
                onClick={() => handleClick(key)}
                disabled={disabled}
                aria-label={getKeyAriaLabel(key, status)}
              >
                {key === 'BACK' ? '⌫' : key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
});
