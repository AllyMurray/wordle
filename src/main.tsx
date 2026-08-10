import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppRouter } from './router'
import ErrorBoundary from './components/ErrorBoundary'
import { registerServiceWorker } from './registerServiceWorker'
import { UpdatePrompt } from './components/UpdatePrompt'

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <AppRouter />
      <UpdatePrompt />
    </ErrorBoundary>
  </StrictMode>,
)

// Register service worker for offline functionality
registerServiceWorker()
