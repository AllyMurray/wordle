# Game Hub

Game Hub is a React and TypeScript collection of browser word games. It currently includes Wordle and Boggle, with solo play, peer-to-peer multiplayer, installable PWA support, and keyboard and screen-reader accessibility.

The deployed app is available at [allymurray.github.io/gamehub](https://allymurray.github.io/gamehub/).

## Games

### Wordle

- Guess a five-letter word in six attempts.
- A curated solution list keeps answers familiar, while a broader dictionary accepts legitimate five-letter guesses.
- Correct-position letters are green, present-but-misplaced letters use the app's amber accent, and absent letters are grey.
- Grey keyboard letters remain enabled, so a player can reuse them when needed.
- Duplicate letters are scored with a two-pass algorithm so a solution letter is never counted twice.

### Boggle

- Find words on a randomly rolled 4×4 board using adjacent tiles without reusing a tile.
- `Qu` is one tile and contributes two letters to a word.
- Timed games last three minutes; Relaxed mode ends when the player chooses.
- The public-domain ENABLE-derived dictionary accepts 172,233 alphabetic words from 3 through 17 letters.
- A trie-backed solver calculates the possible words and score for each board.

## Multiplayer

Wordle and Boggle use PeerJS/WebRTC for direct host-to-viewer play. A host can share the generated session code or URL and can optionally protect the session with a four-to-eight digit PIN.

The host is authoritative for game state. Runtime-validated messages have bounded payloads, state snapshots carry monotonic revisions, and acknowledged actions are retried when delivery is uncertain. Setup deadlines, heartbeat checks, reconnection attempts, and visible error states prevent a failed connection from hanging indefinitely.

The PeerJS signalling service is still required to establish a multiplayer connection. Solo play does not require PeerJS.

## Accessibility and offline use

- Both games support physical keyboards and accessible on-screen controls.
- Boggle tiles support arrow-key focus movement and Enter/Space selection.
- Submitted Wordle feedback and game events are announced to assistive technology.
- Statistics dialogs trap focus, close with Escape, and return focus to their trigger.
- The status palette meets contrast requirements without relying on colour alone.
- Browser zoom is permitted.
- The service worker precaches the application and Boggle dictionary for offline solo play.
- An available update is activated only after the player accepts the reload prompt.
- Runtime fonts use the local system stack; the app does not request third-party font resources.

## Technology

| Technology | Purpose |
| --- | --- |
| React 19 | User interface |
| TypeScript | Static type safety |
| Vite | Development server and production build |
| React Router | Hash-based GitHub Pages routing |
| Zustand | Game, multiplayer, statistics, timer, and UI state |
| PeerJS | WebRTC connection setup |
| Zod | Runtime protocol and persistence validation |
| Vitest + Testing Library | Unit, component, and integration tests |
| Playwright | Chromium end-to-end regressions |

## Development

Node.js 20 or newer is required.

```bash
npm ci
npm run dev
```

The Vite base path is `/gamehub/`; local routes use hashes such as `/gamehub/#/wordle` and `/gamehub/#/boggle`.

### Verification

```bash
npm run lint
npm run typecheck
npm test
npx playwright install chromium  # first browser-test run only
npm run test:e2e
npm run build
```

The browser suite builds and serves the optimized production artifact before
running, including an offline PWA regression. The standalone build command is
listed as an explicit final packaging check.

Extended browser gates are also available:

```bash
npm run test:e2e:cross-browser  # Firefox, WebKit, and mobile profiles
npm run test:e2e:pwa            # persistent-profile upgrade and offline checks
npm run test:e2e:visual         # committed screenshot comparisons
npm run test:e2e:all            # complete nightly matrix
```

The E2E stack uses a local PeerServer, so multiplayer tests never depend on the
public signalling service. The scheduled nightly workflow runs the full matrix;
pull requests run the faster Chromium suite, including two-client multiplayer
and automated accessibility checks.

Pull requests and deployments run the same lint, type, unit/integration, browser, and build checks in GitHub Actions. Dependabot checks npm and GitHub Actions dependencies weekly.

## Project structure

```text
src/
├── components/             shared lobby, layout, modal, and status UI
├── data/                   Wordle solution and accepted-guess data
├── features/dashboard/     game selection screen
├── games/
│   ├── wordle/             live Wordle UI and scoring logic
│   └── boggle/             live Boggle UI, solver, dictionary, and store
├── hooks/                  session, keyboard, cleanup, and reconnect orchestration
├── integration/            cross-store game and P2P tests
├── stores/                 Zustand state and PeerJS connection management
├── router.tsx              lazy game routes
└── registerServiceWorker.ts
e2e/                        Playwright browser flows
public/
├── data/                   Boggle dictionary and provenance notice
├── icons/                  PWA icons
├── manifest.json
└── sw.js
```

Game routes are lazy-loaded. PeerJS is isolated in its own chunk, and Wordle's accepted-guess data stays out of the dashboard and Boggle paths.

## Data sources

- Wordle's broad accepted-guess set is derived from Tab Atkins Jr.'s MIT-licensed [`wordle-list`](https://github.com/tabatkins/wordle-list), pinned in [`src/data/allowedGuesses.ts`](src/data/allowedGuesses.ts).
- Boggle's dictionary is derived from the public-domain ENABLE list. The pinned source revision and transformation are recorded in [`public/data/ENABLE-NOTICE.txt`](public/data/ENABLE-NOTICE.txt).

## Deployment

Merges to `main` deploy the built `dist` directory to GitHub Pages through `.github/workflows/deploy.yml` after every verification check passes.

## License

MIT
