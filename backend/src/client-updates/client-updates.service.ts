import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Injectable } from '@nestjs/common';

const execFileAsync = promisify(execFile);

export type ClientUpdateMeta = {
  version: string;
  publishedAt: string;
  message?: string | null;
  publicUrl?: string | null;
};

@Injectable()
export class ClientUpdatesService {
  private readonly updatesDir: string;
  private readonly metaPath: string;
  private readonly legacyApplicationName = 'client-win.application';

  constructor() {
    // Folder served by your reverse-proxy (nginx) as:
    //   https://api.lilas.hociatec.fr/updates/client-win/
    // Configure this path on the Linux server via CLIENT_UPDATES_DIR.
    this.updatesDir =
      process.env.CLIENT_UPDATES_DIR ||
      path.resolve(process.cwd(), 'data', 'client-updates', 'client-win');
    this.metaPath = path.resolve(
      process.cwd(),
      'data',
      'client-updates',
      'latest.json',
    );
  }

  getTargetDir() {
    return this.updatesDir;
  }

  getPublicUrl() {
    return process.env.CLIENT_UPDATES_PUBLIC_URL || null;
  }

  async getLatest(): Promise<ClientUpdateMeta | null> {
    try {
      const raw = await fs.promises.readFile(this.metaPath, 'utf-8');
      return JSON.parse(raw.replace(/^\uFEFF/, '')) as ClientUpdateMeta;
    } catch {
      return null;
    }
  }

  async saveLatest(meta: ClientUpdateMeta) {
    const dir = path.dirname(this.metaPath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(this.metaPath, JSON.stringify(meta, null, 2));
  }

  private async assertZipSafe(zipPath: string) {
    const { stdout } = await execFileAsync('unzip', ['-Z1', zipPath], {
      timeout: 60_000,
      maxBuffer: 50 * 1024 * 1024,
    });
    const entries = stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    for (const entry of entries) {
      if (
        entry.startsWith('/') ||
        entry.startsWith('\\') ||
        entry.includes('..') ||
        entry.includes(':') ||
        entry.includes('\\')
      ) {
        throw new Error(`Archive invalide (entrée non sûre): ${entry}`);
      }
    }
  }

  async applyZip(zipPath: string): Promise<void> {
    await this.assertZipSafe(zipPath);

    const baseTmp = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'lila-client-update-'),
    );
    const stagingDir = path.join(baseTmp, 'staging');
    await fs.promises.mkdir(stagingDir, { recursive: true });

    // Extract to staging
    await execFileAsync('unzip', ['-o', zipPath, '-d', stagingDir], {
      timeout: 10 * 60_000,
      maxBuffer: 50 * 1024 * 1024,
    });

    // Atomic-ish swap
    const targetDir = this.getTargetDir();
    const parent = path.dirname(targetDir);
    const backupDir = path.join(parent, `client-win.backup.${Date.now()}`);
    await fs.promises.mkdir(parent, { recursive: true });

    const targetExists = fs.existsSync(targetDir);
    if (targetExists) {
      await fs.promises.rename(targetDir, backupDir);
    }
    await fs.promises.rename(stagingDir, targetDir);

    await this.ensureLegacyAliases(targetDir);

    // Cleanup backup best-effort
    if (targetExists) {
      fs.promises.rm(backupDir, { recursive: true, force: true }).catch(() => {
        /* ignore */
      });
    }

    fs.promises.rm(baseTmp, { recursive: true, force: true }).catch(() => {
      /* ignore */
    });
  }

  private async ensureLegacyAliases(targetDir: string): Promise<void> {
    try {
      const legacyPath = path.join(targetDir, this.legacyApplicationName);
      if (fs.existsSync(legacyPath)) {
        return;
      }

      const entries = await fs.promises.readdir(targetDir, { withFileTypes: true });
      const application = entries
        .filter((e) => e.isFile())
        .map((e) => e.name)
        .find((name) => name.toLowerCase().endsWith('.application'));

      if (!application) {
        return;
      }

      await fs.promises.copyFile(path.join(targetDir, application), legacyPath);
    } catch {
      // Best-effort: if it fails, updates are still accessible via the real *.application filename.
    }
  }
}
