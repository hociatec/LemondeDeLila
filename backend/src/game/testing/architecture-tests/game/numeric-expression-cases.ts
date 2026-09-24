import type { NumericExpression } from '../../../engine/runtime/contracts/numeric-expression';

type ExpressionKind = Exclude<NumericExpression, number>['kind'];
export const numericExpressionCases = {
  'resource-value': [{ kind: 'resource-value', resource: 'stars' }, 10],
  'score-value': [{ kind: 'score-value' }, 2],
  'track-value': [{ kind: 'track-value', trackId: 'board' }, 2],
  'inventory-size': [
    { kind: 'inventory-size', inventoryId: 'bag', itemId: 'apple' },
    2,
  ],
  'hand-size': [{ kind: 'hand-size', handId: 'hand' }, 1],
  'player-count': [{ kind: 'player-count', participants: 'active' }, 3],
  add: [{ kind: 'add', left: 5, right: 3 }, 8],
  subtract: [{ kind: 'subtract', left: 5, right: 3 }, 2],
  multiply: [{ kind: 'multiply', left: 5, right: 3 }, 15],
  divide: [{ kind: 'divide', left: 5, right: 2 }, 2.5],
  min: [{ kind: 'min', left: 5, right: 3 }, 3],
  max: [{ kind: 'max', left: 5, right: 3 }, 5],
  clamp: [{ kind: 'clamp', value: 20, min: 1, max: 10 }, 10],
} satisfies Record<ExpressionKind, readonly [NumericExpression, number]>;
