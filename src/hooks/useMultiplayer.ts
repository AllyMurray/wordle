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
import { validatePeerMessage, NETWORK_CONFIG, GAME_CONFIG, sanitizeSessionCode, isValidSessionCode, sanitizeSessionPin, isValidSessionPin } from '../types';

// Generate a unique message ID for acknowledgment tracking
const generateMessageId = (): string => {
  // substring(2, 2 + length) to skip '0.' prefix from Math.random().toString(36)
  return `${Date.now()}-${Math.random().toString(36).substring(2, 2 + GAME_CONFIG.MESSAGE_ID_RANDOM_LENGTH)}`;
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
  const chars = GAME_CONFIG.SESSION_CODE_CHARS;
  let code = '';
  for (let i = 0; i < GAME_CONFIG.SESSION_CODE_LENGTH; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const useMultiplayer = (): UseMultiplayerReturn => {
  const [role, setRole] = useState<MultiplayerRole>(null);
  const [sessionCode, setSessionCode] = useState('');
  const [sessionPin, setSessionPin] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState('');
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<PendingSuggestion | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const connectionRef = useRef<DataConnection | null>(null);
  const gameStateCallbackRef = useRef<((state: ViewerGameState) => void) | null>(null);
  const suggestionResponseCallbackRef = useRef<((accepted: boolean) => void) | null>(null);
  const hostGameRef = useRef<((pin?: string) => void) | null>(null);

  // PIN authentication refs
  const sessionPinRef = useRef('');
  const viewerPinRef = useRef('');
  const isAuthenticatedRef = useRef(false);

  // Reconnection state refs
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSessionCodeRef = useRef('');
  const isReconnectingRef = useRef(false);
  const attemptConnectionRef = useRef<((code: string, isReconnect?: boolean, pin?: string) => void) | null>(null);

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

    try {
      if (connectionRef.current) {
        connectionRef.current.close();
        connectionRef.current = null;
      }
    } catch (err) {
      console.warn('Error closing connection:', err);
      connectionRef.current = null;
    }

    try {
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
    } catch (err) {
      console.warn('Error destroying peer:', err);
      peerRef.current = null;
    }

    setPartnerConnected(false);
    setPendingSuggestion(null);
    reconnectAttemptsRef.current = 0;
    isAuthenticatedRef.current = false;
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
      try {
        conn.send(messageWithId);
      } catch (err) {
        console.warn('Error sending message:', err);
        return null;
      }

      if (requireAck) {
        const scheduleRetry = (): ReturnType<typeof setTimeout> => {
          const timeoutId = setTimeout(() => {
            const pending = pendingMessagesRef.current.get(messageId);
            if (!pending) return;

            if (pending.retries < NETWORK_CONFIG.MAX_RETRY_ATTEMPTS) {
              // Retry sending
              if (conn.open) {
                try {
                  conn.send(messageWithId);
                  pending.retries++;
                  pending.timeoutId = scheduleRetry();
                } catch (err) {
                  console.warn('Error retrying message:', err);
                  pendingMessagesRef.current.delete(messageId);
                  onAckTimeout?.();
                }
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
      try {
        const ackMessage: PeerMessage = { type: 'ack', messageId };
        conn.send(ackMessage);
      } catch (err) {
        console.warn('Error sending acknowledgment:', err);
      }
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
          try {
            const pingMessage: PeerMessage = { type: 'ping', timestamp: Date.now() };
            conn.send(pingMessage);

            // Set timeout for pong response
            heartbeatTimeoutRef.current = setTimeout(() => {
              const timeSinceLastHeartbeat = Date.now() - lastHeartbeatRef.current;
              if (timeSinceLastHeartbeat > NETWORK_CONFIG.HEARTBEAT_TIMEOUT_MS) {
                onTimeout();
              }
            }, NETWORK_CONFIG.HEARTBEAT_TIMEOUT_MS);
          } catch (err) {
            console.warn('Error sending heartbeat ping:', err);
            onTimeout();
          }
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
  const hostGame = useCallback((pin?: string): void => {
    cleanup();
    setRole('host');
    setConnectionStatus('connecting');
    setErrorMessage('');

    // Store the PIN for authentication (empty string means no PIN required)
    const sanitizedPin = pin ? sanitizeSessionPin(pin) : '';
    sessionPinRef.current = sanitizedPin;
    setSessionPin(sanitizedPin);

    const code = generateSessionCode();
    const peerId = `wordle-${code}`;

    let peer: Peer;
    try {
      peer = new Peer(peerId, {
        debug: GAME_CONFIG.PEER_DEBUG_LEVEL,
      });
    } catch (err) {
      console.error('Error creating peer:', err);
      setConnectionStatus('error');
      setErrorMessage('Failed to initialize connection. Please try again.');
      return;
    }

    peer.on('open', () => {
      setSessionCode(code);
      setConnectionStatus('connected');
    });

    peer.on('connection', (conn: DataConnection) => {
      // Track if this connection has been authenticated
      let connectionAuthenticated = false;

      // Close old connection if exists (for rejoin support)
      if (connectionRef.current) {
        connectionRef.current.close();
      }
      connectionRef.current = conn;
      setPendingSuggestion(null); // Clear any pending suggestion from old viewer

      conn.on('open', () => {
        // If no PIN is required, mark as connected immediately
        if (sessionPinRef.current === '') {
          connectionAuthenticated = true;
          setPartnerConnected(true);
        }
        // Otherwise, wait for auth-request from viewer
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

        // Handle authentication request from viewer
        if (message.type === 'auth-request') {
          if (sessionPinRef.current === '') {
            // No PIN required, accept
            try {
              const successMessage: PeerMessage = { type: 'auth-success' };
              conn.send(successMessage);
              connectionAuthenticated = true;
              setPartnerConnected(true);
            } catch (err) {
              console.warn('Error sending auth success:', err);
            }
          } else if (message.pin === sessionPinRef.current) {
            // PIN matches, accept
            try {
              const successMessage: PeerMessage = { type: 'auth-success' };
              conn.send(successMessage);
              connectionAuthenticated = true;
              setPartnerConnected(true);
            } catch (err) {
              console.warn('Error sending auth success:', err);
            }
          } else {
            // PIN doesn't match, reject
            try {
              const failureMessage: PeerMessage = { type: 'auth-failure', reason: 'Incorrect PIN' };
              conn.send(failureMessage);
              // Close connection after sending rejection
              setTimeout(() => conn.close(), 100);
            } catch (err) {
              console.warn('Error sending auth failure:', err);
            }
          }
          return;
        }

        // Reject messages from unauthenticated connections (if PIN is required)
        if (sessionPinRef.current !== '' && !connectionAuthenticated) {
          console.warn('Received message from unauthenticated connection');
          return;
        }

        // Handle heartbeat messages
        if (message.type === 'ping') {
          // Respond with pong
          try {
            const pongMessage: PeerMessage = { type: 'pong', timestamp: message.timestamp };
            conn.send(pongMessage);
          } catch (err) {
            console.warn('Error sending pong response:', err);
          }
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
        // Session code already taken, try again with same PIN
        setConnectionStatus('disconnected');
        setTimeout(() => hostGameRef.current?.(sessionPinRef.current), GAME_CONFIG.HOST_RETRY_DELAY_MS);
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
    (code: string, isReconnect: boolean = false, pin: string = ''): void => {
      // Cleanup existing peer without resetting reconnection state
      try {
        if (connectionRef.current) {
          connectionRef.current.close();
          connectionRef.current = null;
        }
      } catch (err) {
        console.warn('Error closing existing connection:', err);
        connectionRef.current = null;
      }

      try {
        if (peerRef.current) {
          peerRef.current.destroy();
          peerRef.current = null;
        }
      } catch (err) {
        console.warn('Error destroying existing peer:', err);
        peerRef.current = null;
      }

      stopHeartbeat();
      clearPendingMessages();

      if (!isReconnect) {
        setRole('viewer');
        setErrorMessage('');
        reconnectAttemptsRef.current = 0;
        // Store the PIN for reconnection attempts
        viewerPinRef.current = pin;
      }

      isAuthenticatedRef.current = false;
      setConnectionStatus('connecting');
      lastSessionCodeRef.current = code.toUpperCase();

      const peerId = `wordle-viewer-${Date.now()}`;
      const hostPeerId = `wordle-${code.toUpperCase()}`;

      let peer: Peer;
      try {
        peer = new Peer(peerId, {
          debug: GAME_CONFIG.PEER_DEBUG_LEVEL,
        });
      } catch (err) {
        console.error('Error creating peer:', err);
        setConnectionStatus('error');
        setErrorMessage('Failed to initialize connection. Please try again.');
        return;
      }

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
            attemptConnectionRef.current?.(lastSessionCodeRef.current, true, viewerPinRef.current);
          }, delay);
        } else {
          setConnectionStatus('error');
          setErrorMessage('Connection lost. Max reconnection attempts reached.');
          setPartnerConnected(false);
          isReconnectingRef.current = false;
        }
      };

      peer.on('open', () => {
        let conn: DataConnection;
        try {
          conn = peer.connect(hostPeerId, { reliable: true });
        } catch (err) {
          console.error('Error connecting to host:', err);
          setConnectionStatus('error');
          setErrorMessage('Failed to connect to host. Please try again.');
          return;
        }

        conn.on('open', () => {
          connectionRef.current = conn;
          setErrorMessage('');
          isReconnectingRef.current = false;
          clearReconnectTimeout();

          // Send authentication request with PIN (even if empty)
          try {
            const authMessage: PeerMessage = { type: 'auth-request', pin: viewerPinRef.current };
            conn.send(authMessage);
          } catch (err) {
            console.warn('Error sending auth request:', err);
            setConnectionStatus('error');
            setErrorMessage('Failed to authenticate. Please try again.');
            return;
          }

          // Don't mark as connected yet - wait for auth-success
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

          // Handle authentication responses
          if (message.type === 'auth-success') {
            isAuthenticatedRef.current = true;
            setConnectionStatus('connected');
            setPartnerConnected(true);
            reconnectAttemptsRef.current = 0;

            // Start heartbeat monitoring
            startHeartbeat(conn, onHeartbeatTimeout);

            // Request initial game state with acknowledgment
            const requestMessage: PeerMessage = { type: 'request-state' };
            sendWithAck(conn, requestMessage, true, () => {
              // If no ack received for state request, try reconnecting
              onHeartbeatTimeout();
            });
            return;
          }

          if (message.type === 'auth-failure') {
            isAuthenticatedRef.current = false;
            setConnectionStatus('error');
            setErrorMessage(message.reason || 'Authentication failed');
            // Don't attempt reconnection on auth failure - it's intentional rejection
            isReconnectingRef.current = false;
            reconnectAttemptsRef.current = NETWORK_CONFIG.MAX_RECONNECT_ATTEMPTS;
            return;
          }

          // Ignore other messages if not authenticated
          if (!isAuthenticatedRef.current) {
            console.warn('Received message before authentication');
            return;
          }

          // Handle heartbeat messages
          if (message.type === 'ping') {
            try {
              const pongMessage: PeerMessage = { type: 'pong', timestamp: message.timestamp };
              conn.send(pongMessage);
            } catch (err) {
              console.warn('Error sending pong response:', err);
            }
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
              attemptConnectionRef.current?.(lastSessionCodeRef.current, true, viewerPinRef.current);
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
    (code: string, pin?: string): void => {
      // Sanitize and validate the session code
      const sanitizedCode = sanitizeSessionCode(code);
      if (!isValidSessionCode(sanitizedCode)) {
        setConnectionStatus('error');
        setErrorMessage('Invalid session code. Please check and try again.');
        return;
      }

      // Sanitize and validate the PIN (if provided)
      const sanitizedPin = pin ? sanitizeSessionPin(pin) : '';
      if (sanitizedPin !== '' && !isValidSessionPin(sanitizedPin)) {
        setConnectionStatus('error');
        setErrorMessage('Invalid PIN format. PIN must be 4-8 digits.');
        return;
      }

      cleanup();
      setSessionCode(sanitizedCode);
      setSessionPin(sanitizedPin);
      attemptConnection(sanitizedCode, false, sanitizedPin);
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
      try {
        const message: PeerMessage = { type: 'clear-suggestion' };
        connectionRef.current.send(message);
      } catch (err) {
        console.warn('Error clearing suggestion:', err);
      }
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
    setSessionPin('');
    sessionPinRef.current = '';
    viewerPinRef.current = '';
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
    sessionPin,
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
