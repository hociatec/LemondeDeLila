import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  assertStorageCapacity,
  bestEffort,
  StorageCapacityError,
  writeFileAtomic,
} from '../../../common/utils/public-api';
import { readEnvironment } from '../../../config/public-api';

import { WxUpdateReleaseService } from './wx-update-release.service';

type WxUploadMeta = {
  uploadId: string;
  releaseId: string;
  version: string;
  sequence: number;
  publishedAt: string;
  message: string | null;
  minimumVersion: string | null;
  mandatoryAt: string | null;
  sha256: string;
  signature: string;
  totalBytes: number;
  installerSha256: string | null;
  installerTotalBytes: number | null;
  completedAt: string | null;
};

type WxUploadPartKind = 'artifact' | 'installer';

@Injectable()
export class WxUpdateUploadService {
  private readonly uploadsRoot: string;

  constructor(private readonly updates: WxUpdateReleaseService) {
    this.uploadsRoot = path.join(this.updates.getTargetDir(), '.uploads');
  }

  status() {
    return this.updates.getLatest();
  }

  async init(input: {
    releaseId?: string;
    version?: string;
    sequence?: number;
    publishedAt?: string;
    message?: string;
    minimumVersion?: string;
    mandatoryAt?: string;
    sha256?: string;
    signature?: string;
    totalBytes?: number | null;
    installerSha256?: string;
    installerTotalBytes?: number | null;
  }): Promise<{ uploadId: string }> {
    const version = (input.version || '').trim();
    const releaseId = (input.releaseId || '').trim();
    const sequence = Number(input.sequence);
    const publishedAt = (input.publishedAt || '').trim();
    const totalBytes = Number(input.totalBytes);
    if (
      !releaseId ||
      !version ||
      !publishedAt ||
      !Number.isSafeInteger(sequence) ||
      sequence <= 0 ||
      !Number.isSafeInteger(totalBytes) ||
      totalBytes <= 0 ||
      totalBytes > this.updates.getMaxArtifactBytes()
    ) {
      throw new BadRequestException('Métadonnées ou taille WX invalides.');
    }
    const sha256 = (input.sha256 || '').trim().toLowerCase();
    const signature = (input.signature || '').trim();
    if (!/^[a-f0-9]{64}$/.test(sha256)) {
      throw new BadRequestException('SHA-256 WX invalide.');
    }
    if (!signature || signature.length > 16_384) {
      throw new BadRequestException('Signature WX invalide.');
    }
    const installerSha256 = (input.installerSha256 || '').trim().toLowerCase();
    const installerTotalBytes =
      input.installerTotalBytes == null
        ? null
        : Number(input.installerTotalBytes);
    const hasInstaller =
      installerSha256.length > 0 || installerTotalBytes != null;
    if (
      hasInstaller &&
      (!/^[a-f0-9]{64}$/.test(installerSha256) ||
        installerTotalBytes === null ||
        !Number.isSafeInteger(installerTotalBytes) ||
        installerTotalBytes <= 0 ||
        installerTotalBytes > this.updates.getMaxArtifactBytes())
    ) {
      throw new BadRequestException('Métadonnées installateur WX invalides.');
    }
    await this.pruneExpiredUploads();
    const uploadId = randomUUID();
    const dir = this.resolveUploadDir(uploadId);
    await fs.promises.mkdir(dir, { recursive: true });
    const meta: WxUploadMeta = {
      uploadId,
      releaseId,
      version,
      sequence,
      publishedAt,
      message: (input.message || '').trim() || null,
      minimumVersion: (input.minimumVersion || '').trim() || null,
      mandatoryAt: (input.mandatoryAt || '').trim() || null,
      sha256,
      signature,
      totalBytes,
      installerSha256: hasInstaller ? installerSha256 : null,
      installerTotalBytes: hasInstaller ? installerTotalBytes : null,
      completedAt: null,
    };
    await this.writeJsonAtomic(path.join(dir, 'meta.json'), meta);
    return { uploadId };
  }

  async chunk(input: {
    uploadId: string;
    index: number;
    filePath: string;
    kind?: string;
  }) {
    const uploadId = this.requireUploadId(input.uploadId);
    if (!Number.isSafeInteger(input.index) || input.index < 0) {
      throw new BadRequestException('Index de chunk WX invalide.');
    }
    const kind = this.normalizePartKind(input.kind);
    const dir = this.resolveUploadDir(uploadId);
    if (!fs.existsSync(path.join(dir, 'meta.json'))) {
      throw new BadRequestException('Upload WX introuvable.');
    }
    const destination = path.join(dir, `${kind}.${input.index}.part`);
    if (fs.existsSync(destination)) {
      await fs.promises.rm(input.filePath, { force: true });
      return { ok: true, duplicate: true };
    }
    await this.ensureStorageCapacity(
      (await fs.promises.stat(input.filePath)).size,
    );
    try {
      await fs.promises.copyFile(
        input.filePath,
        destination,
        fs.constants.COPYFILE_EXCL,
      );
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EEXIST') return { ok: true, duplicate: true };
      if (
        error instanceof StorageCapacityError ||
        (error as NodeJS.ErrnoException).code === 'ENOSPC'
      ) {
        throw new HttpException(
          error instanceof Error
            ? error.message
            : 'Espace disque WX insuffisant.',
          507,
        );
      }
      throw error;
    } finally {
      await fs.promises.rm(input.filePath, { force: true });
    }
    return { ok: true };
  }

  async complete(uploadIdInput: string) {
    const uploadId = this.requireUploadId(uploadIdInput);
    const dir = this.resolveUploadDir(uploadId);
    const metaPath = path.join(dir, 'meta.json');
    const meta = await this.readMeta(metaPath);
    if (meta.completedAt) {
      return {
        ok: true,
        alreadyCompleted: true,
        manifest: await this.updates.getLatest(),
      };
    }

    const lockPath = path.join(dir, '.complete.lock');
    let lock: fs.promises.FileHandle;
    try {
      lock = await fs.promises.open(lockPath, 'wx');
    } catch {
      throw new ConflictException('Finalisation WX déjà en cours.');
    }

    const combinedPath = path.join(dir, 'combined.zip');
    const installerPath = path.join(dir, 'installer.zip');
    try {
      await this.combineParts({
        dir,
        kind: 'artifact',
        destination: combinedPath,
        expectedBytes: meta.totalBytes,
        missingMessage: 'Aucun chunk WX reçu.',
        overflowMessage: 'Upload WX plus grand que prévu.',
        sizeMessage: 'Taille WX invalide',
      });
      const installerTotalBytes = meta.installerTotalBytes;
      const hasInstaller =
        meta.installerSha256 != null && installerTotalBytes != null;
      if (installerTotalBytes != null && meta.installerSha256 != null) {
        await this.combineParts({
          dir,
          kind: 'installer',
          destination: installerPath,
          expectedBytes: installerTotalBytes,
          missingMessage: 'Aucun chunk installateur WX reçu.',
          overflowMessage: 'Installateur WX plus grand que prévu.',
          sizeMessage: 'Taille installateur WX invalide',
        });
      }
      const manifest = await this.updates.publish({
        zipPath: combinedPath,
        installerZipPath: hasInstaller ? installerPath : null,
        releaseId: meta.releaseId,
        version: meta.version,
        sequence: meta.sequence,
        publishedAt: meta.publishedAt,
        message: meta.message,
        minimumVersion: meta.minimumVersion,
        mandatoryAt: meta.mandatoryAt,
        expectedSha256: meta.sha256,
        expectedInstallerSha256: hasInstaller ? meta.installerSha256 : null,
        signature: meta.signature,
      });
      meta.completedAt = new Date().toISOString();
      await this.writeJsonAtomic(metaPath, meta);
      await bestEffort(
        this.removeUploadedParts(dir),
        `suppression des chunks WX upload=${uploadId}`,
      );
      return { ok: true, manifest };
    } finally {
      await bestEffort(
        lock.close(),
        `fermeture du verrou WX upload=${uploadId}`,
      );
      await fs.promises.rm(lockPath, { force: true });
      await fs.promises.rm(combinedPath, { force: true });
      await fs.promises.rm(installerPath, { force: true });
    }
  }

  private async ensureStorageCapacity(incomingBytes: number): Promise<void> {
    const quota = this.environmentBytes(
      'CLIENT_WX_STORAGE_QUOTA_BYTES',
      8 * 1024 * 1024 * 1024,
    );
    const reserve = this.environmentBytes(
      'STORAGE_MIN_FREE_BYTES',
      512 * 1024 * 1024,
    );
    try {
      await assertStorageCapacity({
        root: this.updates.getTargetDir(),
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

  private environmentBytes(
    key: 'CLIENT_WX_STORAGE_QUOTA_BYTES' | 'STORAGE_MIN_FREE_BYTES',
    fallback: number,
  ): number {
    const raw = readEnvironment(key).trim();
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
  }

  private async combineParts(input: {
    dir: string;
    kind: WxUploadPartKind;
    destination: string;
    expectedBytes: number;
    missingMessage: string;
    overflowMessage: string;
    sizeMessage: string;
  }): Promise<void> {
    const prefix = `${input.kind}.`;
    const parts = (await fs.promises.readdir(input.dir))
      .filter(
        (name) =>
          name.startsWith(prefix) &&
          /^\d+\.part$/.test(name.slice(prefix.length)),
      )
      .map((name) => ({
        name,
        index: Number.parseInt(name.slice(prefix.length), 10),
      }))
      .sort((left, right) => left.index - right.index);
    if (parts.length === 0) {
      throw new BadRequestException(input.missingMessage);
    }
    parts.forEach((part, index) => {
      if (part.index !== index) {
        throw new BadRequestException(
          `Chunk WX ${input.kind} manquant à l'index ${index}.`,
        );
      }
    });

    await fs.promises.rm(input.destination, { force: true });
    const output = await fs.promises.open(input.destination, 'wx');
    let combinedBytes = 0;
    try {
      for (const part of parts) {
        const stream = fs.createReadStream(path.join(input.dir, part.name));
        for await (const bytes of stream) {
          combinedBytes += (bytes as Buffer).length;
          if (combinedBytes > input.expectedBytes) {
            throw new BadRequestException(input.overflowMessage);
          }
          await output.write(bytes as Buffer);
        }
      }
      await output.sync();
    } finally {
      await output.close();
    }
    const size = (await fs.promises.stat(input.destination)).size;
    if (size !== input.expectedBytes) {
      throw new BadRequestException(
        `${input.sizeMessage} (${size}, attendu ${input.expectedBytes}).`,
      );
    }
  }

  private normalizePartKind(value: string | undefined): WxUploadPartKind {
    const kind = (value || 'artifact').trim().toLowerCase();
    if (kind === 'artifact' || kind === 'installer') return kind;
    throw new BadRequestException('Type de chunk WX invalide.');
  }

  private resolveUploadDir(uploadId: string): string {
    return path.join(this.uploadsRoot, uploadId);
  }

  private requireUploadId(value: string): string {
    const uploadId = (value || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(uploadId)) {
      throw new BadRequestException('Identifiant upload WX invalide.');
    }
    return uploadId;
  }

  private async readMeta(metaPath: string): Promise<WxUploadMeta> {
    try {
      return JSON.parse(
        await fs.promises.readFile(metaPath, 'utf-8'),
      ) as WxUploadMeta;
    } catch {
      throw new BadRequestException('Upload WX introuvable ou corrompu.');
    }
  }

  private async writeJsonAtomic(
    filePath: string,
    value: unknown,
  ): Promise<void> {
    await writeFileAtomic(filePath, JSON.stringify(value, null, 2));
  }

  private async removeUploadedParts(dir: string): Promise<void> {
    const entries = await fs.promises.readdir(dir).catch(() => []);
    await Promise.all(
      entries
        .filter((name) => /^(artifact|installer)\.\d+\.part$/.test(name))
        .map((name) => fs.promises.rm(path.join(dir, name), { force: true })),
    );
  }

  private async pruneExpiredUploads(): Promise<void> {
    const expiration = Date.now() - 24 * 60 * 60 * 1000;
    const entries = await fs.promises
      .readdir(this.uploadsRoot, { withFileTypes: true })
      .catch(() => []);
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const target = path.join(this.uploadsRoot, entry.name);
          const stat = await fs.promises.stat(target).catch(() => null);
          const meta = await this.readMeta(
            path.join(target, 'meta.json'),
          ).catch(() => null);
          if (meta?.completedAt || (stat && stat.mtimeMs < expiration)) {
            await fs.promises.rm(target, { recursive: true, force: true });
          }
        }),
    );
  }
}
