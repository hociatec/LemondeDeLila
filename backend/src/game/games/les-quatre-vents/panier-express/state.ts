import type { PanierEventEffect, PanierExchangeEffect } from './content';

export type PanierPending =
  | { kind: 'direction'; actorId: number; distance: number }
  | { kind: 'quiz'; actorId: number; questionId: string }
  | {
      kind: 'target';
      actorId: number;
      effect: PanierEventEffect | PanierExchangeEffect;
    }
  | {
      kind: 'take';
      actorId: number;
      targetId: number;
      targetCards: string[];
    }
  | {
      kind: 'give';
      actorId: number;
      targetId: number;
      take: string;
      ownCards: string[];
    };

export interface PanierState {
  pawnByPlayerId: Record<number, string>;
  setupComplete: boolean;
  starterId: number;
  shoppingLists: Record<number, string[]>;
  baskets: Record<number, string[]>;
  inventories: Record<number, string[]>;
  laps: Record<number, number>;
  skipTurns: Record<number, number>;
  keepTurns: Record<number, number>;
  revealTurns: Record<number, number>;
  movementDirection: 1 | -1;
  reverseOwnerId: number | null;
  pending: PanierPending | null;
  resolvingPlayerId: number | null;
  lastEventId: string | null;
  lastExchangeId: string | null;
  winnerId: number | null;
}

export type PanierPlayerView = Omit<
  PanierState,
  'shoppingLists' | 'baskets' | 'inventories' | 'pending' | 'resolvingPlayerId'
> & {
  positions: Record<number, number>;
  basketCounts: Record<number, number>;
  inventoryCounts: Record<number, number>;
  shoppingList: string[];
  basket: string[];
  inventory: string[];
};
