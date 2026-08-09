import { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { WordleBoard, WordleKeyboard } from './components';
import { GameLayout } from '../../components/GameLayout/GameLayout';
import Lobby from '../../components/Lobby';
import Stats from '../../components/Stats';
import ErrorBoundary from '../../components/ErrorBoundary';
import { useGameSession } from '../../hooks/useGameSession';
import { useStatsStore, useUIStore } from '../../stores';
import { getJoinCodeFromUrl, generateShareUrl, generateWhatsAppUrl } from '../../utils/shareUrl';
import { useGameRouteCleanup } from '../../hooks/useGameRouteCleanup';
import './WordleGame.css';

export default function WordleGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Game session from orchestration hook
  const {
    gameMode,
    guesses,
    currentGuess,
    viewerGuess,
    gameOver,
    won,
    shake,
    message,
    suggestionStatus,
    isHost,
    isViewer,
    partnerConnected,
    sessionCode,
    sessionPin,
    connectionStatus,
    errorMessage,
    pendingSuggestion,
    handleKeyPress,
    getKeyboardStatus,
    handlePlaySolo,
    handleHost,
    handleJoin,
    handleLeave,
    handleNewGame,
    handleAcceptSuggestion,
    handleRejectSuggestion,
  } = useGameSession('wordle');

  // Stats from store
  const stats = useStatsStore((s) => s.stats);
  const recordGame = useStatsStore((s) => s.recordGame);

  // UI state from store
  const isStatsOpen = useUIStore((s) => s.isStatsOpen);
  const openStats = useUIStore((s) => s.openStats);
  const closeStats = useUIStore((s) => s.closeStats);

  // Derived stats
  const winPercentage = stats.gamesPlayed > 0
    ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
    : 0;
  const maxDistributionValue = Math.max(...stats.guessDistribution, 1);

  // Track game completion and record stats
  const gameIdentifier = gameOver ? `${guesses.length}-${won}` : null;
  const lastRecordedGameRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      gameOver &&
      gameMode &&
      !isViewer &&
      gameIdentifier !== null &&
      lastRecordedGameRef.current !== gameIdentifier
    ) {
      lastRecordedGameRef.current = gameIdentifier;
      recordGame(won, guesses.length, gameMode === 'solo' ? 'solo' : 'multiplayer');
      openStats();
    }

    if (!gameOver && lastRecordedGameRef.current !== null) {
      lastRecordedGameRef.current = null;
    }
  }, [gameOver, gameMode, isViewer, won, guesses.length, recordGame, openStats, gameIdentifier]);

  const handleBackToLobby = useCallback(() => {
    handleLeave();
  }, [handleLeave]);

  useGameRouteCleanup(handleLeave);

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
      const whatsappUrl = generateWhatsAppUrl(sessionCode, 'Wordle');
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    }
  }, [sessionCode]);

  // Get initial join code from URL
  const initialJoinCode = getJoinCodeFromUrl(searchParams);

  // Show lobby if no game mode selected
  if (!gameMode) {
    return (
      <Lobby
        gameName="Wordle"
        gameDescription="Guess the word in 6 tries"
        onHost={handleHost}
        onJoin={handleJoin}
        onPlaySolo={handlePlaySolo}
        onBack={() => navigate('/')}
        initialJoinCode={initialJoinCode}
      />
    );
  }

  return (
    <GameLayout
      gameId="wordle"
      gameName="Wordle"
      onBack={handleBackToLobby}
      headerActions={
        <button
          className="stats-btn"
          onClick={openStats}
          aria-label="View statistics"
        >
          Stats
        </button>
      }
    >
      <div className="wordle-game">
        {gameMode === 'multiplayer' && (
          <ErrorBoundary
            compact
            message="Connection status unavailable. The game may still work."
          >
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
                    <span className="partner-status error">{errorMessage}</span>
                  )}
                </div>
              )}
            </div>
          </ErrorBoundary>
        )}

        {message && (
          <div className={`game-message ${won ? 'game-message--won' : ''}`}>
            {message}
          </div>
        )}

        {/* Suggestion panel for host */}
        {isHost && pendingSuggestion && !gameOver && (
          <div
            className="suggestion-panel"
            role="region"
            aria-label="Partner suggestion"
          >
            <span className="suggestion-label">Partner suggests:</span>
            <span className="suggestion-word">{pendingSuggestion.word}</span>
            <div className="suggestion-actions">
              <button
                className="suggestion-btn accept"
                onClick={handleAcceptSuggestion}
                aria-label={`Accept suggestion: ${pendingSuggestion.word}`}
              >
                Accept
              </button>
              <button
                className="suggestion-btn reject"
                onClick={handleRejectSuggestion}
                aria-label={`Reject suggestion: ${pendingSuggestion.word}`}
              >
                Reject
              </button>
            </div>
          </div>
        )}

        <WordleBoard
          guesses={guesses}
          currentGuess={isViewer ? viewerGuess : currentGuess}
          shake={shake}
        />

        {gameOver && !isViewer && (
          <button className="play-again-btn" onClick={handleNewGame}>
            Play Again
          </button>
        )}

        <WordleKeyboard
          keyboardStatus={getKeyboardStatus()}
          onKey={(key) => handleKeyPress(key.toUpperCase())}
          onEnter={() => handleKeyPress('ENTER')}
          onBackspace={() => handleKeyPress('BACKSPACE')}
          disabled={gameOver}
        />
      </div>

      <ErrorBoundary
        compact
        message="Unable to display statistics. Try closing and reopening."
      >
        <Stats
          stats={stats}
          winPercentage={winPercentage}
          maxDistributionValue={maxDistributionValue}
          isOpen={isStatsOpen}
          onClose={closeStats}
          lastGuessCount={won && gameOver ? guesses.length : undefined}
        />
      </ErrorBoundary>
    </GameLayout>
  );
}
