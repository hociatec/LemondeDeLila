import { ConflictException } from '@nestjs/common';
import { closeSync, mkdirSync, openSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';

/** Fail fast on contention: never overwrite another editor's changes. */
export function withCatalogWriteLock<T>(filePath: string, work: () => T): T {
  mkdirSync(dirname(filePath), { recursive: true });
  const lockPath = `${filePath}.lock`;
  let descriptor: number;
  try {
    descriptor = openSync(lockPath, 'wx', 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new ConflictException(
        'Catalogue en cours de modification. Réessayez.',
      );
    }
    throw error;
  }
  try {
    return work();
  } finally {
    closeSync(descriptor);
    unlinkSync(lockPath);
  }
}
