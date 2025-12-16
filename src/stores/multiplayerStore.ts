import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import Peer, { DataConnection } from 'peerjs';
import type {
  MultiplayerRole,
  ConnectionStatus,
  PendingSuggestion,
  GameState,
  ViewerGameState,
  PeerMessage,
} from '../types';
import {
  validatePeerMessage,
  NETWORK_CONFIG,
  GAME_CONFIG,
  sanitizeSessionCode,
  isValidSessionCode,
  sanitizeSessionPin,
  isValidSessionPin,
  generatePeerSecret,
  createFullSessionCode,
} from '../types';

// Generate a unique message ID for acknowledgment tracking
const generateMessageId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 2 + GAME_CONFIG.MESSAGE_ID_RANDOM_LENGTH)}`;
};

// Generate the human-readable part of the session code
const generateReadableCode = (): string => {
  const chars = GAME_CONFIG.SESSION_CODE_CHARS;
  let code = '';
  for (let i = 0; i < GAME_CONFIG.SESSION_CODE_LENGTH; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Generate a full session code with unpredictable peer secret
const generateSessionCode = (): string => {
  const readable = generateReadableCode();
  const secret = generatePeerSecret();
  return createFullSessionCode(readable, secret);
};

// Message with ID for acknowledgment tracking
interface PendingMessage {
  id: string;
  message: PeerMessage;
  retries: number;
  timeoutId: ReturnType<typeof setTimeout>;
}

interface MultiplayerState {
  // Connection state
  role: MultiplayerRole;
  sessionCode: string;
  sessionPin: string;
  connectionStatus: ConnectionStatus;
  errorMessage: string;
  partnerConnected: boolean;
  pendingSuggestion: PendingSuggestion | null;

  // Actions
  hostGame: (pin?: string) => void;
  joinGame: (code: string, pin?: string) => void;
  leaveSession: () => void;
  sendGameState: (state: GameState) => void;
  sendSuggestion: (word: string) => void;
  clearSuggestion: () => void;
  acceptSuggestion: () => string | null;
  rejectSuggestion: () => void;

  // Computed
  isHost: boolean;
  isViewer: boolean;
  isConnected: boolean;
}

// Internal state not exposed in the store interface
// These are managed imperatively for PeerJS connection handling
interface InternalState {
  peer: Peer | null;
  connection: DataConnection | null;
  pendingMessages: Map<string, PendingMessage>;
  heartbeatInterval: ReturnType<typeof setInterval> | null;
  heartbeatTimeout: ReturnType<typeof setTimeout> | null;
  reconnectTimeout: ReturnType<typeof setTimeout> | null;
  reconnectAttempts: number;
  lastSessionCode: string;
  isReconnecting: boolean;
  sessionPinInternal: string;
  viewerPinInternal: string;
  isAuthenticated: boolean;
  lastHeartbeat: number;
  // Callbacks for game state updates (set by useGameSession)
  onGameStateReceived: ((state: ViewerGameState) => void) | null;
  onSuggestionResponse: ((accepted: boolean) => void) | null;
}

const internal: InternalState = {
  peer: null,
  connection: null,
  pendingMessages: new Map(),
  heartbeatInterval: null,
  heartbeatTimeout: null,
  reconnectTimeout: null,
  reconnectAttempts: 0,
  lastSessionCode: '',
  isReconnecting: false,
  sessionPinInternal: '',
  viewerPinInternal: '',
  isAuthenticated: false,
  lastHeartbeat: 0,
  onGameStateReceived: null,
  onSuggestionResponse: null,
};

// Helper functions
const clearPendingMessages = (): void => {
  internal.pendingMessages.forEach((pending) => clearTimeout(pending.timeoutId));
  internal.pendingMessages.clear();
};

const stopHeartbeat = (): void => {
  if (internal.heartbeatInterval) {
    clearInterval(internal.heartbeatInterval);
    internal.heartbeatInterval = null;
  }
  if (internal.heartbeatTimeout) {
    clearTimeout(internal.heartbeatTimeout);
    internal.heartbeatTimeout = null;
  }
};

const clearReconnectTimeout = (): void => {
  if (internal.reconnectTimeout) {
    clearTimeout(internal.reconnectTimeout);
    internal.reconnectTimeout = null;
  }
  internal.isReconnecting = false;
};

const cleanup = (): void => {
  clearPendingMessages();
  stopHeartbeat();
  clearReconnectTimeout();

  try {
    if (internal.connection) {
      internal.connection.close();
      internal.connection = null;
    }
  } catch (err) {
    console.warn('Error closing connection:', err);
    internal.connection = null;
  }

  try {
    if (internal.peer) {
      internal.peer.destroy();
      internal.peer = null;
    }
  } catch (err) {
    console.warn('Error destroying peer:', err);
    internal.peer = null;
  }

  internal.reconnectAttempts = 0;
  internal.isAuthenticated = false;
};

const getReconnectDelay = (): number => {
  return Math.min(
    NETWORK_CONFIG.INITIAL_RECONNECT_DELAY_MS * Math.pow(2, internal.reconnectAttempts),
    NETWORK_CONFIG.MAX_RECONNECT_DELAY_MS
  );
};

const sendWithAck = (
  conn: DataConnection,
  message: PeerMessage,
  requireAck: boolean = false,
  onAckTimeout?: () => void
): string | null => {
  if (!conn.open) return null;

  const messageId = generateMessageId();
  const messageWithId = { ...message, _messageId: messageId };

  try {
    conn.send(messageWithId);
  } catch (err) {
    console.warn('Error sending message:', err);
    return null;
  }

  if (requireAck) {
    const scheduleRetry = (): ReturnType<typeof setTimeout> => {
      return setTimeout(() => {
        const pending = internal.pendingMessages.get(messageId);
        if (!pending) return;

        if (pending.retries < NETWORK_CONFIG.MAX_RETRY_ATTEMPTS) {
          if (conn.open) {
            try {
              conn.send(messageWithId);
              pending.retries++;
              pending.timeoutId = scheduleRetry();
            } catch (err) {
              console.warn('Error retrying message:', err);
              internal.pendingMessages.delete(messageId);
              onAckTimeout?.();
            }
          }
        } else {
          internal.pendingMessages.delete(messageId);
          onAckTimeout?.();
        }
      }, NETWORK_CONFIG.ACK_TIMEOUT_MS);
    };

    internal.pendingMessages.set(messageId, {
      id: messageId,
      message,
      retries: 0,
      timeoutId: scheduleRetry(),
    });
  }

  return messageId;
};

const handleAck = (messageId: string): void => {
  const pending = internal.pendingMessages.get(messageId);
  if (pending) {
    clearTimeout(pending.timeoutId);
    internal.pendingMessages.delete(messageId);
  }
};

const sendAck = (conn: DataConnection, messageId: string): void => {
  if (conn.open) {
    try {
      conn.send({ type: 'ack', messageId } as PeerMessage);
    } catch (err) {
      console.warn('Error sending acknowledgment:', err);
    }
  }
};

const handleHeartbeat = (): void => {
  internal.lastHeartbeat = Date.now();
  if (internal.heartbeatTimeout) {
    clearTimeout(internal.heartbeatTimeout);
    internal.heartbeatTimeout = null;
  }
};

const startHeartbeat = (conn: DataConnection, onTimeout: () => void): void => {
  stopHeartbeat();
  internal.lastHeartbeat = Date.now();

  internal.heartbeatInterval = setInterval(() => {
    if (conn.open) {
      try {
        conn.send({ type: 'ping', timestamp: Date.now() } as PeerMessage);

        internal.heartbeatTimeout = setTimeout(() => {
          const timeSinceLastHeartbeat = Date.now() - internal.lastHeartbeat;
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
};

/**
 * Zustand store for multiplayer state and P2P connection handling.
 *
 * Benefits over previous useMultiplayer hook:
 * - getState() allows accessing connection state outside React
 * - No useRef patterns needed for callbacks - use internal module state
 * - Actions can be called from anywhere (WebRTC callbacks, timeouts)
 * - subscribeWithSelector allows fine-grained component subscriptions
 */
export const useMultiplayerStore = create<MultiplayerState>()(
  subscribeWithSelector((set, get) => {
    // Forward declaration for attemptConnection (used in reconnection)
    let attemptConnection: (code: string, isReconnect?: boolean, pin?: string) => void;

    // Host a new game session
    const hostGame = (pin?: string): void => {
      cleanup();
      const sanitizedPin = pin ? sanitizeSessionPin(pin) : '';
      internal.sessionPinInternal = sanitizedPin;

      set({
        role: 'host',
        connectionStatus: 'connecting',
        errorMessage: '',
        sessionPin: sanitizedPin,
        partnerConnected: false,
        pendingSuggestion: null,
      });

      const code = generateSessionCode();
      const peerId = `wordle-${code}`;

      let peer: Peer;
      try {
        peer = new Peer(peerId, { debug: GAME_CONFIG.PEER_DEBUG_LEVEL });
      } catch (err) {
        console.error('Error creating peer:', err);
        set({
          connectionStatus: 'error',
          errorMessage: 'Failed to initialize connection. Please try again.',
        });
        return;
      }

      peer.on('open', () => {
        set({ sessionCode: code, connectionStatus: 'connected' });
      });

      peer.on('connection', (conn: DataConnection) => {
        let connectionAuthenticated = false;

        if (internal.connection) {
          internal.connection.close();
        }
        internal.connection = conn;
        set({ pendingSuggestion: null });

        conn.on('open', () => {
          if (internal.sessionPinInternal === '') {
            connectionAuthenticated = true;
            set({ partnerConnected: true });
          }
        });

        conn.on('data', (data) => {
          const dataWithId = data as { _messageId?: string };
          const messageId = dataWithId._messageId;

          const validationResult = validatePeerMessage(data);
          if (!validationResult.success) {
            console.warn('Invalid peer message received:', validationResult.error);
            return;
          }
          const message = validationResult.message;

          if (message.type === 'ack') {
            handleAck(message.messageId);
            return;
          }

          if (message.type === 'auth-request') {
            if (internal.sessionPinInternal === '' || message.pin === internal.sessionPinInternal) {
              try {
                conn.send({ type: 'auth-success' } as PeerMessage);
                connectionAuthenticated = true;
                set({ partnerConnected: true });
              } catch (err) {
                console.warn('Error sending auth success:', err);
              }
            } else {
              try {
                conn.send({ type: 'auth-failure', reason: 'Incorrect PIN' } as PeerMessage);
                setTimeout(() => conn.close(), 100);
              } catch (err) {
                console.warn('Error sending auth failure:', err);
              }
            }
            return;
          }

          if (internal.sessionPinInternal !== '' && !connectionAuthenticated) {
            console.warn('Received message from unauthenticated connection');
            return;
          }

          if (message.type === 'ping') {
            try {
              conn.send({ type: 'pong', timestamp: message.timestamp } as PeerMessage);
            } catch (err) {
              console.warn('Error sending pong response:', err);
            }
            return;
          }

          if (message.type === 'pong') {
            handleHeartbeat();
            return;
          }

          if (messageId && (message.type === 'suggest-word' || message.type === 'request-state')) {
            sendAck(conn, messageId);
          }

          if (message.type === 'suggest-word') {
            set({ pendingSuggestion: { word: message.word } });
          } else if (message.type === 'clear-suggestion') {
            set({ pendingSuggestion: null });
          }
        });

        conn.on('close', () => {
          if (internal.connection === conn) {
            set({ partnerConnected: false, pendingSuggestion: null });
          }
        });

        conn.on('error', () => {
          if (internal.connection === conn) {
            set({ partnerConnected: false, pendingSuggestion: null });
          }
        });
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        if (err.type === 'unavailable-id') {
          set({ connectionStatus: 'disconnected' });
          setTimeout(() => hostGame(internal.sessionPinInternal), GAME_CONFIG.HOST_RETRY_DELAY_MS);
        } else {
          set({
            connectionStatus: 'error',
            errorMessage: 'Connection error. Please try again.',
          });
        }
      });

      internal.peer = peer;
    };

    // Attempt connection (used for initial join and reconnection)
    // eslint-disable-next-line prefer-const
    attemptConnection = (code: string, isReconnect: boolean = false, pin: string = ''): void => {
      try {
        if (internal.connection) {
          internal.connection.close();
          internal.connection = null;
        }
      } catch (err) {
        console.warn('Error closing existing connection:', err);
        internal.connection = null;
      }

      try {
        if (internal.peer) {
          internal.peer.destroy();
          internal.peer = null;
        }
      } catch (err) {
        console.warn('Error destroying existing peer:', err);
        internal.peer = null;
      }

      stopHeartbeat();
      clearPendingMessages();

      if (!isReconnect) {
        internal.reconnectAttempts = 0;
        internal.viewerPinInternal = pin;
        set({
          role: 'viewer',
          errorMessage: '',
        });
      }

      internal.isAuthenticated = false;
      internal.lastSessionCode = code;

      set({ connectionStatus: 'connecting' });

      const peerId = `wordle-viewer-${Date.now()}`;
      const hostPeerId = `wordle-${code}`;

      let peer: Peer;
      try {
        peer = new Peer(peerId, { debug: GAME_CONFIG.PEER_DEBUG_LEVEL });
      } catch (err) {
        console.error('Error creating peer:', err);
        set({
          connectionStatus: 'error',
          errorMessage: 'Failed to initialize connection. Please try again.',
        });
        return;
      }

      const onHeartbeatTimeout = (): void => {
        if (internal.reconnectAttempts < NETWORK_CONFIG.MAX_RECONNECT_ATTEMPTS) {
          internal.isReconnecting = true;
          internal.reconnectAttempts++;
          const delay = getReconnectDelay();

          set({
            errorMessage: `Connection lost. Reconnecting in ${delay / 1000}s...`,
            connectionStatus: 'connecting',
            partnerConnected: false,
          });

          internal.reconnectTimeout = setTimeout(() => {
            attemptConnection(internal.lastSessionCode, true, internal.viewerPinInternal);
          }, delay);
        } else {
          set({
            connectionStatus: 'error',
            errorMessage: 'Connection lost. Max reconnection attempts reached.',
            partnerConnected: false,
          });
          internal.isReconnecting = false;
        }
      };

      peer.on('open', () => {
        let conn: DataConnection;
        try {
          conn = peer.connect(hostPeerId, { reliable: true });
        } catch (err) {
          console.error('Error connecting to host:', err);
          set({
            connectionStatus: 'error',
            errorMessage: 'Failed to connect to host. Please try again.',
          });
          return;
        }

        conn.on('open', () => {
          internal.connection = conn;
          set({ errorMessage: '' });
          internal.isReconnecting = false;
          clearReconnectTimeout();

          try {
            conn.send({ type: 'auth-request', pin: internal.viewerPinInternal } as PeerMessage);
          } catch (err) {
            console.warn('Error sending auth request:', err);
            set({
              connectionStatus: 'error',
              errorMessage: 'Failed to authenticate. Please try again.',
            });
          }
        });

        conn.on('data', (data) => {
          const dataWithId = data as { _messageId?: string };
          const messageId = dataWithId._messageId;

          const validationResult = validatePeerMessage(data);
          if (!validationResult.success) {
            console.warn('Invalid peer message received:', validationResult.error);
            return;
          }
          const message = validationResult.message;

          if (message.type === 'ack') {
            handleAck(message.messageId);
            return;
          }

          if (message.type === 'auth-success') {
            internal.isAuthenticated = true;
            internal.reconnectAttempts = 0;
            set({
              connectionStatus: 'connected',
              partnerConnected: true,
            });

            startHeartbeat(conn, onHeartbeatTimeout);

            sendWithAck(
              conn,
              { type: 'request-state' } as PeerMessage,
              true,
              onHeartbeatTimeout
            );
            return;
          }

          if (message.type === 'auth-failure') {
            internal.isAuthenticated = false;
            internal.isReconnecting = false;
            internal.reconnectAttempts = NETWORK_CONFIG.MAX_RECONNECT_ATTEMPTS;
            set({
              connectionStatus: 'error',
              errorMessage: message.reason || 'Authentication failed',
            });
            return;
          }

          if (!internal.isAuthenticated) {
            console.warn('Received message before authentication');
            return;
          }

          if (message.type === 'ping') {
            try {
              conn.send({ type: 'pong', timestamp: message.timestamp } as PeerMessage);
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

          if (messageId && message.type === 'game-state') {
            sendAck(conn, messageId);
          }

          if (message.type === 'game-state' && internal.onGameStateReceived) {
            internal.onGameStateReceived(message.state);
          } else if (
            (message.type === 'suggestion-accepted' || message.type === 'suggestion-rejected') &&
            internal.onSuggestionResponse
          ) {
            internal.onSuggestionResponse(message.type === 'suggestion-accepted');
          }
        });

        conn.on('close', () => {
          stopHeartbeat();
          if (!internal.isReconnecting) {
            onHeartbeatTimeout();
          }
        });

        conn.on('error', () => {
          stopHeartbeat();
          if (!internal.isReconnecting) {
            onHeartbeatTimeout();
          }
        });
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        if (err.type === 'peer-unavailable') {
          if (isReconnect && internal.reconnectAttempts < NETWORK_CONFIG.MAX_RECONNECT_ATTEMPTS) {
            internal.reconnectAttempts++;
            const delay = getReconnectDelay();
            set({ errorMessage: `Host not found. Retrying in ${delay / 1000}s...` });

            internal.reconnectTimeout = setTimeout(() => {
              attemptConnection(internal.lastSessionCode, true, internal.viewerPinInternal);
            }, delay);
          } else if (isReconnect) {
            set({
              connectionStatus: 'error',
              errorMessage: 'Could not reconnect to host. Game session may have ended.',
            });
            internal.isReconnecting = false;
          } else {
            set({
              connectionStatus: 'error',
              errorMessage: 'Game not found. Check the code and try again.',
            });
          }
        } else {
          if (
            !internal.isReconnecting &&
            internal.reconnectAttempts < NETWORK_CONFIG.MAX_RECONNECT_ATTEMPTS
          ) {
            onHeartbeatTimeout();
          } else {
            set({
              connectionStatus: 'error',
              errorMessage: 'Connection error. Please try again.',
            });
          }
        }
      });

      internal.peer = peer;
    };

    // Join an existing game session
    const joinGame = (code: string, pin?: string): void => {
      const sanitizedCode = sanitizeSessionCode(code);
      if (!isValidSessionCode(sanitizedCode)) {
        set({
          connectionStatus: 'error',
          errorMessage: 'Invalid session code. Please check and try again.',
        });
        return;
      }

      const sanitizedPin = pin ? sanitizeSessionPin(pin) : '';
      if (sanitizedPin !== '' && !isValidSessionPin(sanitizedPin)) {
        set({
          connectionStatus: 'error',
          errorMessage: 'Invalid PIN format. PIN must be 4-8 digits.',
        });
        return;
      }

      cleanup();
      set({ sessionCode: sanitizedCode, sessionPin: sanitizedPin });
      attemptConnection(sanitizedCode, false, sanitizedPin);
    };

    return {
      // Initial state
      role: null,
      sessionCode: '',
      sessionPin: '',
      connectionStatus: 'disconnected',
      errorMessage: '',
      partnerConnected: false,
      pendingSuggestion: null,

      // Computed (these update based on role)
      get isHost() {
        return get().role === 'host';
      },
      get isViewer() {
        return get().role === 'viewer';
      },
      get isConnected() {
        return get().connectionStatus === 'connected';
      },

      // Actions
      hostGame,
      joinGame,

      leaveSession: () => {
        cleanup();
        internal.sessionPinInternal = '';
        internal.viewerPinInternal = '';
        set({
          role: null,
          sessionCode: '',
          sessionPin: '',
          connectionStatus: 'disconnected',
          errorMessage: '',
          partnerConnected: false,
          pendingSuggestion: null,
        });
      },

      sendGameState: (state: GameState) => {
        const { role } = get();
        if (role === 'host' && internal.connection?.open) {
          const viewerState: ViewerGameState = {
            guesses: state.guesses,
            currentGuess: state.currentGuess,
            gameOver: state.gameOver,
            won: state.won,
            message: state.message,
          };
          sendWithAck(
            internal.connection,
            { type: 'game-state', state: viewerState } as PeerMessage,
            true
          );
        }
      },

      sendSuggestion: (word: string) => {
        const { role } = get();
        if (role === 'viewer' && internal.connection?.open) {
          sendWithAck(
            internal.connection,
            { type: 'suggest-word', word } as PeerMessage,
            true
          );
        }
      },

      clearSuggestion: () => {
        const { role } = get();
        if (role === 'viewer' && internal.connection?.open) {
          try {
            internal.connection.send({ type: 'clear-suggestion' } as PeerMessage);
          } catch (err) {
            console.warn('Error clearing suggestion:', err);
          }
        }
      },

      acceptSuggestion: () => {
        const { role, pendingSuggestion } = get();
        if (role === 'host' && internal.connection?.open && pendingSuggestion) {
          sendWithAck(
            internal.connection,
            { type: 'suggestion-accepted' } as PeerMessage,
            true
          );
          const word = pendingSuggestion.word;
          set({ pendingSuggestion: null });
          return word;
        }
        return null;
      },

      rejectSuggestion: () => {
        const { role } = get();
        if (role === 'host' && internal.connection?.open) {
          sendWithAck(
            internal.connection,
            { type: 'suggestion-rejected' } as PeerMessage,
            true
          );
          set({ pendingSuggestion: null });
        }
      },
    };
  })
);

// Register callbacks for game state updates (called from useGameSession)
export const registerGameStateCallback = (callback: (state: ViewerGameState) => void): void => {
  internal.onGameStateReceived = callback;
};

export const registerSuggestionResponseCallback = (callback: (accepted: boolean) => void): void => {
  internal.onSuggestionResponse = callback;
};

// Selector hooks for fine-grained subscriptions
export const useRole = () => useMultiplayerStore((state) => state.role);
export const useSessionCode = () => useMultiplayerStore((state) => state.sessionCode);
export const useSessionPin = () => useMultiplayerStore((state) => state.sessionPin);
export const useConnectionStatus = () => useMultiplayerStore((state) => state.connectionStatus);
export const useErrorMessage = () => useMultiplayerStore((state) => state.errorMessage);
export const usePartnerConnected = () => useMultiplayerStore((state) => state.partnerConnected);
export const usePendingSuggestion = () => useMultiplayerStore((state) => state.pendingSuggestion);
