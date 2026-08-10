import type { Guess, LetterStatus } from '../types';

interface UseGameAnnouncementsOptions {
  guesses: Guess[];
  gameOver: boolean;
  won: boolean;
  shake: boolean;
  message: string;
}

const getStatusDescription = (status: LetterStatus): string => {
  switch (status) {
    case 'correct':
      return 'correct position';
    case 'present':
      return 'wrong position';
    case 'absent':
      return 'not in word';
  }
};

const formatGuessAnnouncement = (guess: Guess): string => {
  const letterDescriptions = guess.word
    .split('')
    .map((letter, i) => {
      const status = guess.status[i];
      return status ? `${letter}, ${getStatusDescription(status)}` : letter;
    })
    .join('. ');

  return `Guess ${guess.word}: ${letterDescriptions}`;
};

/**
 * Hook that generates screen reader announcements based on game events.
 * Returns the current announcement message to be used with a live region.
 *
 * This uses a simple approach: compute the announcement from current state.
 */
export const useGameAnnouncements = ({
  guesses,
  gameOver,
  won,
  shake,
  message,
}: UseGameAnnouncementsOptions): string => {
  // Priority order: shake > game over > latest guess

  // Invalid word shake
  if (shake) {
    return message || 'Invalid guess';
  }

  // Game over announcement
  if (gameOver) {
    if (won) {
      const attempts = guesses.length;
      return `Congratulations! You won in ${attempts} ${attempts === 1 ? 'guess' : 'guesses'}!`;
    }
    if (message) {
      return `Game over. ${message}`;
    }
  }

  // Latest guess announcement
  const latestGuess = guesses[guesses.length - 1];
  if (latestGuess) {
    return formatGuessAnnouncement(latestGuess);
  }

  return '';
};
