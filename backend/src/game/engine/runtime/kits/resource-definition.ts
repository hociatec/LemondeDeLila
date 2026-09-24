import type { ResourceDefinition } from '../contracts/resource-definition';
import {
  GameConfigurationError,
  GameRuleViolationError,
} from '../contracts/game-domain.errors';
import { assertGameValue, assertPlayerValueId } from './numeric-invariants';
import {
  atAuthoringPath,
  withAuthoringPath,
} from '../contracts/authoring-origin';

export const resources = {
  pool(definition: Omit<ResourceDefinition, 'component'>): ResourceDefinition {
    atAuthoringPath('id', () => assertPlayerValueId(definition.id));
    for (const key of ['initial', 'min', 'max'] as const) {
      const value = definition[key];
      if (value !== undefined)
        atAuthoringPath(key, () => assertGameValue(value));
    }
    if (
      (definition.min ?? -Number.MAX_SAFE_INTEGER) >
      (definition.max ?? Number.MAX_SAFE_INTEGER)
    )
      throw withAuthoringPath(
        new GameConfigurationError('Inverted resource bounds'),
        'min',
      );
    const result = { ...definition, component: 'resource.pool' as const };
    atAuthoringPath('initial', () =>
      assertResourceBounds(result, definition.initial ?? 0),
    );
    return Object.freeze(result);
  },
};

export function assertResourceBounds(
  definition: ResourceDefinition | undefined,
  value: number,
): void {
  if (!definition) return;
  if (
    value < (definition.min ?? -Number.MAX_SAFE_INTEGER) ||
    value > (definition.max ?? Number.MAX_SAFE_INTEGER)
  )
    throw new GameRuleViolationError('RESOURCE_BOUNDS', {
      resource: definition.id,
      value,
      min: definition.min,
      max: definition.max,
    });
}
