export type MinuitPending = {
  kind: 'quiz';
  actorId: number;
  cardId: number;
};

export type MinuitState = Record<string, never>;
