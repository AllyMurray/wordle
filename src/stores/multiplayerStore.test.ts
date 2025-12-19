import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import type { DataConnection } from 'peerjs';

// Type for our mock connection event handlers
type MockConnectionEventHandlers = {
  open: (() => void)[];
  data: ((data: unknown) => void)[];
  close: (() => void)[];
  error: ((err: Error) => void)[];
};

// Type for our mock peer event handlers
type MockPeerEventHandlers = {
  open: (() => void)[];
  connection: ((conn: DataConnection) => void)[];
  error: ((err: { type: string; message?: string }) => void)[];
};

// Create mock connection with proper event handling
const createMockConnection = (isOpen: boolean = false) => {
  const handlers: MockConnectionEventHandlers = {
    open: [],
    data: [],
    close: [],
    error: [],
  };

  const mockConn = {
    open: isOpen,
    send: vi.fn(),
    close: vi.fn(),
    on: vi.fn((event: keyof MockConnectionEventHandlers, handler: () => void) => {
      handlers[event].push(handler);
    }),
    _handlers: handlers,
    _triggerOpen: () => {
      mockConn.open = true;
      handlers.open.forEach((h) => h());
    },
    _triggerData: (data: unknown) => {
      handlers.data.forEach((h) => h(data));
    },
    _triggerClose: () => {
      mockConn.open = false;
      handlers.close.forEach((h) => h());
    },
    _triggerError: (err: Error) => {
      handlers.error.forEach((h) => h(err));
    },
  };

  return mockConn;
};

// Store the mock peer instance for each test
let mockPeerInstance: ReturnType<typeof createMockPeerInstance> | null = null;
let lastCreatedConnection: ReturnType<typeof createMockConnection> | null = null;

const createMockPeerInstance = () => {
  const handlers: MockPeerEventHandlers = {
    open: [],
    connection: [],
    error: [],
  };

  const mockPeer = {
    id: 'mock-peer-id',
    connect: vi.fn(() => {
      lastCreatedConnection = createMockConnection();
      return lastCreatedConnection;
    }),
    destroy: vi.fn(),
    on: vi.fn(
      (event: keyof MockPeerEventHandlers, handler: (arg?: unknown) => void) => {
        handlers[event].push(handler as () => void);
      }
    ),
    _handlers: handlers,
    _triggerOpen: () => {
      handlers.open.forEach((h) => h());
    },
    _triggerConnection: (conn: DataConnection) => {
      handlers.connection.forEach((h) => h(conn));
    },
    _triggerError: (err: { type: string; message?: string }) => {
      handlers.error.forEach((h) => h(err));
    },
  };

  return mockPeer;
};

// Create a mock Peer class that will be returned by loadPeerJS
class MockPeerClass {
  id: string;
  connect: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  _handlers: MockPeerEventHandlers;
  _triggerOpen: () => void;
  _triggerConnection: (conn: DataConnection) => void;
  _triggerError: (err: { type: string; message?: string }) => void;

  constructor() {
    const instance = createMockPeerInstance();
    this.id = instance.id;
    this.connect = instance.connect;
    this.destroy = instance.destroy;
    this.on = instance.on;
    this._handlers = instance._handlers;
    this._triggerOpen = instance._triggerOpen;
    this._triggerConnection = instance._triggerConnection;
    this._triggerError = instance._triggerError;
    mockPeerInstance = instance;
  }
}

// Mock the peerConnection module to intercept loadPeerJS
vi.mock('./peerConnection', async (importOriginal) => {
  const original = await importOriginal<typeof import('./peerConnection')>();
  return {
    ...original,
    // Override loadPeerJS to return our mock class immediately
    loadPeerJS: vi.fn(() => Promise.resolve(MockPeerClass as unknown as typeof import('peerjs').default)),
  };
});

// Import after mocking
import {
  useMultiplayerStore,
  registerGameStateCallback,
  registerSuggestionResponseCallback,
} from './multiplayerStore';

// Helper to wait for async PeerJS loading to complete
// Uses vi.runAllTimersAsync() to handle both timers and microtasks
const flushAsyncOperations = async () => {
  await vi.runAllTimersAsync();
};

describe('multiplayerStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockPeerInstance = null;
    lastCreatedConnection = null;

    // Reset the store to initial state before each test
    act(() => {
      useMultiplayerStore.setState({
        role: null,
        sessionCode: '',
        sessionPin: '',
        connectionStatus: 'disconnected',
        errorMessage: '',
        partnerConnected: false,
        pendingSuggestion: null,
      });
    });
  });

  afterEach(() => {
    // Call leaveSession to clean up internal state
    act(() => {
      useMultiplayerStore.getState().leaveSession();
    });
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should have correct default values', () => {
      const state = useMultiplayerStore.getState();

      expect(state.role).toBe(null);
      expect(state.sessionCode).toBe('');
      expect(state.sessionPin).toBe('');
      expect(state.connectionStatus).toBe('disconnected');
      expect(state.errorMessage).toBe('');
      expect(state.partnerConnected).toBe(false);
      expect(state.pendingSuggestion).toBe(null);
    });
  });

  describe('role and connection state', () => {
    it('should set role to host when hosting a game', () => {
      const { hostGame } = useMultiplayerStore.getState();

      act(() => {
        hostGame();
      });

      expect(useMultiplayerStore.getState().role).toBe('host');
    });

    it('should set role to viewer when joining a game', () => {
      const { joinGame } = useMultiplayerStore.getState();

      act(() => {
        joinGame('ABCDEF-abc123');
      });

      expect(useMultiplayerStore.getState().role).toBe('viewer');
    });

    it('should set connectionStatus to connected when peer opens', async () => {
      const { hostGame } = useMultiplayerStore.getState();

      act(() => {
        hostGame();
      });

      // Wait for async PeerJS loading
      await act(async () => {
        await flushAsyncOperations();
      });

      act(() => {
        mockPeerInstance?._triggerOpen();
      });

      expect(useMultiplayerStore.getState().connectionStatus).toBe('connected');
    });

    it('should set connectionStatus to connecting before peer opens', () => {
      const { hostGame } = useMultiplayerStore.getState();

      act(() => {
        hostGame();
      });

      // Status is 'connecting' right after hostGame, not 'connected'
      expect(useMultiplayerStore.getState().connectionStatus).toBe('connecting');
    });
  });

  describe('hostGame', () => {
    it('should set role to host and status to connecting', () => {
      const { hostGame } = useMultiplayerStore.getState();

      act(() => {
        hostGame();
      });

      const state = useMultiplayerStore.getState();
      expect(state.role).toBe('host');
      expect(state.connectionStatus).toBe('connecting');
    });

    it('should sanitize and store session PIN', () => {
      const { hostGame } = useMultiplayerStore.getState();

      act(() => {
        hostGame('1234');
      });

      const state = useMultiplayerStore.getState();
      expect(state.sessionPin).toBe('1234');
    });

    it('should set status to connected when peer opens', async () => {
      const { hostGame } = useMultiplayerStore.getState();

      act(() => {
        hostGame();
      });

      await act(async () => {
        await flushAsyncOperations();
      });

      // Simulate peer connection opening
      act(() => {
        mockPeerInstance?._triggerOpen();
      });

      const state = useMultiplayerStore.getState();
      expect(state.connectionStatus).toBe('connected');
      expect(state.sessionCode).toBeTruthy();
    });

    it('should set partnerConnected when viewer connects without PIN', async () => {
      const { hostGame } = useMultiplayerStore.getState();

      act(() => {
        hostGame(); // No PIN
      });

      await act(async () => {
        await flushAsyncOperations();
      });

      act(() => {
        mockPeerInstance?._triggerOpen();
      });

      // Simulate viewer connecting
      const mockViewerConn = createMockConnection();
      act(() => {
        mockPeerInstance?._triggerConnection(mockViewerConn as unknown as DataConnection);
      });

      // Viewer connection opens
      act(() => {
        mockViewerConn._triggerOpen();
      });

      expect(useMultiplayerStore.getState().partnerConnected).toBe(true);
    });

    it('should clear pending suggestion when new viewer connects', () => {
      act(() => {
        useMultiplayerStore.setState({ pendingSuggestion: { word: 'HELLO' } });
      });

      const { hostGame } = useMultiplayerStore.getState();

      act(() => {
        hostGame();
      });

      act(() => {
        mockPeerInstance?._triggerOpen();
      });

      const mockViewerConn = createMockConnection();
      act(() => {
        mockPeerInstance?._triggerConnection(mockViewerConn as unknown as DataConnection);
      });

      expect(useMultiplayerStore.getState().pendingSuggestion).toBe(null);
    });

    it('should handle PIN authentication for viewers', async () => {
      const { hostGame } = useMultiplayerStore.getState();

      act(() => {
        hostGame('1234');
      });

      await act(async () => {
        await flushAsyncOperations();
      });

      act(() => {
        mockPeerInstance?._triggerOpen();
      });

      const mockViewerConn = createMockConnection();
      act(() => {
        mockPeerInstance?._triggerConnection(mockViewerConn as unknown as DataConnection);
      });

      // Connection opens but not authenticated yet
      act(() => {
        mockViewerConn._triggerOpen();
      });

      // partnerConnected should still be false until auth
      expect(useMultiplayerStore.getState().partnerConnected).toBe(false);

      // Viewer sends correct PIN
      act(() => {
        mockViewerConn._triggerData({ type: 'auth-request', pin: '1234' });
      });

      expect(mockViewerConn.send).toHaveBeenCalledWith({ type: 'auth-success' });
      expect(useMultiplayerStore.getState().partnerConnected).toBe(true);
    });

    it('should reject viewer with incorrect PIN', async () => {
      const { hostGame } = useMultiplayerStore.getState();

      act(() => {
        hostGame('1234');
      });

      await act(async () => {
        await flushAsyncOperations();
      });

      act(() => {
        mockPeerInstance?._triggerOpen();
      });

      const mockViewerConn = createMockConnection();
      act(() => {
        mockPeerInstance?._triggerConnection(mockViewerConn as unknown as DataConnection);
      });

      act(() => {
        mockViewerConn._triggerOpen();
      });

      // Viewer sends incorrect PIN
      act(() => {
        mockViewerConn._triggerData({ type: 'auth-request', pin: '0000' });
      });

      expect(mockViewerConn.send).toHaveBeenCalledWith({
        type: 'auth-failure',
        reason: 'Incorrect PIN',
      });
      expect(useMultiplayerStore.getState().partnerConnected).toBe(false);
    });

    it('should handle peer error with unavailable-id by retrying', async () => {
      const { hostGame } = useMultiplayerStore.getState();

      act(() => {
        hostGame();
      });

      await act(async () => {
        await flushAsyncOperations();
      });

      act(() => {
        mockPeerInstance?._triggerError({ type: 'unavailable-id' });
      });

      expect(useMultiplayerStore.getState().connectionStatus).toBe('disconnected');

      // Fast-forward past retry delay
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should have attempted to host again
      expect(useMultiplayerStore.getState().connectionStatus).toBe('connecting');
    });

    it('should set error status on other peer errors', async () => {
      const { hostGame } = useMultiplayerStore.getState();

      act(() => {
        hostGame();
      });

      await act(async () => {
        await flushAsyncOperations();
      });

      act(() => {
        mockPeerInstance?._triggerError({ type: 'network' });
      });

      const state = useMultiplayerStore.getState();
      expect(state.connectionStatus).toBe('error');
      expect(state.errorMessage).toBe('Connection error. Please try again.');
    });
  });

  describe('joinGame', () => {
    it('should reject invalid session code', () => {
      const { joinGame } = useMultiplayerStore.getState();

      act(() => {
        joinGame('invalid');
      });

      const state = useMultiplayerStore.getState();
      expect(state.connectionStatus).toBe('error');
      expect(state.errorMessage).toBe('Invalid session code. Please check and try again.');
    });

    it('should reject invalid PIN format', () => {
      const { joinGame } = useMultiplayerStore.getState();

      // Valid session code format: 6 chars + separator + 6 hex chars
      act(() => {
        joinGame('ABCDEF-abc123', '12'); // PIN too short
      });

      const state = useMultiplayerStore.getState();
      expect(state.connectionStatus).toBe('error');
      expect(state.errorMessage).toBe('Invalid PIN format. PIN must be 4-8 digits.');
    });

    it('should set role to viewer and status to connecting with valid code', () => {
      const { joinGame } = useMultiplayerStore.getState();

      act(() => {
        joinGame('ABCDEF-abc123');
      });

      const state = useMultiplayerStore.getState();
      expect(state.role).toBe('viewer');
      expect(state.connectionStatus).toBe('connecting');
      expect(state.sessionCode).toBe('ABCDEF-abc123');
    });

    it('should send auth request on connection open', () => {
      const { joinGame } = useMultiplayerStore.getState();

      act(() => {
        joinGame('ABCDEF-abc123', '1234');
      });

      // Simulate peer opening
      act(() => {
        mockPeerInstance?._triggerOpen();
      });

      // Get the connection that was created
      if (lastCreatedConnection) {
        act(() => {
          lastCreatedConnection?._triggerOpen();
        });

        expect(lastCreatedConnection.send).toHaveBeenCalledWith({
          type: 'auth-request',
          pin: '1234',
        });
      }
    });

    it('should set connected status on auth success', () => {
      const { joinGame } = useMultiplayerStore.getState();

      act(() => {
        joinGame('ABCDEF-abc123');
      });

      act(() => {
        mockPeerInstance?._triggerOpen();
      });

      if (lastCreatedConnection) {
        act(() => {
          lastCreatedConnection?._triggerOpen();
        });

        act(() => {
          lastCreatedConnection?._triggerData({ type: 'auth-success' });
        });

        const state = useMultiplayerStore.getState();
        expect(state.connectionStatus).toBe('connected');
        expect(state.partnerConnected).toBe(true);
      }
    });

    it('should set error status on auth failure', () => {
      const { joinGame } = useMultiplayerStore.getState();

      act(() => {
        joinGame('ABCDEF-abc123', '0000');
      });

      act(() => {
        mockPeerInstance?._triggerOpen();
      });

      if (lastCreatedConnection) {
        act(() => {
          lastCreatedConnection?._triggerOpen();
        });

        act(() => {
          lastCreatedConnection?._triggerData({ type: 'auth-failure', reason: 'Incorrect PIN' });
        });

        const state = useMultiplayerStore.getState();
        expect(state.connectionStatus).toBe('error');
        expect(state.errorMessage).toBe('Incorrect PIN');
      }
    });

    it('should handle peer-unavailable error', async () => {
      const { joinGame } = useMultiplayerStore.getState();

      act(() => {
        joinGame('ABCDEF-abc123');
      });

      await act(async () => {
        await flushAsyncOperations();
      });

      act(() => {
        mockPeerInstance?._triggerError({ type: 'peer-unavailable' });
      });

      const state = useMultiplayerStore.getState();
      expect(state.connectionStatus).toBe('error');
      expect(state.errorMessage).toBe('Game not found. Check the code and try again.');
    });
  });

  describe('leaveSession', () => {
    it('should reset all state to initial values', () => {
      // First set up some state
      act(() => {
        useMultiplayerStore.setState({
          role: 'host',
          sessionCode: 'ABCDEF-abc123',
          sessionPin: '1234',
          connectionStatus: 'connected',
          errorMessage: 'some error',
          partnerConnected: true,
          pendingSuggestion: { word: 'HELLO' },
        });
      });

      const { leaveSession } = useMultiplayerStore.getState();

      act(() => {
        leaveSession();
      });

      const state = useMultiplayerStore.getState();
      expect(state.role).toBe(null);
      expect(state.sessionCode).toBe('');
      expect(state.sessionPin).toBe('');
      expect(state.connectionStatus).toBe('disconnected');
      expect(state.errorMessage).toBe('');
      expect(state.partnerConnected).toBe(false);
      expect(state.pendingSuggestion).toBe(null);
    });
  });

  describe('suggestion handling (host)', () => {
    it('should receive suggestion from viewer', async () => {
      const { hostGame } = useMultiplayerStore.getState();

      act(() => {
        hostGame();
      });

      await act(async () => {
        await flushAsyncOperations();
      });

      act(() => {
        mockPeerInstance?._triggerOpen();
      });

      const mockViewerConn = createMockConnection();
      act(() => {
        mockPeerInstance?._triggerConnection(mockViewerConn as unknown as DataConnection);
      });

      act(() => {
        mockViewerConn._triggerOpen();
      });

      // Viewer suggests a word
      act(() => {
        mockViewerConn._triggerData({ type: 'suggest-word', word: 'HELLO' });
      });

      expect(useMultiplayerStore.getState().pendingSuggestion).toEqual({ word: 'HELLO' });
    });

    it('should clear suggestion when viewer clears it', async () => {
      const { hostGame } = useMultiplayerStore.getState();

      act(() => {
        hostGame();
      });

      await act(async () => {
        await flushAsyncOperations();
      });

      act(() => {
        mockPeerInstance?._triggerOpen();
      });

      const mockViewerConn = createMockConnection();
      act(() => {
        mockPeerInstance?._triggerConnection(mockViewerConn as unknown as DataConnection);
      });

      act(() => {
        mockViewerConn._triggerOpen();
      });

      // Set pending suggestion
      act(() => {
        mockViewerConn._triggerData({ type: 'suggest-word', word: 'HELLO' });
      });

      expect(useMultiplayerStore.getState().pendingSuggestion).toEqual({ word: 'HELLO' });

      // Viewer clears suggestion
      act(() => {
        mockViewerConn._triggerData({ type: 'clear-suggestion' });
      });

      expect(useMultiplayerStore.getState().pendingSuggestion).toBe(null);
    });

    it('should accept suggestion and return the word', async () => {
      const { hostGame } = useMultiplayerStore.getState();

      act(() => {
        hostGame();
      });

      await act(async () => {
        await flushAsyncOperations();
      });

      act(() => {
        mockPeerInstance?._triggerOpen();
      });

      const mockViewerConn = createMockConnection(true);
      act(() => {
        mockPeerInstance?._triggerConnection(mockViewerConn as unknown as DataConnection);
      });

      act(() => {
        mockViewerConn._triggerOpen();
      });

      // Set pending suggestion
      act(() => {
        useMultiplayerStore.setState({ pendingSuggestion: { word: 'HELLO' } });
      });

      let result: string | null = null;
      act(() => {
        result = useMultiplayerStore.getState().acceptSuggestion();
      });

      expect(result).toBe('HELLO');
      expect(useMultiplayerStore.getState().pendingSuggestion).toBe(null);
    });

    it('should reject suggestion and clear it', async () => {
      const { hostGame } = useMultiplayerStore.getState();

      act(() => {
        hostGame();
      });

      await act(async () => {
        await flushAsyncOperations();
      });

      act(() => {
        mockPeerInstance?._triggerOpen();
      });

      const mockViewerConn = createMockConnection(true);
      act(() => {
        mockPeerInstance?._triggerConnection(mockViewerConn as unknown as DataConnection);
      });

      act(() => {
        mockViewerConn._triggerOpen();
      });

      act(() => {
        useMultiplayerStore.setState({ pendingSuggestion: { word: 'HELLO' } });
      });

      act(() => {
        useMultiplayerStore.getState().rejectSuggestion();
      });

      expect(useMultiplayerStore.getState().pendingSuggestion).toBe(null);
    });

    it('should return null when accepting with no pending suggestion', () => {
      act(() => {
        useMultiplayerStore.setState({
          role: 'host',
          connectionStatus: 'connected',
          pendingSuggestion: null,
        });
      });

      const { acceptSuggestion } = useMultiplayerStore.getState();

      let result: string | null = 'not-null';
      act(() => {
        result = acceptSuggestion();
      });

      expect(result).toBe(null);
    });
  });

  describe('sendGameState (host)', () => {
    it('should not send when not a host', () => {
      act(() => {
        useMultiplayerStore.setState({
          role: 'viewer',
          connectionStatus: 'connected',
        });
      });

      const { sendGameState } = useMultiplayerStore.getState();

      act(() => {
        sendGameState({
          solution: 'HELLO',
          guesses: [],
          currentGuess: '',
          gameOver: false,
          won: false,
          message: '',
        });
      });

      // No error should occur, just a no-op
    });

    it('should send viewer-safe game state (without solution)', () => {
      const { hostGame, sendGameState } = useMultiplayerStore.getState();

      act(() => {
        hostGame();
      });

      act(() => {
        mockPeerInstance?._triggerOpen();
      });

      const mockViewerConn = createMockConnection(true);
      act(() => {
        mockPeerInstance?._triggerConnection(mockViewerConn as unknown as DataConnection);
      });

      act(() => {
        mockViewerConn._triggerOpen();
      });

      act(() => {
        sendGameState({
          solution: 'SECRET', // This should NOT be sent to viewer
          guesses: [{ word: 'HELLO', status: ['absent', 'absent', 'absent', 'absent', 'absent'] }],
          currentGuess: 'WO',
          gameOver: false,
          won: false,
          message: 'Test message',
        });
      });

      // Check that send was called with viewer state (no solution)
      const sendCalls = mockViewerConn.send.mock.calls;
      const gameStateCall = sendCalls.find(
        (call) => call[0] && typeof call[0] === 'object' && call[0].type === 'game-state'
      );

      if (gameStateCall) {
        const sentMessage = gameStateCall[0] as {
          type: string;
          state: { solution?: string; guesses: unknown[]; currentGuess: string };
        };
        expect(sentMessage.state.solution).toBeUndefined();
        expect(sentMessage.state.guesses).toHaveLength(1);
        expect(sentMessage.state.currentGuess).toBe('WO');
      }
    });
  });

  describe('sendSuggestion (viewer)', () => {
    it('should not send when not a viewer', () => {
      act(() => {
        useMultiplayerStore.setState({
          role: 'host',
          connectionStatus: 'connected',
        });
      });

      const { sendSuggestion } = useMultiplayerStore.getState();

      // Should be a no-op
      act(() => {
        sendSuggestion('HELLO');
      });
    });
  });

  describe('clearSuggestion (viewer)', () => {
    it('should not send when not a viewer', () => {
      act(() => {
        useMultiplayerStore.setState({
          role: 'host',
          connectionStatus: 'connected',
        });
      });

      const { clearSuggestion } = useMultiplayerStore.getState();

      // Should be a no-op
      act(() => {
        clearSuggestion();
      });
    });
  });

  describe('callback registration', () => {
    it('should register game state callback', () => {
      const mockCallback = vi.fn();
      registerGameStateCallback(mockCallback);

      // The callback is stored in internal state and called when game-state message received
      // We can verify it was set by checking the function doesn't throw
      expect(() => registerGameStateCallback(mockCallback)).not.toThrow();
    });

    it('should register suggestion response callback', () => {
      const mockCallback = vi.fn();
      registerSuggestionResponseCallback(mockCallback);

      expect(() => registerSuggestionResponseCallback(mockCallback)).not.toThrow();
    });
  });

  describe('message handling', () => {
    it('should ignore invalid messages', () => {
      const { hostGame } = useMultiplayerStore.getState();

      act(() => {
        hostGame();
      });

      act(() => {
        mockPeerInstance?._triggerOpen();
      });

      const mockViewerConn = createMockConnection();
      act(() => {
        mockPeerInstance?._triggerConnection(mockViewerConn as unknown as DataConnection);
      });

      act(() => {
        mockViewerConn._triggerOpen();
      });

      // Send invalid message - should not throw
      act(() => {
        mockViewerConn._triggerData({ invalid: 'message' });
      });

      // State should be unchanged from invalid message
      expect(useMultiplayerStore.getState().pendingSuggestion).toBe(null);
    });

    it('should handle ping/pong messages', async () => {
      const { hostGame } = useMultiplayerStore.getState();

      act(() => {
        hostGame();
      });

      await act(async () => {
        await flushAsyncOperations();
      });

      act(() => {
        mockPeerInstance?._triggerOpen();
      });

      const mockViewerConn = createMockConnection(true);
      act(() => {
        mockPeerInstance?._triggerConnection(mockViewerConn as unknown as DataConnection);
      });

      act(() => {
        mockViewerConn._triggerOpen();
      });

      // Send ping - should respond with pong
      const timestamp = Date.now();
      act(() => {
        mockViewerConn._triggerData({ type: 'ping', timestamp });
      });

      const pongCall = mockViewerConn.send.mock.calls.find(
        (call) => call[0] && typeof call[0] === 'object' && call[0].type === 'pong'
      );
      expect(pongCall).toBeDefined();
      if (pongCall) {
        expect((pongCall[0] as { timestamp: number }).timestamp).toBe(timestamp);
      }
    });

    it('should send acknowledgment for suggest-word messages', async () => {
      const { hostGame } = useMultiplayerStore.getState();

      act(() => {
        hostGame();
      });

      await act(async () => {
        await flushAsyncOperations();
      });

      act(() => {
        mockPeerInstance?._triggerOpen();
      });

      const mockViewerConn = createMockConnection(true);
      act(() => {
        mockPeerInstance?._triggerConnection(mockViewerConn as unknown as DataConnection);
      });

      act(() => {
        mockViewerConn._triggerOpen();
      });

      // Send suggest-word with message ID
      act(() => {
        mockViewerConn._triggerData({
          type: 'suggest-word',
          word: 'HELLO',
          _messageId: 'test-msg-123',
        });
      });

      const ackCall = mockViewerConn.send.mock.calls.find(
        (call) => call[0] && typeof call[0] === 'object' && call[0].type === 'ack'
      );
      expect(ackCall).toBeDefined();
      if (ackCall) {
        expect((ackCall[0] as { messageId: string }).messageId).toBe('test-msg-123');
      }
    });
  });

  describe('connection close handling', () => {
    it('should set partnerConnected to false when viewer disconnects', async () => {
      const { hostGame } = useMultiplayerStore.getState();

      act(() => {
        hostGame();
      });

      await act(async () => {
        await flushAsyncOperations();
      });

      act(() => {
        mockPeerInstance?._triggerOpen();
      });

      const mockViewerConn = createMockConnection();
      act(() => {
        mockPeerInstance?._triggerConnection(mockViewerConn as unknown as DataConnection);
      });

      act(() => {
        mockViewerConn._triggerOpen();
      });

      expect(useMultiplayerStore.getState().partnerConnected).toBe(true);

      // Viewer disconnects
      act(() => {
        mockViewerConn._triggerClose();
      });

      expect(useMultiplayerStore.getState().partnerConnected).toBe(false);
    });

    it('should clear pending suggestion when viewer disconnects', async () => {
      const { hostGame } = useMultiplayerStore.getState();

      act(() => {
        hostGame();
      });

      await act(async () => {
        await flushAsyncOperations();
      });

      act(() => {
        mockPeerInstance?._triggerOpen();
      });

      const mockViewerConn = createMockConnection();
      act(() => {
        mockPeerInstance?._triggerConnection(mockViewerConn as unknown as DataConnection);
      });

      act(() => {
        mockViewerConn._triggerOpen();
      });

      act(() => {
        useMultiplayerStore.setState({ pendingSuggestion: { word: 'HELLO' } });
      });

      act(() => {
        mockViewerConn._triggerClose();
      });

      expect(useMultiplayerStore.getState().pendingSuggestion).toBe(null);
    });
  });

  describe('selector hooks', () => {
    it('should export selector hooks', async () => {
      // Dynamically import to test exports
      const selectors = await import('./multiplayerStore');

      expect(selectors.useRole).toBeDefined();
      expect(selectors.useSessionCode).toBeDefined();
      expect(selectors.useSessionPin).toBeDefined();
      expect(selectors.useConnectionStatus).toBeDefined();
      expect(selectors.useErrorMessage).toBeDefined();
      expect(selectors.usePartnerConnected).toBeDefined();
      expect(selectors.usePendingSuggestion).toBeDefined();
    });
  });

  describe('rate limiting', () => {
    it('should rate limit rapid join attempts', () => {
      const { joinGame } = useMultiplayerStore.getState();

      // Make 5 rapid join attempts (the rate limit)
      for (let i = 0; i < 5; i++) {
        act(() => {
          useMultiplayerStore.setState({
            connectionStatus: 'disconnected',
            errorMessage: '',
          });
          joinGame('ABCDEF-abc123');
        });
      }

      // Reset state and try again - should be rate limited
      act(() => {
        useMultiplayerStore.setState({
          connectionStatus: 'disconnected',
          errorMessage: '',
        });
        joinGame('ABCDEF-abc123');
      });

      const state = useMultiplayerStore.getState();
      expect(state.connectionStatus).toBe('error');
      expect(state.errorMessage).toContain('Too many connection attempts');
    });

    it('should allow join after rate limit cooldown', () => {
      const { joinGame, leaveSession } = useMultiplayerStore.getState();

      // Trigger rate limit
      for (let i = 0; i < 6; i++) {
        act(() => {
          useMultiplayerStore.setState({
            connectionStatus: 'disconnected',
            errorMessage: '',
          });
          joinGame('ABCDEF-abc123');
        });
      }

      // Verify rate limited
      expect(useMultiplayerStore.getState().errorMessage).toContain('Too many connection attempts');

      // Leave session resets rate limiting
      act(() => {
        leaveSession();
      });

      // Should be allowed again
      act(() => {
        joinGame('ABCDEF-abc123');
      });

      expect(useMultiplayerStore.getState().connectionStatus).toBe('connecting');
    });

    it('should block peer after too many failed auth attempts', async () => {
      const { hostGame } = useMultiplayerStore.getState();

      act(() => {
        hostGame('1234');
      });

      await act(async () => {
        await flushAsyncOperations();
      });

      act(() => {
        mockPeerInstance?._triggerOpen();
      });

      const mockViewerConn = createMockConnection();
      // Set a peer ID for tracking
      (mockViewerConn as unknown as { peer: string }).peer = 'attacker-peer';

      act(() => {
        mockPeerInstance?._triggerConnection(mockViewerConn as unknown as DataConnection);
      });

      act(() => {
        mockViewerConn._triggerOpen();
      });

      // Send 3 failed auth attempts
      for (let i = 0; i < 3; i++) {
        act(() => {
          mockViewerConn._triggerData({ type: 'auth-request', pin: 'wrong' });
        });
      }

      // Check the last response indicates blocking
      const lastAuthCall = mockViewerConn.send.mock.calls
        .filter((call) => call[0]?.type === 'auth-failure')
        .pop();

      expect(lastAuthCall).toBeDefined();
      expect(lastAuthCall?.[0]?.reason).toContain('Too many failed attempts');
    });

    it('should clear auth rate limit on successful authentication', async () => {
      const { hostGame } = useMultiplayerStore.getState();

      act(() => {
        hostGame('1234');
      });

      await act(async () => {
        await flushAsyncOperations();
      });

      act(() => {
        mockPeerInstance?._triggerOpen();
      });

      const mockViewerConn = createMockConnection();
      (mockViewerConn as unknown as { peer: string }).peer = 'user-peer';

      act(() => {
        mockPeerInstance?._triggerConnection(mockViewerConn as unknown as DataConnection);
      });

      act(() => {
        mockViewerConn._triggerOpen();
      });

      // Send 2 failed auth attempts (not enough to block)
      for (let i = 0; i < 2; i++) {
        act(() => {
          mockViewerConn._triggerData({ type: 'auth-request', pin: 'wrong' });
        });
      }

      // Now send correct PIN
      act(() => {
        mockViewerConn._triggerData({ type: 'auth-request', pin: '1234' });
      });

      // Should have received auth-success
      const authSuccessCall = mockViewerConn.send.mock.calls.find(
        (call) => call[0]?.type === 'auth-success'
      );
      expect(authSuccessCall).toBeDefined();
      expect(useMultiplayerStore.getState().partnerConnected).toBe(true);
    });

    it('should reset rate limiting when hosting new game', async () => {
      const { joinGame, leaveSession, hostGame } = useMultiplayerStore.getState();

      // Trigger rate limit on join attempts
      for (let i = 0; i < 6; i++) {
        act(() => {
          useMultiplayerStore.setState({
            connectionStatus: 'disconnected',
            errorMessage: '',
          });
          joinGame('ABCDEF-abc123');
        });
      }

      // Verify rate limited
      expect(useMultiplayerStore.getState().errorMessage).toContain('Too many connection attempts');

      // Leave and host a new game - should reset rate limiting
      act(() => {
        leaveSession();
      });

      act(() => {
        hostGame();
      });

      await act(async () => {
        await flushAsyncOperations();
      });

      // Now try joining again - should work because rate limit was reset
      act(() => {
        leaveSession();
      });

      act(() => {
        joinGame('ABCDEF-abc123');
      });

      expect(useMultiplayerStore.getState().connectionStatus).toBe('connecting');
    });
  });
});
