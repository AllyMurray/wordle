/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode, useState, useCallback } from 'react';
import { useGameSession, type UseGameSessionReturn } from '../hooks/useGameSession';
import { useStats, type UseStatsReturn } from '../hooks/useStats';
import type { GameMode, ConnectionStatus } from '../types';

// Context value type - exposes game mode and multiplayer status
export interface GameContextValue {
  // Game mode
  gameMode: GameMode;

  // Multiplayer status (commonly accessed across components)
  isHost: boolean;
  isViewer: boolean;
  partnerConnected: boolean;
  sessionCode: string;
  sessionPin: string;
  connectionStatus: ConnectionStatus;

  // Statistics
  stats: UseStatsReturn;
  isStatsOpen: boolean;
  openStats: () => void;
  closeStats: () => void;

  // Full session (for components that need everything)
  session: UseGameSessionReturn;
}

// Create context with undefined default (will be provided by GameProvider)
const GameContext = createContext<GameContextValue | undefined>(undefined);

// Provider props
interface GameProviderProps {
  children: ReactNode;
}

// GameProvider component - wraps children and provides game context
export const GameProvider = ({ children }: GameProviderProps) => {
  const session = useGameSession();
  const stats = useStats();
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  const openStats = useCallback(() => setIsStatsOpen(true), []);
  const closeStats = useCallback(() => setIsStatsOpen(false), []);

  const value: GameContextValue = {
    // Game mode
    gameMode: session.gameMode,

    // Multiplayer status shortcuts for easy access
    isHost: session.multiplayer.isHost,
    isViewer: session.multiplayer.isViewer,
    partnerConnected: session.multiplayer.partnerConnected,
    sessionCode: session.multiplayer.sessionCode,
    sessionPin: session.multiplayer.sessionPin,
    connectionStatus: session.multiplayer.connectionStatus,

    // Statistics
    stats,
    isStatsOpen,
    openStats,
    closeStats,

    // Full session for components that need complete access
    session,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

// Custom hook to use game context
export const useGameContext = (): GameContextValue => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
};
