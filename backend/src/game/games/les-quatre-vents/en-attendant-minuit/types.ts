export type MinuitPending = {
  kind: 'quiz';
  actorId: number;
  cardId: number;
};

export type MinuitState = import('../../../engine/sdk/public-api').NoGameState;
