export type CardLocation =
  | { kind: 'deck' | 'discard'; deckId: string }
  | { kind: 'hand'; handId: string; playerId: number }
  | { kind: 'zone'; zoneId: string };
