export type TriominoTile = {
  id: number;
  a: number;
  b: number;
  c: number;
};

export type TriominoPlacement = {
  tile: TriominoTile;
  ownerId: number;
  rot: 0 | 1 | 2;
};

export type TriominoStep = 'choose_tile' | 'place_tile';

export type TriominoMetadata = {
  rng?: Record<string, any>;
  size: number;
  deck: TriominoTile[];
  handsByPlayerId: Record<string, TriominoTile[]>;
  scoresByPlayerId: Record<string, number>;
  placedByKey: Record<string, TriominoPlacement>;
  selectedTileIdByPlayerId: Record<string, number | null>;
  step: TriominoStep;
  winnerId?: number | null;
  ended?: boolean;
};

export const triominoKey = (x: number, y: number) => `${x},${y}`;
export const isUpTriangle = (x: number, y: number) => (x + y) % 2 === 0;

