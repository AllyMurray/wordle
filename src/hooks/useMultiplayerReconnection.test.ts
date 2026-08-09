import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useMultiplayerReconnection } from './useMultiplayerReconnection';
import { useMultiplayerStore } from '../stores/multiplayerStore';

describe('useMultiplayerReconnection', () => {
  const mockRestoreHostConnection = vi.fn();
  const mockRestoreViewerConnection = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to initial state
    useMultiplayerStore.setState({
      role: null,
      restoreHostConnection: mockRestoreHostConnection,
      restoreViewerConnection: mockRestoreViewerConnection,
    });
  });

  afterEach(() => {
    // Clean up any listeners
    vi.restoreAllMocks();
  });

  describe('when role is null', () => {
    it('should not add event listeners', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const windowAddEventListenerSpy = vi.spyOn(window, 'addEventListener');

      renderHook(() => useMultiplayerReconnection());

      // Should not add visibilitychange listener
      expect(addEventListenerSpy).not.toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      );
      // Should not add pageshow listener
      expect(windowAddEventListenerSpy).not.toHaveBeenCalledWith(
        'pageshow',
        expect.any(Function)
      );
    });
  });

  describe('when role is host', () => {
    beforeEach(() => {
      useMultiplayerStore.setState({ role: 'host' });
    });

    it('should add event listeners', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const windowAddEventListenerSpy = vi.spyOn(window, 'addEventListener');

      renderHook(() => useMultiplayerReconnection());

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      );
      expect(windowAddEventListenerSpy).toHaveBeenCalledWith(
        'pageshow',
        expect.any(Function)
      );
    });

    it('should call restoreHostConnection on visibility change to visible', () => {
      renderHook(() => useMultiplayerReconnection());

      // Simulate visibility change to visible
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
      });

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(mockRestoreHostConnection).toHaveBeenCalledTimes(1);
      expect(mockRestoreViewerConnection).not.toHaveBeenCalled();
    });

    it('should not call restore on visibility change to hidden', () => {
      renderHook(() => useMultiplayerReconnection());

      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      });

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(mockRestoreHostConnection).not.toHaveBeenCalled();
    });

    it('should call restoreHostConnection on pageshow with persisted=true', () => {
      renderHook(() => useMultiplayerReconnection());

      act(() => {
        const event = new PageTransitionEvent('pageshow', { persisted: true });
        window.dispatchEvent(event);
      });

      expect(mockRestoreHostConnection).toHaveBeenCalledTimes(1);
    });

    it('should not call restore on pageshow with persisted=false', () => {
      renderHook(() => useMultiplayerReconnection());

      act(() => {
        const event = new PageTransitionEvent('pageshow', { persisted: false });
        window.dispatchEvent(event);
      });

      expect(mockRestoreHostConnection).not.toHaveBeenCalled();
    });

    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      const windowRemoveEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useMultiplayerReconnection());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      );
      expect(windowRemoveEventListenerSpy).toHaveBeenCalledWith(
        'pageshow',
        expect.any(Function)
      );
    });
  });

  describe('when role is viewer', () => {
    beforeEach(() => {
      useMultiplayerStore.setState({ role: 'viewer' });
    });

    it('should call restoreViewerConnection on visibility change to visible', () => {
      renderHook(() => useMultiplayerReconnection());

      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
      });

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(mockRestoreViewerConnection).toHaveBeenCalledTimes(1);
      expect(mockRestoreHostConnection).not.toHaveBeenCalled();
    });

    it('should call restoreViewerConnection on pageshow with persisted=true', () => {
      renderHook(() => useMultiplayerReconnection());

      act(() => {
        const event = new PageTransitionEvent('pageshow', { persisted: true });
        window.dispatchEvent(event);
      });

      expect(mockRestoreViewerConnection).toHaveBeenCalledTimes(1);
      expect(mockRestoreHostConnection).not.toHaveBeenCalled();
    });
  });

  describe('role changes', () => {
    it('should update listeners when role changes from null to host', () => {
      const { rerender } = renderHook(() => useMultiplayerReconnection());

      // Initially no role
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
      });

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(mockRestoreHostConnection).not.toHaveBeenCalled();

      // Change to host
      act(() => {
        useMultiplayerStore.setState({ role: 'host' });
      });

      rerender();

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(mockRestoreHostConnection).toHaveBeenCalledTimes(1);
    });
  });
});
