/**
 * Lazy-loaded PeerJS Connection Module
 *
 * This module handles all PeerJS interactions and is dynamically imported
 * only when multiplayer features are used. This reduces the initial bundle
 * size by ~100KB for users who only play solo games.
 *
 * The module is loaded when:
 * - User clicks "Host Game" (hostGame action)
 * - User clicks "Join Game" (joinGame action)
 */

import type { DataConnection } from 'peerjs';
import type {
  PeerMessage,
  GameState,
  ViewerGameState,
} from '../types';
import {
  validatePeerMessage,
  NETWORK_CONFIG,
  GAME_CONFIG,
  generatePeerSecret,
  createFullSessionCode,
  secureRandomString,
} from '../types';

// Re-export DataConnection type for use in multiplayerStore
export type { DataConnection };

// Lazy-loaded Peer class
let PeerClass: typeof import('peerjs').default | null = null;

/**
 * Load PeerJS dynamically. This function is idempotent - subsequent calls
 * return the cached class.
 */
export const loadPeerJS = async (): Promise<typeof import('peerjs').default> => {
  if (PeerClass) {
    return PeerClass;
  }
  const module = await import('peerjs');
  PeerClass = module.default;
  return PeerClass;
};

// Generate a unique message ID for acknowledgment tracking
export const generateMessageId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 2 + GAME_CONFIG.MESSAGE_ID_RANDOM_LENGTH)}`;
};

// Generate the human-readable part of the session code using crypto.getRandomValues()
const generateReadableCode = (): string => {
  return secureRandomString(
    GAME_CONFIG.SESSION_CODE_CHARS,
    GAME_CONFIG.SESSION_CODE_LENGTH
  );
};

// Generate a full session code with unpredictable peer secret
export const generateSessionCode = (): string => {
  const readable = generateReadableCode();
  const secret = generatePeerSecret();
  return createFullSessionCode(readable, secret);
};

// Message with ID for acknowledgment tracking
export interface PendingMessage {
  id: string;
  message: PeerMessage;
  retries: number;
  timeoutId: ReturnType<typeof setTimeout>;
}

/**
 * Internal state for managing WebRTC connections.
 * This is kept as module-level state because:
 * - PeerJS objects are not serializable
 * - WebRTC needs imperative lifecycle management
 * - Callbacks and timeouts are implementation details
 */
export interface InternalConnectionState {
  peer: InstanceType<typeof import('peerjs').default> | null;
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

export const createInternalState = (): InternalConnectionState => ({
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
});

// Helper functions
export const clearPendingMessages = (internal: InternalConnectionState): void => {
  internal.pendingMessages.forEach((pending) => clearTimeout(pending.timeoutId));
  internal.pendingMessages.clear();
};

export const stopHeartbeat = (internal: InternalConnectionState): void => {
  if (internal.heartbeatInterval) {
    clearInterval(internal.heartbeatInterval);
    internal.heartbeatInterval = null;
  }
  if (internal.heartbeatTimeout) {
    clearTimeout(internal.heartbeatTimeout);
    internal.heartbeatTimeout = null;
  }
};

export const clearReconnectTimeout = (internal: InternalConnectionState): void => {
  if (internal.reconnectTimeout) {
    clearTimeout(internal.reconnectTimeout);
    internal.reconnectTimeout = null;
  }
  internal.isReconnecting = false;
};

export const cleanup = (internal: InternalConnectionState): void => {
  clearPendingMessages(internal);
  stopHeartbeat(internal);
  clearReconnectTimeout(internal);

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

export const getReconnectDelay = (internal: InternalConnectionState): number => {
  return Math.min(
    NETWORK_CONFIG.INITIAL_RECONNECT_DELAY_MS * Math.pow(2, internal.reconnectAttempts),
    NETWORK_CONFIG.MAX_RECONNECT_DELAY_MS
  );
};

export const sendWithAck = (
  internal: InternalConnectionState,
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

export const handleAck = (internal: InternalConnectionState, messageId: string): void => {
  const pending = internal.pendingMessages.get(messageId);
  if (pending) {
    clearTimeout(pending.timeoutId);
    internal.pendingMessages.delete(messageId);
  }
};

export const sendAck = (conn: DataConnection, messageId: string): void => {
  if (conn.open) {
    try {
      conn.send({ type: 'ack', messageId } as PeerMessage);
    } catch (err) {
      console.warn('Error sending acknowledgment:', err);
    }
  }
};

export const handleHeartbeat = (internal: InternalConnectionState): void => {
  internal.lastHeartbeat = Date.now();
  if (internal.heartbeatTimeout) {
    clearTimeout(internal.heartbeatTimeout);
    internal.heartbeatTimeout = null;
  }
};

export const startHeartbeat = (
  internal: InternalConnectionState,
  conn: DataConnection,
  onTimeout: () => void
): void => {
  stopHeartbeat(internal);
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
 * Create a Peer instance with the given ID.
 * This function uses the lazy-loaded PeerJS class.
 */
export const createPeer = async (
  peerId: string
): Promise<InstanceType<typeof import('peerjs').default>> => {
  const Peer = await loadPeerJS();
  return new Peer(peerId, { debug: GAME_CONFIG.PEER_DEBUG_LEVEL });
};

/**
 * Create viewer-safe game state (without solution).
 */
export const createViewerState = (state: GameState): ViewerGameState => ({
  guesses: state.guesses,
  currentGuess: state.currentGuess,
  gameOver: state.gameOver,
  won: state.won,
  message: state.message,
});

// Re-export validatePeerMessage for use in multiplayerStore
export { validatePeerMessage };

// ============================================
// Rate Limiting for Connection Attempts
// ============================================

/**
 * Tracks connection attempt timestamps and failed auth attempts for rate limiting.
 * Used to prevent brute-force attacks on sessions and PINs.
 */
export interface RateLimitState {
  /** Timestamps of recent connection attempts (for viewer join rate limiting) */
  connectionAttempts: number[];
  /** Timestamp when rate limit cooldown ends (0 if not in cooldown) */
  rateLimitCooldownEnd: number;
  /** Map of peer IDs to failed auth attempt counts (for host PIN protection) */
  failedAuthAttempts: Map<string, { count: number; blockedUntil: number }>;
}

/**
 * Create initial rate limit state.
 */
export const createRateLimitState = (): RateLimitState => ({
  connectionAttempts: [],
  rateLimitCooldownEnd: 0,
  failedAuthAttempts: new Map(),
});

/**
 * Check if a connection attempt is allowed (for viewer joining).
 * Returns { allowed: true } or { allowed: false, retryAfterMs: number }.
 */
export const checkConnectionRateLimit = (
  state: RateLimitState
): { allowed: true } | { allowed: false; retryAfterMs: number } => {
  const now = Date.now();

  // Check if in cooldown
  if (state.rateLimitCooldownEnd > now) {
    return { allowed: false, retryAfterMs: state.rateLimitCooldownEnd - now };
  }

  // Clean up old attempts outside the window
  state.connectionAttempts = state.connectionAttempts.filter(
    (timestamp) => now - timestamp < NETWORK_CONFIG.RATE_LIMIT_WINDOW_MS
  );

  // Check if under the limit
  if (state.connectionAttempts.length < NETWORK_CONFIG.RATE_LIMIT_MAX_ATTEMPTS) {
    return { allowed: true };
  }

  // Rate limit exceeded - enter cooldown
  state.rateLimitCooldownEnd = now + NETWORK_CONFIG.RATE_LIMIT_COOLDOWN_MS;
  return { allowed: false, retryAfterMs: NETWORK_CONFIG.RATE_LIMIT_COOLDOWN_MS };
};

/**
 * Record a connection attempt (for viewer joining).
 */
export const recordConnectionAttempt = (state: RateLimitState): void => {
  state.connectionAttempts.push(Date.now());
};

/**
 * Check if a peer is blocked due to failed auth attempts (for host PIN protection).
 * Returns { allowed: true } or { allowed: false, retryAfterMs: number }.
 */
export const checkAuthRateLimit = (
  state: RateLimitState,
  peerId: string
): { allowed: true } | { allowed: false; retryAfterMs: number } => {
  const now = Date.now();
  const peerState = state.failedAuthAttempts.get(peerId);

  if (!peerState) {
    return { allowed: true };
  }

  // Check if block has expired
  if (peerState.blockedUntil > 0 && peerState.blockedUntil <= now) {
    // Block expired, reset state
    state.failedAuthAttempts.delete(peerId);
    return { allowed: true };
  }

  // Check if currently blocked
  if (peerState.blockedUntil > now) {
    return { allowed: false, retryAfterMs: peerState.blockedUntil - now };
  }

  return { allowed: true };
};

/**
 * Record a failed auth attempt from a peer (for host PIN protection).
 * Returns true if the peer is now blocked.
 */
export const recordFailedAuthAttempt = (
  state: RateLimitState,
  peerId: string
): boolean => {
  const now = Date.now();
  let peerState = state.failedAuthAttempts.get(peerId);

  if (!peerState) {
    peerState = { count: 0, blockedUntil: 0 };
    state.failedAuthAttempts.set(peerId, peerState);
  }

  peerState.count++;

  if (peerState.count >= NETWORK_CONFIG.MAX_FAILED_AUTH_ATTEMPTS) {
    peerState.blockedUntil = now + NETWORK_CONFIG.AUTH_BLOCK_DURATION_MS;
    return true;
  }

  return false;
};

/**
 * Clear auth rate limit state for a peer (called on successful auth).
 */
export const clearAuthRateLimit = (state: RateLimitState, peerId: string): void => {
  state.failedAuthAttempts.delete(peerId);
};

/**
 * Reset all rate limiting state.
 */
export const resetRateLimitState = (state: RateLimitState): void => {
  state.connectionAttempts = [];
  state.rateLimitCooldownEnd = 0;
  state.failedAuthAttempts.clear();
};
