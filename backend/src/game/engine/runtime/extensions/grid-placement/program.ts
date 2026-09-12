/** Reusable JSON authoring extension; prefer shared effects and patterns for new rules. */
/** A bounded line-building board game, with no author callbacks or mutable rule state. */
export type GridPlacementProgram = {
  boardId: string;
  width: number;
  height: number;
  winLength: number;
  drawWhenFull: boolean;
  winnerReason: string;
  drawReason: string;
  markEvent: string;
  preferredCells: readonly { x: number; y: number }[];
  pawnSelection?: {
    setId: string;
    choiceId: string;
    order: 'players' | 'shuffled';
  };
};
