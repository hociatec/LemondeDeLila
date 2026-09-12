/** Single-consumer JSON authoring extension; prefer shared effects and patterns for new rules. */
export type ParadeCard = {
  id: string;
  name: string;
  value: string;
  special: boolean;
};
export type ParadeProgram = {
  deckId: string;
  handId: string;
  cards: readonly ParadeCard[];
  sequence: readonly string[];
  rewards: Readonly<Record<string, Readonly<Record<string, number>>>>;
  resourceValues: Readonly<Record<string, number>>;
  finishReason: string;
  eventNamespace: string;
};
