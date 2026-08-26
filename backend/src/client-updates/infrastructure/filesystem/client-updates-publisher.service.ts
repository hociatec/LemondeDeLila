import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { Injectable, Logger } from '@nestjs/common';

import { parseVersion } from '../../../common/utils/public-api';
import { ClientUpdateMeta } from '../../application/models/client-update-meta.record';
import {
  ClientUpdatesInvalidArchiveError,
  ClientUpdatesMissingDependencyError,
} from './client-updates-publisher.errors';
import { ClientUpdatesMetaStoreService } from './client-updates-meta-store.service';
import { ClientUpdatesPathsService } from './client-updates-paths.service';

const execFileAsync = promisify(execFile);

@Injectable()
export class ClientUpdatesPublisherService {
  private readonly logger = new Logger(ClientUpdatesPublisherService.name);

  constructor(
    private readonly paths: ClientUpdatesPathsService,
    private readonly metaStore: ClientUpdatesMetaStoreService,
  ) {}

  resolveClientPublicUrl(latest: ClientUpdateMeta | null): string | null {
    const explicit = (latest?.publicUrl || '').trim();
    if (explicit) {
      return explicit;
    }

    const base = (this.paths.getPublicUrl() || '').trim();
    return base || null;
  }

  resolveClientPublicUrlForOrigin(
    latest: ClientUpdateMeta | null,
    origin: string | null,
  ): string | null {
    const resolved = this.resolveClientPublicUrl(latest);
    if (resolved) {
      if (
        resolved.startsWith('http://') ||
        resolved.startsWith('https://') ||
        resolved.startsWith('ms-appx://')
      ) {
        return resolved;
      }
      if (origin && resolved.startsWith('/')) {
        return `${origin.replace(/\/$/, '')}${resolved}`;
      }
      return resolved;
    }

    if (!origin) {
      return null;
    }
    return `${origin.replace(/\/$/, '')}/updates/client-win/`;
  }

  async getPublishedClickOnceVersionFromDisk(): Promise<string | null> {
    const targetDir = this.paths.getTargetDir();
    const candidates = [
      path.join(targetDir, 'LeMondeDeLila.application'),
      path.join(targetDir, this.paths.getLegacyApplicationName()),
    ];

    for (const file of candidates) {
      try {
        if (!fs.existsSync(file)) continue;
        const raw = await fs.promises.readFile(file, 'utf-8');
        const text = raw.replace(/^\uFEFF/, '');
        const match = text.match(
          /assemblyIdentity[^>]*version="(?<v>[0-9.]+)"/i,
        );
        const version = (match?.groups?.v || '').trim();
        if (!version || parseVersion(version) == null) {
          continue;
        }
        return version;
      } catch {
        // ignore
      }
    }

    return null;
  }

  async writeLandingPage(targetDir: string): Promise<void> {
    const zipExists = fs.existsSync(
      path.join(targetDir, this.paths.getLatestZipName()),
    );
    const entries = await fs.promises.readdir(targetDir, {
      withFileTypes: true,
    });
    const application = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .find((name) => name.toLowerCase().endsWith('.application'));

    const links: Array<{ href: string; label: string; note?: string }> = [];
    if (zipExists) {
      links.push({
        href: this.paths.getLatestZipName(),
        label: 'Telecharger (ZIP)',
        note: 'Version portable (a extraire).',
      });
    }
    if (application) {
      links.push({
        href: application,
        label: 'Installer / Mettre a jour (ClickOnce)',
        note: 'Si vous utilisez ClickOnce.',
      });
    }

    const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Le Monde de Lila - Mise à jour</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; max-width: 760px; margin: 0 auto; }
      h1 { margin: 0 0 8px; }
      .muted { color: #666; }
      .card { border: 1px solid #e5e5e5; border-radius: 12px; padding: 16px; margin-top: 16px; }
      a.btn { display: inline-block; padding: 10px 14px; border-radius: 10px; background: #111; color: #fff; text-decoration: none; }
      a.btn.secondary { background: #2b2b2b; }
      .note { margin-top: 8px; color: #666; font-size: 14px; }
    </style>
  </head>
  <body>
    <h1>Mise à jour du client</h1>
    <div class="muted">Téléchargez la dernière version du client Windows.</div>
    <div class="card">
      ${
        links.length > 0
          ? links
              .map(
                (link, index) =>
                  `<div style="margin-top: ${index === 0 ? 0 : 12}px;">
                     <a class="btn ${index === 0 ? '' : 'secondary'}" href="${link.href}">${link.label}</a>
                     ${link.note ? `<div class="note">${link.note}</div>` : ''}
                   </div>`,
              )
              .join('\n')
          : '<div>Aucun package disponible pour le moment.</div>'
      }
      <div class="note" style="margin-top: 16px;">
        Si l'application vous indique qu'une mise à jour est requise, installez la dernière version puis relancez.
      </div>
    </div>
  </body>
</html>`;

    await fs.promises.writeFile(
      path.join(targetDir, 'index.html'),
      html,
      'utf-8',
    );
  }

  async getMinRequiredVersion(): Promise<string | null> {
    const env = (process.env.CLIENT_MIN_VERSION || '').trim();
    const latest = await this.metaStore.getLatest();
    const forceLatestRaw = (process.env.CLIENT_FORCE_LATEST || '')
      .trim()
      .toLowerCase();
    const forceLatest =
      forceLatestRaw === '1' ||
      forceLatestRaw === 'true' ||
      forceLatestRaw === 'yes' ||
      forceLatestRaw === 'y';

    const metaMin = (latest?.minRequiredVersion || '').trim();
    const publishedClickOnce =
      await this.getPublishedClickOnceVersionFromDisk();
    const clickOncePacked = publishedClickOnce
      ? parseVersion(publishedClickOnce)
      : null;
    const hasClickOnce = clickOncePacked != null;
    const latestAsMin =
      forceLatest && hasClickOnce ? (publishedClickOnce || '').trim() : '';

    const candidates = [env, metaMin, latestAsMin].filter(Boolean);
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0] || null;

    const parsed = candidates
      .map((value) => ({ value, packed: parseVersion(value) }))
      .filter((entry) => entry.packed != null) as Array<{
      value: string;
      packed: number;
    }>;
    if (parsed.length === 0) {
      return env || metaMin || latestAsMin || null;
    }
    parsed.sort((left, right) => right.packed - left.packed);

    if (publishedClickOnce && clickOncePacked != null) {
      if (parsed[0].packed > clickOncePacked) {
        return publishedClickOnce;
      }
      return parsed[0].value;
    }

    return env || null;
  }

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
      if (!swapped) {
        await this.replaceDirectoryContents(stagingDir, targetDir);
      }
      await this.finalizePublication(zipPath, targetDir);
      await this.pruneBackups(releasesDir);
    } finally {
      fs.promises
        .rm(baseTmp, { recursive: true, force: true })
        .catch(() => undefined);
    }
  }

  private async extractAndValidate(
    zipPath: string,
    stagingDir: string,
  ): Promise<void> {
    await fs.promises.mkdir(stagingDir, { recursive: true });
    await execFileAsync('unzip', ['-o', zipPath, '-d', stagingDir], {
      timeout: 10 * 60_000,
      maxBuffer: 50 * 1024 * 1024,
    });
    const entries = await fs.promises.readdir(stagingDir, {
      withFileTypes: true,
    });
    const hasApplication = entries.some(
      (entry) =>
        entry.isFile() && entry.name.toLowerCase().endsWith('.application'),
    );
    if (!hasApplication) {
      throw new ClientUpdatesInvalidArchiveError(
        'Archive invalide: manifeste ClickOnce (.application) manquant.',
      );
    }
    const hasApplicationFiles = entries.some(
      (entry) => entry.isDirectory() && entry.name === 'Application Files',
    );
    if (!hasApplicationFiles) {
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
      if (!existingTarget) {
        return false;
      }
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
      if (existing.isDirectory()) {
        return targetDir;
      }
      if (!existing.isSymbolicLink()) {
        return null;
      }
      let resolved: string | null = null;
      try {
        const realPath = await fs.promises.realpath(targetDir);
        if ((await fs.promises.lstat(realPath)).isDirectory()) {
          resolved = realPath;
        }
      } catch {
        // Ignore broken or invalid symbolic link targets.
      }
      await fs.promises.unlink(targetDir).catch(() => undefined);
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
    await fs.promises
      .copyFile(zipPath, path.join(targetDir, this.paths.getLatestZipName()))
      .catch(() => undefined);
    await this.writeLandingPage(targetDir).catch(() => undefined);
  }

  private async pruneBackups(releasesDir: string | null): Promise<void> {
    if (!releasesDir) {
      return;
    }
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
        fs.promises
          .rm(path.join(releasesDir, backup), { recursive: true, force: true })
          .catch(() => undefined);
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
    srcDir: string,
    dstDir: string,
  ): Promise<void> {
    await fs.promises.mkdir(dstDir, { recursive: true });
    const existing = await fs.promises.readdir(dstDir, { withFileTypes: true });
    for (const entry of existing) {
      await fs.promises.rm(path.join(dstDir, entry.name), {
        recursive: true,
        force: true,
      });
    }

    const copyRecursive = async (from: string, to: string): Promise<void> => {
      const stats = await fs.promises.stat(from);
      if (stats.isDirectory()) {
        await fs.promises.mkdir(to, { recursive: true });
        const entries = await fs.promises.readdir(from, {
          withFileTypes: true,
        });
        for (const entry of entries) {
          await copyRecursive(
            path.join(from, entry.name),
            path.join(to, entry.name),
          );
        }
        return;
      }
      await fs.promises.mkdir(path.dirname(to), { recursive: true });
      await fs.promises.copyFile(from, to);
    };

    await copyRecursive(srcDir, dstDir);
  }

  private async ensureLegacyAliases(targetDir: string): Promise<void> {
    try {
      const legacyPath = path.join(
        targetDir,
        this.paths.getLegacyApplicationName(),
      );
      await fs.promises.rm(legacyPath, { force: true }).catch(() => undefined);
      const entries = await fs.promises.readdir(targetDir, {
        withFileTypes: true,
      });
      const application = entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .find((name) => name.toLowerCase().endsWith('.application'));
      if (!application) {
        return;
      }
      await fs.promises.copyFile(path.join(targetDir, application), legacyPath);
    } catch {
      // Best-effort
    }
  }
}
