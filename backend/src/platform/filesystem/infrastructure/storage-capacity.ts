import * as fs from 'fs';
import * as path from 'path';

const MAX_SCANNED_FILES = 100_000;
const MAX_SCANNED_DIRECTORIES = 10_000;

export type StorageCapacityPolicy = {
  root: string;
  incomingBytes: number;
  maxTotalBytes: number;
  minFreeBytes: number;
};

export class StorageCapacityError extends Error {
  readonly code = 'STORAGE_CAPACITY_EXCEEDED';

  constructor(
    readonly reason: 'quota' | 'disk-free',
    message: string,
  ) {
    super(message);
    this.name = 'StorageCapacityError';
  }
}

/** Checks both the application quota and a filesystem free-space reserve. */
export async function assertStorageCapacity(
  policy: StorageCapacityPolicy,
): Promise<void> {
  if (
    typeof policy.root !== 'string' ||
    !policy.root.trim() ||
    policy.root.length > 4096 ||
    !Number.isSafeInteger(policy.incomingBytes) ||
    policy.incomingBytes < 0 ||
    !Number.isSafeInteger(policy.maxTotalBytes) ||
    policy.maxTotalBytes < 0 ||
    !Number.isSafeInteger(policy.minFreeBytes) ||
    policy.minFreeBytes < 0
  ) {
    throw new StorageCapacityError('quota', 'Politique de stockage invalide.');
  }
  await fs.promises.mkdir(policy.root, { recursive: true });
  const incomingBytes = Math.max(0, policy.incomingBytes);
  const [usedBytes, stats] = await Promise.all([
    directorySize(policy.root),
    fs.promises.statfs(policy.root),
  ]);
  if (
    !Number.isSafeInteger(usedBytes) ||
    usedBytes > policy.maxTotalBytes - incomingBytes
  ) {
    throw new StorageCapacityError(
      'quota',
      `Quota de stockage dépassé (${usedBytes + incomingBytes}/${policy.maxTotalBytes} octets).`,
    );
  }
  const availableBytes = Number(stats.bavail) * Number(stats.bsize);
  if (!Number.isSafeInteger(availableBytes) || availableBytes < 0) {
    throw new StorageCapacityError('disk-free', 'Capacité disque illisible.');
  }
  if (availableBytes - incomingBytes < policy.minFreeBytes) {
    throw new StorageCapacityError(
      'disk-free',
      `Espace disque insuffisant (réserve minimale ${policy.minFreeBytes} octets).`,
    );
  }
}

async function directorySize(root: string): Promise<number> {
  let total = 0;
  let scannedFiles = 0;
  let scannedDirectories = 0;
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;
    scannedDirectories += 1;
    if (scannedDirectories > MAX_SCANNED_DIRECTORIES) {
      throw new StorageCapacityError(
        'quota',
        'Arborescence de stockage trop volumineuse.',
      );
    }
    const entries = await fs.promises.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile()) {
        scannedFiles += 1;
        if (scannedFiles > MAX_SCANNED_FILES) {
          throw new StorageCapacityError(
            'quota',
            'Nombre de fichiers de stockage trop élevé.',
          );
        }
        const size = (await fs.promises.stat(target)).size;
        if (
          !Number.isSafeInteger(size) ||
          size < 0 ||
          total > Number.MAX_SAFE_INTEGER - size
        ) {
          throw new StorageCapacityError(
            'quota',
            'Taille de stockage invalide.',
          );
        }
        total += size;
      }
    }
  }
  return total;
}
