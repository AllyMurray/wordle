import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWindowKeyDown } from './useWindowKeyDown';

describe('useWindowKeyDown', () => {
  it('does not listen while keyboard input is disabled', () => {
    const handler = vi.fn();
    const addSpy = vi.spyOn(window, 'addEventListener');

    renderHook(() => useWindowKeyDown(false, handler));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'A' }));

    expect(handler).not.toHaveBeenCalled();
    expect(addSpy).not.toHaveBeenCalledWith('keydown', handler);
  });

  it('removes the listener when input becomes disabled', () => {
    const handler = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }) => useWindowKeyDown(enabled, handler),
      { initialProps: { enabled: true } }
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'A' }));
    rerender({ enabled: false });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'B' }));

    expect(handler).toHaveBeenCalledOnce();
  });
});
