import type { NumericExpression } from '../contracts/numeric-expression';
import { numericExpressionSchema } from '../contracts/numeric-expression-schema';
import {
  assertAuthorJson,
  validateAuthorSchema,
} from '../contracts/json-author-schema';
import type {
  GameEffectValidationReferences,
  ValidationFailure,
} from '../contracts/effect-validation';

export function validateNumericExpression(
  value: NumericExpression,
  path: string,
  references: GameEffectValidationReferences,
  fail: ValidationFailure,
): void {
  assertAuthorJson(value, path, true);
  validateAuthorSchema(
    value,
    numericExpressionSchema,
    { 'numeric-expression': numericExpressionSchema },
    path,
    true,
  );
  let nodes = 0;
  const visit = (
    expression: NumericExpression,
    location: string,
    depth: number,
  ): void => {
    if (++nodes > 256 || depth > 16)
      fail(location, 'expression budget exceeded');
    if (typeof expression === 'number') {
      if (Math.abs(expression) > Number.MAX_SAFE_INTEGER)
        fail(location, 'unsafe number');
      return;
    }
    const reference = (
      ids: { has(id: string): boolean } | undefined,
      id: string,
      field: string,
    ) => {
      if (ids && !ids.has(id))
        fail(`${location}.${field}`, `unknown reference ${id}`);
    };
    switch (expression.kind) {
      case 'resource-value':
        reference(references.resources, expression.resource, 'resource');
        break;
      case 'track-value':
        reference(references.tracks, expression.trackId, 'trackId');
        break;
      case 'hand-size':
        reference(references.hands, expression.handId, 'handId');
        break;
      case 'inventory-size':
        reference(
          references.inventories,
          expression.inventoryId,
          'inventoryId',
        );
        if (expression.itemId !== undefined)
          reference(
            references.inventoryItems?.get(expression.inventoryId) ?? undefined,
            expression.itemId,
            'itemId',
          );
        break;
      case 'score-value':
      case 'player-count':
        break;
      case 'clamp':
        for (const key of ['value', 'min', 'max'] as const)
          visit(expression[key], `${location}.${key}`, depth + 1);
        if (
          typeof expression.min === 'number' &&
          typeof expression.max === 'number' &&
          expression.min > expression.max
        )
          fail(location, 'inverted bounds');
        break;
      default:
        visit(expression.left, `${location}.left`, depth + 1);
        visit(expression.right, `${location}.right`, depth + 1);
        if (expression.kind === 'divide' && expression.right === 0)
          fail(`${location}.right`, 'division by zero');
    }
  };
  visit(value, path, 0);
}
