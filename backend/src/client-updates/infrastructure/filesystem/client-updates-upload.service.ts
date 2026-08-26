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
  getErrorMessage,
  parseVersion,
} from '../../../common/utils/public-api';
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

  private normalizeVersion(input: unknown): string | null {
    const v = typeof input === 'string' ? input.trim() : '';
    if (!v) return null;
    if (parseVersion(v) == null) {
      throw new BadRequestException('Version invalide');
    }
    return v;
  }

  private normalizeMinRequiredVersion(input: unknown): string | null {
    const v = typeof input === 'string' ? input.trim() : '';
    if (!v) return null;
    if (parseVersion(v) == null) {
      throw new BadRequestException('minRequiredVersion invalide');
    }
    return v;
  }

  private normalizeMessage(input: unknown): string | null {
    const m = typeof input === 'string' ? input.trim() : '';
    return m ? m : null;
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

    const version =
      this.normalizeVersion(params.version) ?? `uploaded-${Date.now()}`;
    const message = this.normalizeMessage(params.message);
    const minRequiredVersion = this.normalizeMinRequiredVersion(
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
      version: this.normalizeVersion(params.version),
      message: this.normalizeMessage(params.message),
      minRequiredVersion: this.normalizeMinRequiredVersion(
        params.minRequiredVersion,
      ),
      totalBytes:
        typeof params.totalBytes === 'number' &&
        Number.isFinite(params.totalBytes)
          ? params.totalBytes
          : null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    await fs.promises.writeFile(
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
    const uploadId = (params.uploadId || '').trim();
    const index = params.index;
    if (!uploadId || !Number.isFinite(index) || index < 0) {
      throw new BadRequestException('uploadId/index invalides.');
    }
    if (!params.filePath || !fs.existsSync(params.filePath)) {
      throw new BadRequestException('Chunk manquant (champ "file").');
    }

    const dir = path.join(this.uploadStore.getUploadsRoot(), uploadId);
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
    await fs.promises.rename(params.filePath, partPath);
    return { ok: true };
  }

  async uploadComplete(params: { uploadId: string }) {
    const uploadId = (params.uploadId || '').trim();
    if (!uploadId) {
      throw new BadRequestException('uploadId manquant.');
    }
    const dir = path.join(this.uploadStore.getUploadsRoot(), uploadId);
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
      await lockFd.close().catch(() => undefined);
      fs.promises.rm(lockPath, { force: true }).catch(() => undefined);
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
      const saved = this.toPublishedMeta(meta);
      await this.saveAndApplyZip(zipPath, saved);
      await fs.promises.writeFile(
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
      fs.promises.rm(zipPath, { force: true }).catch(() => undefined);
      if (published && markerWritten) {
        fs.promises
          .rm(dir, { recursive: true, force: true })
          .catch(() => undefined);
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
