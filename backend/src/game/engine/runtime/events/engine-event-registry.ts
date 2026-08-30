import type { EventVisibility } from '../../../core/application/contracts/game-event.model';

export type EventValue =
  | null
  | string
  | number
  | boolean
  | EventValue[]
  | { [key: string]: EventValue };

export type EngineEventMap = {
  'turn.started': { playerId: number | null; turnNumber: number };
  'turn.ended': { playerId: number | null; turnNumber: number };
  'turn.replaced': { slotOwnerId: number; replacementPlayerId: number };
  'turn.simultaneous.waiting': {
    sessionId: string;
    pendingPlayerIds: number[];
    turnNumber: number;
  };
  'turn.simultaneous.completed': { sessionId: string; turnNumber: number };
  'timer.scheduled': { id: string; dueAtMs: number };
  'timer.cancelled': { id: string };
  'timer.fired': { id: string };
  'card.drawn': { deckId: string };
  'card.received': { handId: string; playerId: number };
  'card.played': {
    handId: string;
    deckId: string;
    playerId: number;
    card?: EventValue;
  };
  'card.discarded': { deckId: string; card: EventValue };
  'card.transferred': {
    handId: string;
    fromPlayerId: number;
    toPlayerId: number;
  };
  'cards.exchanged': {
    handId: string;
    leftPlayerId: number;
    rightPlayerId: number;
  };
  'cards.hands-shuffled': { handId: string; playerIds: number[] };
  'cards.hands-swapped': {
    handId: string;
    leftPlayerId: number;
    rightPlayerId: number;
  };
  'dice.rolled': {
    diceId: string;
    values: number[];
    total: number;
    attempts: number;
    selection: 'first' | 'last' | 'best' | 'worst';
  };
  'pawn.moved':
    | {
        trackId: string;
        playerId: number;
        from: number;
        to: number;
        distance: number;
      }
    | {
        setId: string;
        pawnId: string;
        playerId: number | null;
        from: number;
        to: number;
        distance: number;
      };
  'pawn.landed': { trackId: string; playerId: number; position: number };
  'pawn.assigned': { setId: string; pawnId: string; playerId: number };
  'score.changed': {
    playerId: number;
    previous: number;
    value: number;
    delta: number;
  };
  'resource.changed': {
    playerId: number;
    resource: string;
    previous: number;
    value: number;
    delta: number;
  };
  'resource.transferred': {
    from: number;
    to: number;
    resource: string;
    amount: number;
  };
  'player.eliminated': { playerId: number; reason: string };
  'player.skipped': { playerId: number };
  'round.started': {
    number: number;
    starterPlayerId: number | null;
    participantPlayerIds: number[];
  };
  'round.ended': { number: number; winnerPlayerIds: number[] };
  'round.player-left': { playerId: number; number: number };
  'game.phase.changed': { phase: string };
  'game.automatic': { ruleId: string; priority: number };
  'game.effect.resolved': { effectId: string };
  'game.finished': {
    winnerPlayerIds: number[];
    reason: string;
    finishedAtMs: number;
  };
  'game.configured': { playerId: number; values: object };
  'match.started': { startedAtMs: number };
  'match.cancelled': { reason: string };
  'deck.exhausted': { deckId: string };
  'deck.recycled': { deckId: string; count: number };
  'cards.set-completed': {
    collectionId: string;
    playerId: number;
    setId: string;
  };
  'quiz.asked': {
    sessionId: string;
    bankId: string;
    questionId: string;
    participantPlayerIds: number[];
  };
  'quiz.answered': { sessionId: string; playerId: number };
  'quiz.revealed': {
    sessionId: string;
    questionId: string;
    correctAnswerIndex: number;
    answers: Record<string, number>;
  };
  'quiz.scored': { sessionId: string; deltas: Record<string, number> };
  'quiz.closed': { sessionId: string };
  'submission.received': { sessionId: string; playerId: number };
  'submission.replaced': { sessionId: string; playerId: number };
  'submission.pending.reordered': {
    sessionId: string;
    pendingPlayerIds: number[];
  };
  'submission.opened': {
    sessionId: string;
    participantPlayerIds: number[];
  };
  'submission.closed': { sessionId: string };
  'submissions.revealed': {
    sessionId: string;
    valuesByPlayerId: object;
  };
  'vote.opened': { sessionId: string; participantPlayerIds: number[] };
  'vote.received': { sessionId: string; playerId: number };
  'vote.closed': { sessionId: string };
  'judge.started': { id: string; playerId: number; playerIds: number[] };
  'judge.changed': { id: string; playerId: number; index: number };
  'ownership.claimed': {
    registryId: string;
    assetId: string;
    playerId: number;
  };
  'ownership.released': {
    registryId: string;
    assetId: string;
    playerId: number;
  };
  'ownership.transferred': {
    registryId: string;
    assetId: string;
    fromPlayerId: number;
    toPlayerId: number;
  };
  'inventory.item-added': {
    inventoryId: string;
    playerId: number;
    itemId: string;
    count: number;
  };
  'inventory.item-removed': {
    inventoryId: string;
    playerId: number;
    itemId: string;
    count: number;
  };
  'inventory.transferred': {
    inventoryId: string;
    fromPlayerId: number;
    toPlayerId: number;
    itemId: string;
    count: number;
  };
  'inventory.exchanged': {
    inventoryId: string;
    leftPlayerId: number;
    rightPlayerId: number;
  };
  'inventory.swapped': {
    inventoryId: string;
    leftPlayerId: number;
    rightPlayerId: number;
  };
  'economy.price-changed': {
    marketId: string;
    itemId: string;
    previous: number;
    price: number;
    delta: number;
  };
  'economy.item-bought': {
    marketId: string;
    playerId: number;
    itemId: string;
    price: number;
  };
  'economy.item-sold': {
    marketId: string;
    playerId: number;
    itemId: string;
    price: number;
  };
};

export type EngineEventType = keyof EngineEventMap;
export type EngineEventVisibilityPolicy = EventVisibility['kind'] | 'dynamic';

export const ENGINE_EVENT_VISIBILITY = {
  'turn.started': 'public',
  'turn.ended': 'public',
  'turn.replaced': 'public',
  'turn.simultaneous.waiting': 'public',
  'turn.simultaneous.completed': 'public',
  'timer.scheduled': 'internal',
  'timer.cancelled': 'internal',
  'timer.fired': 'internal',
  'card.drawn': 'public',
  'card.received': 'dynamic',
  'card.played': 'public',
  'card.discarded': 'public',
  'card.transferred': 'public',
  'cards.exchanged': 'public',
  'cards.hands-shuffled': 'public',
  'cards.hands-swapped': 'public',
  'dice.rolled': 'public',
  'pawn.moved': 'public',
  'pawn.landed': 'public',
  'pawn.assigned': 'public',
  'score.changed': 'public',
  'resource.changed': 'public',
  'resource.transferred': 'public',
  'player.eliminated': 'public',
  'player.skipped': 'public',
  'round.started': 'public',
  'round.ended': 'public',
  'round.player-left': 'public',
  'game.phase.changed': 'public',
  'game.automatic': 'internal',
  'game.effect.resolved': 'public',
  'game.finished': 'public',
  'game.configured': 'public',
  'match.started': 'public',
  'match.cancelled': 'public',
  'deck.exhausted': 'public',
  'deck.recycled': 'public',
  'cards.set-completed': 'public',
  'quiz.asked': 'public',
  'quiz.answered': 'dynamic',
  'quiz.revealed': 'public',
  'quiz.scored': 'public',
  'quiz.closed': 'public',
  'submission.received': 'dynamic',
  'submission.replaced': 'dynamic',
  'submission.pending.reordered': 'public',
  'submission.opened': 'public',
  'submission.closed': 'public',
  'submissions.revealed': 'public',
  'vote.opened': 'public',
  'vote.received': 'dynamic',
  'vote.closed': 'public',
  'judge.started': 'public',
  'judge.changed': 'public',
  'ownership.claimed': 'dynamic',
  'ownership.released': 'dynamic',
  'ownership.transferred': 'dynamic',
  'inventory.item-added': 'dynamic',
  'inventory.item-removed': 'dynamic',
  'inventory.transferred': 'dynamic',
  'inventory.exchanged': 'dynamic',
  'inventory.swapped': 'dynamic',
  'economy.price-changed': 'public',
  'economy.item-bought': 'public',
  'economy.item-sold': 'public',
} as const satisfies Record<EngineEventType, EngineEventVisibilityPolicy>;

export function engineEventVisibility(
  type: EngineEventType,
): EngineEventVisibilityPolicy {
  return ENGINE_EVENT_VISIBILITY[type];
}

const ENGINE_EVENT_TYPES = new Set<string>(
  Object.keys(ENGINE_EVENT_VISIBILITY),
);

export function isEngineEventType(type: string): type is EngineEventType {
  return ENGINE_EVENT_TYPES.has(type);
}
