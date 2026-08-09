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

  it.each([
    ['button', '<button type="button">Action</button>'],
    ['link', '<a href="/other">Other page</a>'],
    ['input', '<input />'],
    ['editable content', '<div contenteditable="true"></div>'],
  ])('ignores keys originating from a focused %s', (_label, markup) => {
    const handler = vi.fn();
    const container = document.createElement('div');
    container.innerHTML = markup;
    const control = container.firstElementChild as HTMLElement;
    document.body.append(control);

    renderHook(() => useWindowKeyDown(true, handler));
    control.focus();
    control.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(handler).not.toHaveBeenCalled();
    control.remove();
  });

  it('continues to handle keys from the game page', () => {
    const handler = vi.fn();
    renderHook(() => useWindowKeyDown(true, handler));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'A' }));

    expect(handler).toHaveBeenCalledOnce();
  });
});
