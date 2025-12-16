import { useState, useCallback } from 'react';
import Board from './components/Board';
import Keyboard from './components/Keyboard';
import Lobby from './components/Lobby';
import ScreenReaderAnnouncement from './components/ScreenReaderAnnouncement';
import { useGameContext } from './contexts/GameContext';
import { useGameAnnouncements } from './hooks/useGameAnnouncements';
import { sanitizeSessionCode, isValidSessionCode } from './types';
import './App.css';

// Get join code from URL query parameter
const getJoinCodeFromUrl = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  const joinCode = params.get('join');
  if (joinCode) {
    const sanitized = sanitizeSessionCode(joinCode);
    if (isValidSessionCode(sanitized)) {
      return sanitized;
    }
  }
  return null;
};

// Generate a share URL with the session code
const generateShareUrl = (sessionCode: string): string => {
  const url = new URL(window.location.href);
  url.search = ''; // Clear existing params
  url.searchParams.set('join', sessionCode);
  return url.toString();
};

// Generate WhatsApp share URL
const generateWhatsAppUrl = (sessionCode: string): string => {
  const shareUrl = generateShareUrl(sessionCode);
  const message = `Join my Wordle game! ${shareUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
};

function App() {
  const [copyFeedback, setCopyFeedback] = useState(false);
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

  // Handle copy link to clipboard
  const handleCopyLink = useCallback((): void => {
    if (sessionCode) {
      const shareUrl = generateShareUrl(sessionCode);
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      });
    }
  }, [sessionCode]);

  // Handle WhatsApp share
  const handleWhatsAppShare = useCallback((): void => {
    if (sessionCode) {
      const whatsappUrl = generateWhatsAppUrl(sessionCode);
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    }
  }, [sessionCode]);

  // Get initial join code from URL
  const initialJoinCode = getJoinCodeFromUrl();

  // Show lobby if no game mode selected
  if (!gameMode) {
    return (
      <Lobby
        onHost={handleHost}
        onJoin={handleJoin}
        onPlaySolo={handlePlaySolo}
        initialJoinCode={initialJoinCode}
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
              <div className="share-buttons">
                <button
                  className="share-btn copy"
                  onClick={handleCopyLink}
                  aria-label="Copy game link to clipboard"
                  title="Copy link"
                >
                  {copyFeedback ? 'Copied!' : 'Copy Link'}
                </button>
                <button
                  className="share-btn whatsapp"
                  onClick={handleWhatsAppShare}
                  aria-label="Share game link via WhatsApp"
                  title="Share on WhatsApp"
                >
                  WhatsApp
                </button>
              </div>
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
