/** Single-consumer JSON authoring extension; prefer shared effects and patterns for new rules. */
/** Roll, choose one legal pawn move, resolve arrival and complete the turn. */
export type PawnRaceProgram = {
  setId: string;
  diceId: string;
  choiceId: string;
  finishAt: number;
  finishReason: string;
  extraTurnRolls?: readonly number[];
};
