export type PanierPending =
  | { panierKind: 'direction'; actorId: number; distance: number }
  | { panierKind: 'quiz'; actorId: number; sessionId: string }
  | {
      panierKind: 'take';
      actorId: number;
      targetId: number;
    }
  | {
      panierKind: 'give';
      actorId: number;
      targetId: number;
      take: string;
    };

export type PanierState = import('../../../engine/sdk/public-api').NoGameState;
