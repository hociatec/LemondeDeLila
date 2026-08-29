import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Injectable } from '@nestjs/common';
import { readEnvironment } from '../../../config/public-api';

@Injectable()
export class ClientUpdatesPathsService {
  private readonly updatesDir: string;
  private readonly metaPath: string;
  private readonly uploadsRoot: string;
  private readonly legacyApplicationName = 'client-win.application';
  private readonly latestZipName = 'client-win.zip';

  constructor() {
    const backendRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const legacyDataDir = path.join(backendRoot, 'data', 'client-updates');
    const nodeEnv = readEnvironment('NODE_ENV').trim().toLowerCase();
    const defaultDataDir =
      nodeEnv === 'production'
        ? path.join(
            os.homedir(),
            '.local',
            'share',
            'lemonde-de-lila',
            'client-updates',
          )
        : legacyDataDir;
    const defaultUpdatesDir = path.join(defaultDataDir, 'client-win');

    if (
      nodeEnv === 'production' &&
      !readEnvironment('CLIENT_UPDATES_DIR') &&
      !readEnvironment('CLIENT_UPDATES_META_PATH')
    ) {
      this.bootstrapPersistentStorage(legacyDataDir, defaultDataDir);
    }

    this.updatesDir = readEnvironment('CLIENT_UPDATES_DIR', defaultUpdatesDir);
    this.metaPath =
      readEnvironment('CLIENT_UPDATES_META_PATH') ||
      path.join(defaultDataDir, 'latest.json');
    this.uploadsRoot =
      readEnvironment('CLIENT_UPDATES_UPLOADS_DIR').trim() ||
      path.join(path.dirname(this.updatesDir), 'uploads');
  }

  getTargetDir(): string {
    return this.updatesDir;
  }

  getMetaPath(): string {
    return this.metaPath;
  }

  getUploadsRoot(): string {
    return this.uploadsRoot;
  }

  getPublicUrl(): string | null {
    return readEnvironment('CLIENT_UPDATES_PUBLIC_URL') || null;
  }

  getLegacyApplicationName(): string {
    return this.legacyApplicationName;
  }

  getLatestZipName(): string {
    return this.latestZipName;
  }

  private hasDirectoryEntries(dir: string): boolean {
    try {
      return fs.readdirSync(dir).length > 0;
    } catch {
      return false;
    }
  }

  private bootstrapPersistentStorage(
    legacyDataDir: string,
    persistentDataDir: string,
  ): void {
    if (path.resolve(legacyDataDir) === path.resolve(persistentDataDir)) {
      return;
    }

    try {
      const legacyClientDir = path.join(legacyDataDir, 'client-win');
      const persistentClientDir = path.join(persistentDataDir, 'client-win');
      const legacyMeta = path.join(legacyDataDir, 'latest.json');
      const persistentMeta = path.join(persistentDataDir, 'latest.json');

      if (
        !this.hasDirectoryEntries(persistentClientDir) &&
        this.hasDirectoryEntries(legacyClientDir)
      ) {
        fs.mkdirSync(path.dirname(persistentClientDir), { recursive: true });
        fs.cpSync(legacyClientDir, persistentClientDir, {
          recursive: true,
          force: false,
          errorOnExist: false,
        });
      }

      if (!fs.existsSync(persistentMeta) && fs.existsSync(legacyMeta)) {
        fs.mkdirSync(path.dirname(persistentMeta), { recursive: true });
        fs.copyFileSync(legacyMeta, persistentMeta);
      }
    } catch {
      // Best-effort migration.
    }
  }
}
