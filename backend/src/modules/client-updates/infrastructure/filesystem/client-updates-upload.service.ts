import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Inject } from '@nestjs/common';
import {
  assertPathInside,
  assertStorageCapacity,
  bestEffort,
  getErrorMessage,
  parseVersion,
  writeFileAtomic,
  StorageCapacityError,
} from '../../../../shared/utils/public-api';
import { readEnvironment } from '../../../../platform/config/public-api';
import {
  CLIENT_UPDATES_UPLOAD_STORE_PORT,
  type ClientUpdatesUploadStorePort,
} from '../../application/ports/client-updates-upload-store.port';
import {
  ClientUpdateMeta,
  CompletedUploadMarker,
  UploadMetaFile,
} from '../../application/models/client-update-meta.record';
import { ClientUpdatesService } from '../../application/use-cases/client-updates/client-updates.service';
import { decodeUploadMetaFile } from './client-update-meta.decoder';

@Injectable()
export class ClientUpdatesUploadService {
  private static readonly MAX_TOTAL_BYTES = 600 * 1024 * 1024;
  private static readonly MAX_CHUNKS = 10_000;
  private readonly logger = new Logger(ClientUpdatesUploadService.name);

  constructor(
    private readonly updates: ClientUpdatesService,
    @Inject(CLIENT_UPDATES_UPLOAD_STORE_PORT)
    private readonly uploadStore: ClientUpdatesUploadStorePort,
  ) {}

  async status() {
    const latest = await this.updates.getLatest();
    return {
      latest,
      targetDir: this.updates.getTargetDir(),
      publicUrl: this.updates.getPublicUrl(),
    };
  }

  private async saveAndApplyZip(zipPath: string, meta: ClientUpdateMeta) {
    try {
      await this.updates.applyZip(zipPath);

      try {
        const published =
          await this.updates.getPublishedClickOnceVersionFromDisk();
        if (published) {
          meta = { ...meta, version: published };
        }
      } catch {
        // Best-effort
      }

      await this.updates.saveLatest(meta);
    } catch (err) {
      const msg = getErrorMessage(err);
      throw new BadRequestException(`Publication echouee: ${msg}`);
    }
  }

  async uploadSingleZip(params: {
    zipPath: string;
    version?: string;
    message?: string;
    minRequiredVersion?: string;
  }) {
    const zipPath = params.zipPath;
    if (!zipPath || !fs.existsSync(zipPath)) {
      throw new BadRequestException('Fichier upload introuvable.');
    }
    await this.ensureStorageCapacity(
      this.updates.getTargetDir(),
      (await fs.promises.stat(zipPath)).size,
    );

    const version =
      normalizeVersion(params.version) ?? `uploaded-${Date.now()}`;
    const message = normalizeMessage(params.message);
    const minRequiredVersion = normalizeMinRequiredVersion(
      params.minRequiredVersion,
    );

    const meta: ClientUpdateMeta = {
      version,
      publishedAt: new Date().toISOString(),
      message,
      publicUrl: this.updates.getPublicUrl(),
      minRequiredVersion,
    };
    await this.saveAndApplyZip(zipPath, meta);
    return { ok: true, meta };
  }

  async uploadInit(params: {
    version?: string;
    message?: string;
    minRequiredVersion?: string;
    totalBytes?: number | null;
  }) {
    const uploadId = randomUUID();
    const root = this.uploadStore.getUploadsRoot();
    await fs.promises.mkdir(root, { recursive: true });
    const dir = path.join(root, uploadId);
    await fs.promises.mkdir(dir, { recursive: true });

    const meta: UploadMetaFile = {
      uploadId,
      version: normalizeVersion(params.version),
      message: normalizeMessage(params.message),
      minRequiredVersion: normalizeMinRequiredVersion(
        params.minRequiredVersion,
      ),
      totalBytes: this.normalizeTotalBytes(params.totalBytes),
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    await writeFileAtomic(
      path.join(dir, 'meta.json'),
      JSON.stringify(meta, null, 2),
    );

    return { uploadId };
  }

  async uploadChunk(params: {
    uploadId: string;
    index: number;
    filePath: string;
  }) {
    const uploadId = this.normalizeUploadId(params.uploadId);
    const index = params.index;
    if (
      !Number.isSafeInteger(index) ||
      index < 0 ||
      index >= ClientUpdatesUploadService.MAX_CHUNKS
    ) {
      throw new BadRequestException('uploadId/index invalides.');
    }
    if (!params.filePath || !fs.existsSync(params.filePath)) {
      throw new BadRequestException('Chunk manquant (champ "file").');
    }

    const root = this.uploadStore.getUploadsRoot();
    const dir = assertPathInside(root, path.join(root, uploadId));
    const metaPath = path.join(dir, 'meta.json');
    if (!fs.existsSync(metaPath)) {
      throw new BadRequestException(
        `Upload introuvable (uploadId=${uploadId}).`,
      );
    }

    const partPath = path.join(dir, `${index}.part`);
    if (fs.existsSync(partPath)) {
      return { ok: true, duplicate: true };
    }
    await this.ensureStorageCapacity(
      root,
      (await fs.promises.stat(params.filePath)).size,
    );
    try {
      await fs.promises.copyFile(
        params.filePath,
        partPath,
        fs.constants.COPYFILE_EXCL,
      );
    } catch (error) {
      if (isNodeError(error) && error.code === 'EEXIST') {
        return { ok: true, duplicate: true };
      }
      throw this.storageError(error);
    }
    await fs.promises.rm(params.filePath, { force: true });
    return { ok: true };
  }

  async uploadComplete(params: { uploadId: string }) {
    const uploadId = this.normalizeUploadId(params.uploadId);
    const root = this.uploadStore.getUploadsRoot();
    const dir = assertPathInside(root, path.join(root, uploadId));
    const metaPath = path.join(dir, 'meta.json');
    const completedMarker =
      await this.uploadStore.readCompletedMarker(uploadId);
    if (!fs.existsSync(metaPath)) {
      if (completedMarker) {
        return { ok: true, alreadyCompleted: true, meta: completedMarker.meta };
      }
      throw new BadRequestException(
        `Upload introuvable (uploadId=${uploadId}).`,
      );
    }
    const lockPath = path.join(dir, '.complete.lock');
    const lockFd = await this.acquireCompletionLock(lockPath);
    try {
      return await this.completeLocked(
        uploadId,
        dir,
        metaPath,
        completedMarker,
      );
    } finally {
      await bestEffort(
        lockFd.close(),
        'fermeture du verrou upload client',
        this.logger,
      );
      void bestEffort(
        fs.promises.rm(lockPath, { force: true }),
        'suppression du verrou upload client',
        this.logger,
      );
    }
  }

  private async acquireCompletionLock(
    lockPath: string,
  ): Promise<fs.promises.FileHandle> {
    try {
      return await fs.promises.open(lockPath, 'wx');
    } catch {
      throw new ConflictException('Finalisation deja en cours.');
    }
  }

  private async completeLocked(
    uploadId: string,
    dir: string,
    metaPath: string,
    marker: CompletedUploadMarker | null,
  ) {
    const meta = await this.readUploadMeta(metaPath);
    if (meta.completedAt) {
      return this.completedResult(meta, marker);
    }
    const parts = await this.listContiguousParts(dir);
    const zipPath = path.join(
      os.tmpdir(),
      `lila-client-update-${uploadId}.zip`,
    );
    let published = false;
    let markerWritten = false;
    try {
      await this.assembleArchive(dir, parts, zipPath);
      await this.assertArchiveSize(zipPath, meta.totalBytes);
      const saved = this.toPublishedMeta(meta);
      await this.saveAndApplyZip(zipPath, saved);
      await writeFileAtomic(
        metaPath,
        JSON.stringify(
          { ...meta, completedAt: new Date().toISOString() },
          null,
          2,
        ),
      );
      published = true;
      markerWritten = await this.writeCompletionMarker(uploadId, saved);
      return { ok: true, meta: saved };
    } finally {
      void bestEffort(
        fs.promises.rm(zipPath, { force: true }),
        'suppression de l’archive client temporaire',
        this.logger,
      );
      if (published && markerWritten) {
        void bestEffort(
          fs.promises.rm(dir, { recursive: true, force: true }),
          'suppression des chunks client finalisés',
          this.logger,
        );
      }
    }
  }

  private async readUploadMeta(metaPath: string): Promise<UploadMetaFile> {
    const raw = await fs.promises.readFile(metaPath, 'utf-8');
    const parsed: unknown = JSON.parse(raw.replace(/^\uFEFF/, ''));
    const meta = decodeUploadMetaFile(parsed);
    if (!meta) {
      throw new BadRequestException('Métadonnées d’upload invalides.');
    }
    return meta;
  }

  private normalizeUploadId(input: unknown): string {
    const uploadId = typeof input === 'string' ? input.trim() : '';
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(uploadId)) {
      throw new BadRequestException('uploadId invalide.');
    }
    return uploadId;
  }

  private normalizeTotalBytes(input: number | null | undefined): number | null {
    if (input == null) return null;
    if (
      !Number.isSafeInteger(input) ||
      input <= 0 ||
      input > ClientUpdatesUploadService.MAX_TOTAL_BYTES
    ) {
      throw new BadRequestException('totalBytes invalide.');
    }
    return input;
  }

  private async ensureStorageCapacity(
    root: string,
    incomingBytes: number,
  ): Promise<void> {
    try {
      await assertStorageCapacity({
        root,
        incomingBytes,
        maxTotalBytes: this.environmentBytes(
          'CLIENT_UPDATES_STORAGE_QUOTA_BYTES',
          4 * 1024 * 1024 * 1024,
        ),
        minFreeBytes: this.environmentBytes(
          'STORAGE_MIN_FREE_BYTES',
          512 * 1024 * 1024,
        ),
      });
    } catch (error) {
      throw this.storageError(error);
    }
  }

  private storageError(error: unknown): unknown {
    if (
      error instanceof StorageCapacityError ||
      (isNodeError(error) && error.code === 'ENOSPC')
    ) {
      return new HttpException(
        error instanceof Error ? error.message : 'Espace disque insuffisant.',
        507,
      );
    }
    return error;
  }

  private environmentBytes(
    key: 'CLIENT_UPDATES_STORAGE_QUOTA_BYTES' | 'STORAGE_MIN_FREE_BYTES',
    fallback: number,
  ): number {
    const raw = readEnvironment(key).trim();
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
  }

  private completedResult(
    meta: UploadMetaFile,
    marker: CompletedUploadMarker | null,
  ) {
    return {
      ok: true,
      alreadyCompleted: true,
      meta: marker?.meta ?? {
        version: meta.version || `uploaded-${Date.now()}`,
        publishedAt:
          meta.completedAt || meta.createdAt || new Date().toISOString(),
        message: meta.message || null,
        publicUrl: this.updates.getPublicUrl(),
        minRequiredVersion: meta.minRequiredVersion || null,
      },
    };
  }

  private async listContiguousParts(
    dir: string,
  ): Promise<Array<{ name: string; index: number }>> {
    const parts = (await fs.promises.readdir(dir))
      .filter((file) => file.endsWith('.part'))
      .map((name) => ({
        name,
        index: Number.parseInt(name.replace('.part', ''), 10),
      }))
      .filter((part) => Number.isFinite(part.index))
      .sort((left, right) => left.index - right.index);
    if (parts.length === 0) {
      throw new BadRequestException('Aucun chunk recu.');
    }
    for (let expected = 0; expected < parts.length; expected++) {
      if (parts[expected].index !== expected) {
        throw new BadRequestException(
          `Chunks manquants ou index non-contigus (attendu ${expected}).`,
        );
      }
    }
    return parts;
  }

  private async assembleArchive(
    dir: string,
    parts: Array<{ name: string }>,
    zipPath: string,
  ): Promise<void> {
    const output = fs.createWriteStream(zipPath);
    const finished = new Promise<void>((resolve, reject) => {
      output.on('error', reject);
      output.on('finish', resolve);
    });
    try {
      for (const part of parts) {
        await new Promise<void>((resolve, reject) => {
          const input = fs.createReadStream(path.join(dir, part.name));
          input.on('error', reject);
          input.on('end', resolve);
          input.pipe(output, { end: false });
        });
      }
      output.end();
      await finished;
    } finally {
      output.destroy();
    }
  }

  private async assertArchiveSize(
    zipPath: string,
    expectedBytes: number | null,
  ): Promise<void> {
    const { size } = await fs.promises.stat(zipPath);
    if (size > ClientUpdatesUploadService.MAX_TOTAL_BYTES) {
      throw new BadRequestException('Archive trop volumineuse.');
    }
    if (expectedBytes != null && size !== expectedBytes) {
      throw new BadRequestException(
        `Taille archive invalide (attendu ${expectedBytes}, reçu ${size}).`,
      );
    }
  }

  private toPublishedMeta(meta: UploadMetaFile): ClientUpdateMeta {
    return {
      version: meta.version || `uploaded-${Date.now()}`,
      publishedAt: new Date().toISOString(),
      message: meta.message || null,
      publicUrl: this.updates.getPublicUrl(),
      minRequiredVersion: meta.minRequiredVersion || null,
    };
  }

  private async writeCompletionMarker(
    uploadId: string,
    meta: ClientUpdateMeta,
  ): Promise<boolean> {
    try {
      await this.uploadStore.writeCompletedMarker(uploadId, meta);
      return true;
    } catch (error) {
      this.logger.warn(
        `Impossible d'ecrire le marqueur de finalisation uploadId=${uploadId}: ${getErrorMessage(error)}`,
      );
      return false;
    }
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}

function normalizeVersion(input: unknown): string | null {
  const value = typeof input === 'string' ? input.trim() : '';
  if (!value) return null;
  if (parseVersion(value) == null) {
    throw new BadRequestException('Version invalide');
  }
  return value;
}

function normalizeMinRequiredVersion(input: unknown): string | null {
  const value = typeof input === 'string' ? input.trim() : '';
  if (!value) return null;
  if (parseVersion(value) == null) {
    throw new BadRequestException('minRequiredVersion invalide');
  }
  return value;
}

function normalizeMessage(input: unknown): string | null {
  const message = typeof input === 'string' ? input.trim() : '';
  return message || null;
}
