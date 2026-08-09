/**
 * Service worker registration for PWA functionality.
 * Enables offline solo play and app installability.
 */

const BASE_PATH = import.meta.env.BASE_URL;
export const SERVICE_WORKER_UPDATE_EVENT = 'gamehub:update-available';

export interface ServiceWorkerUpdateDetail {
  activate: () => void;
}

const announceUpdate = (registration: ServiceWorkerRegistration): void => {
  window.dispatchEvent(
    new CustomEvent<ServiceWorkerUpdateDetail>(SERVICE_WORKER_UPDATE_EVENT, {
      detail: {
        activate: () => registration.waiting?.postMessage('skipWaiting'),
      },
    })
  );
};

export function registerServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      let reloadRequested = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloadRequested) return;
        reloadRequested = true;
        window.location.reload();
      });

      navigator.serviceWorker
        .register(`${BASE_PATH}sw.js`, { scope: BASE_PATH })
        .then((registration) => {
          if (registration.waiting && navigator.serviceWorker.controller) {
            announceUpdate(registration);
          }

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (
                  newWorker.state === 'installed' &&
                  navigator.serviceWorker.controller
                ) {
                  announceUpdate(registration);
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('Service worker registration failed:', error);
        });
    });
  }
}
