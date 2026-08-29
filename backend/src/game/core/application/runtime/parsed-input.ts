import type { GameInputSchema } from './game-input-schema';

/** Single raw -> schema -> typed-value entry point shared by runtime registries. */
export function parseRuntimeInput<TValue>(
  schema: GameInputSchema<TValue>,
  raw: unknown,
  path: string,
): TValue {
  return schema.parse(raw, path);
}
