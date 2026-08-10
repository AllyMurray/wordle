import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBoggleStore } from './store';
import { useTimerStore } from '../../stores/timerStore';
import {
  BoggleBoard,
  Timer,
  WordList,
  AllWordsList,
  BoggleLoadingState,
  BoggleWordFeedback,
  BoggleStats,
} from './components';
import { GameLayout } from '../../components/GameLayout/GameLayout';
import Lobby from '../../components/Lobby';
import ErrorBoundary from '../../components/ErrorBoundary';
import { ConnectionAlert } from '../../components/ConnectionAlert';
import {
  registerBoggleStateCallback,
  registerBoggleWordCallback,
  registerBoggleWordResultCallback,
  registerStateRequestCallback,
  useMultiplayerStore,
} from '../../stores/multiplayerStore';
import { useStatsStore } from '../../stores/statsStore';
import { useUIStore } from '../../stores/uiStore';
import { useMultiplayerReconnection } from '../../hooks/useMultiplayerReconnection';
import { useGameRouteCleanup } from '../../hooks/useGameRouteCleanup';
import { getJoinCodeFromUrl, generateShareUrl, generateWhatsAppUrl } from '../../utils/shareUrl';
import type { GameMode } from '../../types';
import type { BoggleWordResult } from '../../types';
import './BoggleGame.css';

const GAME_DURATION = 180; // 3 minutes

type GamePhase = 'lobby' | 'modeSelect' | 'loading' | 'playing' | 'gameOver';

export default function BoggleGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [loadingError, setLoadingError] = useState('');
  const [wordFeedback, setWordFeedback] = useState<BoggleWordResult | null>(null);

  // Game phase state machine: lobby → modeSelect → loading → playing → gameOver
  const [gamePhase, setGamePhase] = useState<GamePhase>('lobby');

  // Track which mode (solo/multiplayer) for UI purposes
  const [localGameMode, setLocalGameMode] = useState<GameMode>(null);

  // Track if game is timed or untimed
  const [timedMode, setTimedMode] = useState(true);

  // Boggle store state
  const board = useBoggleStore((s) => s.board);
  const foundWords = useBoggleStore((s) => s.foundWords);
  const currentPath = useBoggleStore((s) => s.currentPath);
  const currentWord = useBoggleStore((s) => s.currentWord);
  const score = useBoggleStore((s) => s.score);
  const maxScore = useBoggleStore((s) => s.maxScore);
  const wordsByLength = useBoggleStore((s) => s.wordsByLength);
  const possibleWords = useBoggleStore((s) => s.possibleWords);
  const highlightedPath = useBoggleStore((s) => s.highlightedPath);

  const initGame = useBoggleStore((s) => s.initGame);
  const selectTile = useBoggleStore((s) => s.selectTile);
  const submitWord = useBoggleStore((s) => s.submitWord);
  const endGame = useBoggleStore((s) => s.endGame);
  const resetGame = useBoggleStore((s) => s.resetGame);
  const rotateBoard = useBoggleStore((s) => s.rotateBoard);
  const highlightWord = useBoggleStore((s) => s.highlightWord);
  const clearHighlight = useBoggleStore((s) => s.clearHighlight);
  const clearSelection = useBoggleStore((s) => s.clearSelection);
  const submitWordByText = useBoggleStore((s) => s.submitWordByText);
  const applyMultiplayerState = useBoggleStore((s) => s.applyMultiplayerState);

  // Timer store state
  const timeRemaining = useTimerStore((s) => s.timeRemaining);
  const startTimer = useTimerStore((s) => s.start);
  const stopTimer = useTimerStore((s) => s.stop);
  const resetTimer = useTimerStore((s) => s.reset);

  // Multiplayer store
  const role = useMultiplayerStore((s) => s.role);
  const sessionCode = useMultiplayerStore((s) => s.sessionCode);
  const sessionPin = useMultiplayerStore((s) => s.sessionPin);
  const connectionStatus = useMultiplayerStore((s) => s.connectionStatus);
  const errorMessage = useMultiplayerStore((s) => s.errorMessage);
  const partnerConnected = useMultiplayerStore((s) => s.partnerConnected);

  const hostGame = useMultiplayerStore((s) => s.hostGame);
  const joinGame = useMultiplayerStore((s) => s.joinGame);
  const leaveSession = useMultiplayerStore((s) => s.leaveSession);
  const sendBoggleState = useMultiplayerStore((s) => s.sendBoggleState);
  const sendBoggleWord = useMultiplayerStore((s) => s.sendBoggleWord);

  // Stats
  const recordBoggleGame = useStatsStore((s) => s.recordBoggleGame);
  const boggleStats = useStatsStore((s) => s.boggleStats);
  const isStatsOpen = useUIStore((s) => s.isStatsOpen);
  const openStats = useUIStore((s) => s.openStats);
  const closeStats = useUIStore((s) => s.closeStats);

  // Track game completion for stats
  const lastRecordedGameRef = useRef<string | null>(null);

  // Ref to track current game phase for use in subscriptions (avoids stale closures)
  const gamePhaseRef = useRef(gamePhase);
  useEffect(() => {
    gamePhaseRef.current = gamePhase;
  }, [gamePhase]);

  const isHost = role === 'host';
  const isViewer = role === 'viewer';

  // Handle loading → playing transition
  useEffect(() => {
    if (gamePhase !== 'loading') return;
    if (localGameMode === 'multiplayer' && isViewer) return;

    let cancelled = false;

    initGame()
      .then(() => {
        if (!cancelled) {
          setLoadingError('');
          setGamePhase('playing');
          if (timedMode) {
            startTimer(GAME_DURATION);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadingError('Unable to load the word list. Check your connection and try again.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [gamePhase, initGame, startTimer, timedMode, localGameMode, isViewer]);

  // Handle playing → gameOver transition when timer reaches zero (only in timed mode)
  // Uses subscription pattern to avoid setState in effect body
  useEffect(() => {
    if (!timedMode) return; // No auto-end for untimed games

    const unsubscribe = useTimerStore.subscribe(
      (state) => state.timeRemaining,
      (timeRemaining) => {
        if (gamePhaseRef.current === 'playing' && timeRemaining === 0) {
          setGamePhase('gameOver');
          endGame();
        }
      }
    );
    return unsubscribe;
  }, [endGame, timedMode]);

  // Record stats when game ends
  useEffect(() => {
    const isGameOver = gamePhase === 'gameOver';
    const gameIdentifier = isGameOver ? `${score}-${foundWords.length}` : null;

    if (
      isGameOver &&
      localGameMode &&
      !isViewer &&
      gameIdentifier !== null &&
      lastRecordedGameRef.current !== gameIdentifier
    ) {
      lastRecordedGameRef.current = gameIdentifier;
      recordBoggleGame(score, foundWords.length, localGameMode === 'solo' ? 'solo' : 'multiplayer');
      openStats();
    }

    if (!isGameOver && lastRecordedGameRef.current !== null) {
      lastRecordedGameRef.current = null;
    }
  }, [
    gamePhase,
    localGameMode,
    isViewer,
    score,
    foundWords.length,
    recordBoggleGame,
    openStats,
  ]);

  // Handle page visibility changes for connection restoration
  useMultiplayerReconnection();

  // Viewers wait for the host's authoritative board, score, and timer.
  useEffect(() => {
    if (!isViewer) return;

    registerBoggleStateCallback((state) => {
      void applyMultiplayerState(state)
        .then(() => {
          setLoadingError('');
          resetTimer(state.timeRemaining);
          setTimedMode(state.timedMode);
          setGamePhase(state.gameOver ? 'gameOver' : 'playing');
        })
        .catch(() => {
          setLoadingError('Unable to load the word list. Check your connection and try again.');
        });
    });

    return () => registerBoggleStateCallback(null);
  }, [isViewer, applyMultiplayerState, resetTimer]);

  // The host validates words submitted by the viewer against its own board.
  useEffect(() => {
    if (!isHost) return;

    registerBoggleWordCallback((word) => {
      const result = submitWordByText(word);
      return {
        word: result.word || word,
        accepted: result.success,
        ...(result.reason ? { reason: result.reason } : {}),
      };
    });

    return () => registerBoggleWordCallback(null);
  }, [isHost, submitWordByText]);

  useEffect(() => {
    if (!isViewer) return;

    registerBoggleWordResultCallback(setWordFeedback);
    return () => registerBoggleWordResultCallback(null);
  }, [isViewer]);

  useEffect(() => {
    if (!wordFeedback) return;
    const timeout = setTimeout(() => setWordFeedback(null), 2500);
    return () => clearTimeout(timeout);
  }, [wordFeedback]);

  // Broadcast host-authoritative state, including the timer, on every change.
  useEffect(() => {
    if (
      !isHost ||
      !partnerConnected ||
      localGameMode !== 'multiplayer' ||
      !board ||
      (gamePhase !== 'playing' && gamePhase !== 'gameOver')
    ) {
      return;
    }

    sendBoggleState({
      board,
      foundWords,
      score,
      gameOver: gamePhase === 'gameOver',
      timeRemaining,
      timedMode,
    });
  }, [
    isHost,
    partnerConnected,
    localGameMode,
    board,
    foundWords,
    score,
    gamePhase,
    timeRemaining,
    timedMode,
    sendBoggleState,
  ]);

  // Reconnecting viewers request a fresh snapshot even when the host's
  // partnerConnected flag was already true for the replaced connection.
  useEffect(() => {
    if (!isHost) return;

    registerStateRequestCallback(() => {
      const state = useBoggleStore.getState();
      if (!state.board || (gamePhaseRef.current !== 'playing' && gamePhaseRef.current !== 'gameOver')) {
        return;
      }

      sendBoggleState({
        board: state.board,
        foundWords: state.foundWords,
        score: state.score,
        gameOver: gamePhaseRef.current === 'gameOver',
        timeRemaining: useTimerStore.getState().timeRemaining,
        timedMode,
      });
    });

    return () => registerStateRequestCallback(null);
  }, [isHost, sendBoggleState, timedMode]);

  const handleBack = useCallback(() => {
    stopTimer();
    navigate('/');
  }, [navigate, stopTimer]);

  const handleBackToLobby = useCallback(() => {
    stopTimer();
    closeStats();
    resetGame();
    leaveSession();
    setLocalGameMode(null);
    setTimedMode(true);
    setLoadingError('');
    setGamePhase('lobby');
  }, [stopTimer, closeStats, resetGame, leaveSession]);

  const handleRouteCleanup = useCallback(() => {
    stopTimer();
    closeStats();
    resetGame();
    leaveSession();
  }, [stopTimer, closeStats, resetGame, leaveSession]);

  useGameRouteCleanup(handleRouteCleanup);

  // Track selected word for highlighting in game over state
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  const handleNewGame = useCallback(() => {
    setSelectedWord(null);
    closeStats();
    setLoadingError('');
    setGamePhase('loading');
  }, [closeStats]);

  const handleSubmit = useCallback(() => {
    if (isViewer) {
      if (currentWord.length >= 3) {
        setWordFeedback(null);
        sendBoggleWord(currentWord);
      }
      clearSelection();
      return;
    }

    const result = submitWord();
    setWordFeedback({
      word: result.word || currentWord,
      accepted: result.success,
      ...(result.reason ? { reason: result.reason } : {}),
    });
  }, [isViewer, currentWord, sendBoggleWord, clearSelection, submitWord]);

  // Rotation animation state
  const [rotationAnimation, setRotationAnimation] = useState<'left' | 'right' | null>(null);

  const handleRotateLeft = useCallback(() => {
    if (rotationAnimation) return; // Prevent double-click during animation
    setRotationAnimation('left');
  }, [rotationAnimation]);

  const handleRotateRight = useCallback(() => {
    if (rotationAnimation) return; // Prevent double-click during animation
    setRotationAnimation('right');
  }, [rotationAnimation]);

  const handleRotationAnimationEnd = useCallback(() => {
    if (rotationAnimation) {
      rotateBoard(rotationAnimation);
      setRotationAnimation(null);
    }
  }, [rotationAnimation, rotateBoard]);

  // Handle word selection for highlighting
  const handleWordSelect = useCallback(
    (word: string | null) => {
      setSelectedWord(word);
      if (word) {
        highlightWord(word);
      } else {
        clearHighlight();
      }
    },
    [highlightWord, clearHighlight]
  );

  // Game mode handlers
  const handlePlaySolo = useCallback(() => {
    setLocalGameMode('solo');
    setGamePhase('modeSelect');
  }, []);

  const handleStartTimed = useCallback(() => {
    setTimedMode(true);
    setLoadingError('');
    setGamePhase('loading');
  }, []);

  const handleStartUntimed = useCallback(() => {
    setTimedMode(false);
    setLoadingError('');
    setGamePhase('loading');
  }, []);

  // End game manually (for untimed mode)
  const handleEndGame = useCallback(() => {
    setGamePhase('gameOver');
    endGame();
  }, [endGame]);

  const handleHost = useCallback(
    (pin?: string) => {
      setLoadingError('');
      hostGame('boggle', pin);
      setLocalGameMode('multiplayer');
      setGamePhase('loading');
    },
    [hostGame]
  );

  const handleJoin = useCallback(
    (code: string, pin?: string) => {
      if (!joinGame('boggle', code, pin)) return;

      setLoadingError('');
      setLocalGameMode('multiplayer');
      setGamePhase('loading');
    },
    [joinGame]
  );

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
      const whatsappUrl = generateWhatsAppUrl(sessionCode, 'Boggle');
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    }
  }, [sessionCode]);

  // Get initial join code from URL
  const initialJoinCode = getJoinCodeFromUrl(searchParams);

  // Render based on game phase
  if (gamePhase === 'lobby') {
    return (
      <Lobby
        gameName="Boggle"
        gameDescription="Find words in a grid of letters"
        onHost={handleHost}
        onJoin={handleJoin}
        onPlaySolo={handlePlaySolo}
        onBack={handleBack}
        initialJoinCode={initialJoinCode}
      />
    );
  }

  if (gamePhase === 'modeSelect') {
    return (
      <GameLayout gameId="boggle" gameName="Boggle" onBack={handleBackToLobby}>
        <div className="boggle-game">
          <div className="mode-select">
            <h2>Choose Game Mode</h2>
            <p>How would you like to play?</p>
            <div className="mode-buttons">
              <button className="mode-btn timed" onClick={handleStartTimed}>
                <span className="mode-icon">⏱</span>
                <span className="mode-label">Timed</span>
                <span className="mode-desc">3 minutes to find words</span>
              </button>
              <button className="mode-btn untimed" onClick={handleStartUntimed}>
                <span className="mode-icon">∞</span>
                <span className="mode-label">Relaxed</span>
                <span className="mode-desc">Play at your own pace</span>
              </button>
            </div>
          </div>
        </div>
      </GameLayout>
    );
  }

  if (gamePhase === 'loading' || !board) {
    return (
      <GameLayout gameId="boggle" gameName="Boggle" onBack={handleBackToLobby}>
        <div className="boggle-game">
          <BoggleLoadingState
            isMultiplayerViewer={localGameMode === 'multiplayer' && isViewer}
            connectionStatus={connectionStatus}
            errorMessage={loadingError || errorMessage}
          />
        </div>
      </GameLayout>
    );
  }

  return (
    <GameLayout
      gameId="boggle"
      gameName="Boggle"
      onBack={handleBackToLobby}
      headerActions={
        <button className="stats-btn" onClick={openStats} aria-label="View Boggle statistics">
          Stats
        </button>
      }
    >
      <div className="boggle-game">
        {/* Connection status for multiplayer */}
        {localGameMode === 'multiplayer' && (
          <ErrorBoundary
            compact
            message="Connection status unavailable. The game may still work."
          >
            <div className="connection-status">
              {isHost && (
                <div className="session-info">
                  {sessionCode ? (
                    <>
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
                    </>
                  ) : connectionStatus !== 'error' ? (
                    <span className="partner-status waiting">Creating session...</span>
                  ) : null}
                  <ConnectionAlert status={connectionStatus} message={errorMessage} />
                  {connectionStatus !== 'error' &&
                    sessionCode &&
                    (partnerConnected ? (
                      <span className="partner-status connected">Partner connected</span>
                    ) : (
                      <span className="partner-status waiting">Waiting for partner...</span>
                    ))}
                </div>
              )}
              {isViewer && (
                <div className="session-info">
                  <span className="viewer-label">Playing with partner</span>
                  {connectionStatus === 'connecting' && (
                    <span className="partner-status waiting">Connecting...</span>
                  )}
                  {connectionStatus === 'connected' && (
                    <span className="partner-status connected">Connected</span>
                  )}
                  <ConnectionAlert status={connectionStatus} message={errorMessage} />
                </div>
              )}
            </div>
          </ErrorBoundary>
        )}

        <BoggleWordFeedback result={wordFeedback} />

        <div className="boggle-game-bar">
          <div className="boggle-stats-bar">
            {gamePhase === 'gameOver' ? (
              <div className="stats-bar__status stats-bar__status--gameover">
                {timedMode ? "Time's Up!" : 'Game Over'}
              </div>
            ) : timedMode ? (
              <Timer timeRemaining={timeRemaining} />
            ) : (
              <div className="stats-bar__status stats-bar__status--relaxed">Relaxed</div>
            )}
            <div className="stats-bar__divider" />
            <div className="stats-bar__score">
              <strong>{score}</strong>
              <span className="stats-bar__score-max">/{maxScore}</span>
            </div>
            <div className="stats-bar__divider" />
            <div className="stats-bar__words">
              <span className="stats-bar__words-count">
                <strong>{foundWords.length}</strong>/{possibleWords.length}
              </span>
              <span className="stats-bar__words-label">words</span>
            </div>
            <div className="stats-bar__divider stats-bar__divider--mobile-hide" />
            <div className="stats-bar__breakdown">
              {Object.keys(wordsByLength)
                .map(Number)
                .sort((a, b) => a - b)
                .map((len, index) => {
                  const data = wordsByLength[len];
                  if (!data) return null;
                  const isComplete = data.found === data.total;
                  return (
                    <span
                      key={len}
                      className={`stats-bar__len${isComplete ? ' stats-bar__len--complete' : ''}`}
                    >
                      {index > 0 && <span className="stats-bar__len-sep">•</span>}
                      <span className="stats-bar__len-label">{len}L:</span>
                      <strong>{data.found}</strong>/{data.total}
                    </span>
                  );
                })}
            </div>
          </div>
          <div className="boggle-controls">
            <button
              className="control-btn rotate-btn"
              onClick={handleRotateLeft}
              disabled={gamePhase === 'gameOver' || isViewer}
              aria-label="Rotate board left 90 degrees"
              title="Rotate left"
            >
              <span className="rotate-icon">↺</span>
            </button>
            {gamePhase === 'gameOver' ? (
              <button
                className="control-btn play-again-btn"
                onClick={handleNewGame}
                disabled={isViewer}
                aria-label="Play again"
              >
                Play Again
              </button>
            ) : timedMode ? (
              <button
                className="control-btn new-game-btn"
                onClick={handleNewGame}
                disabled={isViewer}
                aria-label="Start a new game"
              >
                New Game
              </button>
            ) : (
              <button
                className="control-btn end-game-btn"
                onClick={handleEndGame}
                disabled={isViewer}
                aria-label="End current game"
              >
                End Game
              </button>
            )}
            <button
              className="control-btn rotate-btn"
              onClick={handleRotateRight}
              disabled={gamePhase === 'gameOver' || isViewer}
              aria-label="Rotate board right 90 degrees"
              title="Rotate right"
            >
              <span className="rotate-icon">↻</span>
            </button>
          </div>
        </div>

        <div className="boggle-content">
          <BoggleBoard
            board={board}
            selectedPath={currentPath}
            currentWord={currentWord}
            onTileSelect={selectTile}
            onSubmit={handleSubmit}
            onClear={clearSelection}
            disabled={gamePhase === 'gameOver'}
            rotationAnimation={rotationAnimation}
            onRotationAnimationEnd={handleRotationAnimationEnd}
            highlightedPath={highlightedPath}
          />
          <div className="boggle-sidebar">
            {gamePhase === 'gameOver' ? (
              <AllWordsList
                possibleWords={possibleWords}
                foundWords={foundWords}
                selectedWord={selectedWord}
                onWordSelect={handleWordSelect}
              />
            ) : (
              <WordList words={foundWords} totalScore={score} />
            )}
          </div>
        </div>
      </div>
      <BoggleStats stats={boggleStats} isOpen={isStatsOpen} onClose={closeStats} />
    </GameLayout>
  );
}
