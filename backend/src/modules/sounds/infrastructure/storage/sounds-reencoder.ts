import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { writeFileAtomic } from '../../../../shared/utils/public-api';
import {
  SOUND_KEYS,
  type SoundKey,
  type SoundManifest,
  type SoundManifestEntry,
} from '../../application/contracts/sound-manifest.record';
import { toSoundErrorMessage } from './sounds-storage.utils';

export type SoundsMaintenanceDeps = {
  dataRoot: () => string;
  readManifest: () => Promise<SoundManifest>;
  writeManifest: (manifest: SoundManifest) => Promise<void>;
  transcodeToStableWav: (
    inputPath: string,
  ) => Promise<{ outputPath: string; tempDir: string }>;
  probeDurationSeconds: (filePath: string) => Promise<number>;
  detectSilence: (filePath: string) => Promise<boolean>;
  removeUnusedFilesForSoundId: (
    soundId: SoundKey,
    keepSha256: string,
  ) => Promise<number>;
  notifySoundsUpdated: (updatedAt: string) => Promise<void>;
  warn: (message: string) => void;
  now: () => string;
};

type ReencodeDetails = {
  updated: string[];
  skipped: string[];
  missing: string[];
  invalid: string[];
  errors: { soundId: string; message: string }[];
};

export class SoundsReencoder {
  constructor(private readonly deps: SoundsMaintenanceDeps) {}

  async reencodeAll() {
    const details = await this.reencode(false);
    return {
      ok: true as const,
      updated: details.updated.length,
      skipped: details.skipped.length,
      missing: details.missing.length,
      errors: details.errors.length,
      details: withoutInvalid(details),
    };
  }

  async reencodeInvalid() {
    const details = await this.reencode(true);
    return {
      ok: true as const,
      updated: details.updated.length,
      skipped: details.skipped.length,
      missing: details.missing.length,
      invalid: details.invalid.length,
      errors: details.errors.length,
      details,
    };
  }

  findSourcePath(soundId: SoundKey, sha256: string): string | null {
    const soundDir = path.join(this.deps.dataRoot(), soundId);
    const wav = path.join(soundDir, `${sha256}.wav`);
    const mp3 = path.join(soundDir, `${sha256}.mp3`);
    if (fs.existsSync(wav)) return wav;
    if (fs.existsSync(mp3)) return mp3;
    return null;
  }

  private async reencode(onlyInvalid: boolean): Promise<ReencodeDetails> {
    const manifest = await this.deps.readManifest();
    const next = cloneManifest(manifest);
    const details: ReencodeDetails = {
      updated: [],
      skipped: [],
      missing: [],
      invalid: [],
      errors: [],
    };
    for (const soundId of SOUND_KEYS) {
      const entry = manifest.sounds?.[soundId];
      if (!entry?.sha256) continue;
      const sourcePath = this.findSourcePath(soundId, entry.sha256);
      if (!sourcePath) {
        details.missing.push(soundId);
        continue;
      }
      if (onlyInvalid && (await this.isValid(sourcePath))) {
        details.skipped.push(soundId);
        continue;
      }
      if (onlyInvalid) details.invalid.push(soundId);
      const result = await this.reencodeSourceFile(soundId, sourcePath);
      if (result.kind === 'error')
        details.errors.push({ soundId, message: result.message });
      else if (result.kind === 'skipped') details.skipped.push(soundId);
      else {
        next.sounds[soundId] = result.entry;
        details.updated.push(soundId);
      }
    }
    await this.persistIfChanged(next, details.updated.length > 0);
    return details;
  }

  private async isValid(filePath: string): Promise<boolean> {
    try {
      await this.validateSoundFile(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async validateSoundFile(filePath: string): Promise<void> {
    const duration = await this.deps.probeDurationSeconds(filePath);
    if (duration < 0.2)
      throw new BadRequestException('Son trop court (min 200ms).');
    if (await this.deps.detectSilence(filePath)) {
      throw new BadRequestException('Son silencieux (volume max = -inf).');
    }
  }

  private async reencodeSourceFile(
    soundId: SoundKey,
    sourcePath: string,
  ): Promise<
    | { kind: 'updated'; entry: SoundManifestEntry }
    | { kind: 'skipped' }
    | { kind: 'error'; message: string }
  > {
    let tempDir: string | null = null;
    try {
      const transcoded = await this.deps.transcodeToStableWav(sourcePath);
      tempDir = transcoded.tempDir;
      await this.validateSoundFile(transcoded.outputPath);
      const bytes = await fs.promises.readFile(transcoded.outputPath);
      const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
      if (sha256 === path.basename(sourcePath).replace(/\.(wav|mp3)$/i, '')) {
        return { kind: 'skipped' };
      }
      const soundDir = path.join(this.deps.dataRoot(), soundId);
      await fs.promises.mkdir(soundDir, { recursive: true });
      await writeFileAtomic(path.join(soundDir, `${sha256}.wav`), bytes);
      await this.deps.removeUnusedFilesForSoundId(soundId, sha256);
      return {
        kind: 'updated',
        entry: {
          soundId,
          sha256,
          bytes: bytes.length,
          uploadedAt: this.deps.now(),
          url: `/api/sounds/${encodeURIComponent(soundId)}/${sha256}.wav`,
        },
      };
    } catch (error) {
      return { kind: 'error', message: toSoundErrorMessage(error) };
    } finally {
      if (tempDir) {
        try {
          await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
          this.deps.warn(
            `Impossible de supprimer le répertoire temporaire audio: ${toSoundErrorMessage(error)}`,
          );
        }
      }
    }
  }

  private async persistIfChanged(
    manifest: SoundManifest,
    changed: boolean,
  ): Promise<void> {
    if (!changed) return;
    manifest.updatedAt = this.deps.now();
    await this.deps.writeManifest(manifest);
    await this.deps.notifySoundsUpdated(manifest.updatedAt);
  }
}

function cloneManifest(manifest: SoundManifest): SoundManifest {
  return {
    updatedAt: manifest.updatedAt,
    sounds: { ...(manifest.sounds ?? {}) },
  };
}

function withoutInvalid(details: ReencodeDetails) {
  return {
    updated: details.updated,
    skipped: details.skipped,
    missing: details.missing,
    errors: details.errors,
  };
}
