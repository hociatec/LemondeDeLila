import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readEnvironment } from '../../../../platform/config/public-api';
import type { GameCatalogReader } from '../../application/ports/game-catalog.reader';
import type {
  GameCatalogEntryRecord,
  GameManifestRecord,
} from '../../application/models/game-catalog-entry.model';

@Injectable()
export class FilesystemGameCatalogReader implements GameCatalogReader {
  listEntries(): GameCatalogEntryRecord[] {
    return resolveGameRoots()
      .map((root) => this.readEntry(root))
      .filter((entry): entry is GameCatalogEntryRecord => entry != null);
  }

  readTextFile(filePath: string): string {
    return fs.readFileSync(filePath, 'utf8');
  }

  private readEntry(root: string): GameCatalogEntryRecord | null {
    const manifestPath = path.join(root, 'manifest.json');
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const manifest = toGameManifest(parsed);
      if (!manifest) {
        return null;
      }
      const code = String(manifest.code ?? '').trim();
      if (!code) {
        return null;
      }

      const rulesPath = path.join(root, 'rules.md');
      return {
        root,
        manifestPath,
        rulesPath: fs.existsSync(rulesPath) ? rulesPath : undefined,
        manifest,
      };
    } catch {
      return null;
    }
  }
}

function toGameManifest(value: unknown): GameManifestRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  const manifest: GameManifestRecord = {};
  assignString(manifest, value, 'code');
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
  key: 'code' | 'name' | 'summary',
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

function resolveGameRoots(): string[] {
  const configured = readEnvironment('GAME_MODULES_ROOT').trim();
  const baseRoot = configured
    ? path.resolve(configured)
    : path.resolve(process.cwd(), 'src', 'game', 'games');

  const roots: string[] = [];
  walkGameRoots(baseRoot, roots);
  return roots;
}

function walkGameRoots(dir: string, roots: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  if (
    entries.some((entry) => entry.isFile() && entry.name === 'manifest.json')
  ) {
    roots.push(dir);
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      walkGameRoots(path.join(dir, entry.name), roots);
    }
  }
}
