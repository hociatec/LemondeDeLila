import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
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
} from '../../application/models/sound-manifest.record';
import {
  NOTIFICATION_DISPATCHER,
  type NotificationDispatcher,
} from '../../../notification/public-api';
import {
  buildStorageIoError,
  resolveSoundsDataRoot,
  toSoundErrorMessage,
} from './sounds-storage.utils';
import {
  createAudioToolExecutionError,
  detectSoundSilence,
  isSoundSpawnExecutionError,
  probeSoundDurationSeconds,
  transcodeSoundToStableWav,
} from './sounds-audio.utils';
import { SoundsMaintenanceManager } from './sounds-maintenance.manager';
import { SoundsTableAmbiencesManager } from './sounds-table-ambiences.manager';

@Injectable()
export class SoundsService {
  private readonly logger = new Logger(SoundsService.name);
  private readonly storageRoot: string;
  private readonly maintenance: SoundsMaintenanceManager;
  private readonly tableAmbiences: SoundsTableAmbiencesManager;

  constructor(
    @Inject(NOTIFICATION_DISPATCHER)
    private readonly notifications: NotificationDispatcher,
  ) {
    this.storageRoot = resolveSoundsDataRoot({
      legacyRoot: path.resolve(__dirname, '..', '..', 'data', 'sounds'),
      warn: (message) => this.logger.warn(message),
    });
    this.maintenance = new SoundsMaintenanceManager({
      dataRoot: () => this.dataRoot(),
      readManifest: () => this.readManifest(),
      writeManifest: (manifest) => this.writeManifest(manifest),
      transcodeToStableWav: (inputPath) => this.transcodeToStableWav(inputPath),
      probeDurationSeconds: (filePath) => this.probeDurationSeconds(filePath),
      detectSilence: (filePath) => this.detectSilence(filePath),
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
      filePath: () => this.tableAmbiencesPath(),
      normalizeSoundKey: (input) => this.normalizeSoundKey(input),
      notifyUpdated: (updatedAt) =>
        this.notifications.notifyAll('sounds.tableAmbiences.updated', {
          updatedAt,
        }),
      clearSound: (soundId) => this.clearSound(soundId),
      storageIoError: (action, err) => this.storageIoError(action, err),
      now: () => new Date().toISOString(),
    });
  }

  private dataRoot() {
    return this.storageRoot;
  }

  private storageIoError(
    action: string,
    err: unknown,
  ): InternalServerErrorException {
    return buildStorageIoError(action, err, (message, stack) =>
      this.logger.error(message, stack),
    );
  }

  private async probeDurationSeconds(filePath: string): Promise<number> {
    return probeSoundDurationSeconds(filePath, (message) =>
      this.logger.warn(message),
    );
  }

  private async detectSilence(filePath: string): Promise<boolean> {
    return detectSoundSilence(filePath);
  }

  private async transcodeToStableWav(
    inputPath: string,
  ): Promise<{ outputPath: string; tempDir: string }> {
    return transcodeSoundToStableWav(inputPath, (message) =>
      this.logger.warn(message),
    );
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

  private async readManifest(): Promise<SoundManifest> {
    const file = this.manifestPath();
    try {
      const raw = await fs.promises.readFile(file, 'utf-8');
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as SoundManifest;
      if (!parsed?.sounds || typeof parsed?.sounds !== 'object') {
        throw new BadRequestException('manifest invalide');
      }
      return parsed;
    } catch {
      return { updatedAt: new Date().toISOString(), sounds: {} };
    }
  }

  private async writeManifest(next: SoundManifest): Promise<void> {
    const root = this.dataRoot();
    try {
      await fs.promises.mkdir(root, { recursive: true });
      await fs.promises.writeFile(
        this.manifestPath(),
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

      const root = this.dataRoot();
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
    const soundId = this.normalizeSoundKey(soundIdRaw);
    if (!tempFilePath || !fs.existsSync(tempFilePath)) {
      throw new BadRequestException('Fichier manquant.');
    }

    const ext = path.extname(originalName || tempFilePath).toLowerCase();
    if (ext !== '.mp3' && ext !== '.wav' && ext !== '.wave') {
      throw new BadRequestException(
        'Seuls les fichiers .mp3, .wav ou .wave sont acceptés.',
      );
    }
    const isWavInput = ext === '.wav' || ext === '.wave';

    const stat = await fs.promises.stat(tempFilePath);
    // Safety: keep reasonably small. Can be tuned.
    // WAV is much larger than MP3 (PCM). Keep this high; admin-only endpoint.
    const maxBytes = 250 * 1024 * 1024;
    if (stat.size <= 0 || stat.size > maxBytes) {
      throw new BadRequestException(
        `Taille fichier invalide (max ${maxBytes} bytes).`,
      );
    }

    // Validate input and re-encode to a stable WAV (PCM) format.
    const minDurationSeconds = 0.2;
    const inputDuration = await this.probeDurationSeconds(tempFilePath);
    if (inputDuration < minDurationSeconds) {
      throw new BadRequestException('Son trop court (min 200ms).');
    }

    let bytes = Buffer.alloc(0);
    let sha256 = '';
    let encodedSize = 0;
    let tempDir: string | null = null;
    let outputPath = tempFilePath;
    try {
      try {
        const transcoded = await this.transcodeToStableWav(tempFilePath);
        outputPath = transcoded.outputPath;
        tempDir = transcoded.tempDir;
      } catch (err) {
        // Fallback: allow WAV upload even if ffmpeg is blocked/unavailable on the host.
        if (
          isWavInput &&
          (isSoundSpawnExecutionError(err) ||
            err instanceof InternalServerErrorException)
        ) {
          outputPath = tempFilePath;
          tempDir = null;
        } else if (isSoundSpawnExecutionError(err)) {
          throw createAudioToolExecutionError(
            'ffmpeg',
            err,
            'Utilisez un fichier .wav si ffmpeg est bloqué sur ce serveur.',
          );
        } else {
          throw err;
        }
      }

      const encodedStat = await fs.promises.stat(outputPath);
      if (encodedStat.size <= 0 || encodedStat.size > maxBytes) {
        throw new BadRequestException(
          `Taille fichier invalide après transcodage (max ${maxBytes} bytes).`,
        );
      }
      encodedSize = encodedStat.size;

      const duration = await this.probeDurationSeconds(outputPath);
      if (duration < minDurationSeconds) {
        throw new BadRequestException('Son trop court après transcodage.');
      }

      const isSilent = await this.detectSilence(outputPath);
      if (isSilent) {
        throw new BadRequestException('Son silencieux (volume max = -inf).');
      }

      bytes = await fs.promises.readFile(outputPath);
      sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    } finally {
      if (tempDir) {
        try {
          await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }
    }

    const root = this.dataRoot();
    const soundDir = path.join(root, soundId);
    try {
      await fs.promises.mkdir(soundDir, { recursive: true });
    } catch (err) {
      throw this.storageIoError(`création dossier son (${soundId})`, err);
    }

    const destName = `${sha256}.wav`;
    const destPath = path.join(soundDir, destName);
    try {
      await fs.promises.writeFile(destPath, bytes);
    } catch (err) {
      throw this.storageIoError(`écriture fichier son (${soundId})`, err);
    }

    const entry: SoundManifestEntry = {
      soundId,
      sha256,
      bytes: encodedSize || bytes.length,
      uploadedAt: new Date().toISOString(),
      url: `/api/sounds/${encodeURIComponent(soundId)}/${sha256}.wav`,
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

  async clearSound(soundIdRaw: string): Promise<{ ok: true }> {
    const soundId = this.normalizeSoundKey(soundIdRaw);
    const manifest = await this.readManifest();
    if (!manifest.sounds?.[soundId]) {
      return { ok: true as const };
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
    const wav = path.join(this.dataRoot(), soundId, `${entry.sha256}.wav`);
    const mp3 = path.join(this.dataRoot(), soundId, `${entry.sha256}.mp3`);
    const filePath = fs.existsSync(wav) ? wav : mp3;
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Fichier son introuvable.');
    }
    const ext = filePath.toLowerCase().endsWith('.wav') ? '.wav' : '.mp3';
    return { entry, filePath, ext };
  }

  // Convenience for local dev: ensure data dir exists
  async ensureDirs() {
    await fs.promises.mkdir(this.dataRoot(), { recursive: true });
  }
}
