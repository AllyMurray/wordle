import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataConnection } from 'peerjs';
import { NETWORK_CONFIG } from '../types';
import {
  createInternalState,
  handleHeartbeat,
  startHeartbeat,
  stopHeartbeat,
} from './peerConnection';

describe('peer connection heartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses one unanswered-ping deadline and times out only once', () => {
    const internal = createInternalState();
    const onTimeout = vi.fn();
    const connection = {
      open: true,
      send: vi.fn(),
    } as unknown as DataConnection;

    startHeartbeat(internal, connection, onTimeout);
    vi.advanceTimersByTime(NETWORK_CONFIG.HEARTBEAT_INTERVAL_MS);

    const firstDeadline = internal.heartbeatTimeout;
    vi.advanceTimersByTime(NETWORK_CONFIG.HEARTBEAT_INTERVAL_MS * 2);

    expect(internal.heartbeatTimeout).toBe(firstDeadline);

    vi.advanceTimersByTime(NETWORK_CONFIG.HEARTBEAT_TIMEOUT_MS);
    vi.advanceTimersByTime(NETWORK_CONFIG.HEARTBEAT_TIMEOUT_MS * 2);

    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(internal.heartbeatInterval).toBeNull();
  });

  it('clears the unanswered-ping deadline when a heartbeat arrives', () => {
    const internal = createInternalState();
    const onTimeout = vi.fn();
    const connection = {
      open: true,
      send: vi.fn(),
    } as unknown as DataConnection;

    startHeartbeat(internal, connection, onTimeout);
    vi.advanceTimersByTime(NETWORK_CONFIG.HEARTBEAT_INTERVAL_MS);
    handleHeartbeat(internal);
    vi.advanceTimersByTime(NETWORK_CONFIG.HEARTBEAT_INTERVAL_MS - 1);

    expect(onTimeout).not.toHaveBeenCalled();
    stopHeartbeat(internal);
  });
});
