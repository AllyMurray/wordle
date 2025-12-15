import type { LetterStatus } from '../types';
import './Tile.css';

interface TileProps {
  letter: string;
  status?: LetterStatus | undefined;
  position: number;
}

const Tile = ({ letter, status, position }: TileProps) => {
  const hasLetter = letter !== '';

  return (
    <div
      className={`tile ${status ?? ''} ${hasLetter && !status ? 'filled' : ''}`}
      style={{ animationDelay: status ? `${position * 100}ms` : '0ms' }}
    >
      {letter}
    </div>
  );
};

export default Tile;
