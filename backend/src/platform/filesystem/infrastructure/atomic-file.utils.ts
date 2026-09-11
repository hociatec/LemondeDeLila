import { promises as fs } from 'node:fs';
import * as fsSync from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export async function writeFileAtomic(
  targetPath: string,
  data: string | Buffer,
): Promise<void> {
  if (typeof targetPath !== 'string' || !targetPath || targetPath.length > 4096) {
    throw new Error('Invalid atomic-file target path');
  }
  if ((Buffer.isBuffer(data) ? data.byteLength : Buffer.byteLength(data, 'utf8')) > 256 * 1024 * 1024) {
    throw new Error('Atomic-file payload too large');
  }
  const directory = path.dirname(targetPath);
  await fs.mkdir(directory, { recursive: true });
  const temporary = path.join(
    directory,
    `.${path.basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  const handle = await fs.open(temporary, 'wx');
  try {
    await handle.writeFile(data);
    await handle.sync();
    await handle.close();
    await renameWithTransientRetry(temporary, targetPath);
  } catch (error) {
    await bestEffortCleanup(() => handle.close(), 'close temporary file');
    await bestEffortCleanup(
      () => fs.rm(temporary, { force: true }),
      'remove temporary file',
    );
    throw error;
  }
}

async function renameWithTransientRetry(
  source: string,
  target: string,
): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await fs.rename(source, target);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (
        process.platform !== 'win32' ||
        attempt >= 5 ||
        !['EPERM', 'EACCES', 'EBUSY'].includes(code ?? '')
      )
        throw error;
      // Bounded infrastructure retry: antivirus/concurrent opens can briefly
      // deny replacement on Windows. Never unlink the published destination.
      await new Promise<void>((resolve) =>
        setTimeout(resolve, 10 * (attempt + 1)),
      );
    }
  }
}

export function writeFileAtomicSync(
  targetPath: string,
  data: string | Buffer,
): void {
  if (typeof targetPath !== 'string' || !targetPath || targetPath.length > 4096) {
    throw new Error('Invalid atomic-file target path');
  }
  if ((Buffer.isBuffer(data) ? data.byteLength : Buffer.byteLength(data, 'utf8')) > 256 * 1024 * 1024) {
    throw new Error('Atomic-file payload too large');
  }
  const directory = path.dirname(targetPath);
  fsSync.mkdirSync(directory, { recursive: true });
  const temporary = path.join(
    directory,
    `.${path.basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let descriptor: number | null = null;
  try {
    descriptor = fsSync.openSync(temporary, 'wx');
    fsSync.writeFileSync(descriptor, data);
    fsSync.fsyncSync(descriptor);
    fsSync.closeSync(descriptor);
    descriptor = null;
    fsSync.renameSync(temporary, targetPath);
  } catch (error) {
    if (descriptor != null) {
      try {
        fsSync.closeSync(descriptor);
      } catch {
        /* Continue cleanup and preserve the original write failure. */
      }
    }
    try {
      fsSync.rmSync(temporary, { force: true });
    } catch {
      // The original write failure remains authoritative.
    }
    throw error;
  }
}

async function bestEffortCleanup(
  operation: () => Promise<unknown>,
  label: string,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    process.emitWarning(
      `${label}: ${error instanceof Error ? error.message : String(error)}`,
      { code: 'BEST_EFFORT_CLEANUP_FAILED' },
    );
  }
}

export function assertPathInside(root: string, candidate: string): string {
  if (typeof root !== 'string' || typeof candidate !== 'string' || root.length > 4096 || candidate.length > 4096) {
    throw new Error('Chemin filesystem invalide');
  }
  const normalizedRoot = path.resolve(root);
  const normalizedCandidate = path.resolve(candidate);
  const relative = path.relative(normalizedRoot, normalizedCandidate);
  if (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  ) {
    return normalizedCandidate;
  }
  throw new Error(`Chemin hors du répertoire autorisé: ${normalizedCandidate}`);
}
