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
      const releasesDir = await this.prepareReleasesDirectory(targetDir);
      const swapped = releasesDir
        ? await this.tryDirectorySwap(stagingDir, targetDir, releasesDir)
        : false;
      if (!swapped) await this.replaceDirectoryContents(stagingDir, targetDir);
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

  private async prepareReleasesDirectory(
    targetDir: string,
  ): Promise<string | null> {
    const releasesDir = path.join(
      path.dirname(targetDir),
      'client-win.releases',
    );
    try {
      await fs.promises.mkdir(releasesDir, { recursive: true });
      return releasesDir;
    } catch (error) {
      const message =
        (error as NodeJS.ErrnoException)?.message || 'erreur inconnue';
      this.logger.warn(
        `Impossible de preparer le dossier de backups (${releasesDir}). Fallback publication sans swap de repertoire: ${message}`,
      );
      return null;
    }
  }

  private async tryDirectorySwap(
    stagingDir: string,
    targetDir: string,
    releasesDir: string,
  ): Promise<boolean> {
    try {
      const existingTarget = await this.resolveExistingTarget(targetDir);
      if (!existingTarget) return false;
      const backupDir = path.join(releasesDir, `backup.${Date.now()}`);
      await fs.promises.rename(existingTarget, backupDir);
      await fs.promises.rename(stagingDir, targetDir);
      return true;
    } catch {
      return false;
    }
  }

  private async resolveExistingTarget(
    targetDir: string,
  ): Promise<string | null> {
    try {
      const existing = await fs.promises.lstat(targetDir);
      if (existing.isDirectory()) return targetDir;
      if (!existing.isSymbolicLink()) return null;
      let resolved: string | null = null;
      try {
        const realPath = await fs.promises.realpath(targetDir);
        if ((await fs.promises.lstat(realPath)).isDirectory()) {
          resolved = realPath;
        }
      } catch {
        // Ignore broken or invalid symbolic link targets.
      }
      await bestEffort(
        fs.promises.unlink(targetDir),
        'suppression du lien client invalide',
        this.logger,
      );
      return resolved;
    } catch {
      return null;
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
    const { stdout } = await execFileAsync('unzip', ['-Z1', zipPath], {
      timeout: 60_000,
      maxBuffer: 50 * 1024 * 1024,
    });
    const entries = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    for (const entry of entries) {
      if (
        entry.startsWith('/') ||
        entry.startsWith('\\') ||
        entry.includes('..') ||
        entry.includes(':') ||
        entry.includes('\\')
      ) {
        throw new ClientUpdatesInvalidArchiveError(
          `Archive invalide (entree non sure): ${entry}`,
        );
      }
    }
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

  private async replaceDirectoryContents(
    sourceDir: string,
    targetDir: string,
  ): Promise<void> {
    await fs.promises.mkdir(targetDir, { recursive: true });
    const existing = await fs.promises.readdir(targetDir, {
      withFileTypes: true,
    });
    for (const entry of existing) {
      await fs.promises.rm(path.join(targetDir, entry.name), {
        recursive: true,
        force: true,
      });
    }
    await copyRecursive(sourceDir, targetDir);
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

async function copyRecursive(source: string, target: string): Promise<void> {
  const stats = await fs.promises.stat(source);
  if (stats.isDirectory()) {
    await fs.promises.mkdir(target, { recursive: true });
    const entries = await fs.promises.readdir(source, { withFileTypes: true });
    for (const entry of entries) {
      await copyRecursive(
        path.join(source, entry.name),
        path.join(target, entry.name),
      );
    }
    return;
  }
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.copyFile(source, target);
}
