import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import type {
  MultiplayerRole,
  ConnectionStatus,
  PendingSuggestion,
  GameState,
  ViewerGameState,
  UseMultiplayerReturn,
  PeerMessage,
} from '../types';
import { validatePeerMessage, NETWORK_CONFIG } from '../types';

// Generate a unique message ID for acknowledgment tracking
const generateMessageId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Message with ID for acknowledgment tracking
interface PendingMessage {
  id: string;
  message: PeerMessage;
  retries: number;
  timeoutId: ReturnType<typeof setTimeout>;
}

// Generate a short, readable session code
const generateSessionCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const useMultiplayer = (): UseMultiplayerReturn => {
  const [role, setRole] = useState<MultiplayerRole>(null);
  const [sessionCode, setSessionCode] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState('');
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<PendingSuggestion | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const connectionRef = useRef<DataConnection | null>(null);
  const gameStateCallbackRef = useRef<((state: ViewerGameState) => void) | null>(null);
  const suggestionResponseCallbackRef = useRef<((accepted: boolean) => void) | null>(null);
  const hostGameRef = useRef<(() => void) | null>(null);

  // Reconnection state refs
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSessionCodeRef = useRef('');
  const isReconnectingRef = useRef(false);
  const attemptConnectionRef = useRef<((code: string, isReconnect?: boolean) => void) | null>(null);

  // Message acknowledgment refs
  const pendingMessagesRef = useRef<Map<string, PendingMessage>>(new Map());

  // Heartbeat refs
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastHeartbeatRef = useRef<number>(0);
  const heartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear all pending message timeouts
  const clearPendingMessages = useCallback((): void => {
    pendingMessagesRef.current.forEach((pending) => {
      clearTimeout(pending.timeoutId);
    });
    pendingMessagesRef.current.clear();
  }, []);

  // Stop heartbeat monitoring
  const stopHeartbeat = useCallback((): void => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  // Clear reconnection timeout
  const clearReconnectTimeout = useCallback((): void => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    isReconnectingRef.current = false;
  }, []);

  // Cleanup peer connection
  const cleanup = useCallback((): void => {
    clearPendingMessages();
    stopHeartbeat();
    clearReconnectTimeout();

    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setPartnerConnected(false);
    setPendingSuggestion(null);
    reconnectAttemptsRef.current = 0;
  }, [clearPendingMessages, stopHeartbeat, clearReconnectTimeout]);

  // Send a message with optional acknowledgment tracking
  const sendWithAck = useCallback(
    (
      conn: DataConnection,
      message: PeerMessage,
      requireAck: boolean = false,
      onAckTimeout?: () => void
    ): string | null => {
      if (!conn.open) return null;

      const messageId = generateMessageId();

      // Add message ID to the message for tracking (using type assertion for internal tracking)
      const messageWithId = { ...message, _messageId: messageId };
      conn.send(messageWithId);

      if (requireAck) {
        const scheduleRetry = (): ReturnType<typeof setTimeout> => {
          const timeoutId = setTimeout(() => {
            const pending = pendingMessagesRef.current.get(messageId);
            if (!pending) return;

            if (pending.retries < NETWORK_CONFIG.MAX_RETRY_ATTEMPTS) {
              // Retry sending
              if (conn.open) {
                conn.send(messageWithId);
                pending.retries++;
                pending.timeoutId = scheduleRetry();
              }
            } else {
              // Max retries reached
              pendingMessagesRef.current.delete(messageId);
              onAckTimeout?.();
            }
          }, NETWORK_CONFIG.ACK_TIMEOUT_MS);

          return timeoutId;
        };

        const pendingMessage: PendingMessage = {
          id: messageId,
          message,
          retries: 0,
          timeoutId: scheduleRetry(),
        };
        pendingMessagesRef.current.set(messageId, pendingMessage);
      }

      return messageId;
    },
    []
  );

  // Handle incoming acknowledgment
  const handleAck = useCallback((messageId: string): void => {
    const pending = pendingMessagesRef.current.get(messageId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      pendingMessagesRef.current.delete(messageId);
    }
  }, []);

  // Send acknowledgment for a received message
  const sendAck = useCallback((conn: DataConnection, messageId: string): void => {
    if (conn.open) {
      const ackMessage: PeerMessage = { type: 'ack', messageId };
      conn.send(ackMessage);
    }
  }, []);

  // Start heartbeat monitoring (for viewer)
  const startHeartbeat = useCallback(
    (conn: DataConnection, onTimeout: () => void): void => {
      stopHeartbeat();
      lastHeartbeatRef.current = Date.now();

      // Send periodic pings
      heartbeatIntervalRef.current = setInterval(() => {
        if (conn.open) {
          const pingMessage: PeerMessage = { type: 'ping', timestamp: Date.now() };
          conn.send(pingMessage);

          // Set timeout for pong response
          heartbeatTimeoutRef.current = setTimeout(() => {
            const timeSinceLastHeartbeat = Date.now() - lastHeartbeatRef.current;
            if (timeSinceLastHeartbeat > NETWORK_CONFIG.HEARTBEAT_TIMEOUT_MS) {
              onTimeout();
            }
          }, NETWORK_CONFIG.HEARTBEAT_TIMEOUT_MS);
        }
      }, NETWORK_CONFIG.HEARTBEAT_INTERVAL_MS);
    },
    [stopHeartbeat]
  );

  // Handle received heartbeat
  const handleHeartbeat = useCallback((): void => {
    lastHeartbeatRef.current = Date.now();
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  // Calculate reconnection delay with exponential backoff
  const getReconnectDelay = useCallback((): number => {
    const delay = Math.min(
      NETWORK_CONFIG.INITIAL_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current),
      NETWORK_CONFIG.MAX_RECONNECT_DELAY_MS
    );
    return delay;
  }, []);

  // Host a new game session
  const hostGame = useCallback((): void => {
    cleanup();
    setRole('host');
    setConnectionStatus('connecting');
    setErrorMessage('');

    const code = generateSessionCode();
    const peerId = `wordle-${code}`;

    const peer = new Peer(peerId, {
      debug: 0,
    });

    peer.on('open', () => {
      setSessionCode(code);
      setConnectionStatus('connected');
    });

    peer.on('connection', (conn: DataConnection) => {
      // Close old connection if exists (for rejoin support)
      if (connectionRef.current) {
        connectionRef.current.close();
      }
      connectionRef.current = conn;
      setPendingSuggestion(null); // Clear any pending suggestion from old viewer

      conn.on('open', () => {
        setPartnerConnected(true);
      });

      conn.on('data', (data) => {
        // Extract message ID if present for ack tracking
        const dataWithId = data as { _messageId?: string };
        const messageId = dataWithId._messageId;

        const validationResult = validatePeerMessage(data);
        if (!validationResult.success) {
          console.warn('Invalid peer message received:', validationResult.error);
          return;
        }
        const message = validationResult.message;

        // Handle acknowledgment messages
        if (message.type === 'ack') {
          handleAck(message.messageId);
          return;
        }

        // Handle heartbeat messages
        if (message.type === 'ping') {
          // Respond with pong
          const pongMessage: PeerMessage = { type: 'pong', timestamp: message.timestamp };
          conn.send(pongMessage);
          return;
        }
        if (message.type === 'pong') {
          handleHeartbeat();
          return;
        }

        // Send ack for critical messages if messageId present
        if (messageId && (message.type === 'suggest-word' || message.type === 'request-state')) {
          sendAck(conn, messageId);
        }

        if (message.type === 'request-state') {
          // State request handled by App.tsx useEffect
        } else if (message.type === 'suggest-word') {
          setPendingSuggestion({ word: message.word });
        } else if (message.type === 'clear-suggestion') {
          setPendingSuggestion(null);
        }
      });

      conn.on('close', () => {
        // Only set disconnected if this is still the current connection
        if (connectionRef.current === conn) {
          setPartnerConnected(false);
          setPendingSuggestion(null);
        }
      });

      conn.on('error', () => {
        if (connectionRef.current === conn) {
          setPartnerConnected(false);
          setPendingSuggestion(null);
        }
      });
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      if (err.type === 'unavailable-id') {
        // Session code already taken, try again
        setConnectionStatus('disconnected');
        setTimeout(() => hostGameRef.current?.(), 100);
      } else {
        setConnectionStatus('error');
        setErrorMessage('Connection error. Please try again.');
      }
    });

    peerRef.current = peer;
  }, [cleanup, handleAck, handleHeartbeat, sendAck]);

  // Store hostGame in ref for self-reference in error handler
  useEffect(() => {
    hostGameRef.current = hostGame;
  }, [hostGame]);

  // Internal function to attempt connection (used for initial join and reconnection)
  const attemptConnection = useCallback(
    (code: string, isReconnect: boolean = false): void => {
      // Cleanup existing peer without resetting reconnection state
      if (connectionRef.current) {
        connectionRef.current.close();
        connectionRef.current = null;
      }
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
      stopHeartbeat();
      clearPendingMessages();

      if (!isReconnect) {
        setRole('viewer');
        setErrorMessage('');
        reconnectAttemptsRef.current = 0;
      }

      setConnectionStatus('connecting');
      lastSessionCodeRef.current = code.toUpperCase();

      const peerId = `wordle-viewer-${Date.now()}`;
      const hostPeerId = `wordle-${code.toUpperCase()}`;

      const peer = new Peer(peerId, {
        debug: 0,
      });

      // Handle heartbeat timeout - attempt reconnection
      const onHeartbeatTimeout = (): void => {
        if (reconnectAttemptsRef.current < NETWORK_CONFIG.MAX_RECONNECT_ATTEMPTS) {
          isReconnectingRef.current = true;
          reconnectAttemptsRef.current++;
          const delay = getReconnectDelay();
          setErrorMessage(`Connection lost. Reconnecting in ${delay / 1000}s...`);
          setConnectionStatus('connecting');
          setPartnerConnected(false);

          reconnectTimeoutRef.current = setTimeout(() => {
            attemptConnectionRef.current?.(lastSessionCodeRef.current, true);
          }, delay);
        } else {
          setConnectionStatus('error');
          setErrorMessage('Connection lost. Max reconnection attempts reached.');
          setPartnerConnected(false);
          isReconnectingRef.current = false;
        }
      };

      peer.on('open', () => {
        const conn = peer.connect(hostPeerId, { reliable: true });

        conn.on('open', () => {
          connectionRef.current = conn;
          setConnectionStatus('connected');
          setPartnerConnected(true);
          setErrorMessage('');
          reconnectAttemptsRef.current = 0;
          isReconnectingRef.current = false;
          clearReconnectTimeout();

          // Start heartbeat monitoring
          startHeartbeat(conn, onHeartbeatTimeout);

          // Request initial game state with acknowledgment
          const requestMessage: PeerMessage = { type: 'request-state' };
          sendWithAck(conn, requestMessage, true, () => {
            // If no ack received for state request, try reconnecting
            onHeartbeatTimeout();
          });
        });

        conn.on('data', (data) => {
          // Extract message ID if present for ack tracking
          const dataWithId = data as { _messageId?: string };
          const messageId = dataWithId._messageId;

          const validationResult = validatePeerMessage(data);
          if (!validationResult.success) {
            console.warn('Invalid peer message received:', validationResult.error);
            return;
          }
          const message = validationResult.message;

          // Handle acknowledgment messages
          if (message.type === 'ack') {
            handleAck(message.messageId);
            return;
          }

          // Handle heartbeat messages
          if (message.type === 'ping') {
            const pongMessage: PeerMessage = { type: 'pong', timestamp: message.timestamp };
            conn.send(pongMessage);
            handleHeartbeat();
            return;
          }
          if (message.type === 'pong') {
            handleHeartbeat();
            return;
          }

          // Send ack for critical messages if messageId present
          if (messageId && message.type === 'game-state') {
            sendAck(conn, messageId);
          }

          if (message.type === 'game-state' && gameStateCallbackRef.current) {
            gameStateCallbackRef.current(message.state);
          } else if (message.type === 'suggestion-accepted' || message.type === 'suggestion-rejected') {
            if (suggestionResponseCallbackRef.current) {
              suggestionResponseCallbackRef.current(message.type === 'suggestion-accepted');
            }
          }
        });

        conn.on('close', () => {
          stopHeartbeat();
          // Attempt reconnection if not already reconnecting
          if (!isReconnectingRef.current) {
            onHeartbeatTimeout();
          }
        });

        conn.on('error', () => {
          stopHeartbeat();
          // Attempt reconnection if not already reconnecting
          if (!isReconnectingRef.current) {
            onHeartbeatTimeout();
          }
        });
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        if (err.type === 'peer-unavailable') {
          // Host not found - if this is a reconnection attempt, try again
          if (isReconnect && reconnectAttemptsRef.current < NETWORK_CONFIG.MAX_RECONNECT_ATTEMPTS) {
            reconnectAttemptsRef.current++;
            const delay = getReconnectDelay();
            setErrorMessage(`Host not found. Retrying in ${delay / 1000}s...`);

            reconnectTimeoutRef.current = setTimeout(() => {
              attemptConnectionRef.current?.(lastSessionCodeRef.current, true);
            }, delay);
          } else if (isReconnect) {
            setConnectionStatus('error');
            setErrorMessage('Could not reconnect to host. Game session may have ended.');
            isReconnectingRef.current = false;
          } else {
            setConnectionStatus('error');
            setErrorMessage('Game not found. Check the code and try again.');
          }
        } else {
          // Other errors - attempt reconnection
          if (!isReconnectingRef.current && reconnectAttemptsRef.current < NETWORK_CONFIG.MAX_RECONNECT_ATTEMPTS) {
            onHeartbeatTimeout();
          } else {
            setConnectionStatus('error');
            setErrorMessage('Connection error. Please try again.');
          }
        }
      });

      peerRef.current = peer;
    },
    [
      stopHeartbeat,
      clearPendingMessages,
      getReconnectDelay,
      clearReconnectTimeout,
      startHeartbeat,
      sendWithAck,
      handleAck,
      handleHeartbeat,
      sendAck,
    ]
  );

  // Store attemptConnection in ref for self-reference in reconnection timeouts
  useEffect(() => {
    attemptConnectionRef.current = attemptConnection;
  }, [attemptConnection]);

  // Join an existing game session
  const joinGame = useCallback(
    (code: string): void => {
      cleanup();
      setSessionCode(code.toUpperCase());
      attemptConnection(code, false);
    },
    [cleanup, attemptConnection]
  );

  // Send game state to viewer (called by host)
  // Security: Strip the solution before sending to prevent cheating
  // Uses acknowledgment for reliable delivery
  const sendGameState = useCallback(
    (state: GameState): void => {
      if (role === 'host' && connectionRef.current?.open) {
        // Create viewer-safe state without the solution
        const viewerState: ViewerGameState = {
          guesses: state.guesses,
          currentGuess: state.currentGuess,
          gameOver: state.gameOver,
          won: state.won,
          message: state.message,
        };
        const message: PeerMessage = { type: 'game-state', state: viewerState };
        // Send with acknowledgment for critical game state updates
        sendWithAck(connectionRef.current, message, true);
      }
    },
    [role, sendWithAck]
  );

  // Register callback for receiving game state (used by viewer)
  const onGameStateReceived = useCallback((callback: (state: ViewerGameState) => void): void => {
    gameStateCallbackRef.current = callback;
  }, []);

  // Send a word suggestion to host (called by viewer)
  // Uses acknowledgment for reliable delivery
  const sendSuggestion = useCallback(
    (word: string): void => {
      if (role === 'viewer' && connectionRef.current?.open) {
        const message: PeerMessage = { type: 'suggest-word', word };
        sendWithAck(connectionRef.current, message, true);
      }
    },
    [role, sendWithAck]
  );

  // Clear suggestion on host (called by viewer when typing changes)
  const clearSuggestion = useCallback((): void => {
    if (role === 'viewer' && connectionRef.current?.open) {
      const message: PeerMessage = { type: 'clear-suggestion' };
      connectionRef.current.send(message);
    }
  }, [role]);

  // Accept the pending suggestion (called by host)
  // Uses acknowledgment for reliable delivery
  const acceptSuggestion = useCallback((): string | null => {
    if (role === 'host' && connectionRef.current?.open && pendingSuggestion) {
      const message: PeerMessage = { type: 'suggestion-accepted' };
      sendWithAck(connectionRef.current, message, true);
      const word = pendingSuggestion.word;
      setPendingSuggestion(null);
      return word;
    }
    return null;
  }, [role, pendingSuggestion, sendWithAck]);

  // Reject the pending suggestion (called by host)
  // Uses acknowledgment for reliable delivery
  const rejectSuggestion = useCallback((): void => {
    if (role === 'host' && connectionRef.current?.open) {
      const message: PeerMessage = { type: 'suggestion-rejected' };
      sendWithAck(connectionRef.current, message, true);
      setPendingSuggestion(null);
    }
  }, [role, sendWithAck]);

  // Register callback for suggestion response (used by viewer)
  const onSuggestionResponse = useCallback((callback: (accepted: boolean) => void): void => {
    suggestionResponseCallbackRef.current = callback;
  }, []);

  // Leave the current session
  const leaveSession = useCallback((): void => {
    cleanup();
    setRole(null);
    setSessionCode('');
    setConnectionStatus('disconnected');
    setErrorMessage('');
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    role,
    sessionCode,
    connectionStatus,
    errorMessage,
    partnerConnected,
    pendingSuggestion,
    hostGame,
    joinGame,
    leaveSession,
    sendGameState,
    onGameStateReceived,
    sendSuggestion,
    clearSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    onSuggestionResponse,
    isHost: role === 'host',
    isViewer: role === 'viewer',
    isConnected: connectionStatus === 'connected',
  };
};
