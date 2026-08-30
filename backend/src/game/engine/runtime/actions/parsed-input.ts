import type { GameInputSchema } from './game-input-schema';

/** Single raw -> schema -> typed-value entry point shared by runtime registries. */
export function parseRuntimeInput<TValue>(
  schema: GameInputSchema<TValue>,
  raw: unknown,
  path: string,
): TValue {
  return schema.parse(raw, path);
}

/** Shared existential boundary for actions, choices and effects. */
export type TypedRuntimeHandler<TValue, TExecution, TResult = void> = {
  readonly input: GameInputSchema<TValue>;
  parse(raw: unknown): TValue;
  handle(execution: TExecution, raw: unknown): TResult;
};

export function typedRuntimeHandler<TValue, TExecution, TResult = void>(input: {
  schema: GameInputSchema<TValue>;
  path: string;
  handle(execution: TExecution, value: TValue): TResult;
}): TypedRuntimeHandler<TValue, TExecution, TResult> {
  const parse = (raw: unknown) =>
    parseRuntimeInput(input.schema, raw, input.path);
  return Object.freeze({
    input: input.schema,
    parse,
    handle: (execution: TExecution, raw: unknown) =>
      input.handle(execution, parse(raw)),
  });
}
