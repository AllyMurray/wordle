import Board from './components/Board';
import Keyboard from './components/Keyboard';
import Lobby from './components/Lobby';
import { useGameSession } from './hooks/useGameSession';
import './App.css';

function App() {
  const {
    gameMode,
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
  } = useGameSession();

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
      <header className="header">
        <div className="header-content">
          <button className="back-btn" onClick={handleLeave}>
            ← Back
          </button>
          <h1>Wordle</h1>
          <div className="header-spacer" />
        </div>
      </header>

      {/* Connection status for multiplayer */}
      {gameMode === 'multiplayer' && (
        <div className="connection-status">
          {multiplayer.isHost && (
            <div className="session-info">
              <span className="session-label">Share code:</span>
              <span className="session-code">{multiplayer.sessionCode}</span>
              {multiplayer.partnerConnected ? (
                <span className="partner-status connected">Partner connected</span>
              ) : (
                <span className="partner-status waiting">Waiting for partner...</span>
              )}
            </div>
          )}
          {multiplayer.isViewer && (
            <div className="session-info">
              <span className="viewer-label">Playing with partner</span>
              {multiplayer.connectionStatus === 'connecting' && (
                <span className="partner-status waiting">Connecting...</span>
              )}
              {multiplayer.connectionStatus === 'connected' && !suggestionStatus && (
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
              {multiplayer.connectionStatus === 'error' && (
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
        {multiplayer.isHost && multiplayer.pendingSuggestion && !gameOver && (
          <div className="suggestion-panel">
            <span className="suggestion-label">Partner suggests:</span>
            <span className="suggestion-word">{multiplayer.pendingSuggestion.word}</span>
            <div className="suggestion-actions">
              <button className="suggestion-btn accept" onClick={handleAcceptSuggestion}>
                Accept
              </button>
              <button className="suggestion-btn reject" onClick={handleRejectSuggestion}>
                Reject
              </button>
            </div>
          </div>
        )}

        <Board
          guesses={guesses}
          currentGuess={multiplayer.isViewer ? viewerGuess : currentGuess}
          maxGuesses={maxGuesses}
          wordLength={wordLength}
          shake={shake}
        />

        {gameOver && !multiplayer.isViewer && (
          <button className="play-again" onClick={handleNewGame}>
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
