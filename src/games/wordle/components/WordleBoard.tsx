import { memo } from 'react';
import type { Guess } from '../../../types';
import './WordleBoard.css';

interface WordleBoardProps {
  guesses: Guess[];
  currentGuess: string;
  shake: boolean;
  maxGuesses?: number;
  wordLength?: number;
}

export const WordleBoard = memo(function WordleBoard({
  guesses,
  currentGuess,
  shake,
  maxGuesses = 6,
  wordLength = 5,
}: WordleBoardProps) {
  // Build rows: submitted guesses + current guess row + empty rows
  const rows: (Guess | string | null)[] = [
    ...guesses,
    guesses.length < maxGuesses ? currentGuess : null,
    ...Array(Math.max(0, maxGuesses - guesses.length - 1)).fill(null),
  ];

  return (
    <div
      className={`wordle-board ${shake ? 'wordle-board--shake' : ''}`}
      role="grid"
      aria-label="Game board"
    >
      {rows.slice(0, maxGuesses).map((row, rowIndex) => (
        <div key={rowIndex} className="wordle-row" role="row">
          {Array.from({ length: wordLength }, (_, colIndex) => {
            // Determine cell content and status
            if (row === null) {
              // Empty row
              return (
                <div
                  key={colIndex}
                  className="wordle-tile wordle-tile--empty"
                  role="gridcell"
                  aria-label="Empty"
                />
              );
            }

            if (typeof row === 'string') {
              // Current guess row (in progress)
              const letter = row[colIndex] || '';
              return (
                <div
                  key={colIndex}
                  className={`wordle-tile ${letter ? 'wordle-tile--filled' : 'wordle-tile--empty'}`}
                  role="gridcell"
                  aria-label={letter || 'Empty'}
                >
                  {letter}
                </div>
              );
            }

            // Submitted guess row
            const { word, status } = row;
            const letter = word[colIndex];
            const letterStatus = status[colIndex];

            return (
              <div
                key={colIndex}
                className={`wordle-tile wordle-tile--${letterStatus}`}
                role="gridcell"
                aria-label={`${letter}, ${letterStatus}`}
                style={{ animationDelay: `${colIndex * 100}ms` }}
              >
                {letter}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
});
