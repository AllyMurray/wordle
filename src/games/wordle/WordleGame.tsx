import { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWordleStore } from './store';
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

  // Also use the new Wordle store for solo mode keyboard status
  const wordleStoreGuesses = useWordleStore((s) => s.guesses);
  const wordleStoreCurrentGuess = useWordleStore((s) => s.currentGuess);
  const wordleStoreGameOver = useWordleStore((s) => s.gameOver);
  const wordleStoreWon = useWordleStore((s) => s.won);
  const wordleStoreShake = useWordleStore((s) => s.shake);
  const wordleStoreMessage = useWordleStore((s) => s.message);
  const wordleStoreAddLetter = useWordleStore((s) => s.addLetter);
  const wordleStoreRemoveLetter = useWordleStore((s) => s.removeLetter);
  const wordleStoreSubmitGuess = useWordleStore((s) => s.submitGuess);
  const wordleStoreResetGame = useWordleStore((s) => s.resetGame);
  const wordleStoreGetKeyboardStatus = useWordleStore((s) => s.getKeyboardStatus);

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
  const effectiveGameOver = gameMode === 'solo' ? wordleStoreGameOver : gameOver;
  const effectiveWon = gameMode === 'solo' ? wordleStoreWon : won;
  const effectiveGuesses = gameMode === 'solo' ? wordleStoreGuesses : guesses;

  const gameIdentifier = effectiveGameOver ? `${effectiveGuesses.length}-${effectiveWon}` : null;
  const lastRecordedGameRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      effectiveGameOver &&
      gameMode &&
      !isViewer &&
      gameIdentifier !== null &&
      lastRecordedGameRef.current !== gameIdentifier
    ) {
      lastRecordedGameRef.current = gameIdentifier;
      recordGame(effectiveWon, effectiveGuesses.length, gameMode === 'solo' ? 'solo' : 'multiplayer');
      openStats();
    }

    if (!effectiveGameOver && lastRecordedGameRef.current !== null) {
      lastRecordedGameRef.current = null;
    }
  }, [effectiveGameOver, gameMode, isViewer, effectiveWon, effectiveGuesses.length, recordGame, openStats, gameIdentifier]);

  // Handle physical keyboard input for solo mode
  useEffect(() => {
    if (gameMode !== 'solo') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        wordleStoreSubmitGuess();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        wordleStoreRemoveLetter();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        wordleStoreAddLetter(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameMode, wordleStoreAddLetter, wordleStoreRemoveLetter, wordleStoreSubmitGuess]);

  const handleBackToLobby = useCallback(() => {
    handleLeave();
  }, [handleLeave]);

  useGameRouteCleanup(handleLeave);

  const handleSoloNewGame = useCallback(() => {
    wordleStoreResetGame();
  }, [wordleStoreResetGame]);

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

  // Solo mode - use the new Wordle store
  if (gameMode === 'solo') {
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
          {wordleStoreMessage && (
            <div className={`game-message ${wordleStoreWon ? 'game-message--won' : ''}`}>
              {wordleStoreMessage}
            </div>
          )}

          <WordleBoard
            guesses={wordleStoreGuesses}
            currentGuess={wordleStoreCurrentGuess}
            shake={wordleStoreShake}
          />

          {wordleStoreGameOver && (
            <button className="play-again-btn" onClick={handleSoloNewGame}>
              Play Again
            </button>
          )}

          <WordleKeyboard
            keyboardStatus={wordleStoreGetKeyboardStatus()}
            onKey={wordleStoreAddLetter}
            onEnter={wordleStoreSubmitGuess}
            onBackspace={wordleStoreRemoveLetter}
            disabled={wordleStoreGameOver}
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
            lastGuessCount={wordleStoreWon && wordleStoreGameOver ? wordleStoreGuesses.length : undefined}
          />
        </ErrorBoundary>
      </GameLayout>
    );
  }

  // Multiplayer mode - use the game session hook
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
        {/* Connection status for multiplayer */}
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
