import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  MultiplayerRole,
  ConnectionStatus,
  PendingSuggestion,
  GameState,
  ViewerGameState,
  PeerMessage,
} from '../types';
import {
  NETWORK_CONFIG,
  GAME_CONFIG,
  sanitizeSessionCode,
  isValidSessionCode,
  sanitizeSessionPin,
  isValidSessionPin,
} from '../types';
import type { DataConnection, InternalConnectionState, RateLimitState } from './peerConnection';
import {
  createInternalState,
  loadPeerJS,
  generateSessionCode,
  cleanup,
  clearPendingMessages,
  stopHeartbeat,
  clearReconnectTimeout,
  getReconnectDelay,
  sendWithAck,
  handleAck,
  sendAck,
  handleHeartbeat,
  startHeartbeat,
  validatePeerMessage,
  createViewerState,
  createRateLimitState,
  checkConnectionRateLimit,
  recordConnectionAttempt,
  checkAuthRateLimit,
  recordFailedAuthAttempt,
  clearAuthRateLimit,
  resetRateLimitState,
} from './peerConnection';

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

/**
 * ARCHITECTURE NOTE: Module-Level Mutable State Pattern
 *
 * This file uses module-level mutable state (`internal`) outside of the Zustand store
 * for managing WebRTC/PeerJS connections. This is an intentional architectural decision:
 *
 * WHY THIS PATTERN IS USED:
 * 1. PeerJS objects (Peer, DataConnection) are stateful class instances that cannot be
 *    serialized or cloned. Zustand stores work best with plain, serializable data.
 *
 * 2. WebRTC connections require imperative lifecycle management (event handlers, cleanup)
 *    that doesn't fit the reactive state model. The connection objects themselves aren't
 *    state - they're infrastructure that produces state updates.
 *
 * 3. Callback registration (onGameStateReceived, onSuggestionResponse) needs to persist
 *    across re-renders without triggering state updates when registered.
 *
 * 4. Timeouts, intervals, and pending message tracking are implementation details that
 *    shouldn't cause React re-renders or be part of the observable store state.
 *
 * HOW IT WORKS:
 * - `internal` holds connection infrastructure and cleanup handlers
 * - The Zustand store (`useMultiplayerStore`) holds UI-relevant state (connectionStatus,
 *   partnerConnected, errorMessage, etc.) that components subscribe to
 * - Store actions read/write `internal` imperatively, then update store state to
 *   trigger UI updates
 *
 * TRADEOFFS:
 * - The store is not fully self-contained; `internal` creates implicit module state
 * - Testing requires resetting both the store AND the internal state
 * - Hot module replacement may not fully reset connection state
 *
 * ALTERNATIVES CONSIDERED:
 * - Storing Peer/DataConnection in Zustand: Causes issues with serialization and
 *   unnecessary re-renders on internal PeerJS state changes
 * - Using React refs in a hook: Would require prop drilling connection state or
 *   context, and wouldn't work with external store access via getState()
 * - Separate connection manager class: Would add complexity without clear benefit
 *   for this use case
 *
 * LAZY LOADING:
 * PeerJS (~100KB) is dynamically imported only when multiplayer features are used.
 * This reduces the initial bundle size for users who only play solo games.
 */
const internal: InternalConnectionState = createInternalState();

/**
 * Rate limiting state for connection attempts.
 * Prevents brute-force attacks on sessions and PINs.
 */
const rateLimitState: RateLimitState = createRateLimitState();

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
      cleanup(internal);
      // Reset rate limiting state for fresh session
      resetRateLimitState(rateLimitState);
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

      // Load PeerJS dynamically
      loadPeerJS()
        .then((Peer) => {
          let peer: InstanceType<typeof Peer>;
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
                handleAck(internal, message.messageId);
                return;
              }

              if (message.type === 'auth-request') {
                const peerId = conn.peer;

                // Check if this peer is rate-limited due to too many failed auth attempts
                const authRateCheck = checkAuthRateLimit(rateLimitState, peerId);
                if (!authRateCheck.allowed) {
                  const retrySeconds = Math.ceil(authRateCheck.retryAfterMs / 1000);
                  try {
                    conn.send({
                      type: 'auth-failure',
                      reason: `Too many failed attempts. Try again in ${retrySeconds} seconds.`,
                    } as PeerMessage);
                    setTimeout(() => conn.close(), 100);
                  } catch (err) {
                    console.warn('Error sending auth failure:', err);
                  }
                  return;
                }

                if (internal.sessionPinInternal === '' || message.pin === internal.sessionPinInternal) {
                  // Clear any previous failed attempts on successful auth
                  clearAuthRateLimit(rateLimitState, peerId);
                  try {
                    conn.send({ type: 'auth-success' } as PeerMessage);
                    connectionAuthenticated = true;
                    set({ partnerConnected: true });
                  } catch (err) {
                    console.warn('Error sending auth success:', err);
                  }
                } else {
                  // Record failed auth attempt
                  const isBlocked = recordFailedAuthAttempt(rateLimitState, peerId);
                  const reason = isBlocked
                    ? 'Too many failed attempts. Please try again later.'
                    : 'Incorrect PIN';
                  try {
                    conn.send({ type: 'auth-failure', reason } as PeerMessage);
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
                handleHeartbeat(internal);
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
        })
        .catch((err) => {
          console.error('Failed to load PeerJS:', err);
          set({
            connectionStatus: 'error',
            errorMessage: 'Failed to load multiplayer module. Please try again.',
          });
        });
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

      stopHeartbeat(internal);
      clearPendingMessages(internal);

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

      // Load PeerJS dynamically
      loadPeerJS()
        .then((Peer) => {
          let peer: InstanceType<typeof Peer>;
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
              const delay = getReconnectDelay(internal);

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
              clearReconnectTimeout(internal);

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
                handleAck(internal, message.messageId);
                return;
              }

              if (message.type === 'auth-success') {
                internal.isAuthenticated = true;
                internal.reconnectAttempts = 0;
                set({
                  connectionStatus: 'connected',
                  partnerConnected: true,
                });

                startHeartbeat(internal, conn, onHeartbeatTimeout);

                sendWithAck(
                  internal,
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
                handleHeartbeat(internal);
                return;
              }

              if (message.type === 'pong') {
                handleHeartbeat(internal);
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
              stopHeartbeat(internal);
              if (!internal.isReconnecting) {
                onHeartbeatTimeout();
              }
            });

            conn.on('error', () => {
              stopHeartbeat(internal);
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
                const delay = getReconnectDelay(internal);
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
        })
        .catch((err) => {
          console.error('Failed to load PeerJS:', err);
          set({
            connectionStatus: 'error',
            errorMessage: 'Failed to load multiplayer module. Please try again.',
          });
        });
    };

    // Join an existing game session
    const joinGame = (code: string, pin?: string): void => {
      // Check rate limiting for connection attempts
      const rateCheck = checkConnectionRateLimit(rateLimitState);
      if (!rateCheck.allowed) {
        const retrySeconds = Math.ceil(rateCheck.retryAfterMs / 1000);
        set({
          connectionStatus: 'error',
          errorMessage: `Too many connection attempts. Please wait ${retrySeconds} seconds.`,
        });
        return;
      }

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

      // Record this connection attempt
      recordConnectionAttempt(rateLimitState);

      cleanup(internal);
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
        cleanup(internal);
        internal.sessionPinInternal = '';
        internal.viewerPinInternal = '';
        // Reset rate limiting state when leaving session
        resetRateLimitState(rateLimitState);
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
          const viewerState = createViewerState(state);
          sendWithAck(
            internal,
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
            internal,
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
            internal,
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
            internal,
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
