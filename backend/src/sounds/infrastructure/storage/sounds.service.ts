import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  SOUND_KEYS,
  SoundKey,
  SoundManifest,
} from '../../application/models/sound-manifest.record';
import {
  NOTIFICATION_DISPATCHER,
  type NotificationDispatcher,
} from '../../../notification/public-api';
import {
  buildStorageIoError,
  decodeSoundManifest,
  resolveSoundsDataRoot,
} from './sounds-storage.utils';
import {
  detectSoundSilence,
  probeSoundDurationSeconds,
  transcodeSoundToStableWav,
} from './sounds-audio.utils';
import { SoundsMaintenanceManager } from './sounds-maintenance.manager';
import { SoundsTableAmbiencesManager } from './sounds-table-ambiences.manager';
import { SoundsUploadManager } from './sounds-upload.manager';

@Injectable()
export class SoundsService {
  private readonly logger = new Logger(SoundsService.name);
  private readonly storageRoot: string;
  private readonly maintenance: SoundsMaintenanceManager;
  private readonly tableAmbiences: SoundsTableAmbiencesManager;
  private readonly uploads: SoundsUploadManager;

  constructor(
    @Inject(NOTIFICATION_DISPATCHER)
    private readonly notifications: NotificationDispatcher,
  ) {
    this.storageRoot = resolveSoundsDataRoot({
      legacyRoot: path.resolve(__dirname, '..', '..', 'data', 'sounds'),
      warn: (message) => this.logger.warn(message),
    });
    this.maintenance = new SoundsMaintenanceManager({
      dataRoot: () => this.storageRoot,
      readManifest: () => this.readManifest(),
      writeManifest: (manifest) => this.writeManifest(manifest),
      transcodeToStableWav: (inputPath) =>
        transcodeSoundToStableWav(inputPath, (message) =>
          this.logger.warn(message),
        ),
      probeDurationSeconds: (filePath) =>
        probeSoundDurationSeconds(filePath, (message) =>
          this.logger.warn(message),
        ),
      detectSilence: (filePath) => detectSoundSilence(filePath),
      removeUnusedFilesForSoundId: (soundId, keepSha256) =>
        this.removeUnusedFilesForSoundId(soundId, keepSha256),
      notifySoundsUpdated: (updatedAt) =>
        this.notifications.notifyAll('sounds.updated', {
          soundId: null,
          sha256: null,
          url: null,
          updatedAt,
        }),
      now: () => new Date().toISOString(),
    });
    this.tableAmbiences = new SoundsTableAmbiencesManager({
      filePath: () => path.join(this.storageRoot, 'table-ambiences.json'),
      normalizeSoundKey: (input) => this.normalizeSoundKey(input),
      notifyUpdated: (updatedAt) =>
        this.notifications.notifyAll('sounds.tableAmbiences.updated', {
          updatedAt,
        }),
      clearSound: (soundId) => this.clearSound(soundId),
      storageIoError: (action, err) => this.storageIoError(action, err),
      now: () => new Date().toISOString(),
    });
    this.uploads = new SoundsUploadManager({
      dataRoot: this.storageRoot,
      normalizeSoundKey: (input) => this.normalizeSoundKey(input),
      readManifest: () => this.readManifest(),
      writeManifest: (manifest) => this.writeManifest(manifest),
      removeUnusedFiles: (soundId, keepSha256) =>
        this.removeUnusedFilesForSoundId(soundId, keepSha256),
      notifyUpdated: (entry, updatedAt) =>
        this.notifications.notifyAll('sounds.updated', {
          soundId: entry.soundId,
          sha256: entry.sha256,
          url: entry.url,
          updatedAt,
        }),
      storageError: (action, error) => this.storageIoError(action, error),
      warn: (message) => this.logger.warn(message),
    });
  }

  private storageIoError(
    action: string,
    err: unknown,
  ): InternalServerErrorException {
    return buildStorageIoError(action, err, (message, stack) =>
      this.logger.error(message, stack),
    );
  }

  private async removeUnusedFilesForSoundId(
    soundId: SoundKey,
    keepSha256: string,
  ): Promise<number> {
    const soundDir = path.join(this.storageRoot, soundId);
    let deleted = 0;
    try {
      const files = await fs.promises.readdir(soundDir);
      for (const file of files) {
        const lower = file.toLowerCase();
        if (!(lower.endsWith('.wav') || lower.endsWith('.mp3'))) continue;
        if (file === `${keepSha256}.wav`) continue;
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

  private normalizeSoundKey(input: string): SoundKey {
    const raw = (input || '').trim();
    const found = SOUND_KEYS.find((k) => k.toLowerCase() === raw.toLowerCase());
    if (!found) {
      throw new BadRequestException(`soundId invalide: ${raw}`);
    }
    return found;
  }

  private async readManifest(): Promise<SoundManifest> {
    const file = path.join(this.storageRoot, 'manifest.json');
    try {
      const raw = await fs.promises.readFile(file, 'utf-8');
      const parsed = decodeSoundManifest(
        JSON.parse(raw.replace(/^\uFEFF/, '')),
      );
      if (!parsed) {
        throw new BadRequestException('manifest invalide');
      }
      return parsed;
    } catch {
      return { updatedAt: new Date().toISOString(), sounds: {} };
    }
  }

  private async writeManifest(next: SoundManifest): Promise<void> {
    const root = this.storageRoot;
    try {
      await fs.promises.mkdir(root, { recursive: true });
      await fs.promises.writeFile(
        path.join(this.storageRoot, 'manifest.json'),
        JSON.stringify(next, null, 2),
        'utf-8',
      );
    } catch (err) {
      throw this.storageIoError('écriture manifest.json', err);
    }
  }

  async listTableAmbiences() {
    return this.listTableAmbiencesWithFilter();
  }

  async listTableAmbiencesWithFilter(options?: { includeDisabled?: boolean }) {
    return this.tableAmbiences.list(options);
  }

  async createTableAmbience(nameRaw: string) {
    return this.tableAmbiences.create(nameRaw);
  }

  async renameTableAmbience(soundIdRaw: string, nameRaw: string) {
    return this.tableAmbiences.rename(soundIdRaw, nameRaw);
  }

  async deleteTableAmbience(soundIdRaw: string): Promise<{ ok: true }> {
    return this.tableAmbiences.delete(soundIdRaw);
  }

  async setTableAmbienceEnabled(soundIdRaw: string, enabled: boolean) {
    return this.tableAmbiences.setEnabled(soundIdRaw, enabled);
  }

  async getPublicManifest(origin?: string | null): Promise<SoundManifest> {
    const manifest = await this.readManifest();

    // Always filter to known keys and only publish entries that have an on-disk file.
    // This prevents the client from trying to download sounds that were removed from disk
    // but accidentally left behind in the manifest.
    const sounds: SoundManifest['sounds'] = {};
    for (const key of SOUND_KEYS) {
      const entry = manifest.sounds?.[key];
      if (!entry) continue;

      const root = this.storageRoot;
      const soundDir = path.join(root, entry.soundId);
      const wav = path.join(soundDir, `${entry.sha256}.wav`);
      const mp3 = path.join(soundDir, `${entry.sha256}.mp3`);
      if (!fs.existsSync(wav) && !fs.existsSync(mp3)) {
        continue;
      }

      sounds[key] = origin ? { ...entry, url: `${origin}${entry.url}` } : entry;
    }

    return { ...manifest, sounds };
  }

  async setSound(
    soundIdRaw: string,
    tempFilePath: string,
    originalName?: string,
  ) {
    return this.uploads.setSound(soundIdRaw, tempFilePath, originalName);
  }

  async clearSound(soundIdRaw: string): Promise<{ ok: true }> {
    const soundId = this.normalizeSoundKey(soundIdRaw);
    const manifest = await this.readManifest();
    if (!manifest.sounds?.[soundId]) {
      return { ok: true as const };
    }
    const next = {
      updatedAt: new Date().toISOString(),
      sounds: { ...(manifest.sounds || {}) },
    };
    delete next.sounds[soundId];
    await this.writeManifest(next);

    // Nettoyage best-effort: si le son est supprimé du manifest, supprimer aussi les fichiers associés.
    try {
      await fs.promises.rm(path.join(this.storageRoot, soundId), {
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
    return { ok: true as const };
  }

  async reencodeAllSounds() {
    return this.maintenance.reencodeAll();
  }

  async reencodeInvalidSounds() {
    return this.maintenance.reencodeInvalid();
  }

  async diagnoseSounds() {
    return this.maintenance.diagnose();
  }

  async cleanupUnusedSounds() {
    return this.maintenance.cleanupUnused();
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
    const wav = path.join(this.storageRoot, soundId, `${entry.sha256}.wav`);
    const mp3 = path.join(this.storageRoot, soundId, `${entry.sha256}.mp3`);
    const filePath = fs.existsSync(wav) ? wav : mp3;
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Fichier son introuvable.');
    }
    const ext = filePath.toLowerCase().endsWith('.wav') ? '.wav' : '.mp3';
    return { entry, filePath, ext };
  }

  // Convenience for local dev: ensure data dir exists
  async ensureDirs() {
    await fs.promises.mkdir(this.storageRoot, { recursive: true });
  }
}
