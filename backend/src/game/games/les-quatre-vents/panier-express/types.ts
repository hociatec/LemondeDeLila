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

export type PanierState = import('../../../engine/sdk/public-api').NoGameState;
