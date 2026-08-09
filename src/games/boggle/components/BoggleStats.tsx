import { ModalDialog } from '../../../components/ModalDialog';
import type { BoggleStatistics } from '../../../stores/statsStore';
import './BoggleStats.css';

interface BoggleStatsProps {
  stats: BoggleStatistics;
  isOpen: boolean;
  onClose: () => void;
}

export function BoggleStats({ stats, isOpen, onClose }: BoggleStatsProps) {
  return (
    <ModalDialog
      isOpen={isOpen}
      title="Boggle Statistics"
      titleId="boggle-stats-title"
      onClose={onClose}
    >
      <div className="boggle-stats-summary">
        <div className="stat-item">
          <div className="stat-value">{stats.gamesPlayed}</div>
          <div className="stat-label">Played</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{stats.bestScore}</div>
          <div className="stat-label">Best Score</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{stats.mostWords}</div>
          <div className="stat-label">Most Words</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{Math.round(stats.averageScore)}</div>
          <div className="stat-label">Average Score</div>
        </div>
      </div>

      {stats.gamesPlayed > 0 && (
        <div className="stats-breakdown">
          <p className="breakdown-item">Solo games: {stats.soloGamesPlayed}</p>
          <p className="breakdown-item">
            Multiplayer games: {stats.multiplayerGamesPlayed}
          </p>
        </div>
      )}
    </ModalDialog>
  );
}
