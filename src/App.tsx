import Board from './components/Board';
import Keyboard from './components/Keyboard';
import Lobby from './components/Lobby';
import ScreenReaderAnnouncement from './components/ScreenReaderAnnouncement';
import { useGameContext } from './contexts/GameContext';
import { useGameAnnouncements } from './hooks/useGameAnnouncements';
import './App.css';

function App() {
  const {
    gameMode,
    isHost,
    isViewer,
    partnerConnected,
    sessionCode,
    sessionPin,
    connectionStatus,
    session: {
      guesses,
      currentGuess,
      viewerGuess,
      gameOver,
      won,
      shake,
      message,
      maxGuesses,
      wordLength,
      suggestionStatus,
      multiplayer,
      handleKeyPress,
      getKeyboardStatus,
      handlePlaySolo,
      handleHost,
      handleJoin,
      handleLeave,
      handleNewGame,
      handleAcceptSuggestion,
      handleRejectSuggestion,
    },
  } = useGameContext();

  // Generate screen reader announcements for game events
  const announcement = useGameAnnouncements({
    guesses,
    gameOver,
    won,
    shake,
    message,
  });

  // Show lobby if no game mode selected
  if (!gameMode) {
    return (
      <Lobby
        onHost={handleHost}
        onJoin={handleJoin}
        onPlaySolo={handlePlaySolo}
      />
    );
  }

  return (
    <div className="app">
      {/* Screen reader announcements for game events */}
      <ScreenReaderAnnouncement message={announcement} priority="polite" />

      <header className="header">
        <div className="header-content">
          <button
            className="back-btn"
            onClick={handleLeave}
            aria-label="Leave game and return to lobby"
          >
            ← Back
          </button>
          <h1>Wordle</h1>
          <div className="header-spacer" />
        </div>
      </header>

      {/* Connection status for multiplayer */}
      {gameMode === 'multiplayer' && (
        <div className="connection-status">
          {isHost && (
            <div className="session-info">
              <span className="session-label">Share code:</span>
              <span className="session-code">{sessionCode}</span>
              {sessionPin && (
                <span className="session-pin-indicator" title={`PIN: ${sessionPin}`}>
                  🔒
                </span>
              )}
              {partnerConnected ? (
                <span className="partner-status connected">Partner connected</span>
              ) : (
                <span className="partner-status waiting">Waiting for partner...</span>
              )}
            </div>
          )}
          {isViewer && (
            <div className="session-info">
              <span className="viewer-label">Playing with partner</span>
              {connectionStatus === 'connecting' && (
                <span className="partner-status waiting">Connecting...</span>
              )}
              {connectionStatus === 'connected' && !suggestionStatus && (
                <span className="partner-status connected">Type a word to suggest</span>
              )}
              {suggestionStatus === 'pending' && (
                <span className="partner-status waiting">Waiting for host...</span>
              )}
              {suggestionStatus === 'accepted' && (
                <span className="partner-status connected">Suggestion accepted!</span>
              )}
              {suggestionStatus === 'rejected' && (
                <span className="partner-status error">Suggestion rejected</span>
              )}
              {suggestionStatus === 'invalid' && (
                <span className="partner-status error">Not in word list</span>
              )}
              {connectionStatus === 'error' && (
                <span className="partner-status error">{multiplayer.errorMessage}</span>
              )}
            </div>
          )}
        </div>
      )}

      <main className="main">
        {message && (
          <div className={`message ${won ? 'won' : ''}`}>
            {message}
          </div>
        )}

        {/* Suggestion panel for host */}
        {isHost && multiplayer.pendingSuggestion && !gameOver && (
          <div
            className="suggestion-panel"
            role="region"
            aria-label="Partner suggestion"
          >
            <span className="suggestion-label">Partner suggests:</span>
            <span className="suggestion-word">{multiplayer.pendingSuggestion.word}</span>
            <div className="suggestion-actions">
              <button
                className="suggestion-btn accept"
                onClick={handleAcceptSuggestion}
                aria-label={`Accept suggestion: ${multiplayer.pendingSuggestion.word}`}
              >
                Accept
              </button>
              <button
                className="suggestion-btn reject"
                onClick={handleRejectSuggestion}
                aria-label={`Reject suggestion: ${multiplayer.pendingSuggestion.word}`}
              >
                Reject
              </button>
            </div>
          </div>
        )}

        <Board
          guesses={guesses}
          currentGuess={isViewer ? viewerGuess : currentGuess}
          maxGuesses={maxGuesses}
          wordLength={wordLength}
          shake={shake}
        />

        {gameOver && !isViewer && (
          <button
            className="play-again"
            onClick={handleNewGame}
            aria-label="Start a new game"
          >
            Play Again
          </button>
        )}

        <Keyboard
          onKeyPress={handleKeyPress}
          keyboardStatus={getKeyboardStatus()}
          disabled={gameOver}
        />
      </main>
    </div>
  );
}

export default App;
