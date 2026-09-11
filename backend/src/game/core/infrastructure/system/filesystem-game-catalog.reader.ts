import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readEnvironment } from '../../../../platform/config/public-api';
import { GameConfigurationError } from '../../domain/errors/game-domain.errors';
import catalogIndex from './generated-game-catalog-index.json';
import type { GameCatalogReader } from '../../application/ports/game-catalog.reader';
import type {
  GameCatalogEntryRecord,
  GameManifestRecord,
} from '../../application/models/game-catalog-entry.model';

const MAX_GAME_MANIFEST_BYTES = 1024 * 1024;
const MAX_GAME_RULES_BYTES = 4 * 1024 * 1024;

@Injectable()
export class FilesystemGameCatalogReader implements GameCatalogReader {
  listEntries(): GameCatalogEntryRecord[] {
    const configured = readEnvironment('GAME_MODULES_ROOT').trim();
    const root = configured
      ? path.resolve(configured)
      : path.resolve(__dirname, '../../../games');
    return readInstalledGameCatalog(root, catalogIndex);
  }

  readTextFile(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf8');
    if (Buffer.byteLength(content, 'utf8') > MAX_GAME_RULES_BYTES) {
      throw new GameConfigurationError('Règles de jeu trop volumineuses');
    }
    return content;
  }
}

/** Reads only packages enumerated by build composition; never discovers folders. */
export function readInstalledGameCatalog(
  gamesRoot: string,
  entries: readonly { code: string; directory: string }[],
): GameCatalogEntryRecord[] {
  return entries.map(({ code, directory }) => {
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(
        directory,
      ) ||
      path.posix.basename(directory) !== code
    )
      throw new GameConfigurationError('Index de catalogue invalide');
    const root = path.resolve(gamesRoot, directory);
    const manifestPath = path.join(root, 'manifest.json');
    try {
      const manifestSource = fs.readFileSync(manifestPath, 'utf8');
      if (Buffer.byteLength(manifestSource, 'utf8') > MAX_GAME_MANIFEST_BYTES) {
        throw new GameConfigurationError(
          `Manifeste de catalogue trop volumineux : ${code}`,
        );
      }
      const parsed: unknown = JSON.parse(manifestSource);
      const manifest = toGameManifest(parsed);
      if (!manifest || manifest.code !== code)
        throw new GameConfigurationError(
          `Manifeste de catalogue invalide : ${code}`,
        );

      const rulesPath = path.join(root, 'rules.md');
      return {
        root,
        manifestPath,
        rulesPath: fs.existsSync(rulesPath) ? rulesPath : undefined,
        manifest,
      };
    } catch (error) {
      if (error instanceof GameConfigurationError) throw error;
      throw new GameConfigurationError(
        `Package de jeu absent ou illisible : ${code}`,
      );
    }
  });
}

function toGameManifest(value: unknown): GameManifestRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  const manifest: GameManifestRecord = {};
  assignString(manifest, value, 'code');
  assignString(manifest, value, 'engine');
  assignString(manifest, value, 'name');
  assignString(manifest, value, 'summary');
  assignNumber(manifest, value, 'minPlayers');
  assignNumber(manifest, value, 'maxPlayers');
  assignBoolean(manifest, value, 'chatEnabled');
  assignBoolean(manifest, value, 'chatSoundsEnabled');
  if (isManifestStatus(value.status)) {
    manifest.status = value.status;
  }
  return manifest;
}

function assignString(
  target: GameManifestRecord,
  source: Record<string, unknown>,
  key: 'code' | 'engine' | 'name' | 'summary',
): void {
  if (typeof source[key] === 'string') {
    target[key] = source[key];
  }
}

function assignNumber(
  target: GameManifestRecord,
  source: Record<string, unknown>,
  key: 'minPlayers' | 'maxPlayers',
): void {
  if (typeof source[key] === 'number' && Number.isFinite(source[key])) {
    target[key] = source[key];
  }
}

function assignBoolean(
  target: GameManifestRecord,
  source: Record<string, unknown>,
  key: 'chatEnabled' | 'chatSoundsEnabled',
): void {
  if (typeof source[key] === 'boolean') {
    target[key] = source[key];
  }
}

function isManifestStatus(
  value: unknown,
): value is NonNullable<GameManifestRecord['status']> {
  return value === 'construction' || value === 'beta' || value === 'finished';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
