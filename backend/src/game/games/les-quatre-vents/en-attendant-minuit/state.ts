import type { PlayerMap } from '../../../core/application/public-api';

export type MinuitPending = {
  kind: 'quiz';
  actorId: number;
  cardId: number;
};

export type MinuitState = Record<string, never>;

export type MinuitPlayerView = {
  ignoreNextMalus: PlayerMap<boolean>;
  ignoreNextSkip: PlayerMap<boolean>;
  forceDrawNextTurn: PlayerMap<boolean>;
  pawnByPlayerId: PlayerMap<string>;
};
