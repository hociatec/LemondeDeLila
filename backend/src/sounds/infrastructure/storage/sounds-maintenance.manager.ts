import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { writeFileAtomic } from '../../../common/utils/public-api';
import {
  SOUND_KEYS,
  type SoundKey,
  type SoundManifest,
  type SoundManifestEntry,
} from '../../application/models/sound-manifest.record';
import { toSoundErrorMessage } from './sounds-storage.utils';

type SoundsMaintenanceError = {
  soundId: string;
  message: string;
};

type SoundsDiagnosticItem = {
  soundId: string;
  inManifest: boolean;
  sha256?: string | null;
  filePath?: string | null;
  exists: boolean;
  bytes?: number | null;
  url?: string | null;
  uploadedAt?: string | null;
};

type SoundsMaintenanceManagerDeps = {
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
  now: () => string;
};

export class SoundsMaintenanceManager {
  constructor(private readonly deps: SoundsMaintenanceManagerDeps) {}

  async reencodeAll(): Promise<{
    ok: true;
    updated: number;
    skipped: number;
    missing: number;
    errors: number;
    details: {
      updated: string[];
      skipped: string[];
      missing: string[];
      errors: SoundsMaintenanceError[];
    };
  }> {
    const manifest = await this.deps.readManifest();
    const next = this.cloneManifest(manifest);
    const updated: string[] = [];
    const skipped: string[] = [];
    const missing: string[] = [];
    const errors: SoundsMaintenanceError[] = [];
    let changed = false;

    for (const soundId of SOUND_KEYS) {
      const entry = manifest.sounds?.[soundId];
      if (!entry?.sha256) continue;

      const sourcePath = this.findSourcePath(soundId, entry.sha256);
      if (!sourcePath) {
        missing.push(soundId);
        continue;
      }

      const result = await this.reencodeSourceFile(soundId, sourcePath);
      if (result.kind === 'error') {
        errors.push({ soundId, message: result.message });
        continue;
      }
      if (result.kind === 'skipped') {
        skipped.push(soundId);
        continue;
      }

      next.sounds[soundId] = result.entry;
      updated.push(soundId);
      changed = true;
    }

    await this.persistIfChanged(next, changed);
    return {
      ok: true,
      updated: updated.length,
      skipped: skipped.length,
      missing: missing.length,
      errors: errors.length,
      details: { updated, skipped, missing, errors },
    };
  }

  async reencodeInvalid(): Promise<{
    ok: true;
    updated: number;
    skipped: number;
    missing: number;
    invalid: number;
    errors: number;
    details: {
      updated: string[];
      skipped: string[];
      missing: string[];
      invalid: string[];
      errors: SoundsMaintenanceError[];
    };
  }> {
    const manifest = await this.deps.readManifest();
    const next = this.cloneManifest(manifest);
    const updated: string[] = [];
    const skipped: string[] = [];
    const missing: string[] = [];
    const invalid: string[] = [];
    const errors: SoundsMaintenanceError[] = [];
    let changed = false;

    for (const soundId of SOUND_KEYS) {
      const entry = manifest.sounds?.[soundId];
      if (!entry?.sha256) continue;

      const sourcePath = this.findSourcePath(soundId, entry.sha256);
      if (!sourcePath) {
        missing.push(soundId);
        continue;
      }

      let needsFix = false;
      try {
        await this.validateSoundFile(sourcePath);
      } catch {
        needsFix = true;
        invalid.push(soundId);
      }
      if (!needsFix) {
        skipped.push(soundId);
        continue;
      }

      const result = await this.reencodeSourceFile(soundId, sourcePath);
      if (result.kind === 'error') {
        errors.push({ soundId, message: result.message });
        continue;
      }
      if (result.kind === 'skipped') {
        skipped.push(soundId);
        continue;
      }

      next.sounds[soundId] = result.entry;
      updated.push(soundId);
      changed = true;
    }

    await this.persistIfChanged(next, changed);
    return {
      ok: true,
      updated: updated.length,
      skipped: skipped.length,
      missing: missing.length,
      invalid: invalid.length,
      errors: errors.length,
      details: { updated, skipped, missing, invalid, errors },
    };
  }

  async diagnose(): Promise<{
    ok: true;
    dataRoot: string;
    manifestPath: string;
    manifestUpdatedAt: string;
    total: number;
    missing: string[];
    sounds: SoundsDiagnosticItem[];
  }> {
    const manifest = await this.deps.readManifest();
    const root = this.deps.dataRoot();
    const missing: string[] = [];
    const sounds: SoundsDiagnosticItem[] = [];

    for (const soundId of SOUND_KEYS) {
      const entry = manifest.sounds?.[soundId];
      const sha256 = entry?.sha256 ?? null;
      const filePath = sha256 ? this.findSourcePath(soundId, sha256) : null;
      let exists = false;
      let bytes: number | null = null;

      if (filePath) {
        try {
          const stat = await fs.promises.stat(filePath);
          exists = stat.isFile();
          bytes = stat.size;
        } catch {
          exists = false;
        }
      }

      if (entry?.sha256 && !exists) {
        missing.push(soundId);
      }

      sounds.push({
        soundId,
        inManifest: Boolean(entry?.sha256),
        sha256,
        filePath,
        exists,
        bytes,
        url: entry?.url ?? null,
        uploadedAt: entry?.uploadedAt ?? null,
      });
    }

    return {
      ok: true,
      dataRoot: root,
      manifestPath: path.join(root, 'manifest.json'),
      manifestUpdatedAt: manifest.updatedAt ?? this.deps.now(),
      total: sounds.length,
      missing,
      sounds,
    };
  }

  async cleanupUnused(): Promise<{
    ok: true;
    deletedFiles: number;
    deletedDirs: number;
  }> {
    const root = this.deps.dataRoot();
    const manifest = await this.deps.readManifest();
    const usedById: Partial<Record<SoundKey, string>> = {};

    for (const key of SOUND_KEYS) {
      const entry = manifest.sounds?.[key];
      if (entry?.sha256) {
        usedById[key] = entry.sha256;
      }
    }

    let dirs: fs.Dirent[];
    try {
      dirs = await fs.promises.readdir(root, { withFileTypes: true });
    } catch {
      return { ok: true, deletedFiles: 0, deletedDirs: 0 };
    }

    let deletedFiles = 0;
    let deletedDirs = 0;
    for (const dirent of dirs) {
      if (!dirent.isDirectory()) continue;
      const soundKey = SOUND_KEYS.find((key) => key === dirent.name);
      const dirPath = path.join(root, dirent.name);

      if (!soundKey) {
        if (await this.removeDir(dirPath)) deletedDirs += 1;
        continue;
      }

      const keepSha = usedById[soundKey];
      if (!keepSha) {
        if (await this.removeDir(dirPath)) deletedDirs += 1;
        continue;
      }

      deletedFiles += await this.deps.removeUnusedFilesForSoundId(
        soundKey,
        keepSha,
      );

      try {
        const remaining = await fs.promises.readdir(dirPath);
        if (remaining.length === 0 && (await this.removeDir(dirPath))) {
          deletedDirs += 1;
        }
      } catch {
        // ignore
      }
    }

    return { ok: true, deletedFiles, deletedDirs };
  }

  private async validateSoundFile(filePath: string): Promise<void> {
    const duration = await this.deps.probeDurationSeconds(filePath);
    if (duration < 0.2) {
      throw new BadRequestException('Son trop court (min 200ms).');
    }
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
      const outputPath = transcoded.outputPath;
      await this.validateSoundFile(outputPath);
      const bytes = await fs.promises.readFile(outputPath);
      const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
      const currentSha = path.basename(sourcePath).replace(/\.(wav|mp3)$/i, '');
      if (sha256 === currentSha) {
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
    } catch (err) {
      return { kind: 'error', message: toSoundErrorMessage(err) };
    } finally {
      if (tempDir) {
        try {
          await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }
    }
  }

  private findSourcePath(soundId: SoundKey, sha256: string): string | null {
    const soundDir = path.join(this.deps.dataRoot(), soundId);
    const wav = path.join(soundDir, `${sha256}.wav`);
    const mp3 = path.join(soundDir, `${sha256}.mp3`);
    if (fs.existsSync(wav)) return wav;
    if (fs.existsSync(mp3)) return mp3;
    return null;
  }

  private cloneManifest(manifest: SoundManifest): SoundManifest {
    return {
      updatedAt: manifest.updatedAt,
      sounds: { ...(manifest.sounds ?? {}) },
    };
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

  private async removeDir(dirPath: string): Promise<boolean> {
    try {
      await fs.promises.rm(dirPath, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }
}
