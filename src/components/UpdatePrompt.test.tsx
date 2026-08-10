import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UpdatePrompt } from './UpdatePrompt';
import { SERVICE_WORKER_UPDATE_EVENT } from '../registerServiceWorker';

describe('UpdatePrompt', () => {
  it('lets the user activate a waiting service worker', () => {
    const activate = vi.fn();
    render(<UpdatePrompt />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(SERVICE_WORKER_UPDATE_EVENT, { detail: { activate } })
      );
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

    expect(activate).toHaveBeenCalledOnce();
  });

  it('can be dismissed without activating the update', () => {
    const activate = vi.fn();
    render(<UpdatePrompt />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent(SERVICE_WORKER_UPDATE_EVENT, { detail: { activate } })
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss update' }));

    expect(screen.queryByText('A new version is ready.')).not.toBeInTheDocument();
    expect(activate).not.toHaveBeenCalled();
  });
});
