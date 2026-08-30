import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  bestEffort,
  writeFileAtomic,
} from '../../../../shared/utils/public-api';
import type {
  SoundKey,
  SoundManifest,
  SoundManifestEntry,
} from '../../application/contracts/sound-manifest.record';
import {
  detectSoundSilence,
  probeSoundDurationSeconds,
  transcodeSoundToStableWav,
} from './sounds-audio.utils';
import {
  audioToolExecutionError,
  isAudioProcessSpawnError,
} from './sounds-audio-process';

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
  bytes: Buffer;
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
  ): Promise<SoundManifestEntry> {
    const soundId = this.dependencies.normalizeSoundKey(soundIdRaw);
    const isWavInput = await this.validateInput(tempFilePath, originalName);
    const encoded = await this.encodeAndValidate(tempFilePath, isWavInput);
    const entry = await this.persist(soundId, encoded);
    await this.dependencies.removeUnusedFiles(soundId, encoded.sha256);
    await this.dependencies.notifyUpdated(entry, entry.uploadedAt);
    return entry;
  }

  private async validateInput(
    tempFilePath: string,
    originalName?: string,
  ): Promise<boolean> {
    if (!tempFilePath || !fs.existsSync(tempFilePath)) {
      throw new BadRequestException('Fichier manquant.');
    }
    const extension = path.extname(originalName || tempFilePath).toLowerCase();
    if (!['.mp3', '.wav', '.wave'].includes(extension)) {
      throw new BadRequestException(
        'Seuls les fichiers .mp3, .wav ou .wave sont acceptés.',
      );
    }
    await this.assertValidSize(tempFilePath, '');
    const duration = await probeSoundDurationSeconds(
      tempFilePath,
      this.dependencies.warn,
    );
    if (duration < MIN_SOUND_DURATION_SECONDS) {
      throw new BadRequestException('Son trop court (min 200ms).');
    }
    return extension === '.wav' || extension === '.wave';
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
      const bytes = await fs.promises.readFile(outputPath);
      const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
      return { bytes, sha256, encodedSize };
    } finally {
      if (tempDir) {
        await bestEffort(
          fs.promises.rm(tempDir, { recursive: true, force: true }),
          'nettoyage du transcodage audio temporaire',
        );
      }
    }
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
      await this.dependencies.ensureStorageCapacity(encoded.bytes.length);
      await fs.promises.mkdir(soundDir, { recursive: true });
      await writeFileAtomic(
        path.join(soundDir, `${encoded.sha256}.wav`),
        encoded.bytes,
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
      bytes: encoded.encodedSize || encoded.bytes.length,
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
