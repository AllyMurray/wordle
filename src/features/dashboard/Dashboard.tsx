import { Link } from 'react-router-dom';
import { getAllGames } from '../../games/registry';
import ThemeToggle from '../../components/ThemeToggle';
import './Dashboard.css';

export function Dashboard() {
  const games = getAllGames();

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Game Hub</h1>
        <ThemeToggle />
      </header>

      <main className="game-grid">
        {games.map((game) => (
          <Link key={game.id} to={game.route} className="game-card">
            <span className="game-icon" aria-hidden="true">
              {game.icon}
            </span>
            <h2 className="game-name">{game.name}</h2>
            <p className="game-description">{game.description}</p>
            <div className="game-badges">
              {game.supportsSinglePlayer && (
                <span className="game-badge single-player">Single Player</span>
              )}
              {game.supportsMultiplayer && (
                <span className="game-badge multiplayer">Multiplayer</span>
              )}
            </div>
          </Link>
        ))}
      </main>

      <footer className="dashboard-footer">
        <p className="footer-text">Select a game to play</p>
      </footer>
    </div>
  );
}
