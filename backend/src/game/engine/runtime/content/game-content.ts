import {
  assertStaticObject,
  validateStaticQuestion,
} from './static-content-object-validation';
import {
  atAuthoringPath,
  authoringPathOf,
  withAuthoringPath,
} from '../contracts/authoring-origin';
import { authoringProperty } from '../contracts/authoring-diagnostics';
import { stableContentVersion } from './content-version';
import { deepFreeze, cloneStaticContent } from './content-immutability';
import { GameContentValidationError } from '../../../core/domain/errors/game-domain.errors';
import type { QuizQuestion } from './quiz-content-contract';
import { loadExternalGameContent } from './external-content-release';
import { parseContentJson } from './content-parser';
import { AuthoringError } from '../contracts/authoring-error';

export const GAME_CONTENT_KIND = 'lila.game-content' as const;

export type IdentifiedGameContent = {
  id: string | number;
};

export type LinkedBoardContent = IdentifiedGameContent & {
  links?: readonly (string | number)[];
};

/** Explicit compatibility for a content-only change that leaves saved state valid. */
export type ContentSnapshotMigration = {
  readonly fromVersion: string;
  readonly toVersion: string;
};

export type GameContent<TData extends object = Record<string, unknown>> = {
  readonly kind: typeof GAME_CONTENT_KIND;
  readonly gameId: string;
  readonly version: string;
  readonly formatVersion: number;
  readonly data: Readonly<TData>;
  readonly snapshotMigrations?: readonly ContentSnapshotMigration[];
};

export interface GameContentShape {
  readonly kind: typeof GAME_CONTENT_KIND;
  readonly gameId: string;
  readonly version: string;
  readonly formatVersion?: number;
  readonly data: Readonly<object>;
  readonly snapshotMigrations?: readonly ContentSnapshotMigration[];
}

export type GameContentManifest = {
  readonly gameId: string;
  readonly version: string;
  readonly formatVersion: number;
  readonly sections: readonly string[];
};

export type GameContentSchema<TData extends object> = {
  parse(value: unknown, path?: string): TData;
};

type GameContentOptions = {
  externalContent?: boolean;
  version?: string;
  formatVersion?: number;
  snapshotMigrations?: readonly ContentSnapshotMigration[];
};

/** One authoring boundary for embedded objects, decoded assets and releases. */
export function defineGameContent<TData extends object>(
  gameId: string,
  source: unknown,
  options: GameContentOptions & { schema: GameContentSchema<TData> },
): GameContent<TData>;
export function defineGameContent<TData extends object>(
  gameId: string,
  source: TData,
  options?: GameContentOptions,
): GameContent<TData>;
export function defineGameContent<TData extends object>(
  gameId: string,
  source: unknown,
  options: GameContentOptions & { schema?: GameContentSchema<TData> } = {},
): GameContent<TData> {
  const external =
    options.externalContent === false ? null : loadExternalGameContent(gameId);
  let candidate = external?.source ?? source;
  if (typeof candidate === 'string') {
    candidate = parseContentJson(candidate, gameId);
  }
  try {
    const data = options.schema
      ? options.schema.parse(candidate, 'content')
      : candidate;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new GameContentValidationError(`Contenu invalide pour ${gameId}`);
    }
    return createGameContent(gameId, data as TData, {
      ...options,
      ...(external
        ? { version: external.version, snapshotMigrations: [] }
        : {}),
    });
  } catch (error) {
    if (error instanceof AuthoringError) throw error;
    if (error instanceof GameContentValidationError) throw error;
    throw new GameContentValidationError(`Contenu invalide pour ${gameId}`, {
      gameId,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

function createGameContent<TData extends object>(
  gameId: string,
  data: TData,
  options: GameContentOptions,
): GameContent<TData> {
  if (!gameId.trim()) {
    throw new GameContentValidationError('Identifiant de contenu vide');
  }
  validateStaticContent(data, `${gameId}.content`);
  const formatVersion = options.formatVersion ?? 1;
  if (!Number.isSafeInteger(formatVersion) || formatVersion < 1) {
    throw new GameContentValidationError(
      'Version de format de contenu invalide',
    );
  }
  const sourceVersion = options.version ?? stableContentVersion(gameId, data);
  if (!sourceVersion.trim()) {
    throw new GameContentValidationError('Version de contenu vide');
  }
  const version =
    formatVersion === 1
      ? sourceVersion
      : `${sourceVersion}@format:${formatVersion}`;
  const migrations = options.snapshotMigrations ?? [];
  if (
    migrations.length > 64 ||
    migrations.some(
      (migration) =>
        typeof migration.fromVersion !== 'string' ||
        !migration.fromVersion.trim() ||
        typeof migration.toVersion !== 'string' ||
        !migration.toVersion.trim() ||
        migration.fromVersion === migration.toVersion,
    )
  )
    throw new GameContentValidationError(
      'Migration de version de contenu invalide',
    );
  return deepFreeze({
    kind: GAME_CONTENT_KIND,
    gameId,
    version,
    formatVersion,
    data: cloneContent(data),
    ...(migrations.length
      ? { snapshotMigrations: cloneContent(migrations) }
      : {}),
  });
}

export function contentManifest(
  content: GameContentShape,
): GameContentManifest {
  return deepFreeze({
    gameId: content.gameId,
    version: content.version,
    formatVersion: content.formatVersion ?? 1,
    sections: Object.keys(content.data).sort(),
  });
}

/**
 * Freezes mutable records in place. Retain the returned value: collections and
 * already sealed records require isolated replacements to prevent mutation.
 */
export function freezeGameContent<TValue>(value: TValue): TValue {
  validateStaticContent(value, 'content');
  return deepFreeze(value);
}

export function cardContent<TCard extends IdentifiedGameContent>(
  cards: readonly TCard[],
): readonly Readonly<TCard>[] {
  assertUniqueContentIds(cards, 'carte');
  return deepFreeze(cloneContent(cards));
}

export function quizContent<TQuestion extends QuizQuestion>(
  questions: readonly TQuestion[],
): readonly Readonly<TQuestion>[] {
  if (questions.length > 10_000) {
    throw new GameContentValidationError('Trop de questions dans le contenu');
  }
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
  return deepFreeze(cloneContent(questions));
}

export function boardContent<TTile extends LinkedBoardContent>(
  tiles: readonly TTile[],
): readonly Readonly<TTile>[] {
  if (tiles.length > 20_000) {
    throw new GameContentValidationError('Trop de cases dans le contenu');
  }
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
  return deepFreeze(cloneContent(tiles));
}

export function trackContent<TTile extends IdentifiedGameContent>(
  tiles: readonly TTile[],
): readonly Readonly<TTile>[] {
  assertUniqueContentIds(tiles, 'case de piste');
  return deepFreeze(cloneContent(tiles));
}

export function assertUniqueContentIds(
  entries: readonly IdentifiedGameContent[],
  kind: string,
): void {
  if (entries.length > 20_000) {
    throw new GameContentValidationError(
      `Trop d'éléments dans le contenu ${kind}`,
    );
  }
  const ids = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    atAuthoringPath(`[${index}].id`, () => {
      const id = typeof entry.id === 'string' ? entry.id.trim() : entry.id;
      if (
        id === '' ||
        (typeof id === 'string' && id.length > 128) ||
        (typeof id === 'number' && !Number.isSafeInteger(id))
      ) {
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
    });
  }
}

function contentIdKey(id: string | number): string {
  return `${typeof id}:${String(id)}`;
}

export function validateStaticContent(
  value: unknown,
  path: string,
  visited = new Set<object>(),
): void {
  try {
    validateStaticContentValue(value, path, visited);
  } catch (error) {
    if (error instanceof Error && authoringPathOf(error) === undefined)
      withAuthoringPath(error, path);
    throw error;
  }
}

function validateStaticContentValue(
  value: unknown,
  path: string,
  visited: Set<object>,
): void {
  if (value == null || typeof value !== 'object') {
    if (['function', 'symbol', 'bigint'].includes(typeof value)) {
      throw new GameContentValidationError(`Valeur non statique dans ${path}`);
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new GameContentValidationError(`Nombre invalide dans ${path}`);
    }
    return;
  }
  if (visited.has(value) || visited.size >= 128) {
    throw new GameContentValidationError(
      `Contenu cyclique ou trop profond dans ${path}`,
    );
  }
  visited.add(value);
  if (value instanceof Map) {
    for (const [key, nested] of value) {
      validateStaticContent(key, `${path}.<key>`, visited);
      validateStaticContent(nested, `${path}.${String(key)}`, visited);
    }
    visited.delete(value);
    return;
  }
  if (value instanceof Set) {
    let index = 0;
    for (const nested of value) {
      validateStaticContent(nested, `${path}[${index}]`, visited);
      index += 1;
    }
    visited.delete(value);
    return;
  }
  if (Array.isArray(value)) {
    validateIdentifiedCollection(value, path);
    for (const [index, nested] of value.entries()) {
      validateStaticContent(nested, `${path}[${index}]`, visited);
    }
    visited.delete(value);
    return;
  }
  assertStaticObject(value, path);
  const record = value as Record<string, unknown>;
  if ('id' in record && !isContentId(record.id)) {
    throw withAuthoringPath(
      new GameContentValidationError(`Identifiant invalide dans ${path}`),
      `${path}.id`,
    );
  }
  if ('answerIndex' in record) validateStaticQuestion(record, path);
  for (const [key, nested] of Object.entries(record)) {
    validateStaticContent(nested, authoringProperty(path, key), visited);
  }
  visited.delete(value);
}

function validateIdentifiedCollection(
  entries: readonly unknown[],
  path: string,
): void {
  const identified = entries.flatMap((entry, index) =>
    isRecord(entry) && 'id' in entry ? [{ entry, index }] : [],
  );
  if (identified.length === 0) return;
  const hasLinks = identified.some(({ entry }) => Array.isArray(entry.links));
  const ids = new Set<string>();
  for (const { index, entry } of identified) {
    if (!isContentId(entry.id)) {
      throw withAuthoringPath(
        new GameContentValidationError(
          `Identifiant invalide dans ${path}[${index}]`,
        ),
        `${path}[${index}].id`,
      );
    }
    if (!hasLinks) continue;
    const key =
      path.endsWith('.components') && typeof entry.component === 'string'
        ? `${entry.component}:${contentIdKey(entry.id)}`
        : contentIdKey(entry.id);
    if (ids.has(key)) {
      throw withAuthoringPath(
        new GameContentValidationError(
          `Identifiant dupliqué dans ${path}: ${String(entry.id)}`,
        ),
        `${path}[${index}].id`,
      );
    }
    ids.add(key);
  }
  for (const { index, entry } of identified) {
    if (!Array.isArray(entry.links)) continue;
    for (const [linkIndex, targetId] of entry.links.entries()) {
      if (!isContentId(targetId) || !ids.has(contentIdKey(targetId))) {
        throw withAuthoringPath(
          new GameContentValidationError(
            `Référence inconnue dans ${path}: ${String(entry.id)} → ${String(targetId)}`,
          ),
          `${path}[${index}].links[${linkIndex}]`,
        );
      }
    }
  }
}

function isContentId(value: unknown): value is string | number {
  return (
    (typeof value === 'string' && value.trim().length > 0) ||
    (typeof value === 'number' && Number.isSafeInteger(value))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function cloneContent<T>(value: T): T {
  validateStaticContent(value, 'content');
  try {
    return cloneStaticContent(value);
  } catch (error) {
    throw new GameContentValidationError('Contenu non clonable', {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}
