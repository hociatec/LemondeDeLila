import { GameContentValidationError } from '../../domain/errors/game-domain.errors';
import type { QuizQuestion } from './quiz-kit';

export const GAME_CONTENT_KIND = 'lila.game-content' as const;

export type IdentifiedGameContent = {
  id: string | number;
};

export type LinkedBoardContent = IdentifiedGameContent & {
  links?: readonly (string | number)[];
};

export type GameContent<TData extends object = Record<string, unknown>> = {
  readonly kind: typeof GAME_CONTENT_KIND;
  readonly gameId: string;
  readonly version: string;
  readonly data: Readonly<TData>;
};

export interface GameContentShape {
  readonly kind: typeof GAME_CONTENT_KIND;
  readonly gameId: string;
  readonly version: string;
  readonly data: Readonly<object>;
}

export type GameContentManifest = {
  readonly gameId: string;
  readonly version: string;
  readonly sections: readonly string[];
};

export type GameContentSchema<TData extends object> = {
  parse(value: unknown, path?: string): TData;
};

/** Shared typed boundary for JSON modules, files and already parsed content. */
export function loadGameContent<TData extends object>(
  gameId: string,
  source: unknown,
  schema: GameContentSchema<TData>,
): GameContent<TData> {
  let candidate = source;
  if (typeof source === 'string') {
    try {
      candidate = JSON.parse(source) as unknown;
    } catch (error) {
      throw new GameContentValidationError(
        `JSON de contenu invalide pour ${gameId}`,
        {
          gameId,
          cause: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }
  try {
    return defineGameContent(gameId, schema.parse(candidate, 'content'));
  } catch (error) {
    if (error instanceof GameContentValidationError) throw error;
    throw new GameContentValidationError(`Contenu invalide pour ${gameId}`, {
      gameId,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

export function defineGameContent<TData extends object>(
  gameId: string,
  data: TData,
  options: { version?: string } = {},
): GameContent<TData> {
  if (!gameId.trim()) {
    throw new GameContentValidationError('Identifiant de contenu vide');
  }
  const version = options.version ?? stableContentVersion(gameId, data);
  if (!version.trim()) {
    throw new GameContentValidationError('Version de contenu vide');
  }
  validateStaticContent(data, `${gameId}.content`);
  return deepFreeze({
    kind: GAME_CONTENT_KIND,
    gameId,
    version,
    data: structuredClone(data),
  });
}

export function contentManifest(
  content: GameContentShape,
): GameContentManifest {
  return deepFreeze({
    gameId: content.gameId,
    version: content.version,
    sections: Object.keys(content.data).sort(),
  });
}

/**
 * Freezes a module-owned catalogue in place so every rule and component shares
 * the same immutable source instead of a mutable export beside a frozen copy.
 */
export function freezeGameContent<TValue>(value: TValue): TValue {
  validateStaticContent(value, 'content');
  return deepFreeze(value);
}

export function cardContent<TCard extends IdentifiedGameContent>(
  cards: readonly TCard[],
): readonly Readonly<TCard>[] {
  assertUniqueContentIds(cards, 'carte');
  return deepFreeze(structuredClone(cards));
}

export function quizContent<TQuestion extends QuizQuestion>(
  questions: readonly TQuestion[],
): readonly Readonly<TQuestion>[] {
  assertUniqueContentIds(questions, 'question');
  for (const question of questions) {
    if (
      question.choices.length < 2 ||
      !Number.isInteger(question.answerIndex) ||
      question.answerIndex < 0 ||
      question.answerIndex >= question.choices.length
    ) {
      throw new GameContentValidationError(
        `Réponse invalide pour la question ${question.id}`,
        { questionId: question.id },
      );
    }
  }
  return deepFreeze(structuredClone(questions));
}

export function boardContent<TTile extends LinkedBoardContent>(
  tiles: readonly TTile[],
): readonly Readonly<TTile>[] {
  assertUniqueContentIds(tiles, 'case');
  const ids = new Set(tiles.map((tile) => contentIdKey(tile.id)));
  for (const tile of tiles) {
    for (const targetId of tile.links ?? []) {
      if (!ids.has(contentIdKey(targetId))) {
        throw new GameContentValidationError(
          `Lien de plateau inconnu: ${tile.id} → ${targetId}`,
          { tileId: tile.id, targetId },
        );
      }
    }
  }
  return deepFreeze(structuredClone(tiles));
}

export function trackContent<TTile extends IdentifiedGameContent>(
  tiles: readonly TTile[],
): readonly Readonly<TTile>[] {
  assertUniqueContentIds(tiles, 'case de piste');
  return deepFreeze(structuredClone(tiles));
}

export function assertUniqueContentIds(
  entries: readonly IdentifiedGameContent[],
  kind: string,
): void {
  const ids = new Set<string>();
  for (const entry of entries) {
    const id = typeof entry.id === 'string' ? entry.id.trim() : entry.id;
    if (id === '') {
      throw new GameContentValidationError(`Identifiant de ${kind} vide`);
    }
    const key = contentIdKey(id);
    if (ids.has(key)) {
      throw new GameContentValidationError(
        `Identifiant de ${kind} dupliqué: ${id}`,
        { id, kind },
      );
    }
    ids.add(key);
  }
}

function contentIdKey(id: string | number): string {
  return `${typeof id}:${String(id)}`;
}

function stableContentVersion(gameId: string, data: object): string {
  return `${gameId}@content:${hashString(stableJson(data))}`;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value != null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function validateStaticContent(
  value: unknown,
  path: string,
  visited = new Set<object>(),
): void {
  if (value == null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new GameContentValidationError(`Nombre invalide dans ${path}`);
    }
    return;
  }
  if (visited.has(value)) return;
  visited.add(value);
  if (value instanceof Map) {
    for (const [key, nested] of value) {
      validateStaticContent(key, `${path}.<key>`, visited);
      validateStaticContent(nested, `${path}.${String(key)}`, visited);
    }
    return;
  }
  if (value instanceof Set) {
    let index = 0;
    for (const nested of value) {
      validateStaticContent(nested, `${path}[${index}]`, visited);
      index += 1;
    }
    return;
  }
  if (Array.isArray(value)) {
    validateIdentifiedCollection(value, path);
    for (const [index, nested] of value.entries()) {
      validateStaticContent(nested, `${path}[${index}]`, visited);
    }
    return;
  }
  const record = value as Record<string, unknown>;
  if ('id' in record && !isContentId(record.id)) {
    throw new GameContentValidationError(`Identifiant invalide dans ${path}`);
  }
  if ('answerIndex' in record) validateQuestion(record, path);
  for (const [key, nested] of Object.entries(record)) {
    validateStaticContent(nested, `${path}.${key}`, visited);
  }
}

function validateIdentifiedCollection(
  entries: readonly unknown[],
  path: string,
): void {
  const identified = entries.filter(
    (entry): entry is Record<string, unknown> =>
      isRecord(entry) && 'id' in entry,
  );
  if (identified.length === 0) return;
  const hasLinks = identified.some((entry) => Array.isArray(entry.links));
  const ids = new Set<string>();
  for (const [index, entry] of identified.entries()) {
    if (!isContentId(entry.id)) {
      throw new GameContentValidationError(
        `Identifiant invalide dans ${path}[${index}]`,
      );
    }
    if (!hasLinks) continue;
    const key =
      path.endsWith('.components') && typeof entry.component === 'string'
        ? `${entry.component}:${contentIdKey(entry.id)}`
        : contentIdKey(entry.id);
    if (ids.has(key)) {
      throw new GameContentValidationError(
        `Identifiant dupliqué dans ${path}: ${String(entry.id)}`,
      );
    }
    ids.add(key);
  }
  for (const entry of identified) {
    if (!Array.isArray(entry.links)) continue;
    for (const targetId of entry.links) {
      if (!isContentId(targetId) || !ids.has(contentIdKey(targetId))) {
        throw new GameContentValidationError(
          `Référence inconnue dans ${path}: ${String(entry.id)} → ${String(targetId)}`,
        );
      }
    }
  }
}

function validateQuestion(
  question: Record<string, unknown>,
  path: string,
): void {
  if (
    !Array.isArray(question.choices) ||
    question.choices.length < 2 ||
    !question.choices.every(
      (choice) => typeof choice === 'string' && choice.trim().length > 0,
    ) ||
    !Number.isInteger(question.answerIndex) ||
    Number(question.answerIndex) < 0 ||
    Number(question.answerIndex) >= question.choices.length
  ) {
    throw new GameContentValidationError(`Question invalide dans ${path}`);
  }
}

function isContentId(value: unknown): value is string | number {
  return (
    (typeof value === 'string' && value.trim().length > 0) ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function deepFreeze<TValue>(value: TValue): TValue {
  if (value == null || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Map) {
    for (const [key, nested] of value) {
      deepFreeze(key);
      deepFreeze(nested);
    }
    if (!Object.isFrozen(value)) {
      disableCollectionMutators(value, ['set', 'delete', 'clear']);
      Object.freeze(value);
    }
    return value;
  }
  if (value instanceof Set) {
    for (const nested of value) deepFreeze(nested);
    if (!Object.isFrozen(value)) {
      disableCollectionMutators(value, ['add', 'delete', 'clear']);
      Object.freeze(value);
    }
    return value;
  }
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.isFrozen(value) ? value : Object.freeze(value);
}

function disableCollectionMutators(
  value: object,
  methodNames: readonly string[],
): void {
  for (const methodName of methodNames) {
    Object.defineProperty(value, methodName, {
      configurable: false,
      enumerable: false,
      writable: false,
      value: () => {
        throw new TypeError('Le contenu statique du jeu est immuable');
      },
    });
  }
}
