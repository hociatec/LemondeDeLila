import { allCompleted } from '../../../../shared/utils/public-api';
import { bestEffort } from '../../../../platform/observability/public-api';
import { BadRequestException, HttpException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  assertStorageCapacity,
  StorageCapacityError,
  writeFileAtomic,
} from '../../../../platform/filesystem/public-api';
import {
  readEnvironment,
  operationalSettings,
} from '../../../../platform/config/public-api';
import { parseStrictInteger } from '../../../../shared/utils/public-api';

const MAX_UPLOAD_DIRECTORY_ENTRIES = 10_000;

export type WxUploadMeta = {
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

export type WxUploadPartKind = 'artifact' | 'installer';

/** Filesystem and capacity boundary for resumable WX uploads. */
export class WxUpdateUploadStorage {
  readonly uploadsRoot: string;

  constructor(private readonly targetDir: string) {
    this.uploadsRoot = path.join(targetDir, '.uploads');
  }

  uploadDir(uploadId: string): string {
    return path.join(this.uploadsRoot, this.requireUploadId(uploadId));
  }

  requireUploadId(value: string): string {
    const uploadId = typeof value === 'string' ? value.trim() : '';
    if (!/^[0-9a-f-]{36}$/i.test(uploadId)) {
      throw new BadRequestException('Identifiant upload WX invalide.');
    }
    return uploadId;
  }

  normalizePartKind(value: string | undefined): WxUploadPartKind {
    const kind = (value || 'artifact').trim().toLowerCase();
    if (kind === 'artifact' || kind === 'installer') return kind;
    throw new BadRequestException('Type de chunk WX invalide.');
  }

  async ensureCapacity(incomingBytes: number): Promise<void> {
    try {
      await assertStorageCapacity({
        root: this.targetDir,
        incomingBytes,
        maxTotalBytes: environmentBytes(
          'CLIENT_WX_STORAGE_QUOTA_BYTES',
          8 * 1024 ** 3,
        ),
        minFreeBytes: environmentBytes(
          'STORAGE_MIN_FREE_BYTES',
          512 * 1024 ** 2,
        ),
      });
    } catch (error) {
      if (error instanceof StorageCapacityError)
        throw new HttpException(error.message, 507);
      throw error;
    }
  }

  async readMeta(metaPath: string): Promise<WxUploadMeta> {
    try {
      const stat = await fs.promises.stat(metaPath);
      if (!stat.isFile() || stat.size > 64 * 1024) {
        throw new Error('metadata too large');
      }
      const parsed: unknown = JSON.parse(
        await fs.promises.readFile(metaPath, 'utf-8'),
      );
      if (!isWxUploadMeta(parsed)) {
        throw new Error('invalid metadata');
      }
      return parsed;
    } catch {
      throw new BadRequestException('Upload WX introuvable ou corrompu.');
    }
  }

  async writeMeta(filePath: string, value: WxUploadMeta): Promise<void> {
    await writeFileAtomic(filePath, JSON.stringify(value, null, 2));
  }

  async initialize(meta: WxUploadMeta): Promise<void> {
    const uploadId = this.requireUploadId(meta.uploadId);
    const dir = this.uploadDir(uploadId);
    await fs.promises.mkdir(dir, { recursive: true });
    try {
      await this.writeMeta(path.join(dir, 'meta.json'), meta);
    } catch (error) {
      await bestEffort(
        fs.promises.rm(dir, { recursive: true, force: true }),
        `suppression de l'upload WX non initialisé upload=${uploadId}`,
      );
      throw error;
    }
  }

  async cleanupCompletion(dir: string): Promise<void> {
    await Promise.all(
      ['.complete.lock', 'combined.zip', 'installer.zip'].map((name) =>
        bestEffort(
          fs.promises.rm(path.join(dir, name), { force: true }),
          `suppression du temporaire WX ${name} upload=${path.basename(dir)}`,
        ),
      ),
    );
  }

  async combineParts(input: {
    dir: string;
    kind: WxUploadPartKind;
    destination: string;
    expectedBytes: number;
    missingMessage: string;
    overflowMessage: string;
    sizeMessage: string;
  }): Promise<void> {
    if (!Number.isSafeInteger(input.expectedBytes) || input.expectedBytes < 0) {
      throw new BadRequestException('Taille attendue du chunk WX invalide.');
    }
    const prefix = `${input.kind}.`;
    const parts = (await fs.promises.readdir(input.dir))
      .slice(0, MAX_UPLOAD_DIRECTORY_ENTRIES)
      .filter(
        (name) =>
          name.startsWith(prefix) &&
          /^\d+\.part$/.test(name.slice(prefix.length)),
      )
      .map((name) => ({
        name,
        index:
          parseStrictInteger(name.slice(prefix.length, -5), { min: 0 }) ?? -1,
      }))
      .sort((left, right) => left.index - right.index);
    if (parts.length === 0) throw new BadRequestException(input.missingMessage);
    parts.forEach((part, index) => {
      if (part.index !== index) {
        throw new BadRequestException(
          `Chunk WX ${input.kind} manquant à l'index ${index}.`,
        );
      }
    });
    await this.writeCombinedFile(input, parts);
    const size = (await fs.promises.stat(input.destination)).size;
    if (size !== input.expectedBytes) {
      throw new BadRequestException(
        `${input.sizeMessage} (${size}, attendu ${input.expectedBytes}).`,
      );
    }
  }

  async removeParts(dir: string): Promise<void> {
    const entries = (await fs.promises.readdir(dir).catch(() => [])).slice(
      0,
      MAX_UPLOAD_DIRECTORY_ENTRIES,
    );
    await allCompleted(
      entries
        .filter((name) => /^(artifact|installer)\.\d+\.part$/.test(name))
        .map((name) => fs.promises.rm(path.join(dir, name), { force: true })),
    );
  }

  async pruneExpired(): Promise<void> {
    const expiration =
      Date.now() - operationalSettings.clientWxUploadRetentionMs;
    const entries = (
      await fs.promises
        .readdir(this.uploadsRoot, { withFileTypes: true })
        .catch(() => [])
    ).slice(0, MAX_UPLOAD_DIRECTORY_ENTRIES);
    await allCompleted(
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

  private async writeCombinedFile(
    input: {
      dir: string;
      destination: string;
      expectedBytes: number;
      overflowMessage: string;
    },
    parts: readonly { name: string }[],
  ): Promise<void> {
    await fs.promises.rm(input.destination, { force: true });
    const output = await fs.promises.open(input.destination, 'wx');
    let combinedBytes = 0;
    try {
      for (const part of parts) {
        for await (const bytes of fs.createReadStream(
          path.join(input.dir, part.name),
        )) {
          combinedBytes += (bytes as Buffer).length;
          if (combinedBytes > input.expectedBytes)
            throw new BadRequestException(input.overflowMessage);
          await output.write(bytes as Buffer);
        }
      }
      await output.sync();
    } finally {
      await output.close();
    }
  }
}

function isWxUploadMeta(value: unknown): value is WxUploadMeta {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.uploadId === 'string' &&
    /^[0-9a-f-]{36}$/i.test(item.uploadId) &&
    typeof item.releaseId === 'string' &&
    item.releaseId.length > 0 &&
    item.releaseId.length <= 128 &&
    typeof item.version === 'string' &&
    item.version.length > 0 &&
    item.version.length <= 128 &&
    typeof item.sequence === 'number' &&
    Number.isSafeInteger(item.sequence) &&
    item.sequence >= 0 &&
    typeof item.publishedAt === 'string' &&
    item.publishedAt.length <= 64 &&
    (item.message === null ||
      (typeof item.message === 'string' && item.message.length <= 2_000)) &&
    (item.minimumVersion === null ||
      (typeof item.minimumVersion === 'string' &&
        item.minimumVersion.length <= 128)) &&
    (item.mandatoryAt === null ||
      (typeof item.mandatoryAt === 'string' &&
        item.mandatoryAt.length <= 64)) &&
    typeof item.sha256 === 'string' &&
    /^[a-f0-9]{64}$/i.test(item.sha256) &&
    typeof item.signature === 'string' &&
    item.signature.length > 0 &&
    item.signature.length <= 4096 &&
    typeof item.totalBytes === 'number' &&
    Number.isSafeInteger(item.totalBytes) &&
    item.totalBytes >= 0 &&
    (item.installerSha256 === null ||
      (typeof item.installerSha256 === 'string' &&
        /^[a-f0-9]{64}$/i.test(item.installerSha256))) &&
    (item.installerTotalBytes === null ||
      (typeof item.installerTotalBytes === 'number' &&
        Number.isSafeInteger(item.installerTotalBytes) &&
        item.installerTotalBytes >= 0)) &&
    (item.completedAt === null ||
      (typeof item.completedAt === 'string' && item.completedAt.length <= 64))
  );
}

function environmentBytes(
  key: 'CLIENT_WX_STORAGE_QUOTA_BYTES' | 'STORAGE_MIN_FREE_BYTES',
  fallback: number,
): number {
  const raw = readEnvironment(key).trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
