import { useEffect, useState } from 'react';
import {
  SERVICE_WORKER_UPDATE_EVENT,
  type ServiceWorkerUpdateDetail,
} from '../registerServiceWorker';
import './UpdatePrompt.css';

export function UpdatePrompt() {
  const [activateUpdate, setActivateUpdate] = useState<(() => void) | null>(null);

  useEffect(() => {
    const handleUpdate = (event: Event): void => {
      const detail = (event as CustomEvent<ServiceWorkerUpdateDetail>).detail;
      setActivateUpdate(() => detail.activate);
    };

    window.addEventListener(SERVICE_WORKER_UPDATE_EVENT, handleUpdate);
    return () => window.removeEventListener(SERVICE_WORKER_UPDATE_EVENT, handleUpdate);
  }, []);

  if (!activateUpdate) return null;

  return (
    <div className="update-prompt" role="status">
      <span>A new version is ready.</span>
      <button type="button" onClick={activateUpdate}>
        Reload
      </button>
      <button
        type="button"
        className="update-prompt__dismiss"
        onClick={() => setActivateUpdate(null)}
        aria-label="Dismiss update"
      >
        &times;
      </button>
    </div>
  );
}
