export type RitesPendingChoice =
  | { kind: 'draw-one'; playerId: number; cardIds: string[] }
  | { kind: 'resurrection'; playerId: number }
  | { kind: 'free-family'; playerId: number }
  | { kind: 'reveal-and-steal'; playerId: number };

export type EntreRitesState = Record<string, never>;
