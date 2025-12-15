// Tile and letter status types
export type LetterStatus = 'correct' | 'present' | 'absent';

// A guess contains the word and the status of each letter
export interface Guess {
  word: string;
  status: LetterStatus[];
}

// Game state that gets synced between host and viewer
export interface GameState {
  solution: string;
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
  onGameStateReceived: (callback: (state: GameState) => void) => void;
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
export type SuggestionStatus = null | 'pending' | 'accepted' | 'rejected';
