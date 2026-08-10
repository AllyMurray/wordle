/**
 * Shared types for the multi-game platform.
 *
 * Philosophy: Games share infrastructure (router, multiplayer, timer, stats)
 * but implement their own game logic. No forced interface for game mechanics.
 */

type GameId = 'wordle' | 'boggle';

/**
 * Metadata for dashboard display. No game logic here.
 */
export interface GameMetadata {
  id: GameId;
  name: string;
  description: string;
  icon: string;
  route: string;
  supportsSinglePlayer: boolean;
  supportsMultiplayer: boolean;
}

/**
 * Common position type for grid-based games.
 */
export interface Position {
  row: number;
  col: number;
}
