import { promises as fs } from 'node:fs';
import * as fsSync from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export async function writeFileAtomic(
  targetPath: string,
  data: string | Buffer,
): Promise<void> {
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
  } catch (error) {
    await bestEffortCleanup(() => handle.close(), 'close temporary file');
    await bestEffortCleanup(
      () => fs.rm(temporary, { force: true }),
      'remove temporary file',
    );
    throw error;
  }
  await handle.close();
  try {
    await fs.rename(temporary, targetPath);
  } catch (error) {
    await bestEffortCleanup(
      () => fs.rm(temporary, { force: true }),
      'remove temporary file after rename failure',
    );
    throw error;
  }
}

export function writeFileAtomicSync(
  targetPath: string,
  data: string | Buffer,
): void {
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
    if (descriptor != null) fsSync.closeSync(descriptor);
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
