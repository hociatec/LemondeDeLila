import type { NumericExpression } from '../contracts/numeric-expression';
import type { GameContext } from '../definitions/game-author-context';
import { GameRuleViolationError } from '../contracts/game-domain.errors';

type NumericExpressionContext = {
  resources: Pick<GameContext<object>['resources'], 'get'>;
  score: Pick<GameContext<object>['score'], 'get'>;
  movement: Pick<GameContext<object>['movement'], 'position'>;
  cards: Pick<GameContext<object>['cards'], 'hand'>;
  inventory: Pick<GameContext<object>['inventory'], 'items'>;
  players: Pick<GameContext<object>['players'], 'all' | 'active'>;
};

export function evaluateResourceAmount(
  expression: NumericExpression,
  context: NumericExpressionContext,
  playerId: number,
): number {
  const amount = evaluateNumericExpression(expression, context, playerId);
  if (amount < 0) throw new GameRuleViolationError('RESOURCE_AMOUNT_INVALID');
  return amount;
}

export function evaluateNumericExpression(
  expression: NumericExpression,
  context: NumericExpressionContext,
  playerId: number,
): number {
  let nodes = 0;
  const invalid = (reason: string): never => {
    throw new GameRuleViolationError('EXPRESSION_INVALID', { reason });
  };
  const finite = (value: number): number => {
    if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)
      invalid('non-finite or unsafe result');
    return value;
  };
  const evaluate = (value: NumericExpression, depth: number): number => {
    if (++nodes > 256 || depth > 16) invalid('expression budget exceeded');
    if (typeof value === 'number') return finite(value);
    const child = (nested: NumericExpression) => evaluate(nested, depth + 1);
    switch (value.kind) {
      case 'resource-value':
        return finite(context.resources.get(playerId, value.resource));
      case 'score-value':
        return finite(context.score.get(playerId));
      case 'track-value':
        return finite(context.movement.position(value.trackId, playerId));
      case 'hand-size':
        return context.cards.hand(value.handId, playerId).length;
      case 'inventory-size':
        return context.inventory
          .items(value.inventoryId, playerId)
          .filter((item) => value.itemId === undefined || item === value.itemId)
          .length;
      case 'player-count':
        return (
          value.participants === 'all'
            ? context.players.all()
            : context.players.active()
        ).length;
      case 'clamp': {
        const result = child(value.value),
          min = child(value.min),
          max = child(value.max);
        if (min > max) invalid('inverted bounds');
        return Math.min(max, Math.max(min, result));
      }
      default: {
        const left = child(value.left),
          right = child(value.right);
        switch (value.kind) {
          case 'add':
            return finite(left + right);
          case 'subtract':
            return finite(left - right);
          case 'multiply':
            return finite(left * right);
          case 'divide':
            if (right === 0) invalid('division by zero');
            return finite(left / right);
          case 'min':
            return Math.min(left, right);
          case 'max':
            return Math.max(left, right);
        }
      }
    }
  };
  return evaluate(expression, 0);
}
