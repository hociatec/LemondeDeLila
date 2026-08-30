import * as fs from 'fs';
import * as path from 'path';
import {
  SOUND_KEYS,
  type SoundKey,
} from '../../application/contracts/sound-manifest.record';
import {
  SoundsReencoder,
  type SoundsMaintenanceDeps,
} from './sounds-reencoder';

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

export class SoundsMaintenanceManager {
  private readonly reencoder: SoundsReencoder;

  constructor(private readonly deps: SoundsMaintenanceDeps) {
    this.reencoder = new SoundsReencoder(deps);
  }

  reencodeAll() {
    return this.reencoder.reencodeAll();
  }

  reencodeInvalid() {
    return this.reencoder.reencodeInvalid();
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
      const filePath = sha256
        ? this.reencoder.findSourcePath(soundId, sha256)
        : null;
      const stat = filePath
        ? await fs.promises.stat(filePath).catch(() => null)
        : null;
      const exists = stat?.isFile() ?? false;
      if (entry?.sha256 && !exists) missing.push(soundId);
      sounds.push({
        soundId,
        inManifest: Boolean(entry?.sha256),
        sha256,
        filePath,
        exists,
        bytes: stat?.size ?? null,
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
      const sha256 = manifest.sounds?.[key]?.sha256;
      if (sha256) usedById[key] = sha256;
    }
    const directories = await fs.promises
      .readdir(root, { withFileTypes: true })
      .catch(() => []);
    let deletedFiles = 0;
    let deletedDirs = 0;
    for (const entry of directories) {
      if (!entry.isDirectory()) continue;
      const soundKey = SOUND_KEYS.find((key) => key === entry.name);
      const directory = path.join(root, entry.name);
      const keepSha = soundKey ? usedById[soundKey] : undefined;
      if (!soundKey || !keepSha) {
        if (await removeDirectory(directory)) deletedDirs += 1;
        continue;
      }
      deletedFiles += await this.deps.removeUnusedFilesForSoundId(
        soundKey,
        keepSha,
      );
      const remaining = await fs.promises.readdir(directory).catch(() => null);
      if (remaining?.length === 0 && (await removeDirectory(directory))) {
        deletedDirs += 1;
      }
    }
    return { ok: true, deletedFiles, deletedDirs };
  }
}

async function removeDirectory(directory: string): Promise<boolean> {
  try {
    await fs.promises.rm(directory, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}
