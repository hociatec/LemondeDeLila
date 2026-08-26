import { GamePayloadValidationError } from '../../domain/errors/game-domain.errors';

export interface GameInputSchema<T> {
  parse(value: unknown, path?: string): T;
  describe(): Record<string, unknown>;
}

type Shape = Record<string, GameInputSchema<unknown>>;
type InferShape<TShape extends Shape> = {
  [TKey in keyof TShape]: TShape[TKey] extends GameInputSchema<infer TValue>
    ? TValue
    : never;
};

export const gameInput = {
  string(
    options: { min?: number; max?: number } = {},
  ): GameInputSchema<string> {
    return schema(
      (value, path) => {
        if (typeof value !== 'string') invalid(path, 'texte attendu');
        const normalized = value.trim();
        if (options.min != null && normalized.length < options.min) {
          invalid(path, `longueur minimale ${options.min}`);
        }
        if (options.max != null && normalized.length > options.max) {
          invalid(path, `longueur maximale ${options.max}`);
        }
        return normalized;
      },
      { type: 'string', ...options },
    );
  },

  number(options: { min?: number; max?: number; integer?: boolean } = {}) {
    return schema<number>(
      (value, path) => {
        const parsed = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(parsed)) invalid(path, 'nombre attendu');
        if (options.integer && !Number.isInteger(parsed)) {
          invalid(path, 'entier attendu');
        }
        if (options.min != null && parsed < options.min) {
          invalid(path, `minimum ${options.min}`);
        }
        if (options.max != null && parsed > options.max) {
          invalid(path, `maximum ${options.max}`);
        }
        return parsed;
      },
      { type: 'number', ...options },
    );
  },

  boolean(): GameInputSchema<boolean> {
    return schema(
      (value, path) => {
        if (typeof value !== 'boolean') invalid(path, 'booléen attendu');
        return value;
      },
      { type: 'boolean' },
    );
  },

  literal<const TValue extends string | number | boolean>(value: TValue) {
    return schema<TValue>(
      (candidate, path) => {
        if (candidate !== value) invalid(path, `valeur attendue: ${value}`);
        return value;
      },
      { type: 'literal', value },
    );
  },

  enum<const TValue extends string>(values: readonly TValue[]) {
    return schema<TValue>(
      (candidate, path) => {
        if (
          typeof candidate !== 'string' ||
          !values.includes(candidate as TValue)
        ) {
          invalid(path, `valeur attendue parmi ${values.join(', ')}`);
        }
        return candidate as TValue;
      },
      { type: 'enum', values },
    );
  },

  array<TValue>(
    item: GameInputSchema<TValue>,
    options: { min?: number; max?: number } = {},
  ) {
    return schema<TValue[]>(
      (value, path) => {
        if (!Array.isArray(value)) invalid(path, 'liste attendue');
        if (options.min != null && value.length < options.min) {
          invalid(path, `au moins ${options.min} élément(s)`);
        }
        if (options.max != null && value.length > options.max) {
          invalid(path, `au plus ${options.max} élément(s)`);
        }
        return value.map((entry, index) =>
          item.parse(entry, `${path}[${index}]`),
        );
      },
      { type: 'array', items: item.describe(), ...options },
    );
  },

  object<TShape extends Shape>(
    shape: TShape,
  ): GameInputSchema<InferShape<TShape>> {
    return schema(
      (value, path) => {
        if (
          value == null ||
          typeof value !== 'object' ||
          Array.isArray(value)
        ) {
          invalid(path, 'objet attendu');
        }
        const source = value as Record<string, unknown>;
        return Object.fromEntries(
          Object.entries(shape).map(([key, field]) => [
            key,
            field.parse(source[key], `${path}.${key}`),
          ]),
        ) as InferShape<TShape>;
      },
      {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(shape).map(([key, field]) => [key, field.describe()]),
        ),
      },
    );
  },

  optional<TValue>(
    inner: GameInputSchema<TValue>,
  ): GameInputSchema<TValue | undefined> {
    return schema(
      (value, path) =>
        value === undefined ? undefined : inner.parse(value, path),
      { ...inner.describe(), optional: true },
    );
  },

  playerId(): GameInputSchema<number> {
    return this.number({ integer: true, min: 1 });
  },

  cardId(): GameInputSchema<string> {
    return this.string({ min: 1, max: 128 });
  },
};

function schema<T>(
  parse: (value: unknown, path: string) => T,
  description: Record<string, unknown>,
): GameInputSchema<T> {
  return {
    parse: (value, path = 'payload') => parse(value, path),
    describe: () => structuredClone(description),
  };
}

function invalid(path: string, reason: string): never {
  throw new GamePayloadValidationError(`${path}: ${reason}`);
}
