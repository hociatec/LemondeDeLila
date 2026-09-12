export type FouleesFamily = {
  id: string;
  family: string;
  habitat: string;
  pawns: readonly string[];
};

export type FouleesRaceProgram = {
  setId: string;
  diceId: string;
  familyChoiceId: string;
  moveChoiceId: string;
  families: readonly FouleesFamily[];
  trackLength: number;
  homeLength: number;
  safeTiles: readonly number[];
  finishReason: string;
};
