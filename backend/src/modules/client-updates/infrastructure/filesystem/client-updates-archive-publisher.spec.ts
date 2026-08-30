import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ClientUpdatesInvalidArchiveError } from './client-updates-publisher.errors';
import {
  ClientUpdatesArchivePublisher,
  assertNoSymlinkArchiveEntries,
  assertSafeClientUpdateArchiveEntries,
} from './client-updates-archive-publisher';

describe('client update archive safety', () => {
  it.each([
    '../outside.exe',
    'Application Files/../../outside.exe',
    '/absolute/file.exe',
    'C:/Windows/file.exe',
    String.raw`..\outside.exe`,
  ])('rejects a zip-slip entry: %s', (entry) => {
    expect(() => assertSafeClientUpdateArchiveEntries([entry])).toThrow(
      ClientUpdatesInvalidArchiveError,
    );
  });

  it('accepts ordinary ClickOnce paths without rejecting dotted names', () => {
    expect(() =>
      assertSafeClientUpdateArchiveEntries([
        'LeMondeDeLila.application',
        'Application Files/app_1_2_3_4/foo..bar.dll',
      ]),
    ).not.toThrow();
  });

  it('rejects symbolic links reported by zipinfo before extraction', () => {
    expect(() =>
      assertNoSymlinkArchiveEntries(
        'lrwxrwxrwx  3.0 unx  12 bx  12 stor 30-Aug-26 12:00 Application Files/link',
      ),
    ).toThrow(ClientUpdatesInvalidArchiveError);
  });

  it('accepts regular files and directories reported by zipinfo', () => {
    expect(() =>
      assertNoSymlinkArchiveEntries(
        '-rw-r--r--  3.0 unx  12 tx  12 stor 30-Aug-26 12:00 app.application\ndrwxr-xr-x  3.0 unx  0 bx  0 stor 30-Aug-26 12:00 Application Files/',
      ),
    ).not.toThrow();
  });

  it('restores the previous publication when the atomic swap fails', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lila-swap-test-'));
    const target = path.join(root, 'target');
    const releases = path.join(root, 'releases');
    await fs.mkdir(target);
    await fs.mkdir(releases);
    await fs.writeFile(path.join(target, 'current.application'), 'current');
    const publisher = new ClientUpdatesArchivePublisher(
      {} as never,
      { warn: jest.fn() } as never,
      async () => undefined,
    );
    const swap = publisher as unknown as {
      swapDirectory(
        stagingDir: string,
        targetDir: string,
        releasesDir: string,
      ): Promise<void>;
    };

    await expect(
      swap.swapDirectory(path.join(root, 'missing'), target, releases),
    ).rejects.toBeDefined();
    await expect(
      fs.readFile(path.join(target, 'current.application'), 'utf8'),
    ).resolves.toBe('current');
    await fs.rm(root, { recursive: true, force: true });
  });
});
