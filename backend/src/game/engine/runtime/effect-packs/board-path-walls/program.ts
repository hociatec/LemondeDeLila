export type PathWallsPosition = { x: number; y: number };
export type PathWallsPawn = { id: string; label: string; description: string };
export type PathWallsProgram = {
  boardId: string;
  pawnSetId: string;
  pawnChoiceId: string;
  wallsResourceId: string;
  wallsOverlayId: string;
  size: number;
  defaultWallsPerPlayer: number;
  startPositions: readonly [PathWallsPosition, PathWallsPosition];
  pawns: readonly PathWallsPawn[];
};
