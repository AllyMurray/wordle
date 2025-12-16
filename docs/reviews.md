# Wordle Codebase Review

**Date:** December 15, 2025
**Reviewer:** Claude Code
**Repository:** AllyMurray/wordle

---

## Executive Summary

This is a well-architected React/TypeScript Wordle clone with an innovative P2P multiplayer feature using WebRTC via PeerJS. The codebase demonstrates strong TypeScript practices, clean component architecture, and thoughtful state management through custom hooks. Overall code quality is high, with some areas for potential improvement.

**Overall Rating: 8.5/10**

---

## Table of Contents

1. [Architecture & Design Patterns](#architecture--design-patterns)
2. [Code Quality](#code-quality)
3. [TypeScript Implementation](#typescript-implementation)
4. [Feature Implementation](#feature-implementation)
5. [Error Handling](#error-handling)
6. [Security Considerations](#security-considerations)
7. [Performance](#performance)
8. [Testing](#testing)
9. [CI/CD & DevOps](#cicd--devops)
10. [Recommendations](#recommendations)

---

## Architecture & Design Patterns

### Strengths

#### 1. Custom Hooks Pattern (Excellent)
The codebase effectively separates concerns using custom hooks:

- **`useWordle`** (`src/hooks/useWordle.ts`): Encapsulates all game logic including state management, word validation, and keyboard handling
- **`useMultiplayer`** (`src/hooks/useMultiplayer.ts`): Manages P2P connectivity, session management, and message passing

This separation makes the code highly testable and maintainable.

#### 2. Component Hierarchy (Good)
Clean, single-responsibility components:
```
App.tsx (orchestrator)
├── Lobby (game mode selection)
├── Board
│   └── Row
│       └── Tile
└── Keyboard
```

Each component is focused and stateless where appropriate, receiving props from parent components.

#### 3. Discriminated Unions for Messages (Excellent)
The multiplayer message protocol uses TypeScript discriminated unions:

```typescript
type PeerMessage =
  | RequestStateMessage
  | GameStateMessage
  | SuggestWordMessage
  | ClearSuggestionMessage
  | SuggestionAcceptedMessage
  | SuggestionRejectedMessage;
```

This pattern provides type-safe message handling and exhaustive checking.

#### 4. Callback Refs Pattern (Good)
Proper use of refs for stable function references to avoid stale closures:

```typescript
const onStateChangeRef = useRef(onStateChange);
useEffect(() => {
  onStateChangeRef.current = onStateChange;
}, [onStateChange]);
```

### Areas for Improvement

#### 1. ~~App.tsx Complexity~~ ✅ **RESOLVED**
~~`App.tsx` (277 lines) handles significant orchestration logic. Consider extracting:~~
- ~~Game session management into a custom hook (e.g., `useGameSession`)~~
- ~~Multiplayer event handlers into a separate module~~

**Resolution:** Created `useGameSession` hook to extract game session logic. App.tsx now ~145 lines, focused purely on rendering.

#### 2. ~~Missing Context API~~ ✅ **RESOLVED**
~~For deeply shared state like game mode and multiplayer status, React Context could reduce prop drilling and simplify the component tree.~~

**Resolution:** Created `GameContext` (`src/contexts/GameContext.tsx`) that provides game mode and multiplayer status (isHost, isViewer, partnerConnected, sessionCode, connectionStatus) to any component in the tree. The `GameProvider` wraps the app in `main.tsx` and exposes both direct access to common status values and the full session object. App.tsx now uses `useGameContext()` instead of calling `useGameSession()` directly, enabling any child component to access game state without prop drilling.

---

## Code Quality

### Strengths

#### 1. Consistent Coding Style
- Consistent use of functional components with hooks
- Proper TypeScript typing throughout
- Clean import organization (React first, then external, then internal)

#### 2. Meaningful Naming
Variables and functions have clear, descriptive names:
- `getLetterStatus()` - clearly returns letter status
- `handleAcceptSuggestion()` - clearly handles suggestion acceptance
- `partnerConnected` - clearly indicates partner connection state

#### 3. Pure Functions Where Appropriate
The `getLetterStatus` function is pure and testable:

```typescript
const getLetterStatus = useCallback((guess: string, solutionWord: string): LetterStatus[] => {
  // Two-pass algorithm for correct Wordle coloring
  // ...
}, []);
```

#### 4. Proper Event Cleanup
Event listeners are properly cleaned up:

```typescript
useEffect(() => {
  if (gameMode) {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }
}, [handleKeyDown, gameMode]);
```

### Areas for Improvement

#### 1. ~~Magic Numbers~~ ✅ **RESOLVED**
~~Some magic values could be extracted as named constants:~~

```typescript
// In useMultiplayer.ts:56
const code = generateSessionCode(); // Uses hardcoded 6

// Could be:
const SESSION_CODE_LENGTH = 6;
```

**Resolution:** Created `GAME_CONFIG` object in `types.ts` containing all game configuration constants:
- `WORD_LENGTH`, `MAX_GUESSES` - game rules
- `SESSION_CODE_LENGTH`, `SESSION_CODE_CHARS` - multiplayer session codes
- `SHAKE_DURATION_MS`, `HOST_RETRY_DELAY_MS` - UI timing
- `PEER_DEBUG_LEVEL`, `MESSAGE_ID_RANDOM_LENGTH` - technical settings

Updated `useMultiplayer.ts`, `useWordle.ts`, and `Lobby.tsx` to use these centralized constants.

#### 2. ~~Inline Comments~~ ✅ **RESOLVED**
~~While the code is readable, complex algorithms like `getLetterStatus` would benefit from inline comments explaining the two-pass approach.~~

**Resolution:** Added comprehensive JSDoc and inline comments to the `getLetterStatus` function in `useWordle.ts`. The comments explain:
- The purpose of the two-pass algorithm for handling duplicate letters correctly
- A concrete example (APPLE/PAPAL) showing how each pass works
- Why two passes are necessary (to prevent "stealing" correct matches)
- Clear annotations for each section of the algorithm

#### 3. ~~Word List Data Quality~~ ✅ **RESOLVED**
~~In `src/data/words.ts`, some entries are not 5 letters and rely on `.filter(word => word.length === 5)`:~~
- ~~`'army'` (4 letters)~~
- ~~`'fossil'`, `'golden'`, `'lonely'` (6 letters)~~
- ~~`'hasn'` (4 letters, incomplete word)~~

~~This runtime filter works but indicates data quality issues in the source list.~~

**Resolution:** The word list has been cleaned up. All entries in `src/data/words.ts` are now valid 5-letter words. The runtime filter has been removed as it is no longer needed.

---

## TypeScript Implementation

### Strengths

#### 1. Strict Configuration (Excellent)
The `tsconfig.json` enables maximum strictness:

```json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true
}
```

`noUncheckedIndexedAccess` is particularly noteworthy as it catches potential undefined access.

#### 2. Comprehensive Type Definitions
The `types.ts` file provides complete interface definitions for all domain objects:

```typescript
export interface UseWordleReturn {
  solution: string;
  guesses: Guess[];
  // ... comprehensive typing
}
```

#### 3. Readonly Arrays
Proper use of readonly arrays for immutable data:

```typescript
export const WORDS: readonly string[] = [...];
const KEYBOARD_ROWS: readonly (readonly string[])[] = [...];
```

#### 4. Type-Only Imports
Consistent use of `import type` for type-only imports:

```typescript
import type { Guess, LetterStatus, GameState } from '../types';
```

### Areas for Improvement

#### 1. ~~PeerMessage Type Location~~ ✅ **RESOLVED**
~~The `PeerMessage` union type is defined within `useMultiplayer.ts`. Consider moving to `types.ts` for consistency and reusability.~~

**Resolution:** Moved PeerMessage type definition to `types.ts` along with Zod validation schemas.

#### 2. ~~Type Assertion Safety~~ ✅ **RESOLVED**
~~In `useMultiplayer.ts:116`:~~

```typescript
const message = data as PeerMessage;
```

~~This assertion could be unsafe if malformed data is received. Consider adding runtime validation.~~

**Resolution:** Implemented Zod schema validation for all peer messages. Incoming data is now validated using `validatePeerMessage()` before processing.

---

## Feature Implementation

### Core Game Logic (Excellent)

The Wordle game logic is correctly implemented:

1. **Two-pass letter status algorithm**: Correctly handles duplicate letters by first marking exact matches, then remaining present letters
2. **Word validation**: Validates against the word list before accepting guesses
3. **Keyboard status tracking**: Properly tracks and displays letter status with correct priority (correct > present > absent)

### Multiplayer System (Innovative)

The P2P multiplayer implementation using PeerJS is well-designed:

#### Strengths:
- **Serverless architecture**: Uses WebRTC for direct peer connections, eliminating server costs
- **Readable session codes**: 6-character codes using unambiguous characters (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`)
- **Rejoin support**: Handles viewer reconnection gracefully
- **Suggestion workflow**: Host can accept/reject viewer suggestions with validation

#### Host-Viewer Asymmetry:
```
Host: Creates game, controls guesses, accepts/rejects suggestions
Viewer: Observes game state, submits word suggestions
```

### Word Validation (Good)

Recent addition validates viewer suggestions client-side before sending:

```typescript
const handleViewerGuessChange = useCallback((guess: string): void => {
  if (guess.length === 5) {
    if (WORDS.includes(guess.toLowerCase())) {
      // Valid - send suggestion
    } else {
      setSuggestionStatus('invalid');
      multiplayer.clearSuggestion();
    }
  }
}, [multiplayer]);
```

---

## Error Handling

### Strengths

#### 1. Connection Error Handling
Multiplayer connection errors are handled with appropriate user feedback:

```typescript
peer.on('error', (err) => {
  if (err.type === 'unavailable-id') {
    // Retry with new session code
    setTimeout(() => hostGameRef.current?.(), 100);
  } else {
    setConnectionStatus('error');
    setErrorMessage('Connection error. Please try again.');
  }
});
```

#### 2. Empty Word List Guard
The random word selection guards against empty arrays:

```typescript
export const getRandomWord = (): string => {
  const word = WORDS[randomIndex];
  if (word === undefined) {
    throw new Error('Word list is empty');
  }
  return word.toUpperCase();
};
```

#### 3. Graceful Degradation
The app works in solo mode even if multiplayer connectivity fails.

### Areas for Improvement

#### 1. Missing Network Error Recovery
No retry logic for temporary network failures during gameplay. If a WebRTC connection drops briefly, the viewer must manually rejoin.

#### 2. Silent Message Failures
Peer messages are sent without confirmation or retry:

```typescript
conn.send(message); // Fire and forget
```

Consider implementing message acknowledgment for critical messages.

#### 3. ~~Unhandled Promise Rejections~~ ✅ **RESOLVED**
~~PeerJS operations could throw unhandled promises. Consider wrapping in try-catch or using error boundaries.~~

**Resolution:** Added comprehensive try-catch wrappers around all PeerJS operations in `useMultiplayer.ts`:
- Peer constructor calls in both `hostGame` and `attemptConnection` functions
- `peer.connect()` call when connecting to host
- All `conn.send()` operations including message acknowledgments, heartbeat pings/pongs, and suggestion clearing
- `peer.destroy()` and `conn.close()` operations in cleanup functions
- Retry send operations in the message acknowledgment system

Errors are logged with descriptive warnings and handled gracefully without crashing the application.

#### 4. No Input Sanitization
Join code input is uppercased but not validated for potentially malicious input:

```typescript
setJoinCode(e.target.value.toUpperCase().slice(0, 6));
```

---

## Security Considerations

### Current State

#### Concerns:

1. ~~**Solution Exposure in Multiplayer**~~ ✅ **RESOLVED**
   ~~The game solution is sent to viewers in the game state:~~
   ```typescript
   // Previously:
   export interface GameState {
     solution: string; // Visible to viewer!
     // ...
   }
   ```
   ~~A technically savvy viewer could inspect network traffic to see the answer.~~

   **Resolution:** Created `ViewerGameState` type that excludes the solution. The host now strips the solution before sending game state to viewers.

2. **Peer ID Predictability**
   Session codes use `wordle-${code}` as the PeerJS ID. If an attacker knows the code format, they could attempt to connect to active sessions.

3. **No Authentication**
   Anyone with a session code can join as a viewer. No verification of intended participants.

4. ~~**Message Validation**~~ ✅ **RESOLVED**
   ~~Received peer messages are cast without validation:~~
   ```typescript
   const message = data as PeerMessage;
   ```
   ~~Malicious peers could send malformed messages.~~

   **Resolution:** Implemented Zod schema validation for all incoming peer messages.

### Recommendations:
- ~~Remove solution from viewer's game state (calculate status server-side... or in this case, host-side)~~ ✅ **RESOLVED**
- Add optional password/PIN for sessions
- ~~Implement message schema validation using a library like Zod~~ ✅ **RESOLVED**

---

## Performance

### Strengths

1. **Memoization**: Proper use of `useCallback` and `useMemo` for expensive operations
2. **Event Delegation**: Keyboard component handles all key clicks through a single parent handler
3. **CSS Animations**: Uses CSS for animations instead of JS, reducing main thread work
4. **Lazy Initialization**: Solution word generated with lazy state initialization:
   ```typescript
   const [solution, setSolution] = useState(() => getRandomWord());
   ```

### Considerations

1. **Word List Loading**: The 500+ word list is bundled in the JS. For larger lists, consider lazy loading or worker-based validation.

2. **Re-renders**: The `App` component re-renders on any state change. React.memo on child components would optimize this.

3. **CSS Animation Delays**: Tile flip animations use inline `style` for animation delays, which could be optimized with CSS custom properties.

---

## Testing

### Current State

**No tests are present in the repository.**

### Recommendations

#### Unit Tests (Priority: High)
- `useWordle` hook: Test game logic, word validation, state transitions
- `getLetterStatus`: Test edge cases (duplicate letters, all correct, all absent)
- Word validation: Test boundary conditions

#### Integration Tests (Priority: Medium)
- Multiplayer message flow: Host-viewer interaction sequences
- Game flow: Complete game scenarios (win, lose, invalid guesses)

#### E2E Tests (Priority: Low)
- Full game playthroughs
- Multiplayer sessions across different browsers

#### Suggested Testing Stack:
- Vitest + React Testing Library for unit/integration (native Vite integration)
- Playwright or Cypress for E2E
- Mock Service Worker (MSW) for PeerJS mocking

---

## CI/CD & DevOps

### Strengths

1. **GitHub Actions Pipeline**: Automated build and deploy to GitHub Pages
2. **Type Checking in CI**: `npm run typecheck` runs before build
3. **Concurrency Control**: Prevents concurrent deployments
4. **Modern Node Version**: Uses Node 20

### Pipeline Flow:
```
Push to main → Checkout → Setup Node → Install → Typecheck → Build → Deploy
```

### Areas for Improvement

1. ~~**No Linting in CI**~~: ✅ **RESOLVED** - Added `npm run lint` step to deploy workflow
2. ~~**No Tests in CI**~~: ✅ **RESOLVED** - Added test step to deploy workflow
3. ~~**No PR Checks**~~: ✅ **RESOLVED** - Added `pr-check.yml` workflow for pull request validation
4. ~~**No Dependency Caching**~~: ✅ **RESOLVED** - Added `node_modules` caching with `actions/cache@v4` using `package-lock.json` hash as cache key. Skips `npm ci` entirely on cache hit for faster builds.

### Recommended Additions:
```yaml
- name: Lint
  run: npm run lint

- name: Test
  run: npm test

- name: Build
  run: npm run build
```

---

## Recommendations

### High Priority

1. ~~**Add Testing Infrastructure**~~ ✅ **RESOLVED**
   - Set up Vitest with React Testing Library (seamless Vite integration)
   - Add unit tests for `useWordle` hook
   - Test the letter status algorithm exhaustively

2. ~~**Add Linting to CI**~~ ✅ **RESOLVED**
   - Include `npm run lint` in the GitHub Actions workflow

3. ~~**Validate Peer Messages**~~ ✅ **RESOLVED**
   - Add runtime validation for received WebRTC messages
   - Consider using Zod or similar for schema validation

4. ~~**Fix Word List**~~ ✅ **RESOLVED**
   - Clean up the word list to only contain valid 5-letter words
   - Remove the runtime filter as it indicates data issues

### Medium Priority

5. ~~**Extract Game Session Logic**~~ ✅ **RESOLVED**
   - ~~Create `useGameSession` hook to reduce App.tsx complexity~~

   **Resolution:** Created `useGameSession` hook (`src/hooks/useGameSession.ts`) that encapsulates all game session orchestration logic including game mode state, suggestion status, multiplayer integration, and event handlers. App.tsx is now reduced from ~275 lines to ~145 lines and focuses purely on rendering.

6. ~~**Hide Solution from Viewer**~~ ✅ **RESOLVED**
   - ~~Restructure multiplayer to not expose solution to viewers~~

   **Resolution:** Created `ViewerGameState` type that excludes the solution field. The `sendGameState` function in `useMultiplayer.ts` now strips the solution before sending to viewers, preventing cheating by inspecting network traffic. Updated Zod validation schema to reflect the new structure.

7. ~~**Add Error Boundaries**~~ ✅ **RESOLVED**
   - ~~Wrap the app in React error boundaries for graceful failure handling~~

   **Resolution:** Created `ErrorBoundary` class component (`src/components/ErrorBoundary.tsx`) that catches JavaScript errors in the component tree and displays a user-friendly fallback UI with "Reload Page" and "Try Again" options. The App component is wrapped with ErrorBoundary in `main.tsx`.

8. ~~**Improve Network Resilience**~~ ✅ **RESOLVED**
   - ~~Add retry logic for temporary connection failures~~
   - ~~Implement message acknowledgment for critical updates~~

   **Resolution:** Implemented comprehensive network resilience features:
   - Added automatic reconnection with exponential backoff (1s → 2s → 4s → 8s → 16s) for viewers when connection drops
   - Implemented message acknowledgment system for critical messages (game state, suggestions, responses) with retry logic (up to 3 retries, 5s timeout)
   - Added heartbeat/ping-pong monitoring (5s interval, 15s timeout) to detect stale connections early
   - Network configuration is centralized in `NETWORK_CONFIG` constants in `types.ts`

### Low Priority

9. ~~**Add Accessibility Features**~~ ✅ **RESOLVED**
   - ~~ARIA labels for game board and tiles~~
   - ~~Screen reader announcements for game events~~
   - ~~Keyboard navigation improvements~~

   **Resolution:** Implemented comprehensive accessibility features:
   - Added ARIA `role="grid"` to game board with descriptive `aria-label` showing guess progress
   - Added `role="row"` to each row with detailed descriptions of guesses and letter statuses
   - Added `role="gridcell"` to tiles with `aria-label` describing position, letter, and status
   - Added `aria-label` to keyboard keys showing their status (correct/in word/not in word)
   - Created `ScreenReaderAnnouncement` component using ARIA live regions to announce:
     - Submitted guesses with letter-by-letter status
     - Game over messages (win/lose)
     - Invalid word notifications
   - Added `aria-label` to all interactive buttons (Back, Accept/Reject suggestions, Play Again)
   - Added proper labeling to Lobby form with hidden labels and `aria-describedby` for input hints
   - Created `useGameAnnouncements` hook for generating contextual screen reader announcements

10. **Consider State Management**
    - For future complexity, consider Zustand or Redux Toolkit
    - Current hook-based approach is fine for current scope

11. **Add Analytics**
    - Track game completions, win rates, and multiplayer usage
    - Use privacy-respecting analytics

12. ~~**Progressive Web App**~~ ✅ **RESOLVED**
    - ~~Add service worker for offline solo play~~
    - ~~Add manifest for installability~~

    **Resolution:** Implemented full PWA functionality:
    - Created `manifest.json` with app metadata, theme colors, and icons for installability
    - Created custom SVG icons (192x192, 512x512, and maskable) styled as Wordle game boards
    - Created `sw.js` service worker with:
      - Cache-first strategy for static assets (JS, CSS, images)
      - Network-first strategy for HTML to ensure updates
      - Automatic cache cleanup for old versions
      - Exclusion of WebRTC/PeerJS requests (multiplayer requires network)
    - Created `registerServiceWorker.ts` module for service worker registration with update detection
    - Added PWA meta tags to `index.html` including Apple-specific tags for iOS support
    - Users can now install the app and play solo mode offline

---

## File-by-File Notes

| File | LOC | Assessment |
|------|-----|------------|
| `src/hooks/useWordle.ts` | 249 | Excellent - Clean game logic encapsulation |
| `src/hooks/useMultiplayer.ts` | 317 | Good - Consider splitting message handling |
| `src/hooks/useGameSession.ts` | 188 | Excellent - Clean session orchestration |
| `src/App.tsx` | 145 | Good - Now focused on rendering (improved from 278 lines) |
| `src/types.ts` | 91 | Excellent - Comprehensive type definitions |
| `src/components/Board.tsx` | 36 | Excellent - Simple and focused |
| `src/components/Row.tsx` | 52 | Excellent - Clean conditional rendering |
| `src/components/Tile.tsx` | 24 | Excellent - Minimal and efficient |
| `src/components/Keyboard.tsx` | 48 | Excellent - Good use of constants |
| `src/components/Lobby.tsx` | 88 | Good - Well-structured form handling |
| `src/data/words.ts` | 98 | Fair - Data quality issues |

---

## Conclusion

This Wordle clone demonstrates strong React and TypeScript fundamentals with an innovative serverless multiplayer approach. The codebase is well-organized, type-safe, and follows modern React patterns.

The main areas for improvement are:
1. ~~Adding a testing infrastructure~~ ✅ **RESOLVED**
2. ~~Improving network error resilience~~ ✅ **RESOLVED**
3. ~~Addressing security concerns around solution exposure~~ ✅ **RESOLVED**
4. ~~Reducing complexity in the main App component~~ ✅ **RESOLVED**

With these improvements, this would be a production-ready application suitable for deployment at scale.
