import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataConnection } from 'peerjs';
import { NETWORK_CONFIG } from '../types';
import {
  acknowledgeIncomingMessage,
  createInternalState,
  clearConnectionDeadline,
  getPeerOptions,
  handleAck,
  handleHeartbeat,
  sendWithAck,
  startConnectionDeadline,
  startHeartbeat,
  stopHeartbeat,
} from './peerConnection';

describe('PeerJS runtime configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses PeerJS Cloud defaults when no custom host is configured', () => {
    vi.stubEnv('VITE_PEER_HOST', '');

    expect(getPeerOptions()).toEqual({ debug: 0 });
  });

  it('configures a local signalling server from Vite environment values', () => {
    vi.stubEnv('VITE_PEER_HOST', '127.0.0.1');
    vi.stubEnv('VITE_PEER_PORT', '9000');
    vi.stubEnv('VITE_PEER_PATH', '/peerjs');
    vi.stubEnv('VITE_PEER_SECURE', 'false');

    expect(getPeerOptions()).toEqual({
      debug: 0,
      host: '127.0.0.1',
      port: 9000,
      path: '/peerjs',
      secure: false,
    });
  });
});

describe('connection setup deadline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fails stalled setup once and can be cancelled after connecting', () => {
    const internal = createInternalState();
    const onTimeout = vi.fn();

    startConnectionDeadline(internal, onTimeout);
    vi.advanceTimersByTime(NETWORK_CONFIG.CONNECTION_SETUP_TIMEOUT_MS);
    vi.advanceTimersByTime(NETWORK_CONFIG.CONNECTION_SETUP_TIMEOUT_MS);
    expect(onTimeout).toHaveBeenCalledOnce();

    startConnectionDeadline(internal, onTimeout);
    clearConnectionDeadline(internal);
    vi.advanceTimersByTime(NETWORK_CONFIG.CONNECTION_SETUP_TIMEOUT_MS);
    expect(onTimeout).toHaveBeenCalledOnce();
  });
});

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

describe('acknowledged messages', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('removes a pending message when the connection closes before retry', () => {
    const internal = createInternalState();
    const onAckTimeout = vi.fn();
    const connection = {
      open: true,
      send: vi.fn(),
    } as unknown as DataConnection;

    sendWithAck(
      internal,
      connection,
      { type: 'suggestion-accepted' },
      true,
      onAckTimeout
    );
    (connection as unknown as { open: boolean }).open = false;
    vi.runAllTimers();

    expect(internal.pendingMessages.size).toBe(0);
    expect(onAckTimeout).toHaveBeenCalledTimes(1);
  });

  it('retries dropped messages a bounded number of times', () => {
    const internal = createInternalState();
    const onAckTimeout = vi.fn();
    const connection = {
      open: true,
      send: vi.fn(),
    } as unknown as DataConnection;

    sendWithAck(internal, connection, { type: 'suggestion-rejected' }, true, onAckTimeout);
    vi.advanceTimersByTime(
      NETWORK_CONFIG.ACK_TIMEOUT_MS * (NETWORK_CONFIG.MAX_RETRY_ATTEMPTS + 1)
    );

    expect(connection.send).toHaveBeenCalledTimes(NETWORK_CONFIG.MAX_RETRY_ATTEMPTS + 1);
    expect(internal.pendingMessages.size).toBe(0);
    expect(onAckTimeout).toHaveBeenCalledOnce();
  });

  it('stops retrying as soon as a delayed acknowledgment arrives', () => {
    const internal = createInternalState();
    const connection = {
      open: true,
      send: vi.fn(),
    } as unknown as DataConnection;

    const messageId = sendWithAck(
      internal,
      connection,
      { type: 'suggestion-accepted' },
      true
    );
    vi.advanceTimersByTime(NETWORK_CONFIG.ACK_TIMEOUT_MS * 2);
    handleAck(internal, messageId!);
    vi.runAllTimers();

    expect(connection.send).toHaveBeenCalledTimes(3);
    expect(internal.pendingMessages.size).toBe(0);
  });

  it('acknowledges duplicate deliveries but applies their side effects once', () => {
    const internal = createInternalState();
    const connection = {
      open: true,
      send: vi.fn(),
    } as unknown as DataConnection;

    expect(acknowledgeIncomingMessage(internal, connection, 'duplicate-id')).toBe(true);
    expect(acknowledgeIncomingMessage(internal, connection, 'duplicate-id')).toBe(false);
    expect(connection.send).toHaveBeenCalledTimes(2);
  });
});
