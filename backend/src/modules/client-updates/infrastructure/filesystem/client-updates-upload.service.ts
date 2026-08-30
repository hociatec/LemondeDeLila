import {
  BadRequestException,
  ConflictException,
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
  bestEffort,
  getErrorMessage,
  writeFileAtomic,
} from '../../../../shared/utils/public-api';
import {
  CLIENT_UPDATES_UPLOAD_STORE_PORT,
  type ClientUpdatesUploadStorePort,
} from '../../application/ports/client-updates-upload-store.port';
import {
  ClientUpdateMeta,
  CompletedUploadMarker,
  UploadMetaFile,
} from '../../application/contracts/client-update-meta.record';
import { ClientUpdatesService } from '../../application/use-cases/client-updates/client-updates.service';
import { decodeUploadMetaFile } from './client-update-meta.decoder';
import {
  assembleUploadArchive,
  assertUploadArchiveSize,
  listContiguousUploadParts,
} from './client-update-upload-archive';
import {
  clientUpdateStorageError,
  ensureClientUpdateStorageCapacity,
  isNodeError,
  normalizeMessage,
  normalizeMinRequiredVersion,
  normalizeUploadId,
  normalizeUploadTotalBytes,
  normalizeVersion,
} from './client-updates-upload-policy';
import { publishUploadedClientUpdate } from './client-updates-upload-publication';

@Injectable()
export class ClientUpdatesUploadService {
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
    await ensureClientUpdateStorageCapacity(
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
    const publishedMeta = await publishUploadedClientUpdate(
      this.updates,
      zipPath,
      meta,
    );
    return { ok: true, meta: publishedMeta };
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
      totalBytes: normalizeUploadTotalBytes(params.totalBytes),
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
    const uploadId = normalizeUploadId(params.uploadId);
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
    await ensureClientUpdateStorageCapacity(
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
      throw clientUpdateStorageError(error);
    }
    await fs.promises.rm(params.filePath, { force: true });
    return { ok: true };
  }

  async uploadComplete(params: { uploadId: string }) {
    const uploadId = normalizeUploadId(params.uploadId);
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
    const parts = await listContiguousUploadParts(dir);
    const zipPath = path.join(
      os.tmpdir(),
      `lila-client-update-${uploadId}.zip`,
    );
    let published = false;
    let markerWritten = false;
    try {
      await assembleUploadArchive(dir, parts, zipPath);
      await assertUploadArchiveSize(zipPath, meta.totalBytes);
      const saved = this.toPublishedMeta(meta);
      const publishedMeta = await publishUploadedClientUpdate(
        this.updates,
        zipPath,
        saved,
      );
      await writeFileAtomic(
        metaPath,
        JSON.stringify(
          { ...meta, completedAt: new Date().toISOString() },
          null,
          2,
        ),
      );
      published = true;
      markerWritten = await this.writeCompletionMarker(uploadId, publishedMeta);
      return { ok: true, meta: publishedMeta };
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
