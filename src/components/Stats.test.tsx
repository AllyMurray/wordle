import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Stats from './Stats';
import type { GameStatistics } from '../types';

describe('Stats', () => {
  const defaultStats: GameStatistics = {
    gamesPlayed: 10,
    gamesWon: 8,
    currentStreak: 3,
    maxStreak: 5,
    guessDistribution: [1, 2, 3, 1, 1, 0],
    lastGameDate: '2025-12-17',
    soloGamesPlayed: 6,
    multiplayerGamesPlayed: 4,
  };

  const defaultProps = {
    stats: defaultStats,
    winPercentage: 80,
    maxDistributionValue: 3,
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('visibility', () => {
    it('should render when isOpen is true', () => {
      render(<Stats {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<Stats {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('statistics display', () => {
    it('should display games played', () => {
      render(<Stats {...defaultProps} />);

      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('Played')).toBeInTheDocument();
    });

    it('should display win percentage', () => {
      render(<Stats {...defaultProps} />);

      expect(screen.getByText('80')).toBeInTheDocument();
      expect(screen.getByText('Win %')).toBeInTheDocument();
    });

    it('should display current streak', () => {
      render(<Stats {...defaultProps} />);

      const currentStreakLabel = screen.getByText('Current Streak');
      expect(currentStreakLabel).toBeInTheDocument();
      // The value is in the sibling element
      const statItem = currentStreakLabel.closest('.stat-item');
      expect(statItem).toHaveTextContent('3');
    });

    it('should display max streak', () => {
      render(<Stats {...defaultProps} />);

      const maxStreakLabel = screen.getByText('Max Streak');
      expect(maxStreakLabel).toBeInTheDocument();
      // The value is in the sibling element
      const statItem = maxStreakLabel.closest('.stat-item');
      expect(statItem).toHaveTextContent('5');
    });

    it('should display guess distribution', () => {
      render(<Stats {...defaultProps} />);

      expect(screen.getByText('Guess Distribution')).toBeInTheDocument();
      // Check distribution labels (1-6) - they're in the distribution-label class
      const labels = document.querySelectorAll('.distribution-label');
      expect(labels).toHaveLength(6);
    });

    it('should display game mode breakdown when games played > 0', () => {
      render(<Stats {...defaultProps} />);

      expect(screen.getByText('Solo games: 6')).toBeInTheDocument();
      expect(screen.getByText('Multiplayer games: 4')).toBeInTheDocument();
    });

    it('should not display game mode breakdown when no games played', () => {
      const emptyStats: GameStatistics = {
        ...defaultStats,
        gamesPlayed: 0,
        soloGamesPlayed: 0,
        multiplayerGamesPlayed: 0,
      };
      render(<Stats {...defaultProps} stats={emptyStats} />);

      expect(screen.queryByText(/Solo games:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Multiplayer games:/)).not.toBeInTheDocument();
    });
  });

  describe('distribution bars', () => {
    it('should render distribution bars for each guess count', () => {
      render(<Stats {...defaultProps} />);

      const bars = document.querySelectorAll('.distribution-bar');
      expect(bars).toHaveLength(6);
    });

    it('should display distribution counts', () => {
      render(<Stats {...defaultProps} />);

      // Check counts in distribution (1, 2, 3, 1, 1, 0)
      const counts = screen.getAllByText(/^[0-3]$/).filter(
        (el) => el.classList.contains('distribution-count')
      );
      expect(counts).toHaveLength(6);
    });

    it('should apply minimum bar width', () => {
      const statsWithZero: GameStatistics = {
        ...defaultStats,
        guessDistribution: [0, 0, 0, 0, 0, 0],
      };
      render(
        <Stats {...defaultProps} stats={statsWithZero} maxDistributionValue={0} />
      );

      const bars = document.querySelectorAll('.distribution-bar');
      bars.forEach((bar) => {
        expect(bar).toHaveStyle({ width: '7%' });
      });
    });

    it('should highlight last guess row when lastGuessCount is provided', () => {
      render(<Stats {...defaultProps} lastGuessCount={3} />);

      const bars = document.querySelectorAll('.distribution-bar');
      // Third bar (index 2) should be highlighted
      expect(bars[2]).toHaveClass('highlight');
      expect(bars[0]).not.toHaveClass('highlight');
    });
  });

  describe('close functionality', () => {
    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(<Stats {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByRole('button', { name: 'Close statistics' });
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when overlay is clicked', () => {
      const onClose = vi.fn();
      render(<Stats {...defaultProps} onClose={onClose} />);

      const overlay = screen.getByRole('dialog');
      fireEvent.click(overlay);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when modal content is clicked', () => {
      const onClose = vi.fn();
      render(<Stats {...defaultProps} onClose={onClose} />);

      const modalContent = document.querySelector('.stats-modal');
      if (modalContent) {
        fireEvent.click(modalContent);
      }

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should call onClose when Escape key is pressed', () => {
      const onClose = vi.fn();
      render(<Stats {...defaultProps} onClose={onClose} />);

      const overlay = screen.getByRole('dialog');
      fireEvent.keyDown(overlay, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose for other keys', () => {
      const onClose = vi.fn();
      render(<Stats {...defaultProps} onClose={onClose} />);

      const overlay = screen.getByRole('dialog');
      fireEvent.keyDown(overlay, { key: 'Enter' });

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have dialog role', () => {
      render(<Stats {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should have aria-modal attribute', () => {
      render(<Stats {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('should have aria-labelledby pointing to title', () => {
      render(<Stats {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'stats-title');
      expect(screen.getByText('Statistics')).toHaveAttribute('id', 'stats-title');
    });

    it('should have accessible close button', () => {
      render(<Stats {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: 'Close statistics' });
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle zero stats', () => {
      const zeroStats: GameStatistics = {
        gamesPlayed: 0,
        gamesWon: 0,
        currentStreak: 0,
        maxStreak: 0,
        guessDistribution: [0, 0, 0, 0, 0, 0],
        lastGameDate: null,
        soloGamesPlayed: 0,
        multiplayerGamesPlayed: 0,
      };
      render(
        <Stats
          {...defaultProps}
          stats={zeroStats}
          winPercentage={0}
          maxDistributionValue={0}
        />
      );

      // Should render without crashing
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should handle high stats values', () => {
      const highStats: GameStatistics = {
        gamesPlayed: 999,
        gamesWon: 888,
        currentStreak: 100,
        maxStreak: 150,
        guessDistribution: [100, 200, 300, 200, 100, 50],
        lastGameDate: '2025-12-17',
        soloGamesPlayed: 500,
        multiplayerGamesPlayed: 499,
      };
      render(
        <Stats
          {...defaultProps}
          stats={highStats}
          winPercentage={89}
          maxDistributionValue={300}
        />
      );

      expect(screen.getByText('999')).toBeInTheDocument();
      expect(screen.getByText('89')).toBeInTheDocument();
    });
  });
});
