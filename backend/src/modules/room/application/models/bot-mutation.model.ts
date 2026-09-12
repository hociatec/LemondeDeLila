export type BotMutationRequest =
  { kind: 'add' | 'remove'; actorId: number } | { kind: 'restore' };

export type BotMutationDecision =
  | 'allowed'
  | 'room-not-found'
  | 'owner-required'
  | 'room-started'
  | 'room-full'
  | 'minimum-participants';
