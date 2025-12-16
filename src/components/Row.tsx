import { memo } from 'react';
import Tile from './Tile';
import type { Guess } from '../types';
import './Row.css';

interface RowProps {
  guess?: Guess | undefined;
  currentGuess: string;
  wordLength: number;
  isCurrentRow: boolean;
  shake: boolean;
  rowNumber: number;
  totalRows: number;
}

const getStatusDescription = (status: string | undefined): string => {
  switch (status) {
    case 'correct':
      return 'correct position';
    case 'present':
      return 'wrong position';
    case 'absent':
      return 'not in word';
    default:
      return '';
  }
};

const Row = memo(({
  guess,
  currentGuess,
  wordLength,
  isCurrentRow,
  shake,
  rowNumber,
}: RowProps) => {
  // If this row has a submitted guess
  if (guess) {
    const rowDescription = guess.word
      .split('')
      .map((letter, i) => `${letter}, ${getStatusDescription(guess.status[i])}`)
      .join('; ');

    return (
      <div
        className="row"
        role="row"
        aria-label={`Row ${rowNumber}: ${guess.word}. ${rowDescription}.`}
      >
        {guess.word.split('').map((letter, i) => (
          <Tile
            key={i}
            letter={letter}
            status={guess.status[i]}
            position={i}
            wordLength={wordLength}
          />
        ))}
      </div>
    );
  }

  // If this is the current row being typed
  if (isCurrentRow) {
    const letters = currentGuess.split('');
    const currentDescription =
      currentGuess.length > 0
        ? `Current input: ${currentGuess}`
        : 'Empty, type your guess';

    return (
      <div
        className={`row ${shake ? 'shake' : ''}`}
        role="row"
        aria-label={`Row ${rowNumber}, current row. ${currentDescription}.`}
      >
        {Array(wordLength)
          .fill('')
          .map((_, i) => (
            <Tile
              key={i}
              letter={letters[i] ?? ''}
              position={i}
              wordLength={wordLength}
            />
          ))}
      </div>
    );
  }

  // Empty row
  return (
    <div className="row" role="row" aria-label={`Row ${rowNumber}, empty.`}>
      {Array(wordLength)
        .fill('')
        .map((_, i) => (
          <Tile key={i} letter="" position={i} wordLength={wordLength} />
        ))}
    </div>
  );
});

Row.displayName = 'Row';

export default Row;
