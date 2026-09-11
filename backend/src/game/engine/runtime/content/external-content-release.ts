import { createHash } from 'node:crypto';
import path from 'node:path';
import { GameContentValidationError } from '../../../core/domain/errors/game-domain.errors';
import { getProcessEnvironment } from '../../../../platform/config/public-api';
import { decodeContentText, parseContentJson } from './content-parser';
import { readContainedContent } from '../../infrastructure/content/read-contained-content';

type ContentReleaseEntry = {
  file: string;
  sha256: string;
  contentVersion: string;
};

type ContentReleaseManifest = {
  kind: 'lila.content-release';
  schemaVersion: 1;
  releaseId: string;
  games: Record<string, ContentReleaseEntry>;
};

export type ExternalGameContent = {
  source: unknown;
  version: string;
};

export function loadExternalGameContent(
  gameId: string,
  environment: NodeJS.ProcessEnv = getProcessEnvironment(),
): ExternalGameContent | null {
  const configuredRoot = environment.LILA_CONTENT_RELEASE_DIR?.trim();
  if (!configuredRoot) return null;
  const root = path.resolve(configuredRoot);
  const manifest = readManifest(root);
  const entry = Object.hasOwn(manifest.games, gameId)
    ? manifest.games[gameId]
    : undefined;
  if (!entry) return null;
  const raw = decodeContentText(readContainedContent(root, entry.file));
  const actualHash = createHash('sha256').update(raw).digest('hex');
  if (actualHash !== entry.sha256 || entry.contentVersion !== actualHash) {
    throw new GameContentValidationError(
      `Checksum de contenu invalide pour ${gameId}`,
      { gameId, expected: entry.sha256, actual: actualHash },
    );
  }
  try {
    return { source: parseContentJson(raw, gameId), version: actualHash };
  } catch (error) {
    throw new GameContentValidationError(
      `JSON de release invalide pour ${gameId}`,
      { gameId, cause: error instanceof Error ? error.message : String(error) },
    );
  }
}

function readManifest(root: string): ContentReleaseManifest {
  const manifestPath = path.join(root, 'manifest.json');
  let parsed: unknown;
  try {
    parsed = parseContentJson(
      readContainedContent(root, 'manifest.json'),
      'release',
      'manifest.json',
    );
  } catch (error) {
    throw new GameContentValidationError('Manifest de contenu invalide', {
      manifestPath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  if (!isManifest(parsed)) {
    throw new GameContentValidationError(
      'Contrat de release de contenu invalide',
      {
        manifestPath,
      },
    );
  }
  return parsed;
}

function isManifest(value: unknown): value is ContentReleaseManifest {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some(
      (key) => !['kind', 'schemaVersion', 'releaseId', 'games'].includes(key),
    ) ||
    record.kind !== 'lila.content-release' ||
    record.schemaVersion !== 1 ||
    typeof record.releaseId !== 'string' ||
    !record.games ||
    typeof record.games !== 'object' ||
    Array.isArray(record.games)
  ) {
    return false;
  }
  if (
    record.releaseId.length === 0 ||
    record.releaseId.length > 128 ||
    Object.keys(record.games).length > 1_000
  ) {
    return false;
  }
  return Object.entries(record.games).every(([gameId, entry]) => {
    if (!/^[a-z0-9][a-z0-9-]{0,127}$/.test(gameId)) return false;
    if (!entry || typeof entry !== 'object') return false;
    const item = entry as Record<string, unknown>;
    return (
      Object.keys(item).every((key) =>
        ['file', 'sha256', 'contentVersion'].includes(key),
      ) &&
      typeof item.file === 'string' &&
      item.file.length > 0 &&
      item.file.length <= 512 &&
      typeof item.sha256 === 'string' &&
      /^[a-f0-9]{64}$/.test(item.sha256) &&
      item.contentVersion === item.sha256
    );
  });
}
