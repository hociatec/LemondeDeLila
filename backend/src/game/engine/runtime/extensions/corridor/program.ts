/** Single-consumer JSON authoring extension; prefer shared effects and patterns for new rules. */
export type CorridorPosition = { x: number; y: number };
export type CorridorPawn = { id: string; label: string; description: string };
export type CorridorProgram = {
  boardId: string;
  pawnSetId: string;
  pawnChoiceId: string;
  wallsResourceId: string;
  wallsOverlayId: string;
  size: number;
  defaultWallsPerPlayer: number;
  startPositions: readonly [CorridorPosition, CorridorPosition];
  pawns: readonly CorridorPawn[];
};
