import { GamePayloadValidationError } from '../../../core/domain/errors/game-domain.errors';
import {
  parseStrictInteger,
  parseStrictNumber,
} from '../../../../shared/utils/public-api';
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

/** Non-generic schema surface retained by existential runtime registries. */
export type GameInputDescriptor = Pick<GameInputSchema<unknown>, 'describe'>;

type Shape = Record<string, GameInputSchema<unknown>>;
type InferShape<TShape extends Shape> = {
  [TKey in keyof TShape]: TShape[TKey] extends GameInputSchema<infer TValue>
    ? TValue
    : never;
};
type InferSchema<TSchema> =
  TSchema extends GameInputSchema<infer TValue> ? TValue : never;

export const gameInput = {
  label<TValue>(
    label: string,
    input: GameInputSchema<TValue>,
  ): GameInputSchema<TValue> {
    input = captureSchema(input);
    return schema((value, path) => input.parse(value, path), {
      ...input.describe(),
      label: label.trim(),
    });
  },

  string(
    options: { min?: number; max?: number; trim?: boolean } = {},
  ): GameInputSchema<string> {
    options = { ...options };
    if (
      options.min !== undefined &&
      (!Number.isSafeInteger(options.min) || options.min < 0)
    ) {
      throw new Error('Invalid string schema minimum');
    }
    if (
      options.max !== undefined &&
      (!Number.isSafeInteger(options.max) ||
        options.max < 0 ||
        options.max > 65_536)
    ) {
      throw new Error('Invalid string schema maximum');
    }
    return schema(
      (value, path) => {
        if (typeof value !== 'string') invalid(path, 'texte attendu');
        const normalized = options.trim === false ? value : value.trim();
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

  number(
    options: {
      min?: number;
      max?: number;
      integer?: boolean;
      coerce?: boolean;
    } = {},
  ) {
    options = { ...options };
    if (
      (options.min !== undefined && !Number.isFinite(options.min)) ||
      (options.max !== undefined && !Number.isFinite(options.max)) ||
      (options.min !== undefined &&
        options.max !== undefined &&
        options.min > options.max)
    ) {
      throw new Error('Invalid number schema bounds');
    }
    return schema<number>(
      (value, path) => {
        if (options.coerce === false && typeof value !== 'number') {
          invalid(path, 'nombre JSON attendu');
        }
        const parsed = parseNumber(value, path, options.integer);
        if (options.integer && !Number.isSafeInteger(parsed)) {
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
    values = [...values];
    return schema<TValue>(
      (candidate, path) => {
        const parsed = parseNumber(candidate, path);
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

  literal<const TValue extends string | number | boolean | null>(
    value: TValue,
  ) {
    return schema<TValue>(
      (candidate, path) => {
        if (candidate !== value) invalid(path, `valeur attendue: ${value}`);
        return value;
      },
      { type: 'literal', value },
    );
  },

  enum<const TValue extends string>(values: readonly TValue[]) {
    values = [...values];
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
    item = captureSchema(item);
    options = { ...options };
    const max = options.max ?? 10_000;
    if (
      !Number.isSafeInteger(max) ||
      max < 0 ||
      (options.min !== undefined &&
        (!Number.isSafeInteger(options.min) ||
          options.min < 0 ||
          options.min > max))
    ) {
      throw new Error('Invalid array schema bounds');
    }
    options.max = max;
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
    options: { unknownKeys?: 'strip' | 'reject' } = {},
  ): GameInputSchema<InferShape<TShape>> {
    const rejectUnknown = options.unknownKeys === 'reject';
    const fields = Object.entries(shape).map(
      ([key, field]) => [key, captureSchema(field)] as const,
    );
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
        if (rejectUnknown) {
          const allowed = new Set(fields.map(([key]) => key));
          for (const key of Object.keys(source)) {
            if (!allowed.has(key)) invalid(`${path}.${key}`, 'champ inconnu');
          }
        }
        const parsed: Record<string, unknown> = {};
        for (const [key, field] of fields) {
          const fieldValue = field.parse(source[key], `${path}.${key}`);
          if (fieldValue === undefined) continue;
          if (key === '__proto__') {
            Object.defineProperty(parsed, key, {
              value: fieldValue,
              enumerable: true,
              writable: true,
              configurable: true,
            });
          } else parsed[key] = fieldValue;
        }
        return parsed as InferShape<TShape>;
      },
      {
        type: 'object',
        ...(rejectUnknown ? { additionalProperties: false } : {}),
        properties: Object.fromEntries(
          fields.map(([key, field]) => [key, field.describe()]),
        ),
      },
    );
  },

  optional<TValue>(
    inner: GameInputSchema<TValue>,
  ): GameInputSchema<TValue | undefined> {
    inner = captureSchema(inner);
    return schema(
      (value, path) =>
        value === undefined ? undefined : inner.parse(value, path),
      { ...inner.describe(), optional: true },
    );
  },

  union<const TSchemas extends readonly GameInputSchema<unknown>[]>(
    schemas: TSchemas,
  ): GameInputSchema<InferSchema<TSchemas[number]>> {
    const candidates = schemas.map(captureSchema);
    return schema(
      (value, path) => {
        for (const candidate of candidates) {
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
      { oneOf: candidates.map((candidate) => candidate.describe()) },
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
  input = captureSchema(input);
  return schema((value, path) => map(input.parse(value, path)), {
    ...input.describe(),
    format,
  });
}

function schema<T>(
  parse: (value: unknown, path: string) => T,
  description: Record<string, unknown>,
): GameInputSchema<T> {
  const descriptor = structuredClone(description);
  return Object.freeze({
    parse: (value: unknown, path = 'payload') => parse(value, path),
    describe: () => structuredClone(descriptor),
  });
}

export function captureSchema<T>(
  input: GameInputSchema<T>,
): GameInputSchema<T> {
  return schema(input.parse.bind(input), input.describe());
}

function invalid(path: string, reason: string): never {
  throw new GamePayloadValidationError(`${path}: ${reason}`);
}

function parseNumber(value: unknown, path: string, integer = false): number {
  const parsed = integer ? parseStrictInteger(value) : parseStrictNumber(value);
  if (parsed === null) invalid(path, 'nombre attendu');
  return parsed;
}
