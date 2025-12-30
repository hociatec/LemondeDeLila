import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Injectable } from '@nestjs/common';
import { parseVersion } from '../common/utils/version.utils';

const execFileAsync = promisify(execFile);

export type ClientUpdateMeta = {
  version: string;
  publishedAt: string;
  message?: string | null;
  publicUrl?: string | null;
  minRequiredVersion?: string | null;
};

@Injectable()
export class ClientUpdatesService {
  private readonly updatesDir: string;
  private readonly metaPath: string;
  private readonly legacyApplicationName = 'client-win.application';
  private readonly latestZipName = 'client-win.zip';
  private latestCache: { at: number; value: ClientUpdateMeta | null } | null =
    null;
  private readonly latestCacheTtlMs = 10_000;

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

  private hasLatestZipOnDisk(): boolean {
    try {
      return fs.existsSync(path.join(this.getTargetDir(), this.latestZipName));
    } catch {
      return false;
    }
  }

  /**
   * Resolves the public "update URL" shown to clients.
   * - If latest.json has an explicit `publicUrl`, it wins (can be .zip/.application/exe/page).
   * - Otherwise, we return `CLIENT_UPDATES_PUBLIC_URL` as-is.
   */
  resolveClientPublicUrl(latest: ClientUpdateMeta | null): string | null {
    const explicit = (latest?.publicUrl || '').trim();
    if (explicit) {
      return explicit;
    }

    const base = (this.getPublicUrl() || '').trim();
    if (!base) return null;

    return base;
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

    if (!origin) return null;
    const base = origin.replace(/\/$/, '');
    return `${base}/updates/client-win/`;
  }

  private async getPublishedClickOnceVersion(): Promise<string | null> {
    // Source of truth: the ClickOnce manifest currently served from updatesDir.
    // This avoids mismatches when latest.json gets out of sync.
    const targetDir = this.getTargetDir();
    const candidates = [
      path.join(targetDir, 'LeMondeDeLila.application'),
      path.join(targetDir, this.legacyApplicationName),
    ];

    for (const file of candidates) {
      try {
        if (!fs.existsSync(file)) continue;
        const raw = await fs.promises.readFile(file, 'utf-8');
        const text = raw.replace(/^\uFEFF/, '');
        const m = text.match(/assemblyIdentity[^>]*version=\"(?<v>[0-9.]+)\"/i);
        const v = (m?.groups?.v || '').trim();
        if (!v) continue;
        // Validate format for our comparator.
        if (parseVersion(v) == null) continue;
        return v;
      } catch {
        // ignore
      }
    }

    return null;
  }

  async writeLandingPage(targetDir: string): Promise<void> {
    const zipExists = fs.existsSync(path.join(targetDir, this.latestZipName));
    const entries = await fs.promises.readdir(targetDir, { withFileTypes: true });
    const application = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .find((name) => name.toLowerCase().endsWith('.application'));

    const links: Array<{ href: string; label: string; note?: string }> = [];
    if (zipExists) {
      links.push({
        href: this.latestZipName,
        label: 'Télécharger (ZIP)',
        note: 'Version portable (à extraire).',
      });
    }
    if (application) {
      links.push({
        href: application,
        label: 'Installer / Mettre à jour (ClickOnce)',
        note: 'Si vous utilisez ClickOnce.',
      });
    }

    const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Le Monde de Lila – Mise à jour</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; max-width: 760px; margin: 0 auto; }
      h1 { margin: 0 0 8px; }
      .muted { color: #666; }
      .card { border: 1px solid #e5e5e5; border-radius: 12px; padding: 16px; margin-top: 16px; }
      a.btn { display: inline-block; padding: 10px 14px; border-radius: 10px; background: #111; color: #fff; text-decoration: none; }
      a.btn.secondary { background: #2b2b2b; }
      .note { margin-top: 8px; color: #666; font-size: 14px; }
      code { background: #f5f5f5; padding: 2px 6px; border-radius: 6px; }
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
                (l, idx) =>
                  `<div style="margin-top: ${idx === 0 ? 0 : 12}px;">
                     <a class="btn ${idx === 0 ? '' : 'secondary'}" href="${l.href}">${l.label}</a>
                     ${l.note ? `<div class="note">${l.note}</div>` : ''}
                   </div>`,
              )
              .join('\n')
          : '<div>Aucun package disponible pour le moment.</div>'
      }
      <div class="note" style="margin-top: 16px;">
        Si l’application vous indique qu’une mise à jour est requise, installez la dernière version puis relancez.
      </div>
    </div>
  </body>
</html>`;

    await fs.promises.writeFile(path.join(targetDir, 'index.html'), html, 'utf-8');
  }

  async getLatest(): Promise<ClientUpdateMeta | null> {
    const cached = this.latestCache;
    if (cached && Date.now() - cached.at < this.latestCacheTtlMs) {
      return cached.value;
    }
    try {
      const raw = await fs.promises.readFile(this.metaPath, 'utf-8');
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as ClientUpdateMeta;
      this.latestCache = { at: Date.now(), value: parsed };
      return parsed;
    } catch {
      this.latestCache = { at: Date.now(), value: null };
      return null;
    }
  }

  async saveLatest(meta: ClientUpdateMeta) {
    const dir = path.dirname(this.metaPath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(this.metaPath, JSON.stringify(meta, null, 2));
    this.latestCache = { at: Date.now(), value: meta };
  }

  /**
   * Returns the minimum required client version, coming from:
   * - env `CLIENT_MIN_VERSION` (emergency override)
   * - latest.json `minRequiredVersion`
   * - env `CLIENT_FORCE_LATEST=1` => ClickOnce manifest version (fallback to latest.json `version`)
   */
  async getMinRequiredVersion(): Promise<string | null> {
    const env = (process.env.CLIENT_MIN_VERSION || '').trim();
    const latest = await this.getLatest();
    const forceLatestRaw = (process.env.CLIENT_FORCE_LATEST || '').trim().toLowerCase();
    const forceLatest =
      forceLatestRaw === '1' ||
      forceLatestRaw === 'true' ||
      forceLatestRaw === 'yes' ||
      forceLatestRaw === 'y';

    const metaMin = (latest?.minRequiredVersion || '').trim();
    const publishedClickOnce = forceLatest ? (await this.getPublishedClickOnceVersion()) : null;
    const latestAsMin = forceLatest ? ((publishedClickOnce || (latest?.version || '')).trim()) : '';

    const candidates = [env, metaMin, latestAsMin].filter((v) => Boolean(v));
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0] || null;

    // Choose the highest valid one (invalids are ignored, except env which still wins as a fallback).
    const parsed = candidates
      .map((v) => ({ v, p: parseVersion(v) }))
      .filter((x) => x.p != null) as Array<{ v: string; p: number }>;
    if (parsed.length === 0) {
      return env || metaMin || latestAsMin || null;
    }
    parsed.sort((a, b) => b.p - a.p);
    return parsed[0].v;

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

    // Keep a stable downloadable artifact for clients (no need to keep the original upload name).
    try {
      const zipDest = path.join(targetDir, this.latestZipName);
      await fs.promises.copyFile(zipPath, zipDest);
    } catch {
      // Best-effort: the extracted folder is still served, but the "client-win.zip" URL won't work.
    }

    // Provide a stable /updates/client-win/ landing page even without nginx directory listing.
    try {
      await this.writeLandingPage(targetDir);
    } catch {
      // Best-effort
    }

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
