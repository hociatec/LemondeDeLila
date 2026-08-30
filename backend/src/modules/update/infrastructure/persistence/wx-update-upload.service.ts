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
  bestEffort,
  StorageCapacityError,
} from '../../../../shared/utils/public-api';

import { WxUpdateReleaseService } from './wx-update-release.service';
import {
  WxUpdateUploadStorage,
  type WxUploadMeta,
} from './wx-update-upload-storage';

@Injectable()
export class WxUpdateUploadService {
  private readonly storage: WxUpdateUploadStorage;

  constructor(private readonly updates: WxUpdateReleaseService) {
    this.storage = new WxUpdateUploadStorage(this.updates.getTargetDir());
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
    await this.storage.pruneExpired();
    const uploadId = randomUUID();
    const dir = this.storage.uploadDir(uploadId);
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
    await this.storage.writeMeta(path.join(dir, 'meta.json'), meta);
    return { uploadId };
  }

  async chunk(input: {
    uploadId: string;
    index: number;
    filePath: string;
    kind?: string;
  }) {
    const uploadId = this.storage.requireUploadId(input.uploadId);
    if (!Number.isSafeInteger(input.index) || input.index < 0) {
      throw new BadRequestException('Index de chunk WX invalide.');
    }
    const kind = this.storage.normalizePartKind(input.kind);
    const dir = this.storage.uploadDir(uploadId);
    if (!fs.existsSync(path.join(dir, 'meta.json'))) {
      throw new BadRequestException('Upload WX introuvable.');
    }
    const destination = path.join(dir, `${kind}.${input.index}.part`);
    if (fs.existsSync(destination)) {
      await fs.promises.rm(input.filePath, { force: true });
      return { ok: true, duplicate: true };
    }
    await this.storage.ensureCapacity(
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
    const uploadId = this.storage.requireUploadId(uploadIdInput);
    const dir = this.storage.uploadDir(uploadId);
    const metaPath = path.join(dir, 'meta.json');
    const meta = await this.storage.readMeta(metaPath);
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
      await this.storage.combineParts({
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
        await this.storage.combineParts({
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
      await this.storage.writeMeta(metaPath, meta);
      await bestEffort(
        this.storage.removeParts(dir),
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
}
