export interface CorridorPosition {
  x: number;
  y: number;
}

export type CorridorOrientation = 'h' | 'v';

export interface CorridorWall {
  x: number;
  y: number;
  orientation: CorridorOrientation;
}

export interface CorridorPawn {
  id: string;
  label: string;
  description: string;
}

export interface CorridorState {
  size: number;
  ownerPlayerId: number;
  wallsPerPlayer: number;
  pawnByPlayerId: Record<number, string>;
  positions: Record<number, CorridorPosition>;
  goalYByPlayerId: Record<number, number>;
  walls: CorridorWall[];
  wallsRemaining: Record<number, number>;
  setupComplete: boolean;
  winnerId: number | null;
}

export type CorridorPlayerView = CorridorState & {
  legalMoves: CorridorPosition[];
  legalWalls: CorridorWall[];
};
