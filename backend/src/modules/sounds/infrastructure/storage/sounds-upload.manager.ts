import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { bestEffort } from '../../../../platform/observability/public-api';
import {
  assertPathInside,
  copyFileAtomic,
} from '../../../../platform/filesystem/public-api';
import type {
  SoundKey,
  SoundManifest,
  SoundManifestEntry,
} from '../../application/read-models/sound-manifest.record';
import {
  detectSoundSilence,
  probeSoundDurationSeconds,
  transcodeSoundToStableWav,
} from './sounds-audio.utils';
import {
  audioToolExecutionError,
  isAudioProcessSpawnError,
} from './sounds-audio-process';
import { assertSoundMime } from './sounds-media-validation';

type SoundsUploadDependencies = {
  dataRoot: string;
  normalizeSoundKey: (value: string) => SoundKey;
  readManifest: () => Promise<SoundManifest>;
  writeManifest: (manifest: SoundManifest) => Promise<void>;
  removeUnusedFiles: (soundId: SoundKey, keepSha256: string) => Promise<number>;
  notifyUpdated: (
    entry: SoundManifestEntry,
    updatedAt: string,
  ) => Promise<void>;
  storageError: (action: string, error: unknown) => Error;
  ensureStorageCapacity: (incomingBytes: number) => Promise<void>;
  warn: (message: string) => void;
};

type EncodedSound = {
  filePath: string;
  cleanupDir: string | null;
  sha256: string;
  encodedSize: number;
};

const MAX_SOUND_BYTES = 250 * 1024 * 1024;
const MIN_SOUND_DURATION_SECONDS = 0.2;

export class SoundsUploadManager {
  constructor(private readonly dependencies: SoundsUploadDependencies) {}

  async setSound(
    soundIdRaw: string,
    tempFilePath: string,
    originalName?: string,
    mimeType?: string,
  ): Promise<SoundManifestEntry> {
    const soundId = this.dependencies.normalizeSoundKey(soundIdRaw);
    const safeTempFilePath = this.assertTemporaryFilePath(tempFilePath);
    let encoded: EncodedSound | null = null;
    try {
      const isWavInput = await this.validateInput(
        safeTempFilePath,
        originalName,
        mimeType,
      );
      encoded = await this.encodeAndValidate(safeTempFilePath, isWavInput);
      const entry = await this.persist(soundId, encoded);
      await this.dependencies.removeUnusedFiles(soundId, encoded.sha256);
      await this.dependencies.notifyUpdated(entry, entry.uploadedAt);
      return entry;
    } finally {
      if (encoded?.cleanupDir) {
        await bestEffort(
          fs.promises.rm(encoded.cleanupDir, { recursive: true, force: true }),
          'nettoyage du transcodage audio temporaire',
        );
      }
      await bestEffort(
        fs.promises.rm(safeTempFilePath, { force: true }),
        'nettoyage du fichier audio temporaire',
      );
    }
  }

  private async validateInput(
    tempFilePath: string,
    originalName?: string,
    mimeType?: string,
  ): Promise<boolean> {
    const stat = await fs.promises.lstat(tempFilePath).catch(() => null);
    if (!stat?.isFile()) throw new BadRequestException('Fichier manquant.');
    const extension = path.extname(originalName || tempFilePath).toLowerCase();
    if (!['.mp3', '.wav', '.wave'].includes(extension)) {
      throw new BadRequestException(
        'Seuls les fichiers .mp3, .wav ou .wave sont acceptés.',
      );
    }
    await this.assertValidSize(tempFilePath, '');
    assertSoundMime(extension, mimeType);
    const duration = await probeSoundDurationSeconds(
      tempFilePath,
      this.dependencies.warn,
      extension,
    );
    if (duration < MIN_SOUND_DURATION_SECONDS) {
      throw new BadRequestException('Son trop court (min 200ms).');
    }
    return extension === '.wav' || extension === '.wave';
  }

  private assertTemporaryFilePath(input: string): string {
    try {
      return assertPathInside(os.tmpdir(), input);
    } catch {
      throw new BadRequestException('Fichier temporaire invalide.');
    }
  }

  private async encodeAndValidate(
    inputPath: string,
    isWavInput: boolean,
  ): Promise<EncodedSound> {
    let tempDir: string | null = null;
    try {
      const transcoded = await this.transcode(inputPath, isWavInput);
      tempDir = transcoded.tempDir;
      const outputPath = transcoded.outputPath;
      const encodedSize = await this.assertValidSize(
        outputPath,
        ' après transcodage',
      );
      const duration = await probeSoundDurationSeconds(
        outputPath,
        this.dependencies.warn,
      );
      if (duration < MIN_SOUND_DURATION_SECONDS) {
        throw new BadRequestException('Son trop court après transcodage.');
      }
      if (await detectSoundSilence(outputPath)) {
        throw new BadRequestException('Son silencieux (volume max = -inf).');
      }
      const sha256 = await this.sha256File(outputPath);
      return { filePath: outputPath, cleanupDir: tempDir, sha256, encodedSize };
    } catch (error) {
      if (tempDir) {
        await bestEffort(
          fs.promises.rm(tempDir, { recursive: true, force: true }),
          'nettoyage du transcodage audio temporaire',
        );
      }
      throw error;
    }
  }

  private async sha256File(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(filePath)) {
      hash.update(chunk as Buffer);
    }
    return hash.digest('hex');
  }

  private async transcode(
    inputPath: string,
    isWavInput: boolean,
  ): Promise<{ outputPath: string; tempDir: string | null }> {
    try {
      return await transcodeSoundToStableWav(inputPath, this.dependencies.warn);
    } catch (error) {
      if (
        isWavInput &&
        (isAudioProcessSpawnError(error) ||
          error instanceof InternalServerErrorException)
      ) {
        return { outputPath: inputPath, tempDir: null };
      }
      if (isAudioProcessSpawnError(error)) {
        throw audioToolExecutionError(
          'ffmpeg',
          error,
          'Utilisez un fichier .wav si ffmpeg est bloqué sur ce serveur.',
        );
      }
      throw error;
    }
  }

  private async assertValidSize(
    filePath: string,
    label: string,
  ): Promise<number> {
    const size = (await fs.promises.stat(filePath)).size;
    if (size <= 0 || size > MAX_SOUND_BYTES) {
      throw new BadRequestException(
        `Taille fichier invalide${label} (max ${MAX_SOUND_BYTES} bytes).`,
      );
    }
    return size;
  }

  private async persist(
    soundId: SoundKey,
    encoded: EncodedSound,
  ): Promise<SoundManifestEntry> {
    const soundDir = path.join(this.dependencies.dataRoot, soundId);
    try {
      await this.dependencies.ensureStorageCapacity(encoded.encodedSize);
      await fs.promises.mkdir(soundDir, { recursive: true });
      await copyFileAtomic(
        encoded.filePath,
        path.join(soundDir, `${encoded.sha256}.wav`),
        MAX_SOUND_BYTES,
      );
    } catch (error) {
      throw this.dependencies.storageError(
        `écriture fichier son (${soundId})`,
        error,
      );
    }
    const entry: SoundManifestEntry = {
      soundId,
      sha256: encoded.sha256,
      bytes: encoded.encodedSize,
      uploadedAt: new Date().toISOString(),
      url: `/api/sounds/${encodeURIComponent(soundId)}/${encoded.sha256}.wav`,
    };
    const manifest = await this.dependencies.readManifest();
    await this.dependencies.writeManifest({
      updatedAt: entry.uploadedAt,
      sounds: { ...(manifest.sounds || {}), [soundId]: entry },
    });
    return entry;
  }
}
