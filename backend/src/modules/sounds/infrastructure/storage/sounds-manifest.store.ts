import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readEnvironment } from '../../../../platform/config/public-api';
import {
  assertStorageCapacity,
  StorageCapacityError,
  writeFileAtomic,
} from '../../../../platform/filesystem/public-api';
import type { NotificationDispatcher } from '../../../notification/public-api';
import type {
  SoundManifest,
  SoundKey,
} from '../../application/read-models/sound-manifest.record';
import {
  buildStorageIoError,
  decodeSoundManifest,
} from './sounds-storage.utils';
import { bestEffort } from '../../../../platform/observability/public-api';

/** Manifest persistence; callers serialize mutations with the sounds directory lock. */
export class SoundsManifestStore {
  constructor(
    private readonly storageRoot: string,
    private readonly notifications: NotificationDispatcher,
    private readonly logger: Logger,
    private readonly normalizeSoundKey: (value: string) => SoundKey,
  ) {}
  async ensureStorageCapacity(incomingBytes: number): Promise<void> {
    const quota = environmentBytes(
      'SOUNDS_STORAGE_QUOTA_BYTES',
      2 * 1024 * 1024 * 1024,
    );
    const reserve = environmentBytes(
      'STORAGE_MIN_FREE_BYTES',
      512 * 1024 * 1024,
    );
    try {
      await assertStorageCapacity({
        root: this.storageRoot,
        incomingBytes,
        maxTotalBytes: quota,
        minFreeBytes: reserve,
      });
    } catch (error) {
      if (error instanceof StorageCapacityError) {
        throw new HttpException(error.message, 507);
      }
      throw error;
    }
  }

  async readManifest(): Promise<SoundManifest> {
    const file = path.join(this.storageRoot, 'manifest.json');
    try {
      const stat = await fs.promises.stat(file);
      if (!stat.isFile() || stat.size > 1 * 1024 * 1024) {
        throw new BadRequestException('manifest audio trop volumineux');
      }
      const raw = await fs.promises.readFile(file, 'utf-8');
      const parsed = decodeSoundManifest(
        JSON.parse(raw.replace(/^\uFEFF/, '')),
      );
      if (!parsed) {
        throw new BadRequestException('manifest invalide');
      }
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT')
        return {
          updatedAt: new Date().toISOString(),
          sounds: {},
          disabled: [],
        };
      throw storageIoError(this.logger, 'lecture manifest.json', error);
    }
  }

  async writeManifest(next: SoundManifest): Promise<void> {
    const root = this.storageRoot;
    try {
      await fs.promises.mkdir(root, { recursive: true });
      await writeFileAtomic(
        path.join(this.storageRoot, 'manifest.json'),
        JSON.stringify(next, null, 2),
      );
    } catch (err) {
      throw storageIoError(this.logger, 'écriture manifest.json', err);
    }
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
      disabled: [...(manifest.disabled ?? [])],
    };
    delete next.sounds[soundId];
    await this.writeManifest(next);

    // Nettoyage best-effort: si le son est supprimé du manifest, supprimer aussi les fichiers associés.
    try {
      await fs.promises.rm(path.join(this.storageRoot, soundId), {
        recursive: true,
        force: true,
      });
    } catch (error) {
      this.logger.warn(
        `Nettoyage du son ${soundId} non terminé: ${errorMessage(error)}`,
      );
    }

    await bestEffort(
      this.notifications.notifyAll('sounds.updated', {
        soundId,
        sha256: null,
        url: null,
        updatedAt: next.updatedAt,
      }),
      'notification de suppression audio',
    );
    return { ok: true as const };
  }
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

function environmentBytes(
  key: 'SOUNDS_STORAGE_QUOTA_BYTES' | 'STORAGE_MIN_FREE_BYTES',
  fallback: number,
): number {
  const raw = readEnvironment(key).trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
