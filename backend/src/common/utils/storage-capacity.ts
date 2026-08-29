import * as fs from 'fs';
import * as path from 'path';

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
  await fs.promises.mkdir(policy.root, { recursive: true });
  const incomingBytes = Math.max(0, policy.incomingBytes);
  const [usedBytes, stats] = await Promise.all([
    directorySize(policy.root),
    fs.promises.statfs(policy.root),
  ]);
  if (usedBytes + incomingBytes > policy.maxTotalBytes) {
    throw new StorageCapacityError(
      'quota',
      `Quota de stockage dépassé (${usedBytes + incomingBytes}/${policy.maxTotalBytes} octets).`,
    );
  }
  const availableBytes = Number(stats.bavail) * Number(stats.bsize);
  if (availableBytes - incomingBytes < policy.minFreeBytes) {
    throw new StorageCapacityError(
      'disk-free',
      `Espace disque insuffisant (réserve minimale ${policy.minFreeBytes} octets).`,
    );
  }
}

async function directorySize(root: string): Promise<number> {
  let total = 0;
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;
    const entries = await fs.promises.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile()) total += (await fs.promises.stat(target)).size;
    }
  }
  return total;
}
