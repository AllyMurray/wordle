import { z } from 'zod';

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
  connectionStatus: ConnectionStatus;
  errorMessage: string;
  partnerConnected: boolean;
  pendingSuggestion: PendingSuggestion | null;
  hostGame: () => void;
  joinGame: (code: string) => void;
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

// Union schema for all peer messages
export const PeerMessageSchema = z.discriminatedUnion('type', [
  RequestStateMessageSchema,
  GameStateMessageSchema,
  SuggestWordMessageSchema,
  ClearSuggestionMessageSchema,
  SuggestionAcceptedMessageSchema,
  SuggestionRejectedMessageSchema,
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
