import { useEffect, useCallback, useState } from 'react';
import Board from './components/Board';
import Keyboard from './components/Keyboard';
import Lobby from './components/Lobby';
import { useWordle } from './hooks/useWordle';
import { useMultiplayer } from './hooks/useMultiplayer';
import type { GameMode, SuggestionStatus } from './types';
import './App.css';

function App() {
  const [gameMode, setGameMode] = useState<GameMode>(null);
  const [suggestionStatus, setSuggestionStatus] = useState<SuggestionStatus>(null);

  const multiplayer = useMultiplayer();

  // Handle viewer guess changes - send to host as suggestion preview
  const handleViewerGuessChange = useCallback((guess: string): void => {
    if (guess.length === 5) {
      multiplayer.sendSuggestion(guess);
    } else {
      multiplayer.clearSuggestion();
    }
  }, [multiplayer]);

  const {
    guesses,
    currentGuess,
    viewerGuess,
    gameOver,
    won,
    shake,
    message,
    handleKeyPress,
    getKeyboardStatus,
    newGame,
    getGameState,
    setGameState,
    submitWord,
    clearViewerGuess,
    maxGuesses,
    wordLength
  } = useWordle({
    isViewer: multiplayer.isViewer,
    onStateChange: multiplayer.isHost ? multiplayer.sendGameState : undefined,
    onViewerGuessChange: multiplayer.isViewer ? handleViewerGuessChange : undefined,
  });

  // Register callback for receiving game state (viewer)
  useEffect(() => {
    if (multiplayer.isViewer) {
      multiplayer.onGameStateReceived((state) => {
        setGameState(state);
        // Clear viewer's local guess when game state changes (word was submitted)
        clearViewerGuess();
        setSuggestionStatus(null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiplayer.isViewer, multiplayer.onGameStateReceived, setGameState, clearViewerGuess]);

  // Register callback for suggestion responses (viewer)
  useEffect(() => {
    if (multiplayer.isViewer) {
      multiplayer.onSuggestionResponse((accepted) => {
        setSuggestionStatus(accepted ? 'accepted' : 'rejected');
        if (!accepted) {
          // Clear viewer guess on rejection
          clearViewerGuess();
        }
        // Clear status after a moment
        setTimeout(() => setSuggestionStatus(null), 1500);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiplayer.isViewer, multiplayer.onSuggestionResponse, clearViewerGuess]);

  // Send initial state when viewer connects (host)
  useEffect(() => {
    if (multiplayer.isHost && multiplayer.partnerConnected) {
      multiplayer.sendGameState(getGameState());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiplayer.isHost, multiplayer.partnerConnected, multiplayer.sendGameState, getGameState]);

  // Handle physical keyboard input
  const handleKeyDown = useCallback((e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Enter') {
      const result = handleKeyPress('ENTER');
      // If viewer pressed enter with a complete word, mark as pending
      if (result === 'submit-suggestion' && viewerGuess.length === 5) {
        setSuggestionStatus('pending');
      }
    } else if (e.key === 'Backspace') {
      handleKeyPress('BACKSPACE');
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      handleKeyPress(e.key.toUpperCase());
    }
  }, [handleKeyPress, viewerGuess]);

  useEffect(() => {
    if (gameMode) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, gameMode]);

  const handlePlaySolo = (): void => {
    setGameMode('solo');
  };

  const handleHost = (): void => {
    multiplayer.hostGame();
    setGameMode('multiplayer');
  };

  const handleJoin = (code: string): void => {
    multiplayer.joinGame(code);
    setGameMode('multiplayer');
  };

  const handleLeave = (): void => {
    multiplayer.leaveSession();
    setGameMode(null);
    newGame();
  };

  const handleNewGame = (): void => {
    newGame();
    // Send new game state to viewer
    if (multiplayer.isHost && multiplayer.partnerConnected) {
      setTimeout(() => {
        multiplayer.sendGameState(getGameState());
      }, 0);
    }
  };

  // Handle host accepting a suggestion
  const handleAcceptSuggestion = useCallback((): void => {
    const word = multiplayer.acceptSuggestion();
    if (word) {
      submitWord(word);
    }
  }, [multiplayer, submitWord]);

  // Handle host rejecting a suggestion
  const handleRejectSuggestion = useCallback((): void => {
    multiplayer.rejectSuggestion();
  }, [multiplayer]);

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
