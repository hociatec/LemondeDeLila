import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import {
  parseVersion,
  writeFileAtomic,
} from '../../../../shared/utils/public-api';
import {
  readEnvironmentBoolean,
  readEnvironment,
} from '../../../../platform/config/public-api';
import { ClientUpdateMeta } from '../../application/contracts/client-update-meta.record';
import { ClientUpdatesMetaStoreService } from './client-updates-meta-store.service';
import { ClientUpdatesPathsService } from './client-updates-paths.service';
import { ClientUpdatesArchivePublisher } from './client-updates-archive-publisher';

@Injectable()
export class ClientUpdatesPublisherService {
  private readonly logger = new Logger(ClientUpdatesPublisherService.name);
  private readonly archivePublisher: ClientUpdatesArchivePublisher;

  constructor(
    private readonly paths: ClientUpdatesPathsService,
    private readonly metaStore: ClientUpdatesMetaStoreService,
  ) {
    this.archivePublisher = new ClientUpdatesArchivePublisher(
      paths,
      this.logger,
      (targetDir) => this.writeLandingPage(targetDir),
    );
  }

  resolveClientPublicUrl(latest: ClientUpdateMeta | null): string | null {
    const explicit = (latest?.publicUrl || '').trim();
    if (explicit) return explicit;
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
    return origin ? `${origin.replace(/\/$/, '')}/updates/client-win/` : null;
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
        const match = raw
          .replace(/^\uFEFF/, '')
          .match(/assemblyIdentity[^>]*version="(?<v>[0-9.]+)"/i);
        const version = (match?.groups?.v || '').trim();
        if (version && parseVersion(version) != null) return version;
      } catch {
        // Continue with the next known manifest name.
      }
    }
    return null;
  }

  async writeLandingPage(targetDir: string): Promise<void> {
    const links = await this.resolveDownloadLinks(targetDir);
    const linkMarkup =
      links.length > 0
        ? links
            .map(
              (link, index) =>
                `<div style="margin-top: ${index === 0 ? 0 : 12}px;"><a class="btn ${index === 0 ? '' : 'secondary'}" href="${link.href}">${link.label}</a>${link.note ? `<div class="note">${link.note}</div>` : ''}</div>`,
            )
            .join('\n')
        : '<div>Aucun package disponible pour le moment.</div>';
    const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Le Monde de Lila - Mise à jour</title><style>
body { font-family: system-ui, sans-serif; padding: 24px; max-width: 760px; margin: 0 auto; }
h1 { margin: 0 0 8px; } .muted,.note { color: #666; } .note { margin-top: 8px; font-size: 14px; }
.card { border: 1px solid #e5e5e5; border-radius: 12px; padding: 16px; margin-top: 16px; }
a.btn { display: inline-block; padding: 10px 14px; border-radius: 10px; background: #111; color: #fff; text-decoration: none; }
a.btn.secondary { background: #2b2b2b; }</style></head><body>
<h1>Mise à jour du client</h1><div class="muted">Téléchargez la dernière version du client Windows.</div>
<div class="card">${linkMarkup}<div class="note" style="margin-top: 16px;">Si l'application vous indique qu'une mise à jour est requise, installez la dernière version puis relancez.</div></div>
</body></html>`;
    await writeFileAtomic(path.join(targetDir, 'index.html'), html);
  }

  async getMinRequiredVersion(): Promise<string | null> {
    const env = readEnvironment('CLIENT_MIN_VERSION').trim();
    const latest = await this.metaStore.getLatest();
    const forceLatest = readEnvironmentBoolean('CLIENT_FORCE_LATEST', false);
    const published = await this.getPublishedClickOnceVersionFromDisk();
    const publishedPacked = published ? parseVersion(published) : null;
    const latestAsMin = forceLatest && publishedPacked != null ? published : '';
    const candidates = [
      env,
      (latest?.minRequiredVersion || '').trim(),
      latestAsMin,
    ].filter((value): value is string => Boolean(value));
    if (candidates.length === 0) return null;
    const parsed = candidates
      .map((value) => ({ value, packed: parseVersion(value) }))
      .filter(
        (entry): entry is { value: string; packed: number } =>
          entry.packed != null,
      )
      .sort((left, right) => right.packed - left.packed);
    if (parsed.length === 0) return env || candidates[0] || null;
    if (published && publishedPacked != null) {
      return parsed[0].packed > publishedPacked ? published : parsed[0].value;
    }
    return env || null;
  }

  applyZip(zipPath: string): Promise<void> {
    return this.archivePublisher.applyZip(zipPath);
  }

  private async resolveDownloadLinks(
    targetDir: string,
  ): Promise<Array<{ href: string; label: string; note?: string }>> {
    const links: Array<{ href: string; label: string; note?: string }> = [];
    if (fs.existsSync(path.join(targetDir, this.paths.getLatestZipName()))) {
      links.push({
        href: this.paths.getLatestZipName(),
        label: 'Telecharger (ZIP)',
        note: 'Version portable (a extraire).',
      });
    }
    const entries = await fs.promises.readdir(targetDir, {
      withFileTypes: true,
    });
    const application = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .find((name) => name.toLowerCase().endsWith('.application'));
    if (application) {
      links.push({
        href: application,
        label: 'Installer / Mettre a jour (ClickOnce)',
        note: 'Si vous utilisez ClickOnce.',
      });
    }
    return links;
  }
}
