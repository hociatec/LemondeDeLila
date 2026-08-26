export type MinuitPending =
  | {
      kind: 'quiz';
      actorId: number;
      cardId: number;
      prompt: string;
      choices: string[];
      correctIndex: number;
      successDelta: number;
      failureDelta: number;
      anyCorrect: boolean;
    }
  | { kind: 'swap' | 'gift'; actorId: number };

export interface MinuitState {
  pawnByPlayerId: Record<number, string>;
  setupComplete: boolean;
  starterId: number;
  skipTurns: Record<number, number>;
  ignoreNextMalus: Record<number, boolean>;
  ignoreNextSkip: Record<number, boolean>;
  forceDrawNextTurn: Record<number, boolean>;
  keepTurns: Record<number, number>;
  pendingResolution: MinuitPending | null;
  winnerId: number | null;
}

export type MinuitPlayerView = Omit<MinuitState, 'pendingResolution'> & {
  positions: Record<number, number>;
  deckCount: number;
};
