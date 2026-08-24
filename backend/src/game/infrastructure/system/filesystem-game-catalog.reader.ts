import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  GameCatalogReader,
  LoadGameJsonFileParams,
} from '../../application/ports/game-catalog.reader';
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

  loadJsonFile<T>(params: LoadGameJsonFileParams): T {
    const filePath = path.join(
      params.baseDir,
      params.contentDir ?? '',
      params.filename,
    );
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  }

  readTextFile(filePath: string): string {
    return fs.readFileSync(filePath, 'utf8');
  }

  private readEntry(root: string): GameCatalogEntryRecord | null {
    const manifestPath = path.join(root, 'manifest.json');
    try {
      const manifest = JSON.parse(
        fs.readFileSync(manifestPath, 'utf8'),
      ) as GameManifestRecord;
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

function resolveGameRoots(): string[] {
  const configured = String(process.env.GAME_MODULES_ROOT ?? '').trim();
  const baseRoot = configured
    ? path.resolve(configured)
    : path.resolve(process.cwd(), 'src', 'game', 'games');

  const roots: string[] = [];
  walkGameRoots(baseRoot, roots);
  return roots;
}

function walkGameRoots(dir: string, roots: string[]): void {
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  if (entries.some((entry) => entry.isFile() && entry.name === 'manifest.json')) {
    roots.push(dir);
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      walkGameRoots(path.join(dir, entry.name), roots);
    }
  }
}
