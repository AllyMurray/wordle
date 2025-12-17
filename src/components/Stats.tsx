import { memo } from 'react';
import { GAME_CONFIG, type GameStatistics } from '../types';
import './Stats.css';

interface StatsProps {
  stats: GameStatistics;
  winPercentage: number;
  maxDistributionValue: number;
  isOpen: boolean;
  onClose: () => void;
  lastGuessCount?: number | undefined;
}

const Stats = memo(function Stats({
  stats,
  winPercentage,
  maxDistributionValue,
  isOpen,
  onClose,
  lastGuessCount,
}: StatsProps) {
  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="stats-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="stats-title"
    >
      <div className="stats-modal">
        <button
          className="stats-close"
          onClick={onClose}
          aria-label="Close statistics"
        >
          &times;
        </button>

        <h2 id="stats-title" className="stats-title">
          Statistics
        </h2>

        <div className="stats-summary">
          <div className="stat-item">
            <div className="stat-value">{stats.gamesPlayed}</div>
            <div className="stat-label">Played</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{winPercentage}</div>
            <div className="stat-label">Win %</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{stats.currentStreak}</div>
            <div className="stat-label">Current Streak</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{stats.maxStreak}</div>
            <div className="stat-label">Max Streak</div>
          </div>
        </div>

        <h3 className="stats-subtitle">Guess Distribution</h3>

        <div className="guess-distribution">
          {stats.guessDistribution.map((count, index) => {
            const percentage =
              maxDistributionValue > 0 ? (count / maxDistributionValue) * 100 : 0;
            const isLastGuess = lastGuessCount === index + 1;

            return (
              <div key={index} className="distribution-row">
                <div className="distribution-label">{index + 1}</div>
                <div className="distribution-bar-container">
                  <div
                    className={`distribution-bar ${isLastGuess ? 'highlight' : ''}`}
                    style={{ width: `${Math.max(percentage, GAME_CONFIG.MIN_BAR_WIDTH_PERCENT)}%` }}
                  >
                    <span className="distribution-count">{count}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {stats.gamesPlayed > 0 && (
          <div className="stats-breakdown">
            <p className="breakdown-item">
              Solo games: {stats.soloGamesPlayed}
            </p>
            <p className="breakdown-item">
              Multiplayer games: {stats.multiplayerGamesPlayed}
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

Stats.displayName = 'Stats';

export default Stats;
