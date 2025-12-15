import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import type {
  MultiplayerRole,
  ConnectionStatus,
  PendingSuggestion,
  GameState,
  UseMultiplayerReturn,
  PeerMessage,
} from '../types';
import { validatePeerMessage } from '../types';

// Generate a short, readable session code
const generateSessionCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const useMultiplayer = (): UseMultiplayerReturn => {
  const [role, setRole] = useState<MultiplayerRole>(null);
  const [sessionCode, setSessionCode] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState('');
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<PendingSuggestion | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const connectionRef = useRef<DataConnection | null>(null);
  const gameStateCallbackRef = useRef<((state: GameState) => void) | null>(null);
  const suggestionResponseCallbackRef = useRef<((accepted: boolean) => void) | null>(null);
  const hostGameRef = useRef<(() => void) | null>(null);

  // Cleanup peer connection
  const cleanup = useCallback((): void => {
    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setPartnerConnected(false);
    setPendingSuggestion(null);
  }, []);

  // Host a new game session
  const hostGame = useCallback((): void => {
    cleanup();
    setRole('host');
    setConnectionStatus('connecting');
    setErrorMessage('');

    const code = generateSessionCode();
    const peerId = `wordle-${code}`;

    const peer = new Peer(peerId, {
      debug: 0,
    });

    peer.on('open', () => {
      setSessionCode(code);
      setConnectionStatus('connected');
    });

    peer.on('connection', (conn: DataConnection) => {
      // Close old connection if exists (for rejoin support)
      if (connectionRef.current) {
        connectionRef.current.close();
      }
      connectionRef.current = conn;
      setPendingSuggestion(null); // Clear any pending suggestion from old viewer

      conn.on('open', () => {
        setPartnerConnected(true);
      });

      conn.on('data', (data) => {
        const validationResult = validatePeerMessage(data);
        if (!validationResult.success) {
          console.warn('Invalid peer message received:', validationResult.error);
          return;
        }
        const message = validationResult.message;
        if (message.type === 'request-state') {
          // State request handled by App.tsx useEffect
        } else if (message.type === 'suggest-word') {
          setPendingSuggestion({ word: message.word });
        } else if (message.type === 'clear-suggestion') {
          setPendingSuggestion(null);
        }
      });

      conn.on('close', () => {
        // Only set disconnected if this is still the current connection
        if (connectionRef.current === conn) {
          setPartnerConnected(false);
          setPendingSuggestion(null);
        }
      });

      conn.on('error', () => {
        if (connectionRef.current === conn) {
          setPartnerConnected(false);
          setPendingSuggestion(null);
        }
      });
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      if (err.type === 'unavailable-id') {
        // Session code already taken, try again
        setConnectionStatus('disconnected');
        setTimeout(() => hostGameRef.current?.(), 100);
      } else {
        setConnectionStatus('error');
        setErrorMessage('Connection error. Please try again.');
      }
    });

    peerRef.current = peer;
  }, [cleanup]);

  // Store hostGame in ref for self-reference in error handler
  useEffect(() => {
    hostGameRef.current = hostGame;
  }, [hostGame]);

  // Join an existing game session
  const joinGame = useCallback((code: string): void => {
    cleanup();
    setRole('viewer');
    setConnectionStatus('connecting');
    setErrorMessage('');
    setSessionCode(code.toUpperCase());

    const peerId = `wordle-viewer-${Date.now()}`;
    const hostPeerId = `wordle-${code.toUpperCase()}`;

    const peer = new Peer(peerId, {
      debug: 0,
    });

    peer.on('open', () => {
      const conn = peer.connect(hostPeerId, { reliable: true });

      conn.on('open', () => {
        connectionRef.current = conn;
        setConnectionStatus('connected');
        setPartnerConnected(true);

        // Request initial game state
        const requestMessage: PeerMessage = { type: 'request-state' };
        conn.send(requestMessage);
      });

      conn.on('data', (data) => {
        const validationResult = validatePeerMessage(data);
        if (!validationResult.success) {
          console.warn('Invalid peer message received:', validationResult.error);
          return;
        }
        const message = validationResult.message;
        if (message.type === 'game-state' && gameStateCallbackRef.current) {
          gameStateCallbackRef.current(message.state);
        } else if (message.type === 'suggestion-accepted' || message.type === 'suggestion-rejected') {
          if (suggestionResponseCallbackRef.current) {
            suggestionResponseCallbackRef.current(message.type === 'suggestion-accepted');
          }
        }
      });

      conn.on('close', () => {
        setConnectionStatus('disconnected');
        setPartnerConnected(false);
        setErrorMessage('Host disconnected');
      });

      conn.on('error', () => {
        setConnectionStatus('error');
        setErrorMessage('Connection lost');
      });
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      setConnectionStatus('error');
      if (err.type === 'peer-unavailable') {
        setErrorMessage('Game not found. Check the code and try again.');
      } else {
        setErrorMessage('Connection error. Please try again.');
      }
    });

    peerRef.current = peer;
  }, [cleanup]);

  // Send game state to viewer (called by host)
  const sendGameState = useCallback((state: GameState): void => {
    if (role === 'host' && connectionRef.current?.open) {
      const message: PeerMessage = { type: 'game-state', state };
      connectionRef.current.send(message);
    }
  }, [role]);

  // Register callback for receiving game state (used by viewer)
  const onGameStateReceived = useCallback((callback: (state: GameState) => void): void => {
    gameStateCallbackRef.current = callback;
  }, []);

  // Send a word suggestion to host (called by viewer)
  const sendSuggestion = useCallback((word: string): void => {
    if (role === 'viewer' && connectionRef.current?.open) {
      const message: PeerMessage = { type: 'suggest-word', word };
      connectionRef.current.send(message);
    }
  }, [role]);

  // Clear suggestion on host (called by viewer when typing changes)
  const clearSuggestion = useCallback((): void => {
    if (role === 'viewer' && connectionRef.current?.open) {
      const message: PeerMessage = { type: 'clear-suggestion' };
      connectionRef.current.send(message);
    }
  }, [role]);

  // Accept the pending suggestion (called by host)
  const acceptSuggestion = useCallback((): string | null => {
    if (role === 'host' && connectionRef.current?.open && pendingSuggestion) {
      const message: PeerMessage = { type: 'suggestion-accepted' };
      connectionRef.current.send(message);
      const word = pendingSuggestion.word;
      setPendingSuggestion(null);
      return word;
    }
    return null;
  }, [role, pendingSuggestion]);

  // Reject the pending suggestion (called by host)
  const rejectSuggestion = useCallback((): void => {
    if (role === 'host' && connectionRef.current?.open) {
      const message: PeerMessage = { type: 'suggestion-rejected' };
      connectionRef.current.send(message);
      setPendingSuggestion(null);
    }
  }, [role]);

  // Register callback for suggestion response (used by viewer)
  const onSuggestionResponse = useCallback((callback: (accepted: boolean) => void): void => {
    suggestionResponseCallbackRef.current = callback;
  }, []);

  // Leave the current session
  const leaveSession = useCallback((): void => {
    cleanup();
    setRole(null);
    setSessionCode('');
    setConnectionStatus('disconnected');
    setErrorMessage('');
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    role,
    sessionCode,
    connectionStatus,
    errorMessage,
    partnerConnected,
    pendingSuggestion,
    hostGame,
    joinGame,
    leaveSession,
    sendGameState,
    onGameStateReceived,
    sendSuggestion,
    clearSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    onSuggestionResponse,
    isHost: role === 'host',
    isViewer: role === 'viewer',
    isConnected: connectionStatus === 'connected',
  };
};
