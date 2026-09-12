import type {
  EffectComparison,
  EffectCondition,
  EffectTarget,
} from '../contracts/effect-ir';
import type { GameContext } from '../definitions/game-author-context';

export function evaluateEffectCondition<TState extends object>(
  condition: EffectCondition,
  targets: (target: EffectTarget | undefined) => number[] | null,
  context: GameContext<TState>,
): boolean | null {
  if (condition.kind === 'not') {
    const result = evaluateEffectCondition(
      condition.condition,
      targets,
      context,
    );
    return result == null ? null : !result;
  }
  if (condition.kind === 'all' || condition.kind === 'any') {
    const results = condition.conditions.map((candidate) =>
      evaluateEffectCondition(candidate, targets, context),
    );
    if (results.some((result) => result == null)) return null;
    return condition.kind === 'all'
      ? results.every(Boolean)
      : results.some(Boolean);
  }
  const playerIds = targets(condition.target);
  if (!playerIds) return null;
  return playerIds.every((id) =>
    evaluatePlayerCondition(condition, id, context),
  );
}

function evaluatePlayerCondition<TState extends object>(
  condition: Exclude<EffectCondition, { kind: 'all' | 'any' | 'not' }>,
  playerId: number,
  context: GameContext<TState>,
): boolean {
  if (condition.kind === 'score')
    return compare(
      context.score.get(playerId),
      condition.compare,
      condition.amount,
    );
  if (condition.kind === 'resource')
    return compare(
      context.resources.get(playerId, condition.resource),
      condition.compare,
      condition.amount,
    );
  if (condition.kind === 'inventory-count')
    return compare(
      context.inventory
        .items(condition.inventoryId, playerId)
        .filter(
          (item) => condition.itemId === undefined || item === condition.itemId,
        ).length,
      condition.compare,
      condition.amount,
    );
  if (condition.kind === 'owns-asset')
    return context.ownership.isOwner(
      condition.registryId,
      condition.assetId,
      playerId,
    );
  if (condition.kind === 'has-resource') {
    return context.resources.has(
      playerId,
      condition.resource,
      condition.amount,
    );
  }
  if (condition.kind === 'has-status') {
    return context.status.has(playerId, condition.status);
  }
  if (condition.kind === 'has-card') {
    const cards = context.cards.hand(condition.handId, playerId);
    return condition.cardId == null
      ? cards.length > 0
      : cards.some((card) =>
          typeof card === 'object' && card !== null && 'id' in card
            ? card.id === condition.cardId
            : card === condition.cardId,
        );
  }
  const position = context.movement.position(condition.trackId, playerId);
  return (
    (condition.position == null || position === condition.position) &&
    (condition.min == null || position >= condition.min) &&
    (condition.max == null || position <= condition.max)
  );
}

function compare(
  value: number,
  operator: EffectComparison,
  expected: number,
): boolean {
  switch (operator) {
    case 'eq':
      return value === expected;
    case 'ne':
      return value !== expected;
    case 'lt':
      return value < expected;
    case 'lte':
      return value <= expected;
    case 'gt':
      return value > expected;
    case 'gte':
      return value >= expected;
  }
}
