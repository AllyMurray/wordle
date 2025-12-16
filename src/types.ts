import { z } from 'zod';

// Game configuration constants
export const GAME_CONFIG = {
  // Word settings
  WORD_LENGTH: 5,
  MAX_GUESSES: 6,

  // Session code settings
  // Human-readable part (e.g., "ABCDEF")
  SESSION_CODE_LENGTH: 6,
  SESSION_CODE_CHARS: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', // Excludes ambiguous characters (0, O, 1, I)
  // Random secret suffix for peer ID unpredictability (e.g., "a3f2b1")
  PEER_SECRET_LENGTH: 6,
  PEER_SECRET_CHARS: '0123456789abcdef', // Hex characters for the secret
  // Full session code format: "{readable}-{secret}" = 6 + 1 + 6 = 13 chars
  FULL_SESSION_CODE_LENGTH: 13,
  SESSION_CODE_SEPARATOR: '-',

  // Session PIN settings (optional authentication)
  SESSION_PIN_MIN_LENGTH: 4,
  SESSION_PIN_MAX_LENGTH: 8,
  SESSION_PIN_CHARS: '0123456789', // Numeric PIN only

  // UI timing (in milliseconds)
  SHAKE_DURATION_MS: 500,
  HOST_RETRY_DELAY_MS: 100,

  // PeerJS configuration
  PEER_DEBUG_LEVEL: 0,

  // Message ID generation
  MESSAGE_ID_RANDOM_LENGTH: 7,
} as const;

/**
 * Generate a random peer secret (lowercase hex string).
 */
export const generatePeerSecret = (): string => {
  const chars = GAME_CONFIG.PEER_SECRET_CHARS;
  let secret = '';
  for (let i = 0; i < GAME_CONFIG.PEER_SECRET_LENGTH; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
};

/**
 * Parse a full session code into its readable and secret parts.
 * Returns null if the format is invalid.
 */
export const parseSessionCode = (
  fullCode: string
): { readable: string; secret: string } | null => {
  const parts = fullCode.split(GAME_CONFIG.SESSION_CODE_SEPARATOR);
  if (parts.length !== 2) {
    return null;
  }
  const [readable, secret] = parts;
  if (
    readable === undefined ||
    secret === undefined ||
    readable.length !== GAME_CONFIG.SESSION_CODE_LENGTH ||
    secret.length !== GAME_CONFIG.PEER_SECRET_LENGTH
  ) {
    return null;
  }
  return { readable, secret };
};

/**
 * Create a full session code from readable and secret parts.
 */
export const createFullSessionCode = (readable: string, secret: string): string => {
  return `${readable}${GAME_CONFIG.SESSION_CODE_SEPARATOR}${secret}`;
};

/**
 * Sanitize a session code input by removing invalid characters.
 * Handles the full format: "{readable}-{secret}"
 * - Readable part: uppercase letters from SESSION_CODE_CHARS
 * - Secret part: lowercase hex characters
 */
export const sanitizeSessionCode = (input: string): string => {
  const separator = GAME_CONFIG.SESSION_CODE_SEPARATOR;
  const separatorIndex = input.indexOf(separator);

  if (separatorIndex === -1) {
    // No separator yet - sanitize as readable part only
    return input
      .toUpperCase()
      .split('')
      .filter((char) => GAME_CONFIG.SESSION_CODE_CHARS.includes(char))
      .join('')
      .slice(0, GAME_CONFIG.SESSION_CODE_LENGTH);
  }

  // Has separator - sanitize both parts
  const readablePart = input.slice(0, separatorIndex);
  const secretPart = input.slice(separatorIndex + 1);

  const sanitizedReadable = readablePart
    .toUpperCase()
    .split('')
    .filter((char) => GAME_CONFIG.SESSION_CODE_CHARS.includes(char))
    .join('')
    .slice(0, GAME_CONFIG.SESSION_CODE_LENGTH);

  const sanitizedSecret = secretPart
    .toLowerCase()
    .split('')
    .filter((char) => GAME_CONFIG.PEER_SECRET_CHARS.includes(char))
    .join('')
    .slice(0, GAME_CONFIG.PEER_SECRET_LENGTH);

  return `${sanitizedReadable}${separator}${sanitizedSecret}`;
};

/**
 * Validate that a session code is in the correct full format: "{readable}-{secret}"
 * - Readable: SESSION_CODE_LENGTH uppercase chars from SESSION_CODE_CHARS
 * - Secret: PEER_SECRET_LENGTH lowercase hex chars
 */
export const isValidSessionCode = (code: string): boolean => {
  if (code.length !== GAME_CONFIG.FULL_SESSION_CODE_LENGTH) {
    return false;
  }

  const parsed = parseSessionCode(code);
  if (!parsed) {
    return false;
  }

  const { readable, secret } = parsed;

  const readableValid = readable
    .split('')
    .every((char) => GAME_CONFIG.SESSION_CODE_CHARS.includes(char));

  const secretValid = secret
    .split('')
    .every((char) => GAME_CONFIG.PEER_SECRET_CHARS.includes(char));

  return readableValid && secretValid;
};

/**
 * Sanitize a session PIN input by removing non-numeric characters.
 */
export const sanitizeSessionPin = (input: string): string => {
  return input
    .split('')
    .filter((char) => GAME_CONFIG.SESSION_PIN_CHARS.includes(char))
    .join('')
    .slice(0, GAME_CONFIG.SESSION_PIN_MAX_LENGTH);
};

/**
 * Validate that a session PIN is within valid length range (or empty for no PIN).
 */
export const isValidSessionPin = (pin: string): boolean => {
  // Empty PIN is valid (no authentication)
  if (pin === '') {
    return true;
  }
  // If set, PIN must be within length bounds and numeric only
  if (
    pin.length < GAME_CONFIG.SESSION_PIN_MIN_LENGTH ||
    pin.length > GAME_CONFIG.SESSION_PIN_MAX_LENGTH
  ) {
    return false;
  }
  return pin.split('').every((char) => GAME_CONFIG.SESSION_PIN_CHARS.includes(char));
};

// Network resilience constants
export const NETWORK_CONFIG = {
  // Reconnection settings
  MAX_RECONNECT_ATTEMPTS: 5,
  INITIAL_RECONNECT_DELAY_MS: 1000,
  MAX_RECONNECT_DELAY_MS: 16000,

  // Heartbeat settings
  HEARTBEAT_INTERVAL_MS: 5000,
  HEARTBEAT_TIMEOUT_MS: 15000,

  // Message acknowledgment settings
  ACK_TIMEOUT_MS: 5000,
  MAX_RETRY_ATTEMPTS: 3,
} as const;

// Tile and letter status types
export type LetterStatus = 'correct' | 'present' | 'absent';

// A guess contains the word and the status of each letter
export interface Guess {
  word: string;
  status: LetterStatus[];
}

// Full game state (used internally by host)
export interface GameState {
  solution: string;
  guesses: Guess[];
  currentGuess: string;
  gameOver: boolean;
  won: boolean;
  message: string;
}

// Game state sent to viewer (solution hidden for security)
export interface ViewerGameState {
  guesses: Guess[];
  currentGuess: string;
  gameOver: boolean;
  won: boolean;
  message: string;
}

// Keyboard status map (letter -> status)
export type KeyboardStatus = Record<string, LetterStatus>;

// Options for useWordle hook
export interface UseWordleOptions {
  isViewer?: boolean | undefined;
  onStateChange?: ((state: GameState) => void) | undefined;
  onViewerGuessChange?: ((guess: string) => void) | undefined;
}

// Return type for useWordle hook
export interface UseWordleReturn {
  solution: string;
  guesses: Guess[];
  currentGuess: string;
  viewerGuess: string;
  gameOver: boolean;
  won: boolean;
  shake: boolean;
  message: string;
  handleKeyPress: (key: string) => void | 'submit-suggestion';
  getKeyboardStatus: () => KeyboardStatus;
  newGame: () => void;
  getGameState: () => GameState;
  setGameState: (state: Partial<GameState>) => void;
  submitWord: (word: string) => boolean;
  clearViewerGuess: () => void;
  isValidWord: (word: string) => boolean;
  maxGuesses: number;
  wordLength: number;
}

// Multiplayer role types
export type MultiplayerRole = 'host' | 'viewer' | null;

// Connection status types
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Pending suggestion from viewer
export interface PendingSuggestion {
  word: string;
}

// Return type for useMultiplayer hook
export interface UseMultiplayerReturn {
  role: MultiplayerRole;
  sessionCode: string;
  sessionPin: string;
  connectionStatus: ConnectionStatus;
  errorMessage: string;
  partnerConnected: boolean;
  pendingSuggestion: PendingSuggestion | null;
  hostGame: (pin?: string) => void;
  joinGame: (code: string, pin?: string) => void;
  leaveSession: () => void;
  sendGameState: (state: GameState) => void;
  onGameStateReceived: (callback: (state: ViewerGameState) => void) => void;
  sendSuggestion: (word: string) => void;
  clearSuggestion: () => void;
  acceptSuggestion: () => string | null;
  rejectSuggestion: () => void;
  onSuggestionResponse: (callback: (accepted: boolean) => void) => void;
  isHost: boolean;
  isViewer: boolean;
  isConnected: boolean;
}

// Game mode type
export type GameMode = null | 'solo' | 'multiplayer';

// Suggestion status for viewer
export type SuggestionStatus = null | 'pending' | 'accepted' | 'rejected' | 'invalid';

// ============================================
// Zod Schemas for Peer Message Validation
// ============================================

// Schema for letter status
const LetterStatusSchema = z.enum(['correct', 'present', 'absent']);

// Schema for a guess
const GuessSchema = z.object({
  word: z.string(),
  status: z.array(LetterStatusSchema),
});

// Schema for viewer game state (solution hidden for security)
const ViewerGameStateSchema = z.object({
  guesses: z.array(GuessSchema),
  currentGuess: z.string(),
  gameOver: z.boolean(),
  won: z.boolean(),
  message: z.string(),
});

// Schema for request-state message
const RequestStateMessageSchema = z.object({
  type: z.literal('request-state'),
});

// Schema for game-state message (sent to viewer, solution hidden)
const GameStateMessageSchema = z.object({
  type: z.literal('game-state'),
  state: ViewerGameStateSchema,
});

// Schema for suggest-word message
const SuggestWordMessageSchema = z.object({
  type: z.literal('suggest-word'),
  word: z.string(),
});

// Schema for clear-suggestion message
const ClearSuggestionMessageSchema = z.object({
  type: z.literal('clear-suggestion'),
});

// Schema for suggestion-accepted message
const SuggestionAcceptedMessageSchema = z.object({
  type: z.literal('suggestion-accepted'),
});

// Schema for suggestion-rejected message
const SuggestionRejectedMessageSchema = z.object({
  type: z.literal('suggestion-rejected'),
});

// Schema for message acknowledgment
const AckMessageSchema = z.object({
  type: z.literal('ack'),
  messageId: z.string(),
});

// Schema for heartbeat ping
const PingMessageSchema = z.object({
  type: z.literal('ping'),
  timestamp: z.number(),
});

// Schema for heartbeat pong
const PongMessageSchema = z.object({
  type: z.literal('pong'),
  timestamp: z.number(),
});

// Schema for authentication request (viewer sends PIN to host)
const AuthRequestMessageSchema = z.object({
  type: z.literal('auth-request'),
  pin: z.string(),
});

// Schema for authentication success (host approves connection)
const AuthSuccessMessageSchema = z.object({
  type: z.literal('auth-success'),
});

// Schema for authentication failure (host rejects connection)
const AuthFailureMessageSchema = z.object({
  type: z.literal('auth-failure'),
  reason: z.string(),
});

// Union schema for all peer messages
export const PeerMessageSchema = z.discriminatedUnion('type', [
  RequestStateMessageSchema,
  GameStateMessageSchema,
  SuggestWordMessageSchema,
  ClearSuggestionMessageSchema,
  SuggestionAcceptedMessageSchema,
  SuggestionRejectedMessageSchema,
  AckMessageSchema,
  PingMessageSchema,
  PongMessageSchema,
  AuthRequestMessageSchema,
  AuthSuccessMessageSchema,
  AuthFailureMessageSchema,
]);

// Inferred PeerMessage type from schema
export type PeerMessage = z.infer<typeof PeerMessageSchema>;

// Validation result type
export type PeerMessageValidationResult =
  | { success: true; message: PeerMessage }
  | { success: false; error: string };

// Validate and parse a peer message
export const validatePeerMessage = (data: unknown): PeerMessageValidationResult => {
  const result = PeerMessageSchema.safeParse(data);
  if (result.success) {
    return { success: true, message: result.data };
  }
  return { success: false, error: result.error.message };
};

// ============================================
// Game Statistics (Privacy-Respecting Analytics)
// ============================================

// Statistics stored locally in the browser
export interface GameStatistics {
  // Total counts
  gamesPlayed: number;
  gamesWon: number;

  // Streaks
  currentStreak: number;
  maxStreak: number;

  // Guess distribution (index = number of guesses - 1, so index 0 = won in 1 guess)
  guessDistribution: [number, number, number, number, number, number];

  // Last game date (ISO string) for streak tracking
  lastGameDate: string | null;

  // Game mode breakdown
  soloGamesPlayed: number;
  multiplayerGamesPlayed: number;
}

// Default statistics for new users
export const DEFAULT_STATISTICS: GameStatistics = {
  gamesPlayed: 0,
  gamesWon: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: [0, 0, 0, 0, 0, 0],
  lastGameDate: null,
  soloGamesPlayed: 0,
  multiplayerGamesPlayed: 0,
};

// LocalStorage key for statistics
export const STATS_STORAGE_KEY = 'wordle-statistics';

// Schema for validating stored statistics
const GuessDistributionSchema = z.tuple([
  z.number(),
  z.number(),
  z.number(),
  z.number(),
  z.number(),
  z.number(),
]);

const GameStatisticsSchema = z.object({
  gamesPlayed: z.number().min(0),
  gamesWon: z.number().min(0),
  currentStreak: z.number().min(0),
  maxStreak: z.number().min(0),
  guessDistribution: GuessDistributionSchema,
  lastGameDate: z.string().nullable(),
  soloGamesPlayed: z.number().min(0),
  multiplayerGamesPlayed: z.number().min(0),
});

// Load statistics from localStorage with validation
export const loadStatistics = (): GameStatistics => {
  try {
    const stored = localStorage.getItem(STATS_STORAGE_KEY);
    if (!stored) {
      return { ...DEFAULT_STATISTICS };
    }
    const parsed = JSON.parse(stored) as unknown;
    const result = GameStatisticsSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    // Invalid data, return defaults
    return { ...DEFAULT_STATISTICS };
  } catch {
    // Parse error, return defaults
    return { ...DEFAULT_STATISTICS };
  }
};

// Save statistics to localStorage
export const saveStatistics = (stats: GameStatistics): void => {
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Storage error (e.g., quota exceeded), silently ignore
  }
};

// Check if two dates are consecutive days
const isConsecutiveDay = (lastDate: string, currentDate: string): boolean => {
  const last = new Date(lastDate);
  const current = new Date(currentDate);

  // Reset to start of day for comparison
  last.setHours(0, 0, 0, 0);
  current.setHours(0, 0, 0, 0);

  const diffTime = current.getTime() - last.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  return diffDays === 1;
};

// Check if date is today
const isToday = (dateStr: string): boolean => {
  const date = new Date(dateStr);
  const today = new Date();

  date.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return date.getTime() === today.getTime();
};

// Record a completed game
export const recordGameResult = (
  stats: GameStatistics,
  won: boolean,
  guessCount: number,
  gameMode: 'solo' | 'multiplayer'
): GameStatistics => {
  const today = new Date().toISOString().split('T')[0];
  if (!today) {
    return stats;
  }

  const newStats = { ...stats };

  // Update total counts
  newStats.gamesPlayed += 1;

  // Update game mode counts
  if (gameMode === 'solo') {
    newStats.soloGamesPlayed += 1;
  } else {
    newStats.multiplayerGamesPlayed += 1;
  }

  if (won) {
    newStats.gamesWon += 1;

    // Update guess distribution (0-indexed, so guess 1 = index 0)
    const distributionIndex = Math.min(guessCount - 1, 5);
    newStats.guessDistribution = [...newStats.guessDistribution] as [
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    newStats.guessDistribution[distributionIndex] =
      (newStats.guessDistribution[distributionIndex] ?? 0) + 1;

    // Update streak
    if (stats.lastGameDate && isConsecutiveDay(stats.lastGameDate, today)) {
      newStats.currentStreak = stats.currentStreak + 1;
    } else if (stats.lastGameDate && isToday(stats.lastGameDate)) {
      // Same day, don't change streak
    } else {
      // New streak starts
      newStats.currentStreak = 1;
    }

    newStats.maxStreak = Math.max(newStats.maxStreak, newStats.currentStreak);
  } else {
    // Lost - reset current streak
    newStats.currentStreak = 0;
  }

  newStats.lastGameDate = today;

  return newStats;
};
