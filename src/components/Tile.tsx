import { memo } from 'react';
import type { LetterStatus } from '../types';
import './Tile.css';

interface TileProps {
  letter: string;
  status?: LetterStatus | undefined;
  position: number;
  wordLength: number;
}

const getStatusLabel = (status: LetterStatus | undefined): string => {
  switch (status) {
    case 'correct':
      return 'correct position';
    case 'present':
      return 'in word but wrong position';
    case 'absent':
      return 'not in word';
    default:
      return '';
  }
};

const Tile = memo(({ letter, status, position, wordLength }: TileProps) => {
  const hasLetter = letter !== '';
  const positionLabel = `Position ${position + 1} of ${wordLength}`;

  let ariaLabel: string;
  if (!hasLetter) {
    ariaLabel = `${positionLabel}, empty`;
  } else if (status) {
    ariaLabel = `${positionLabel}, ${letter}, ${getStatusLabel(status)}`;
  } else {
    ariaLabel = `${positionLabel}, ${letter}`;
  }

  return (
    <div
      className={`tile ${status ?? ''} ${hasLetter && !status ? 'filled' : ''}`}
      style={{ animationDelay: status ? `${position * 100}ms` : '0ms' }}
      role="gridcell"
      aria-label={ariaLabel}
      aria-readonly="true"
    >
      {letter}
    </div>
  );
});

Tile.displayName = 'Tile';

export default Tile;
