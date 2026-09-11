import {
  assertEffectInstructions,
  type GameEffectValidationReferences,
  type ValidationFailure,
} from '../effects/game-effect-definition-validator';

/** Inspect every catalogue, including cards not installed in a deck yet. */
export function assertStaticEffectReferences(
  value: unknown,
  path: string,
  references: GameEffectValidationReferences,
  fail: ValidationFailure,
  visited = new WeakSet<object>(),
): void {
  if (value == null || typeof value !== 'object' || visited.has(value)) return;
  visited.add(value);
  if (value instanceof Map) {
    for (const key of value.keys())
      assertStaticEffectReferences(
        key,
        `${path}.key`,
        references,
        fail,
        visited,
      );
  }
  if (value instanceof Map || value instanceof Set) {
    for (const entry of value.values())
      assertStaticEffectReferences(
        entry,
        `${path}.entry`,
        references,
        fail,
        visited,
      );
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'effects') {
      assertEffectInstructions(entry, `${path}.effects`, references, fail);
    } else {
      assertStaticEffectReferences(
        entry,
        `${path}.${key}`,
        references,
        fail,
        visited,
      );
    }
  }
}
