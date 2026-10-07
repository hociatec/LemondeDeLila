import { removeUnusedFilesForSoundId } from './sounds-storage-maintenance';
import { SoundsManifestStore } from './sounds-manifest.store';
import { withExclusiveFileLock } from '../../../../platform/filesystem/public-api';
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
} from '../../application/read-models/sound-manifest.record';
import { SOUND_CATALOG } from '../../application/read-models/sound-catalog.record';
import {
  NOTIFICATION_DISPATCHER,
  type NotificationDispatcher,
} from '../../../notification/public-api';
import {
  buildStorageIoError,
  resolveSoundsDataRoot,
} from './sounds-storage.utils';
import {
  detectSoundSilence,
  probeSoundDurationSeconds,
  transcodeSoundToStableWav,
} from './sounds-audio.utils';
import {
  SoundsReencoder,
  type SoundsMaintenanceDeps,
} from './sounds-reencoder';
import { diagnoseSounds } from './sounds-diagnostics';
import { cleanupUnusedSounds } from './sounds-cleanup';
import { SoundsTableAmbiencesManager } from './sounds-table-ambiences.manager';
import { SoundsUploadManager } from './sounds-upload.manager';

@Injectable()
export class SoundsService {
  private readonly logger = new Logger(SoundsService.name);
  private readonly storageRoot: string;
  private readonly manifests: SoundsManifestStore;
  private readonly reencoder: SoundsReencoder;
  private readonly maintenanceDeps: SoundsMaintenanceDeps;
  private readonly tableAmbiences: SoundsTableAmbiencesManager;
  private readonly uploads: SoundsUploadManager;

  constructor(
    @Inject(NOTIFICATION_DISPATCHER)
    private readonly notifications: NotificationDispatcher,
  ) {
    this.storageRoot = resolveSoundsDataRoot();
    this.manifests = new SoundsManifestStore(
      this.storageRoot,
      this.notifications,
      this.logger,
      normalizeSoundKey,
    );
    this.maintenanceDeps = {
      dataRoot: () => this.storageRoot,
      readManifest: () => this.manifests.readManifest(),
      writeManifest: (manifest) => this.manifests.writeManifest(manifest),
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
        removeUnusedFilesForSoundId(
          this.storageRoot,
          (message) => this.logger.warn(message),
          soundId,
          keepSha256,
        ),
      notifySoundsUpdated: (updatedAt) =>
        this.notifications.notifyAll('sounds.updated', {
          soundId: null,
          sha256: null,
          url: null,
          updatedAt,
        }),
      warn: (message) => this.logger.warn(message),
      now: () => new Date().toISOString(),
    };
    this.reencoder = new SoundsReencoder(this.maintenanceDeps);
    this.tableAmbiences = new SoundsTableAmbiencesManager({
      filePath: () => path.join(this.storageRoot, 'table-ambiences.json'),
      normalizeSoundKey,
      notifyUpdated: (updatedAt) =>
        this.notifications.notifyAll('sounds.tableAmbiences.updated', {
          updatedAt,
        }),
      clearSound: (soundId) => this.clearSound(soundId),
      storageIoError: (action, err) => storageIoError(this.logger, action, err),
      now: () => new Date().toISOString(),
    });
    this.uploads = new SoundsUploadManager({
      dataRoot: this.storageRoot,
      normalizeSoundKey,
      readManifest: () => this.manifests.readManifest(),
      writeManifest: (manifest) => this.manifests.writeManifest(manifest),
      removeUnusedFiles: (soundId, keepSha256) =>
        removeUnusedFilesForSoundId(
          this.storageRoot,
          (message) => this.logger.warn(message),
          soundId,
          keepSha256,
          { strict: true },
        ),
      notifyUpdated: (entry, updatedAt) =>
        this.notifications.notifyAll('sounds.updated', {
          soundId: entry.soundId,
          sha256: entry.sha256,
          url: entry.url,
          updatedAt,
        }),
      storageError: (action, error) =>
        storageIoError(this.logger, action, error),
      ensureStorageCapacity: (incomingBytes) =>
        this.manifests.ensureStorageCapacity(incomingBytes),
      warn: (message) => this.logger.warn(message),
    });
  }

  async listTableAmbiences() {
    return this.listTableAmbiencesWithFilter();
  }

  async listTableAmbiencesWithFilter(options?: { includeDisabled?: boolean }) {
    return this.tableAmbiences.list(options);
  }

  async createTableAmbience(nameRaw: string) {
    return this.mutate(() => this.tableAmbiences.create(nameRaw));
  }

  async renameTableAmbience(soundIdRaw: string, nameRaw: string) {
    return this.mutate(() => this.tableAmbiences.rename(soundIdRaw, nameRaw));
  }

  async deleteTableAmbience(soundIdRaw: string): Promise<{ ok: true }> {
    return this.mutate(() => this.tableAmbiences.delete(soundIdRaw));
  }

  async setTableAmbienceEnabled(soundIdRaw: string, enabled: boolean) {
    return this.mutate(() =>
      this.tableAmbiences.setEnabled(soundIdRaw, enabled),
    );
  }

  async getPublicManifest(origin?: string | null): Promise<SoundManifest> {
    const manifest = await this.manifests.readManifest();
    const ambiences = await this.tableAmbiences.list({ includeDisabled: true });
    const disabled = [
      ...new Set([
        ...(manifest.disabled ?? []),
        ...ambiences.items
          .filter((item) => !item.enabled)
          .map((item) => item.soundId),
      ]),
    ];

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

    return { ...manifest, sounds, disabled };
  }

  async getAdminCatalog() {
    const manifest = await this.getPublicManifest();
    const disabled = new Set(manifest.disabled ?? []);
    const categories = new Map<
      string,
      Map<string, Array<Record<string, unknown>>>
    >();

    for (const definition of SOUND_CATALOG) {
      let screens = categories.get(definition.category);
      if (!screens) {
        screens = new Map();
        categories.set(definition.category, screens);
      }
      let sounds = screens.get(definition.screen);
      if (!sounds) {
        sounds = [];
        screens.set(definition.screen, sounds);
      }
      const configured = manifest.sounds[definition.soundId];
      sounds.push({
        soundId: definition.soundId,
        event: definition.event,
        loop: definition.loop,
        enabled: !disabled.has(definition.soundId),
        source: configured ? 'personnalisé' : 'par défaut',
        ...(configured ?? {}),
      });
    }

    return {
      updatedAt: manifest.updatedAt,
      categories: [...categories].map(([name, screens]) => ({
        name,
        screens: [...screens].map(([name, sounds]) => ({ name, sounds })),
      })),
    };
  }

  async setSoundEnabled(soundIdRaw: string, enabled: boolean) {
    return this.mutate(() => this.setSoundEnabledLocked(soundIdRaw, enabled));
  }

  async createTableAmbienceWithSound(
    name: string,
    file: string,
    originalName?: string,
    mimeType?: string,
  ) {
    return this.mutate(async () => {
      const created = await this.tableAmbiences.create(name, false);
      try {
        await this.uploads.setSound(
          created.soundId,
          file,
          originalName,
          mimeType,
        );
        return await this.tableAmbiences.setEnabled(created.soundId, true);
      } catch (error) {
        await this.tableAmbiences.delete(created.soundId);
        throw error;
      }
    });
  }

  private async setSoundEnabledLocked(soundIdRaw: string, enabled: boolean) {
    const soundId = normalizeSoundKey(soundIdRaw);
    const manifest = await this.manifests.readManifest();
    const disabled = new Set(manifest.disabled ?? []);
    if (enabled) disabled.delete(soundId);
    else disabled.add(soundId);
    const updatedAt = new Date().toISOString();
    await this.manifests.writeManifest({
      ...manifest,
      updatedAt,
      disabled: [...disabled],
    });
    await this.notifications.notifyAll('sounds.updated', {
      soundId,
      sha256: manifest.sounds[soundId]?.sha256 ?? null,
      url: manifest.sounds[soundId]?.url ?? null,
      enabled,
      updatedAt,
    });
    return { soundId, enabled, updatedAt };
  }

  async setSound(
    soundIdRaw: string,
    tempFilePath: string,
    originalName?: string,
    mimeType?: string,
  ) {
    return this.mutate(() =>
      this.uploads.setSound(soundIdRaw, tempFilePath, originalName, mimeType),
    );
  }

  async clearSound(soundIdRaw: string): Promise<{ ok: true }> {
    return this.mutate(() => this.manifests.clearSound(soundIdRaw));
  }

  async reencodeAllSounds() {
    return this.mutate(() => this.reencoder.reencodeAll());
  }

  async reencodeInvalidSounds() {
    return this.mutate(() => this.reencoder.reencodeInvalid());
  }

  async diagnoseSounds() {
    return diagnoseSounds(this.maintenanceDeps);
  }

  async cleanupUnusedSounds() {
    return this.mutate(() => cleanupUnusedSounds(this.maintenanceDeps));
  }

  private mutate<T>(operation: () => Promise<T>): Promise<T> {
    return withExclusiveFileLock(
      path.join(this.storageRoot, '.sounds.lock'),
      operation,
    );
  }

  async resolveSoundFile(soundIdRaw: string, shaFromUrl?: string | null) {
    const soundId = normalizeSoundKey(soundIdRaw);
    const manifest = await this.manifests.readManifest();
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

function normalizeSoundKey(input: string): SoundKey {
  const raw = (input || '').trim();
  const found = SOUND_KEYS.find(
    (key) => key.toLowerCase() === raw.toLowerCase(),
  );
  if (!found) throw new BadRequestException(`soundId invalide: ${raw}`);
  return found;
}

function storageIoError(
  logger: Logger,
  action: string,
  err: unknown,
): InternalServerErrorException {
  return buildStorageIoError(action, err, (message, stack) =>
    logger.error(message, stack),
  );
}
