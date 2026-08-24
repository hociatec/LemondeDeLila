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
import { parseVersion } from '../../../common/utils/public-api';
import {
  CLIENT_UPDATES_UPLOAD_STORE_PORT,
  type ClientUpdatesUploadStorePort,
} from '../../application/ports/client-updates-upload-store.port';
import {
  ClientUpdateMeta,
  UploadMetaFile,
} from '../../application/models/client-update-meta.record';
import { ClientUpdatesService } from '../../application/use-cases/client-updates/client-updates.service';

function getErrorMessage(value: unknown): string {
  if (value instanceof Error && typeof value.message === 'string') {
    const message = value.message.trim();
    if (message) {
      return message;
    }
  }
  return 'erreur inconnue';
}

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
    const completedMarker = await this.uploadStore.readCompletedMarker(uploadId);
    if (!fs.existsSync(metaPath)) {
      if (completedMarker) {
        return { ok: true, alreadyCompleted: true, meta: completedMarker.meta };
      }
      throw new BadRequestException(
        `Upload introuvable (uploadId=${uploadId}).`,
      );
    }

    const lockPath = path.join(dir, '.complete.lock');
    let lockFd: fs.promises.FileHandle | null = null;
    try {
      lockFd = await fs.promises.open(lockPath, 'wx');
    } catch {
      throw new ConflictException('Finalisation deja en cours.');
    }

    try {
      const metaRaw = await fs.promises.readFile(metaPath, 'utf-8');
      const meta = JSON.parse(metaRaw.replace(/^\uFEFF/, '')) as UploadMetaFile;

      if (meta.completedAt) {
        if (completedMarker) {
          return {
            ok: true,
            alreadyCompleted: true,
            meta: completedMarker.meta,
          };
        }
        const fallbackMeta: ClientUpdateMeta = {
          version: meta.version || `uploaded-${Date.now()}`,
          publishedAt:
            meta.completedAt || meta.createdAt || new Date().toISOString(),
          message: meta.message || null,
          publicUrl: this.updates.getPublicUrl(),
          minRequiredVersion: meta.minRequiredVersion || null,
        };
        return { ok: true, alreadyCompleted: true, meta: fallbackMeta };
      }

      const parts = (await fs.promises.readdir(dir))
        .filter((f) => f.endsWith('.part'))
        .map((f) => ({
          name: f,
          index: Number.parseInt(f.replace('.part', ''), 10),
        }))
        .filter((p) => Number.isFinite(p.index))
        .sort((a, b) => a.index - b.index);

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

      const zipPath = path.join(
        os.tmpdir(),
        `lila-client-update-${uploadId}.zip`,
      );
      const out = fs.createWriteStream(zipPath);
      const outDone = new Promise<void>((resolve, reject) => {
        out.on('error', reject);
        out.on('finish', resolve);
      });
      let published = false;
      let markerWritten = false;

      try {
        for (const part of parts) {
          const partPath = path.join(dir, part.name);
          await new Promise<void>((resolve, reject) => {
            const input = fs.createReadStream(partPath);
            input.on('error', reject);
            input.on('end', resolve);
            input.pipe(out, { end: false });
          });
        }
        out.end();
        await outDone;

        const saved: ClientUpdateMeta = {
          version: meta.version || `uploaded-${Date.now()}`,
          publishedAt: new Date().toISOString(),
          message: meta.message || null,
          publicUrl: this.updates.getPublicUrl(),
          minRequiredVersion: meta.minRequiredVersion || null,
        };
        await this.saveAndApplyZip(zipPath, saved);

        const updatedMeta: UploadMetaFile = {
          ...meta,
          completedAt: new Date().toISOString(),
        };
        await fs.promises.writeFile(
          metaPath,
          JSON.stringify(updatedMeta, null, 2),
        );
        published = true;
        try {
          await this.uploadStore.writeCompletedMarker(uploadId, saved);
          markerWritten = true;
        } catch (err) {
          this.logger.warn(
            `Impossible d'ecrire le marqueur de finalisation uploadId=${uploadId}: ${getErrorMessage(
              err,
            )}`,
          );
        }

        return { ok: true, meta: saved };
      } finally {
        try {
          out.destroy();
        } catch {
          /* ignore */
        }
        fs.promises.rm(zipPath, { force: true }).catch(() => {
          /* ignore */
        });
        if (published && markerWritten) {
          fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {
            /* ignore */
          });
        }
      }
    } finally {
      try {
        await lockFd?.close();
      } catch {
        /* ignore */
      }
      fs.promises.rm(lockPath, { force: true }).catch(() => {
        /* ignore */
      });
    }
  }
}
