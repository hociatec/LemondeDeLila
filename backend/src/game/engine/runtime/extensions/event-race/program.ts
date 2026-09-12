/** Reusable JSON authoring extension; prefer shared effects and patterns for new rules. */
/** A dice race whose landings draw and resolve event cards immediately. */
export type EventRaceProgram = {
  trackId: string;
  diceId: string;
  playingPhase: string;
  landingEffectId: string;
  tiles: readonly { label: string; deckId?: string }[];
  pawnSelection: { setId: string; choiceId: string };
};
