import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { GameContentValidationError } from '../../../core/domain/errors/game-domain.errors';

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

let cachedRoot = '';
let cachedManifest: ContentReleaseManifest | null = null;

export function loadExternalGameContent(
  gameId: string,
  environment: NodeJS.ProcessEnv = process.env,
): ExternalGameContent | null {
  const configuredRoot = environment.LILA_CONTENT_RELEASE_DIR?.trim();
  if (!configuredRoot) return null;
  const root = path.resolve(configuredRoot);
  const manifest = readManifest(root);
  const entry = manifest.games[gameId];
  if (!entry) return null;
  const payloadPath = resolvePayloadPath(root, entry.file);
  const raw = readFile(payloadPath, gameId);
  const actualHash = createHash('sha256').update(raw).digest('hex');
  if (actualHash !== entry.sha256 || entry.contentVersion !== actualHash) {
    throw new GameContentValidationError(
      `Checksum de contenu invalide pour ${gameId}`,
      { gameId, expected: entry.sha256, actual: actualHash },
    );
  }
  try {
    return { source: JSON.parse(raw) as unknown, version: actualHash };
  } catch (error) {
    throw new GameContentValidationError(
      `JSON de release invalide pour ${gameId}`,
      { gameId, cause: error instanceof Error ? error.message : String(error) },
    );
  }
}

export function clearExternalContentReleaseCache(): void {
  cachedRoot = '';
  cachedManifest = null;
}

function readManifest(root: string): ContentReleaseManifest {
  if (root === cachedRoot && cachedManifest) return cachedManifest;
  const manifestPath = path.join(root, 'manifest.json');
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFile(manifestPath, 'release')) as unknown;
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
  cachedRoot = root;
  cachedManifest = parsed;
  return parsed;
}

function resolvePayloadPath(root: string, relative: string): string {
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new GameContentValidationError('Chemin de contenu hors release', {
      relative,
    });
  }
  return resolved;
}

function readFile(filePath: string, gameId: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  } catch (error) {
    throw new GameContentValidationError(
      `Fichier de contenu illisible pour ${gameId}`,
      {
        filePath,
        cause: error instanceof Error ? error.message : String(error),
      },
    );
  }
}

function isManifest(value: unknown): value is ContentReleaseManifest {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (
    record.kind !== 'lila.content-release' ||
    record.schemaVersion !== 1 ||
    typeof record.releaseId !== 'string' ||
    !record.games ||
    typeof record.games !== 'object'
  ) {
    return false;
  }
  return Object.values(record.games).every((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const item = entry as Record<string, unknown>;
    return (
      typeof item.file === 'string' &&
      typeof item.sha256 === 'string' &&
      /^[a-f0-9]{64}$/.test(item.sha256) &&
      item.contentVersion === item.sha256
    );
  });
}
