import { promises as fs } from 'node:fs';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertPathInside,
  copyFileAtomic,
  writeFileAtomic,
  writeFileAtomicSync,
} from './atomic-file.utils';

describe('atomic file utilities', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'atomic-file-test-'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('publishes only complete values under concurrent writes', async () => {
    const target = path.join(root, 'nested', 'value.json');
    const left = JSON.stringify({ source: 'left', data: 'a'.repeat(20_000) });
    const right = JSON.stringify({ source: 'right', data: 'b'.repeat(20_000) });
    await Promise.all([
      writeFileAtomic(target, left),
      writeFileAtomic(target, right),
    ]);
    const result = await fs.readFile(target, 'utf8');
    expect([left, right]).toContain(result);
    expect(await fs.readdir(path.dirname(target))).toEqual(['value.json']);
  });

  it('copies an upload atomically while enforcing its byte bound', async () => {
    const source = path.join(root, 'source.bin');
    const target = path.join(root, 'published', 'target.bin');
    await fs.writeFile(source, Buffer.alloc(64 * 1024, 7));

    await expect(
      copyFileAtomic(source, target, 64 * 1024),
    ).resolves.toBeUndefined();
    await expect(fs.readFile(target)).resolves.toEqual(
      Buffer.alloc(64 * 1024, 7),
    );
    await expect(
      copyFileAtomic(source, path.join(root, 'too-large.bin'), 1024),
    ).rejects.toThrow('source too large');
    await expect(fs.readdir(path.join(root, 'published'))).resolves.toEqual([
      'target.bin',
    ]);
  });

  it('rejects path traversal outside the storage root', () => {
    expect(() =>
      assertPathInside(root, path.join(root, 'safe', 'file')),
    ).not.toThrow();
    expect(() =>
      assertPathInside(root, path.join(root, '..', 'escape')),
    ).toThrow('Chemin hors du répertoire autorisé');
  });

  it('preserves the previous published value and cleans staging if replacement keeps failing', async () => {
    const target = path.join(root, 'value.json');
    await fs.writeFile(target, 'previous');
    const failure = Object.assign(new Error('busy'), { code: 'EPERM' });
    const rename = jest.spyOn(fs, 'rename').mockRejectedValue(failure);
    try {
      await expect(writeFileAtomic(target, 'next')).rejects.toBe(failure);
      expect(rename.mock.calls.length).toBe(
        process.platform === 'win32' ? 6 : 1,
      );
      expect(await fs.readFile(target, 'utf8')).toBe('previous');
      expect(await fs.readdir(root)).toEqual(['value.json']);
    } finally {
      rename.mockRestore();
    }
  });

  it('atomically replaces a file for synchronous stores', () => {
    const target = path.join(root, 'sync.json');
    writeFileAtomicSync(target, 'first');
    writeFileAtomicSync(target, 'second');
    expect(fsSync.readFileSync(target, 'utf8')).toBe('second');
    expect(
      fsSync.readdirSync(root).filter((name) => name.endsWith('.tmp')),
    ).toEqual([]);
  });

  it('cleans the temporary file when asynchronous close fails', async () => {
    const failure = new Error('close failed');
    const open = fs.open.bind(fs);
    const intercepted = jest
      .spyOn(fs, 'open')
      .mockImplementation(async (...args) => {
        const handle = await open(...args);
        const close = handle.close.bind(handle);
        jest.spyOn(handle, 'close').mockImplementationOnce(async () => {
          await close();
          throw failure;
        });
        return handle;
      });
    try {
      await expect(
        writeFileAtomic(path.join(root, 'value.json'), 'next'),
      ).rejects.toBe(failure);
      expect(await fs.readdir(root)).toEqual([]);
    } finally {
      intercepted.mockRestore();
    }
  });

  it('still removes staging when synchronous close and cleanup close both fail', () => {
    const failure = new Error('close failed');
    const close = fsSync.closeSync;
    const intercepted = jest
      .spyOn(fsSync, 'closeSync')
      .mockImplementationOnce((descriptor) => {
        close(descriptor);
        throw failure;
      });
    try {
      expect(() =>
        writeFileAtomicSync(path.join(root, 'value.json'), 'next'),
      ).toThrow(failure);
      expect(fsSync.readdirSync(root)).toEqual([]);
    } finally {
      intercepted.mockRestore();
    }
  });
});
