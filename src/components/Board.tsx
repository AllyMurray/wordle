import { memo } from 'react';
import Row from './Row';
import type { Guess } from '../types';
import './Board.css';

interface BoardProps {
  guesses: Guess[];
  currentGuess: string;
  maxGuesses: number;
  wordLength: number;
  shake: boolean;
}

const Board = memo(({ guesses, currentGuess, maxGuesses, wordLength, shake }: BoardProps) => {
  return (
    <div
      className="board"
      role="grid"
      aria-label={`Wordle game board. ${guesses.length} of ${maxGuesses} guesses used.`}
    >
      {Array(maxGuesses)
        .fill(null)
        .map((_, i) => {
          const isCurrentRow = i === guesses.length;
          return (
            <Row
              key={i}
              guess={guesses[i]}
              currentGuess={isCurrentRow ? currentGuess : ''}
              wordLength={wordLength}
              isCurrentRow={isCurrentRow}
              shake={isCurrentRow && shake}
              rowNumber={i + 1}
              totalRows={maxGuesses}
            />
          );
        })}
    </div>
  );
});

Board.displayName = 'Board';

export default Board;
