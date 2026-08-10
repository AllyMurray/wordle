import { lazy, Suspense } from 'react';
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import { Dashboard } from './features/dashboard/Dashboard';

/**
 * Lazy load game modules - they won't be downloaded until user navigates to them.
 * This keeps the initial bundle small (just dashboard + shared code).
 */
const WordleGame = lazy(() => import('./games/wordle/WordleGame'));
const BoggleGame = lazy(() => import('./games/boggle/BoggleGame'));

/**
 * Loading fallback shown while game chunk is downloading.
 */
function GameLoadingFallback() {
  return (
    <div className="game-loading" role="status" aria-label="Loading game">
      <div className="loading-spinner" aria-hidden="true" />
    </div>
  );
}

function RouteErrorFallback() {
  return (
    <main className="error-boundary" role="alert">
      <div className="error-content">
        <h1>Unable to load this game</h1>
        <p className="error-message">
          The game could not be opened. Check your connection or try reloading.
        </p>
        <div className="error-actions">
          <button className="error-btn primary" onClick={() => window.location.reload()}>
            Reload Page
          </button>
          <button
            className="error-btn secondary"
            onClick={() => window.location.assign(`${import.meta.env.BASE_URL}#/`)}
          >
            Back to Game Hub
          </button>
        </div>
      </div>
    </main>
  );
}

/**
 * Using Hash Router for GitHub Pages compatibility.
 * URLs will be: /#/, /#/wordle, /#/boggle
 */
const router = createHashRouter([
  {
    path: '/',
    element: <Dashboard />,
    errorElement: <RouteErrorFallback />,
  },
  {
    path: '/wordle',
    element: (
      <Suspense fallback={<GameLoadingFallback />}>
        <WordleGame />
      </Suspense>
    ),
    errorElement: <RouteErrorFallback />,
  },
  {
    path: '/boggle',
    element: (
      <Suspense fallback={<GameLoadingFallback />}>
        <BoggleGame />
      </Suspense>
    ),
    errorElement: <RouteErrorFallback />,
  },
  {
    // Catch-all redirect to dashboard
    path: '*',
    element: <Navigate to="/" replace />,
    errorElement: <RouteErrorFallback />,
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
