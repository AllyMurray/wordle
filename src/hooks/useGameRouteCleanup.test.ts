import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGameRouteCleanup } from './useGameRouteCleanup';

describe('useGameRouteCleanup', () => {
  it('runs cleanup on route unmount', () => {
    const cleanup = vi.fn();
    const { unmount } = renderHook(() => useGameRouteCleanup(cleanup));

    expect(cleanup).not.toHaveBeenCalled();

    unmount();
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
