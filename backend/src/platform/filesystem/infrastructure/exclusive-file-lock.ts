import { AsyncLocalStorage } from 'node:async_hooks';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import { getProcessEnvironment } from '../../config/public-api';

type FileLock = { assertHeld(): void; release(): Promise<void> };
const owners = new AsyncLocalStorage<ReadonlyMap<string, FileLock>>();

export class FileLockBusyError extends Error {
  constructor() {
    super('Une opération utilise déjà cette ressource. Réessayez.');
  }
}

const windowsLock = `
$ErrorActionPreference = 'Stop'
$deadline = [DateTime]::UtcNow.AddMilliseconds([double]$env:LILA_LOCK_TIMEOUT_MS)
$file = $null
while ($null -eq $file) {
  try {
    $file = [IO.File]::Open($env:LILA_LOCK_PATH, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  } catch [IO.IOException] {
    if ([DateTime]::UtcNow -ge $deadline) { exit 75 }
    Start-Sleep -Milliseconds 50
  }
}
try {
  [Console]::Out.WriteLine('locked')
  [Console]::Out.Flush()
  while ([Console]::In.Read() -ne -1) {}
} finally { $file.Dispose() }
`;

/** A kernel lock, not a timestamp lease. The stable lock file is never unlinked. */
export async function acquireExclusiveFileLock(
  file: string,
  timeoutMs = 30_000,
): Promise<FileLock> {
  await mkdir(path.dirname(file), { recursive: true });
  const child =
    process.platform === 'win32'
      ? spawn(
          'powershell.exe',
          ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', windowsLock],
          {
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
              ...getProcessEnvironment(),
              LILA_LOCK_PATH: path.resolve(file),
              LILA_LOCK_TIMEOUT_MS: String(timeoutMs),
            },
          },
        )
      : spawn(
          'flock',
          [
            '--exclusive',
            '--timeout',
            String(timeoutMs / 1000),
            '--conflict-exit-code',
            '75',
            path.resolve(file),
            'sh',
            '-c',
            'printf "locked\\n"; cat >/dev/null',
          ],
          { stdio: ['pipe', 'pipe', 'pipe'] },
        );
  let alive = false;
  let released = false;
  let finish!: () => void;
  const closed = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(0, 1024);
  });
  child.stdin.on('error', () => {}); // A failed helper can close before acquisition.
  return new Promise<FileLock>((resolve, reject) => {
    let ready = false;
    let stdout = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new FileLockBusyError());
    }, timeoutMs + 5_000);
    child.on('error', (error) => {
      clearTimeout(timer);
      finish();
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      alive = false;
      finish();
      if (!ready)
        reject(
          code === 75
            ? new FileLockBusyError()
            : new Error(`Verrou de fichier indisponible: ${stderr || code}`),
        );
    });
    child.stdout.on('data', (chunk: Buffer) => {
      stdout = (stdout + chunk.toString()).slice(0, 128);
      if (
        ready ||
        (!stdout.includes('locked\n') && !stdout.includes('locked\r\n'))
      )
        return;
      ready = alive = true;
      clearTimeout(timer);
      resolve({
        assertHeld() {
          if (!alive || released) throw new Error('Verrou de fichier perdu');
        },
        async release() {
          if (released) return closed;
          released = true;
          child.stdin.end();
          const stop = setTimeout(() => child.kill(), 5_000);
          try {
            await closed;
          } finally {
            clearTimeout(stop);
          }
        },
      });
    });
  });
}

export async function withExclusiveFileLock<T>(
  file: string,
  operation: () => Promise<T>,
): Promise<T> {
  const key = path.resolve(file);
  const inherited = owners.getStore();
  const current = inherited?.get(key);
  if (current) {
    current.assertHeld();
    return operation();
  }
  const lock = await acquireExclusiveFileLock(key);
  try {
    return await owners.run(
      new Map([...(inherited ?? []), [key, lock]]),
      async () => {
        const result = await operation();
        lock.assertHeld();
        return result;
      },
    );
  } finally {
    await lock.release();
  }
}
