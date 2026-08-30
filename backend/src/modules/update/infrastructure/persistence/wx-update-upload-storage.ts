import { BadRequestException, HttpException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  assertStorageCapacity,
  StorageCapacityError,
  writeFileAtomic,
} from '../../../../shared/utils/public-api';
import { readEnvironment } from '../../../../platform/config/public-api';

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
    return path.join(this.uploadsRoot, uploadId);
  }

  requireUploadId(value: string): string {
    const uploadId = (value || '').trim();
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
      return JSON.parse(
        await fs.promises.readFile(metaPath, 'utf-8'),
      ) as WxUploadMeta;
    } catch {
      throw new BadRequestException('Upload WX introuvable ou corrompu.');
    }
  }

  async writeMeta(filePath: string, value: WxUploadMeta): Promise<void> {
    await writeFileAtomic(filePath, JSON.stringify(value, null, 2));
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
    const entries = await fs.promises.readdir(dir).catch(() => []);
    await Promise.all(
      entries
        .filter((name) => /^(artifact|installer)\.\d+\.part$/.test(name))
        .map((name) => fs.promises.rm(path.join(dir, name), { force: true })),
    );
  }

  async pruneExpired(): Promise<void> {
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

function environmentBytes(
  key: 'CLIENT_WX_STORAGE_QUOTA_BYTES' | 'STORAGE_MIN_FREE_BYTES',
  fallback: number,
): number {
  const raw = readEnvironment(key).trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
