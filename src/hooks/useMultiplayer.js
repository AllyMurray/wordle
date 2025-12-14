import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';

// Generate a short, readable session code
const generateSessionCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const useMultiplayer = () => {
  const [role, setRole] = useState(null); // 'host' | 'viewer' | null
  const [sessionCode, setSessionCode] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'connected' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [partnerConnected, setPartnerConnected] = useState(false);

  const peerRef = useRef(null);
  const connectionRef = useRef(null);
  const gameStateCallbackRef = useRef(null);

  // Cleanup peer connection
  const cleanup = useCallback(() => {
    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setPartnerConnected(false);
  }, []);

  // Host a new game session
  const hostGame = useCallback(() => {
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

    peer.on('connection', (conn) => {
      connectionRef.current = conn;

      conn.on('open', () => {
        setPartnerConnected(true);
      });

      conn.on('close', () => {
        setPartnerConnected(false);
      });

      conn.on('error', () => {
        setPartnerConnected(false);
      });
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      if (err.type === 'unavailable-id') {
        // Session code already taken, try again
        setConnectionStatus('disconnected');
        setTimeout(() => hostGame(), 100);
      } else {
        setConnectionStatus('error');
        setErrorMessage('Connection error. Please try again.');
      }
    });

    peerRef.current = peer;
  }, [cleanup]);

  // Join an existing game session
  const joinGame = useCallback((code) => {
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
        conn.send({ type: 'request-state' });
      });

      conn.on('data', (data) => {
        if (data.type === 'game-state' && gameStateCallbackRef.current) {
          gameStateCallbackRef.current(data.state);
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
  const sendGameState = useCallback((state) => {
    if (role === 'host' && connectionRef.current && connectionRef.current.open) {
      connectionRef.current.send({ type: 'game-state', state });
    }
  }, [role]);

  // Register callback for receiving game state (used by viewer)
  const onGameStateReceived = useCallback((callback) => {
    gameStateCallbackRef.current = callback;
  }, []);

  // Handle incoming data for host (to respond to state requests)
  useEffect(() => {
    if (role === 'host' && connectionRef.current) {
      const conn = connectionRef.current;
      const handler = (data) => {
        if (data.type === 'request-state') {
          // The host's game state will be sent via sendGameState
          // This is handled by the useWordle hook integration
        }
      };
      conn.on('data', handler);
      return () => conn.off('data', handler);
    }
  }, [role, partnerConnected]);

  // Leave the current session
  const leaveSession = useCallback(() => {
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
    hostGame,
    joinGame,
    leaveSession,
    sendGameState,
    onGameStateReceived,
    isHost: role === 'host',
    isViewer: role === 'viewer',
    isConnected: connectionStatus === 'connected',
  };
};
