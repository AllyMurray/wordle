import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BoggleStats } from './BoggleStats';

const stats = {
  gamesPlayed: 4,
  soloGamesPlayed: 3,
  multiplayerGamesPlayed: 1,
  bestScore: 72,
  mostWords: 14,
  totalScore: 170,
  averageScore: 42.5,
};

describe('BoggleStats', () => {
  it('shows recorded Boggle results', () => {
    render(<BoggleStats stats={stats} isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Boggle Statistics');
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('43')).toBeInTheDocument();
    expect(screen.getByText('Solo games: 3')).toBeInTheDocument();
  });

  it('closes from its accessible close button', () => {
    const onClose = vi.fn();
    render(<BoggleStats stats={stats} isOpen onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close boggle statistics' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
