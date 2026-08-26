import type { PlayerMap } from '../../../core/application/public-api';

export type PanierPending =
  | { kind: 'direction'; actorId: number; distance: number }
  | { kind: 'quiz'; actorId: number; sessionId: string }
  | {
      kind: 'take';
      actorId: number;
      targetId: number;
    }
  | {
      kind: 'give';
      actorId: number;
      targetId: number;
      take: string;
    };

export type PanierState = Record<string, never>;

export type PanierPlayerView = {
  laps: PlayerMap<number>;
  revealTurns: PlayerMap<number>;
  reverseOwnerId: number | null;
  lastEventId: string | null;
  lastExchangeId: string | null;
  pawnByPlayerId: PlayerMap<string>;
  basketCounts: PlayerMap<number>;
  shoppingList: string[];
  basket: string[];
};
