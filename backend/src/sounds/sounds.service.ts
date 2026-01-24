import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  SOUND_KEYS,
  SoundKey,
  SoundManifest,
  SoundManifestEntry,
  TableAmbienceDefinition,
  TableAmbienceDefinitionsFile,
  TableAmbienceSoundKey,
} from './sounds.types';
import { NotificationService } from '../notification/services/notification.service';

@Injectable()
export class SoundsService {
  constructor(private readonly notifications: NotificationService) {}

  private dataRoot() {
    return path.resolve(process.cwd(), 'data', 'sounds');
  }

  private async removeUnusedFilesForSoundId(
    soundId: SoundKey,
    keepSha256: string,
  ): Promise<number> {
    const soundDir = path.join(this.dataRoot(), soundId);
    let deleted = 0;
    try {
      const files = await fs.promises.readdir(soundDir);
      for (const file of files) {
        if (!file.toLowerCase().endsWith('.mp3')) continue;
        if (file === `${keepSha256}.mp3`) continue;
        try {
          await fs.promises.rm(path.join(soundDir, file), { force: true });
          deleted++;
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
    return deleted;
  }

  private manifestPath() {
    return path.join(this.dataRoot(), 'manifest.json');
  }

  private tableAmbiencesPath() {
    return path.join(this.dataRoot(), 'table-ambiences.json');
  }

  private normalizeSoundKey(input: string): SoundKey {
    const raw = (input || '').trim();
    const found = SOUND_KEYS.find((k) => k.toLowerCase() === raw.toLowerCase());
    if (!found) {
      throw new BadRequestException(`soundId invalide: ${raw}`);
    }
    return found;
  }

  private normalizeTableAmbienceKey(input: string): TableAmbienceSoundKey {
    const soundId = this.normalizeSoundKey(input);
    if (!/^TableAmbience\d+$/i.test(soundId)) {
      throw new BadRequestException(`Ambiance de table invalide: ${soundId}`);
    }
    return soundId as TableAmbienceSoundKey;
  }

  private async readManifest(): Promise<SoundManifest> {
    const file = this.manifestPath();
    try {
      const raw = await fs.promises.readFile(file, 'utf-8');
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as SoundManifest;
      if (!parsed?.sounds || typeof parsed?.sounds !== 'object') {
        throw new Error('manifest invalide');
      }
      return parsed;
    } catch {
      return { updatedAt: new Date().toISOString(), sounds: {} };
    }
  }

  private async writeManifest(next: SoundManifest): Promise<void> {
    const root = this.dataRoot();
    await fs.promises.mkdir(root, { recursive: true });
    await fs.promises.writeFile(
      this.manifestPath(),
      JSON.stringify(next, null, 2),
      'utf-8',
    );
  }

  private async readTableAmbiences(): Promise<TableAmbienceDefinitionsFile> {
    const file = this.tableAmbiencesPath();
    try {
      const raw = await fs.promises.readFile(file, 'utf-8');
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as any;
      const itemsRaw = Array.isArray(parsed?.items) ? parsed.items : [];
      const items: TableAmbienceDefinition[] = itemsRaw
        .map((it: any) => ({
          soundId: this.normalizeTableAmbienceKey(String(it?.soundId ?? '')),
          name: String(it?.name ?? '').trim(),
        }))
        .filter((it: TableAmbienceDefinition) => it.soundId && it.name);

      const seen = new Set<string>();
      const deduped: TableAmbienceDefinition[] = [];
      for (const it of items) {
        const k = it.soundId.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        deduped.push(it);
      }

      return {
        updatedAt:
          typeof parsed?.updatedAt === 'string' && parsed.updatedAt.trim()
            ? parsed.updatedAt
            : new Date().toISOString(),
        items: deduped,
      };
    } catch {
      return { updatedAt: new Date().toISOString(), items: [] };
    }
  }

  private async writeTableAmbiences(next: TableAmbienceDefinitionsFile) {
    const root = this.dataRoot();
    await fs.promises.mkdir(root, { recursive: true });
    await fs.promises.writeFile(
      this.tableAmbiencesPath(),
      JSON.stringify(next, null, 2),
      'utf-8',
    );
  }

  async listTableAmbiences(): Promise<TableAmbienceDefinitionsFile> {
    return this.readTableAmbiences();
  }

  async createTableAmbience(nameRaw: string): Promise<TableAmbienceDefinition> {
    const name = String(nameRaw ?? '').trim();
    if (!name) {
      throw new BadRequestException("Nom d'ambiance requis.");
    }

    const current = await this.readTableAmbiences();
    const used = new Set(current.items.map((i) => i.soundId.toLowerCase()));
    const available = (SOUND_KEYS.filter((k) =>
      /^TableAmbience\d+$/.test(k),
    ) as TableAmbienceSoundKey[]).find((k) => !used.has(k.toLowerCase()));
    if (!available) {
      throw new BadRequestException(
        'Nombre maximum atteint (20 ambiances de table).',
      );
    }

    const created: TableAmbienceDefinition = { soundId: available, name };
    const next: TableAmbienceDefinitionsFile = {
      updatedAt: new Date().toISOString(),
      items: [...current.items, created],
    };
    await this.writeTableAmbiences(next);

    await this.notifications.notifyAll('sounds.tableAmbiences.updated', {
      updatedAt: next.updatedAt,
    });

    return created;
  }

  async renameTableAmbience(
    soundIdRaw: string,
    nameRaw: string,
  ): Promise<TableAmbienceDefinition> {
    const soundId = this.normalizeTableAmbienceKey(soundIdRaw);
    const name = String(nameRaw ?? '').trim();
    if (!name) {
      throw new BadRequestException("Nom d'ambiance requis.");
    }

    const current = await this.readTableAmbiences();
    const idx = current.items.findIndex(
      (i) => i.soundId.toLowerCase() === soundId.toLowerCase(),
    );
    if (idx < 0) {
      throw new NotFoundException('Ambiance de table introuvable.');
    }

    const nextItems = [...current.items];
    nextItems[idx] = { soundId: soundId as TableAmbienceSoundKey, name };
    const next: TableAmbienceDefinitionsFile = {
      updatedAt: new Date().toISOString(),
      items: nextItems,
    };
    await this.writeTableAmbiences(next);

    await this.notifications.notifyAll('sounds.tableAmbiences.updated', {
      updatedAt: next.updatedAt,
    });

    return nextItems[idx];
  }

  async deleteTableAmbience(soundIdRaw: string): Promise<{ ok: true }> {
    const soundId = this.normalizeTableAmbienceKey(soundIdRaw);

    const current = await this.readTableAmbiences();
    const nextItems = current.items.filter(
      (i) => i.soundId.toLowerCase() !== soundId.toLowerCase(),
    );
    const next: TableAmbienceDefinitionsFile = {
      updatedAt: new Date().toISOString(),
      items: nextItems,
    };
    await this.writeTableAmbiences(next);

    // Also clear associated sound to free the slot completely.
    await this.clearSound(soundId);

    await this.notifications.notifyAll('sounds.tableAmbiences.updated', {
      updatedAt: next.updatedAt,
    });

    return { ok: true };
  }

  async getPublicManifest(origin?: string | null): Promise<SoundManifest> {
    const manifest = await this.readManifest();

    // Ensure URLs are always correct for current host (optional).
    // If origin is provided (e.g. from reverse proxy), we can return absolute URLs; otherwise keep relative.
    if (!origin) {
      return manifest;
    }
    const sounds: SoundManifest['sounds'] = {};
    for (const key of SOUND_KEYS) {
      const entry = manifest.sounds?.[key];
      if (!entry) continue;
      sounds[key] = { ...entry, url: `${origin}${entry.url}` };
    }
    return { ...manifest, sounds };
  }

  async setSound(
    soundIdRaw: string,
    tempFilePath: string,
    originalName?: string,
  ) {
    const soundId = this.normalizeSoundKey(soundIdRaw);
    if (!tempFilePath || !fs.existsSync(tempFilePath)) {
      throw new BadRequestException('Fichier manquant.');
    }

    const ext = path.extname(originalName || tempFilePath).toLowerCase();
    if (ext !== '.mp3') {
      throw new BadRequestException('Seuls les fichiers .mp3 sont acceptés.');
    }

    const stat = await fs.promises.stat(tempFilePath);
    // Safety: keep reasonably small. Can be tuned.
    const maxBytes = 15 * 1024 * 1024;
    if (stat.size <= 0 || stat.size > maxBytes) {
      throw new BadRequestException(
        `Taille fichier invalide (max ${maxBytes} bytes).`,
      );
    }

    const bytes = await fs.promises.readFile(tempFilePath);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');

    const root = this.dataRoot();
    const soundDir = path.join(root, soundId);
    await fs.promises.mkdir(soundDir, { recursive: true });

    const destName = `${sha256}.mp3`;
    const destPath = path.join(soundDir, destName);
    await fs.promises.writeFile(destPath, bytes);

    const entry: SoundManifestEntry = {
      soundId,
      sha256,
      bytes: stat.size,
      uploadedAt: new Date().toISOString(),
      url: `/api/sounds/${encodeURIComponent(soundId)}/${sha256}.mp3`,
    };

    const manifest = await this.readManifest();
    const next: SoundManifest = {
      updatedAt: new Date().toISOString(),
      sounds: { ...(manifest.sounds || {}), [soundId]: entry },
    };
    await this.writeManifest(next);

    // Nettoyage: supprimer les anciennes versions non référencées (doublons) pour ce soundId.
    await this.removeUnusedFilesForSoundId(soundId, sha256);

    await this.notifications.notifyAll('sounds.updated', {
      soundId,
      sha256,
      url: entry.url,
      updatedAt: next.updatedAt,
    });

    return entry;
  }

  async clearSound(soundIdRaw: string) {
    const soundId = this.normalizeSoundKey(soundIdRaw);
    const manifest = await this.readManifest();
    if (!manifest.sounds?.[soundId]) {
      return { ok: true };
    }
    const next = {
      updatedAt: new Date().toISOString(),
      sounds: { ...(manifest.sounds || {}) },
    } as SoundManifest;
    delete next.sounds[soundId];
    await this.writeManifest(next);

    // Nettoyage best-effort: si le son est supprimé du manifest, supprimer aussi les fichiers associés.
    try {
      await fs.promises.rm(path.join(this.dataRoot(), soundId), {
        recursive: true,
        force: true,
      });
    } catch {
      // ignore
    }

    await this.notifications.notifyAll('sounds.updated', {
      soundId,
      sha256: null,
      url: null,
      updatedAt: next.updatedAt,
    });
    return { ok: true };
  }

  async cleanupUnusedSounds(): Promise<{
    ok: true;
    deletedFiles: number;
    deletedDirs: number;
  }> {
    const root = this.dataRoot();
    const manifest = await this.readManifest();

    const usedById: Partial<Record<SoundKey, string>> = {};
    for (const key of SOUND_KEYS) {
      const entry = manifest.sounds?.[key];
      if (!entry?.sha256) continue;
      usedById[key] = entry.sha256;
    }

    let deletedFiles = 0;
    let deletedDirs = 0;

    let dirs: fs.Dirent[];
    try {
      dirs = await fs.promises.readdir(root, { withFileTypes: true });
    } catch {
      return { ok: true, deletedFiles: 0, deletedDirs: 0 };
    }

    for (const dirent of dirs) {
      if (!dirent.isDirectory()) continue;
      const name = dirent.name;
      const soundKey = SOUND_KEYS.find((k) => k === name);
      if (!soundKey) {
        try {
          await fs.promises.rm(path.join(root, name), {
            recursive: true,
            force: true,
          });
          deletedDirs++;
        } catch {
          // ignore
        }
        continue;
      }

      const keepSha = usedById[soundKey];
      if (!keepSha) {
        // Aucun son configuré pour ce soundId => supprimer le dossier.
        try {
          await fs.promises.rm(path.join(root, soundKey), {
            recursive: true,
            force: true,
          });
          deletedDirs++;
        } catch {
          // ignore
        }
        continue;
      }

      deletedFiles += await this.removeUnusedFilesForSoundId(soundKey, keepSha);

      // Si le dossier est vide après cleanup, supprimer.
      try {
        const remaining = await fs.promises.readdir(path.join(root, soundKey));
        if (remaining.length === 0) {
          await fs.promises.rm(path.join(root, soundKey), {
            recursive: true,
            force: true,
          });
          deletedDirs++;
        }
      } catch {
        // ignore
      }
    }

    return { ok: true, deletedFiles, deletedDirs };
  }

  async resolveSoundFile(soundIdRaw: string, shaFromUrl?: string | null) {
    const soundId = this.normalizeSoundKey(soundIdRaw);
    const manifest = await this.readManifest();
    const entry = manifest.sounds?.[soundId];
    if (!entry) {
      throw new NotFoundException('Son non configuré.');
    }
    if (shaFromUrl && shaFromUrl !== entry.sha256) {
      // The client asked an old url; 404 encourages them to refresh manifest.
      throw new NotFoundException('Version du son obsolète.');
    }
    const filePath = path.join(this.dataRoot(), soundId, `${entry.sha256}.mp3`);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Fichier son introuvable.');
    }
    return { entry, filePath };
  }

  // Convenience for local dev: ensure data dir exists
  async ensureDirs() {
    await fs.promises.mkdir(this.dataRoot(), { recursive: true });
  }
}
