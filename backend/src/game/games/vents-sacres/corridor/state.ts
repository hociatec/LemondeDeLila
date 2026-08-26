import type { PlayerMap } from '../../../core/application/public-api';

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
  walls: CorridorWall[];
}

export type CorridorPlayerView = Pick<CorridorState, 'walls'> & {
  wallsRemaining: PlayerMap<number>;
  size: number;
  pawnByPlayerId: PlayerMap<string>;
  goalYByPlayerId: PlayerMap<number>;
  wallsPerPlayer: number;
  legalMoves: CorridorPosition[];
  legalWalls: CorridorWall[];
};
