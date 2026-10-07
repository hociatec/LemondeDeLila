import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import {
  acquireExclusiveFileLock,
  FileLockBusyError,
  withExclusiveFileLock,
} from './exclusive-file-lock';

describe('kernel file locks', () => {
  let root: string;
  let file: string;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'lila-file-lock-'));
    file = path.join(root, '.lock');
  });
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('releases the operating-system lock after its owning Node process crashes', async () => {
    const owner = spawn(
      process.execPath,
      [
        '-r',
        require.resolve('ts-node/register/transpile-only'),
        '-e',
        "require(process.argv[1]).acquireExclusiveFileLock(process.argv[2]).then(() => { console.log('owner-ready'); setInterval(() => {}, 1000); });",
        path.join(__dirname, 'exclusive-file-lock.ts'),
        file,
      ],
      {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          TS_NODE_PROJECT: path.resolve(__dirname, '../../../../tsconfig.json'),
        },
      },
    );
    let diagnostics = '';
    owner.stderr.on('data', (data: Buffer) => {
      diagnostics += data.toString();
    });
    const closed = new Promise<void>((resolve) =>
      owner.once('close', () => resolve()),
    );
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('Owner startup timed out: ' + diagnostics)),
          8000,
        );
        owner.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
        owner.once('close', () => {
          clearTimeout(timeout);
          reject(new Error(diagnostics));
        });
        owner.stdout.on('data', (data: Buffer) => {
          if (data.toString().includes('owner-ready')) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
      owner.kill('SIGKILL');
      await closed;
      const recovered = await acquireExclusiveFileLock(file, 5000);
      recovered.assertHeld();
      await recovered.release();
    } finally {
      owner.kill('SIGKILL');
      await closed;
    }
  });

  it('reuses a file abandoned by an earlier process', async () => {
    await fs.writeFile(file, 'old owner');
    const lock = await acquireExclusiveFileLock(file, 0);
    try {
      lock.assertHeld();
    } finally {
      await lock.release();
    }
    expect(await fs.readFile(file, 'utf8')).toBe('old owner');
  });

  it('never steals a lock held by a live owner and releases after exceptions', async () => {
    const lock = await acquireExclusiveFileLock(file, 0);
    try {
      await expect(acquireExclusiveFileLock(file, 0)).rejects.toBeInstanceOf(
        FileLockBusyError,
      );
      lock.assertHeld();
    } finally {
      await lock.release();
    }
    await expect(
      withExclusiveFileLock(file, async () => {
        throw new Error('failed');
      }),
    ).rejects.toThrow('failed');
    const next = await acquireExclusiveFileLock(file, 0);
    await next.release();
  });

  it('serializes different callers while allowing nested operations by the owner', async () => {
    let active = 0;
    let maximum = 0;
    await Promise.all(
      Array.from({ length: 3 }, () =>
        withExclusiveFileLock(file, async () => {
          maximum = Math.max(maximum, ++active);
          await withExclusiveFileLock(file, async () => {
            await new Promise((resolve) => setTimeout(resolve, 25));
          });
          --active;
        }),
      ),
    );
    expect(maximum).toBe(1);
  });
});
