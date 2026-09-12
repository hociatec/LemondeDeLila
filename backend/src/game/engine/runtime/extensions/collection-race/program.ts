/** Single-consumer JSON authoring extension; prefer shared effects and patterns for new rules. */
export type CollectionRaceProgram = {
  trackId: string;
  diceId: string;
  finishReason: string;
  eventNamespace: string;
  collectedEvent: string;
  tiles: readonly {
    n: number;
    title: string;
    description?: string;
    type: 'card' | 'finish';
  }[];
  zones: readonly {
    id: number;
    minimumTile: number;
    maximumTile: number;
    deckId: string;
    resourceId: string;
  }[];
};
