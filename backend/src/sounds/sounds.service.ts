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
} from './sounds.types';
import { NotificationService } from '../notification/services/notification.service';

@Injectable()
export class SoundsService {
  constructor(private readonly notifications: NotificationService) {}

  private dataRoot() {
    return path.resolve(process.cwd(), 'data', 'sounds');
  }

  private manifestPath() {
    return path.join(this.dataRoot(), 'manifest.json');
  }

  private normalizeSoundKey(input: string): SoundKey {
    const raw = (input || '').trim();
    const found = SOUND_KEYS.find((k) => k.toLowerCase() === raw.toLowerCase());
    if (!found) {
      throw new BadRequestException(`soundId invalide: ${raw}`);
    }
    return found;
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

    await this.notifications.notifyAll('sounds.updated', {
      soundId,
      sha256: null,
      url: null,
      updatedAt: next.updatedAt,
    });
    return { ok: true };
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
