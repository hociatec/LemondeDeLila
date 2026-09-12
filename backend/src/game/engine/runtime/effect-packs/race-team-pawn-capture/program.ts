export type TeamPawnFamily = {
  id: string;
  family: string;
  habitat: string;
  pawns: readonly string[];
};
export type TeamPawnRaceProgram = {
  setId: string;
  diceId: string;
  familyChoiceId: string;
  moveChoiceId: string;
  families: readonly TeamPawnFamily[];
  trackLength: number;
  homeLength: number;
  safeTiles: readonly number[];
  finishReason: string;
};
