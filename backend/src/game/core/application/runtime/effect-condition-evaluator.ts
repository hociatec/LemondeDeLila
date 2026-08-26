import type { EffectCondition, EffectTarget } from './effects-kit';
import type { GameContext } from './game-rule-context';

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
  if (condition.kind === 'has-resource') {
    return playerIds.every((playerId) =>
      context.resources.has(playerId, condition.resource, condition.amount),
    );
  }
  if (condition.kind === 'has-status') {
    return playerIds.every((playerId) =>
      context.status.has(playerId, condition.status),
    );
  }
  if (condition.kind === 'has-card') {
    return playerIds.every((playerId) => {
      const cards = context.cards.hand<string>(condition.handId, playerId);
      return condition.cardId == null
        ? cards.length > 0
        : cards.includes(condition.cardId);
    });
  }
  return playerIds.every((playerId) => {
    const position = context.movement.position(condition.trackId, playerId);
    return (
      (condition.position == null || position === condition.position) &&
      (condition.min == null || position >= condition.min) &&
      (condition.max == null || position <= condition.max)
    );
  });
}
