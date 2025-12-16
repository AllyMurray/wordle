/**
 * Zustand State Management
 *
 * This application uses Zustand for state management, providing several benefits
 * over the previous React Context + useState approach:
 *
 * 1. FINE-GRAINED SUBSCRIPTIONS
 *    Components only re-render when their specific state slice changes.
 *    Example: `const guesses = useGuesses()` won't re-render when `currentGuess` changes.
 *
 * 2. NO PROVIDER REQUIRED
 *    Unlike Context, stores can be imported and used directly without wrapping
 *    the component tree in providers.
 *
 * 3. ACCESS OUTSIDE REACT
 *    Use `store.getState()` to read state from callbacks, WebRTC handlers, etc.
 *    This eliminates the need for useRef patterns to get latest state in closures.
 *
 * 4. BUILT-IN PERSISTENCE
 *    The stats store uses Zustand's `persist` middleware for automatic
 *    localStorage sync, replacing manual useEffect sync.
 *
 * 5. DEVTOOLS SUPPORT
 *    Zustand integrates with Redux DevTools for state inspection and time-travel debugging.
 *
 * Store Structure:
 * - gameStore: Core game logic (guesses, solution, currentGuess)
 * - multiplayerStore: P2P connection state and actions
 * - statsStore: Game statistics with localStorage persistence
 * - uiStore: UI state (modals, game mode selection)
 */

// Game store - core game logic
export {
  useGameStore,
  useSolution,
  useGuesses,
  useCurrentGuess,
  useViewerGuess,
  useGameOver,
  useWon,
  useShake,
  useMessage,
  useIsViewer,
  MAX_GUESSES_COUNT,
  WORD_LENGTH_COUNT,
} from './gameStore';

// Multiplayer store - P2P connection handling
export {
  useMultiplayerStore,
  useRole,
  useSessionCode,
  useSessionPin,
  useConnectionStatus,
  useErrorMessage,
  usePartnerConnected,
  usePendingSuggestion,
  registerGameStateCallback,
  registerSuggestionResponseCallback,
} from './multiplayerStore';

// Stats store - game statistics with persistence
export {
  useStatsStore,
  useStats,
  useRecordGame,
  useResetStats,
  useWinPercentage,
  useMaxDistributionValue,
} from './statsStore';

// UI store - modals and game mode
export {
  useUIStore,
  useGameMode,
  useSuggestionStatus,
  useIsStatsOpen,
} from './uiStore';
