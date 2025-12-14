import { useEffect, useCallback, useState } from 'react';
import Board from './components/Board';
import Keyboard from './components/Keyboard';
import Lobby from './components/Lobby';
import { useWordle } from './hooks/useWordle';
import { useMultiplayer } from './hooks/useMultiplayer';
import './App.css';

function App() {
  const [gameMode, setGameMode] = useState(null); // null | 'solo' | 'multiplayer'

  const multiplayer = useMultiplayer();

  const {
    guesses,
    currentGuess,
    gameOver,
    won,
    shake,
    message,
    handleKeyPress,
    getKeyboardStatus,
    newGame,
    getGameState,
    setGameState,
    maxGuesses,
    wordLength
  } = useWordle({
    isViewer: multiplayer.isViewer,
    onStateChange: multiplayer.isHost ? multiplayer.sendGameState : undefined,
  });

  // Register callback for receiving game state (viewer)
  useEffect(() => {
    if (multiplayer.isViewer) {
      multiplayer.onGameStateReceived(setGameState);
    }
  }, [multiplayer.isViewer, multiplayer.onGameStateReceived, setGameState]);

  // Send initial state when viewer connects (host)
  useEffect(() => {
    if (multiplayer.isHost && multiplayer.partnerConnected) {
      multiplayer.sendGameState(getGameState());
    }
  }, [multiplayer.isHost, multiplayer.partnerConnected, multiplayer.sendGameState, getGameState]);

  // Handle physical keyboard input
  const handleKeyDown = useCallback((e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (multiplayer.isViewer) return;

    if (e.key === 'Enter') {
      handleKeyPress('ENTER');
    } else if (e.key === 'Backspace') {
      handleKeyPress('BACKSPACE');
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      handleKeyPress(e.key.toUpperCase());
    }
  }, [handleKeyPress, multiplayer.isViewer]);

  useEffect(() => {
    if (gameMode) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, gameMode]);

  const handlePlaySolo = () => {
    setGameMode('solo');
  };

  const handleHost = () => {
    multiplayer.hostGame();
    setGameMode('multiplayer');
  };

  const handleJoin = (code) => {
    multiplayer.joinGame(code);
    setGameMode('multiplayer');
  };

  const handleLeave = () => {
    multiplayer.leaveSession();
    setGameMode(null);
    newGame();
  };

  const handleNewGame = () => {
    newGame();
    // Send new game state to viewer
    if (multiplayer.isHost && multiplayer.partnerConnected) {
      setTimeout(() => {
        multiplayer.sendGameState(getGameState());
      }, 0);
    }
  };

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
              <span className="viewer-label">Viewing game</span>
              {multiplayer.connectionStatus === 'connecting' && (
                <span className="partner-status waiting">Connecting...</span>
              )}
              {multiplayer.connectionStatus === 'connected' && (
                <span className="partner-status connected">Connected</span>
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

        <Board
          guesses={guesses}
          currentGuess={currentGuess}
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
          disabled={multiplayer.isViewer}
        />
      </main>
    </div>
  );
}

export default App;
