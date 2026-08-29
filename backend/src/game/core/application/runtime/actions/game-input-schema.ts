import { GamePayloadValidationError } from '../../../domain/errors/game-domain.errors';
import {
  cardId as toCardId,
  pawnId as toPawnId,
  playerId as toPlayerId,
  tileId as toTileId,
  type CardId,
  type PawnId,
  type PlayerId,
  type TileId,
} from '../game-identifiers';

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
type InferSchema<TSchema> =
  TSchema extends GameInputSchema<infer TValue> ? TValue : never;

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

  numberEnum<const TValue extends number>(values: readonly TValue[]) {
    return schema<TValue>(
      (candidate, path) => {
        const parsed =
          typeof candidate === 'number' ? candidate : Number(candidate);
        const matched = values.find((value) => value === parsed);
        if (!Number.isFinite(parsed) || matched == null) {
          invalid(path, `valeur attendue parmi ${values.join(', ')}`);
        }
        return matched;
      },
      { type: 'number', enum: [...values] },
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
        const matched =
          typeof candidate === 'string'
            ? values.find((value) => value === candidate)
            : undefined;
        if (matched == null) {
          invalid(path, `valeur attendue parmi ${values.join(', ')}`);
        }
        return matched;
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
        const parsed: Record<string, unknown> = {};
        for (const [key, field] of Object.entries(shape)) {
          const fieldValue = field.parse(source[key], `${path}.${key}`);
          if (fieldValue !== undefined) parsed[key] = fieldValue;
        }
        return parsed as InferShape<TShape>;
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

  union<const TSchemas extends readonly GameInputSchema<unknown>[]>(
    schemas: TSchemas,
  ): GameInputSchema<InferSchema<TSchemas[number]>> {
    return schema(
      (value, path) => {
        for (const candidate of schemas) {
          try {
            return candidate.parse(value, path) as InferSchema<
              TSchemas[number]
            >;
          } catch (error) {
            if (!(error instanceof GamePayloadValidationError)) throw error;
          }
        }
        return invalid(path, 'aucune variante valide');
      },
      { oneOf: schemas.map((candidate) => candidate.describe()) },
    );
  },

  playerId(): GameInputSchema<PlayerId> {
    const input = this.number({ integer: true, min: 1 });
    return taggedMap(input, 'player-id', toPlayerId);
  },

  cardId(): GameInputSchema<CardId> {
    const input = this.string({ min: 1, max: 128 });
    return taggedMap(input, 'card-id', toCardId);
  },

  pawnId(): GameInputSchema<PawnId> {
    const input = this.string({ min: 1, max: 128 });
    return taggedMap(input, 'pawn-id', toPawnId);
  },

  tileId(): GameInputSchema<TileId> {
    const input = this.string({ min: 1, max: 128 });
    return taggedMap(input, 'tile-id', toTileId);
  },
};

function taggedMap<TValue, TMapped>(
  input: GameInputSchema<TValue>,
  format: string,
  map: (value: TValue) => TMapped,
): GameInputSchema<TMapped> {
  return schema((value, path) => map(input.parse(value, path)), {
    ...input.describe(),
    format,
  });
}

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
