import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import type { Logger } from '@nestjs/common';
import { bestEffort } from '../../../../shared/utils/public-api';
import { operationalPolicy } from '../../../../platform/config/public-api';
import {
  ClientUpdatesInvalidArchiveError,
  ClientUpdatesMissingDependencyError,
} from './client-updates-publisher.errors';
import type { ClientUpdatesPathsService } from './client-updates-paths.service';

const execFileAsync = promisify(execFile);

export class ClientUpdatesArchivePublisher {
  constructor(
    private readonly paths: ClientUpdatesPathsService,
    private readonly logger: Logger,
    private readonly writeLandingPage: (targetDir: string) => Promise<void>,
  ) {}

  async applyZip(zipPath: string): Promise<void> {
    await this.assertZipSafe(zipPath);
    const baseTmp = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'lila-client-update-'),
    );
    const stagingDir = path.join(baseTmp, 'staging');
    try {
      await this.extractAndValidate(zipPath, stagingDir);
      const targetDir = this.paths.getTargetDir();
      const targetExists = await this.assertSafeTarget(targetDir);
      const releasesDir = targetExists
        ? await this.prepareReleasesDirectory(targetDir)
        : null;
      if (releasesDir) {
        await this.swapDirectory(stagingDir, targetDir, releasesDir);
      } else {
        await fs.promises.mkdir(path.dirname(targetDir), { recursive: true });
        await fs.promises.rename(stagingDir, targetDir);
      }
      await this.finalizePublication(zipPath, targetDir);
      await this.pruneBackups(releasesDir);
    } finally {
      void bestEffort(
        fs.promises.rm(baseTmp, { recursive: true, force: true }),
        'nettoyage de l’extraction client temporaire',
        this.logger,
      );
    }
  }

  private async extractAndValidate(
    zipPath: string,
    stagingDir: string,
  ): Promise<void> {
    await fs.promises.mkdir(stagingDir, { recursive: true });
    await execFileAsync('unzip', ['-o', zipPath, '-d', stagingDir], {
      timeout: operationalPolicy.maintenanceCommandTimeoutMs,
      maxBuffer: 50 * 1024 * 1024,
    });
    const entries = await fs.promises.readdir(stagingDir, {
      withFileTypes: true,
    });
    if (
      !entries.some(
        (entry) =>
          entry.isFile() && entry.name.toLowerCase().endsWith('.application'),
      )
    ) {
      throw new ClientUpdatesInvalidArchiveError(
        'Archive invalide: manifeste ClickOnce (.application) manquant.',
      );
    }
    if (
      !entries.some(
        (entry) => entry.isDirectory() && entry.name === 'Application Files',
      )
    ) {
      throw new ClientUpdatesInvalidArchiveError(
        'Archive invalide: dossier "Application Files" introuvable.',
      );
    }
  }

  private async prepareReleasesDirectory(targetDir: string): Promise<string> {
    const releasesDir = path.join(
      path.dirname(targetDir),
      'client-win.releases',
    );
    await fs.promises.mkdir(releasesDir, { recursive: true });
    return releasesDir;
  }

  private async swapDirectory(
    stagingDir: string,
    targetDir: string,
    releasesDir: string,
  ): Promise<void> {
    const backupDir = path.join(
      releasesDir,
      `backup.${Date.now()}.${process.pid}`,
    );
    await fs.promises.rename(targetDir, backupDir);
    try {
      await fs.promises.rename(stagingDir, targetDir);
    } catch (error) {
      await fs.promises.rename(backupDir, targetDir);
      throw error;
    }
  }

  private async assertSafeTarget(targetDir: string): Promise<boolean> {
    try {
      const existing = await fs.promises.lstat(targetDir);
      if (existing.isDirectory() && !existing.isSymbolicLink()) return true;
      if (existing.isSymbolicLink()) {
        throw new ClientUpdatesInvalidArchiveError(
          'Publication refusée: le dossier client cible est un lien symbolique.',
        );
      }
      throw new ClientUpdatesInvalidArchiveError(
        'Publication refusée: la cible client existe et n’est pas un dossier.',
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }

  private async finalizePublication(
    zipPath: string,
    targetDir: string,
  ): Promise<void> {
    await this.ensureLegacyAliases(targetDir);
    await fs.promises.copyFile(
      zipPath,
      path.join(targetDir, this.paths.getLatestZipName()),
    );
    await bestEffort(
      this.writeLandingPage(targetDir),
      'écriture de la page client de secours',
      this.logger,
    );
  }

  private async pruneBackups(releasesDir: string | null): Promise<void> {
    if (!releasesDir) return;
    try {
      const entries = await fs.promises.readdir(releasesDir, {
        withFileTypes: true,
      });
      const backups = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => name.startsWith('backup.'))
        .sort()
        .reverse();
      for (const backup of backups.slice(3)) {
        await bestEffort(
          fs.promises.rm(path.join(releasesDir, backup), {
            recursive: true,
            force: true,
          }),
          `suppression du backup client ${backup}`,
          this.logger,
        );
      }
    } catch {
      // Backup pruning is best effort.
    }
  }

  private async assertZipSafe(zipPath: string): Promise<void> {
    await this.assertUnzipAvailable();
    const [{ stdout: names }, { stdout: listing }] = await Promise.all([
      execFileAsync('unzip', ['-Z1', zipPath], {
        timeout: 60_000,
        maxBuffer: 50 * 1024 * 1024,
      }),
      execFileAsync('unzip', ['-Z', '-l', zipPath], {
        timeout: 60_000,
        maxBuffer: 50 * 1024 * 1024,
      }),
    ]);
    assertNoSymlinkArchiveEntries(listing);
    const entries = names
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    assertSafeClientUpdateArchiveEntries(entries);
  }

  private async assertUnzipAvailable(): Promise<void> {
    try {
      await execFileAsync('unzip', ['-v'], { timeout: 10_000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('ENOENT')) {
        throw new ClientUpdatesMissingDependencyError(
          'Dependance manquante: commande "unzip" introuvable (installez le paquet unzip).',
        );
      }
      throw error;
    }
  }

  private async ensureLegacyAliases(targetDir: string): Promise<void> {
    try {
      const legacyPath = path.join(
        targetDir,
        this.paths.getLegacyApplicationName(),
      );
      await bestEffort(
        fs.promises.rm(legacyPath, { force: true }),
        'suppression de l’alias client historique',
        this.logger,
      );
      const entries = await fs.promises.readdir(targetDir, {
        withFileTypes: true,
      });
      const application = entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .find((name) => name.toLowerCase().endsWith('.application'));
      if (application) {
        await fs.promises.copyFile(
          path.join(targetDir, application),
          legacyPath,
        );
      }
    } catch {
      // Best-effort.
    }
  }
}

export function assertSafeClientUpdateArchiveEntries(
  entries: readonly string[],
): void {
  for (const entry of entries) {
    const segments = entry.split('/');
    if (
      entry.startsWith('/') ||
      entry.startsWith('\\') ||
      entry.includes('\\') ||
      /^[A-Za-z]:/.test(entry) ||
      segments.includes('..')
    ) {
      throw new ClientUpdatesInvalidArchiveError(
        `Archive invalide (entree non sure): ${entry}`,
      );
    }
  }
}

export function assertNoSymlinkArchiveEntries(listing: string): void {
  const symbolicLink = listing
    .split(/\r?\n/)
    .map((line) => line.trimStart())
    .find((line) => /^l[rwx-]{9}\s/.test(line));
  if (symbolicLink) {
    throw new ClientUpdatesInvalidArchiveError(
      'Archive invalide (lien symbolique interdit).',
    );
  }
}
