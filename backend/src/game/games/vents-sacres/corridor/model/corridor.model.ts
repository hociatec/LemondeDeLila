export type CorridorPos = { x: number; y: number };

export type CorridorWallOrientation = 'h' | 'v';

export type CorridorMetadata = {
  size: number;
  setupStep?: 'setup_config' | 'playing';
  ownerPlayerId?: number | null;
  pawns?: Array<{ id: string; label: string; description?: string }>;
  pawnByPlayerId?: Record<string, string>;
  setupStarterId?: number | null;
  wallsPerPlayer?: number;
  pawnsByPlayerId: Record<string, CorridorPos>;
  goalYByPlayerId?: Record<string, number>;
  walls: {
    h: string[];
    v: string[];
  };
  wallsRemainingByPlayerId: Record<string, number>;
  winnerPlayerId?: number | null;
  winnerId?: number | null;
};
