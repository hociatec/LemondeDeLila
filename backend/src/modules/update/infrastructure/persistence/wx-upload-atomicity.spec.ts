import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { WxUpdateUploadService } from './wx-update-upload.service';
import { WxUpdateUploadStorage } from './wx-update-upload-storage';
import type { WxUpdateReleaseService } from './wx-update-release.service';
import type { RedisDistributedLeaseService } from '../../../../platform/redis/public-api';

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'lila-wx-atomic-'));
});
afterEach(async () => {
  jest.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});

async function upload() {
  const service = new WxUpdateUploadService(
    {
      getTargetDir: () => root,
      getMaxArtifactBytes: () => 1024,
    } as unknown as WxUpdateReleaseService,
    {} as RedisDistributedLeaseService,
  );
  const { uploadId } = await service.init({
    releaseId: 'atomic',
    version: '1',
    sequence: 1,
    publishedAt: new Date(0).toISOString(),
    sha256: 'a'.repeat(64),
    signature: 'test',
    totalBytes: 8,
  });
  return { service, uploadId, dir: path.join(root, '.uploads', uploadId) };
}

it('publishes a chunk only after its full copy, with exactly one concurrent winner', async () => {
  const { service, uploadId, dir } = await upload();
  const first = path.join(root, 'first.tmp'),
    second = path.join(root, 'second.tmp');
  await fs.writeFile(first, 'abcdefgh');
  await fs.writeFile(second, '12345678');
  let resume!: () => void, entered!: () => void;
  const paused = new Promise<void>((resolve) => {
    resume = resolve;
  });
  const copying = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const copy = fs.copyFile.bind(fs);
  jest
    .spyOn(fs, 'copyFile')
    .mockImplementation(async (source, destination, flags) => {
      if (String(source) === first) {
        await fs.writeFile(destination, 'ab', { flag: 'wx' });
        entered();
        await paused;
        await fs.writeFile(destination, 'abcdefgh');
      } else await copy(source, destination, flags);
    });
  const pending = service.chunk({ uploadId, index: 0, filePath: first });
  try {
    await copying;
    expect(await fs.readdir(dir)).not.toContain('artifact.0.part');
    await expect(
      service.chunk({ uploadId, index: 0, filePath: second }),
    ).resolves.toEqual({ ok: true });
  } finally {
    resume();
    await pending;
  }
  expect(await pending).toEqual({ ok: true, duplicate: true });
  expect(await fs.readFile(path.join(dir, 'artifact.0.part'), 'utf8')).toBe(
    '12345678',
  );
  expect((await fs.readdir(dir)).sort()).toEqual([
    'artifact.0.part',
    'meta.json',
  ]);
});

it.each(['copy', 'sync', 'link'] as const)(
  'removes staging after a %s failure and accepts a complete retry',
  async (phase) => {
    const { service, uploadId, dir } = await upload();
    const source = path.join(root, 'source.tmp');
    await fs.writeFile(source, 'abcdefgh');
    const failure = Object.assign(new Error('injected storage failure'), {
      code: phase === 'copy' ? 'ENOSPC' : 'EIO',
    });
    if (phase === 'copy')
      jest
        .spyOn(fs, 'copyFile')
        .mockImplementationOnce(async (_source, target) => {
          await fs.writeFile(target, 'ab', { flag: 'wx' });
          throw failure;
        });
    else if (phase === 'link')
      jest.spyOn(fs, 'link').mockRejectedValueOnce(failure);
    else {
      const open = fs.open.bind(fs);
      jest.spyOn(fs, 'open').mockImplementationOnce(async (...args) => {
        const handle = await open(...args);
        jest.spyOn(handle, 'sync').mockRejectedValueOnce(failure);
        return handle;
      });
    }
    await expect(
      service.chunk({ uploadId, index: 0, filePath: source }),
    ).rejects.toThrow('injected storage failure');
    expect(await fs.readdir(dir)).toEqual(['meta.json']);
    await expect(fs.stat(source)).rejects.toHaveProperty('code', 'ENOENT');
    jest.restoreAllMocks();
    await fs.writeFile(source, 'abcdefgh');
    await expect(
      service.chunk({ uploadId, index: 0, filePath: source }),
    ).resolves.toEqual({ ok: true });
    expect(await fs.readFile(path.join(dir, 'artifact.0.part'), 'utf8')).toBe(
      'abcdefgh',
    );
  },
);

it('rejects a zero-byte write instead of looping forever', async () => {
  const storage = new WxUpdateUploadStorage(root);
  await fs.writeFile(path.join(root, 'artifact.0.part'), 'abcd');
  const open = fs.open.bind(fs);
  jest.spyOn(fs, 'open').mockImplementationOnce(async (...args) => {
    const handle = await open(...args);
    jest
      .spyOn(handle, 'write')
      .mockResolvedValue({ bytesWritten: 0, buffer: '' });
    return handle;
  });
  await expect(
    storage.combineParts({
      dir: root,
      kind: 'artifact',
      destination: path.join(root, 'combined.zip'),
      expectedBytes: 4,
      missingMessage: 'missing',
      overflowMessage: 'overflow',
      sizeMessage: 'size mismatch',
    }),
  ).rejects.toThrow('sans progression');
});

it('does not acknowledge a staging collision as a stored duplicate or delete the other file', async () => {
  const { service, uploadId, dir } = await upload();
  const source = path.join(root, 'source.tmp');
  await fs.writeFile(source, 'abcdefgh');
  let collision = '';
  jest.spyOn(fs, 'copyFile').mockImplementationOnce(async (_source, target) => {
    collision = String(target);
    await fs.writeFile(collision, 'other owner', { flag: 'wx' });
    throw Object.assign(new Error('staging collision'), { code: 'EEXIST' });
  });
  await expect(
    service.chunk({ uploadId, index: 0, filePath: source }),
  ).rejects.toThrow('staging collision');
  expect(await fs.readFile(collision, 'utf8')).toBe('other owner');
  expect(await fs.readdir(dir)).not.toContain('artifact.0.part');
});

it('assembles every byte even when the filesystem accepts short writes', async () => {
  const storage = new WxUpdateUploadStorage(root);
  await fs.writeFile(path.join(root, 'artifact.0.part'), 'abcdefgh');
  await fs.writeFile(path.join(root, 'artifact.1.part'), 'ijklmnop');
  const open = fs.open.bind(fs);
  jest.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const handle = await open(...args);
    const write = handle.write.bind(handle);
    jest.spyOn(handle, 'write').mockImplementation(async (buffer: unknown) => {
      if (!(buffer instanceof Uint8Array))
        throw new Error('Expected buffer write');
      const result = await write(buffer.subarray(0, 2));
      return { bytesWritten: result.bytesWritten, buffer: '' };
    });
    return handle;
  });
  const destination = path.join(root, 'combined.zip');
  await storage.combineParts({
    dir: root,
    kind: 'artifact',
    destination,
    expectedBytes: 16,
    missingMessage: 'missing',
    overflowMessage: 'overflow',
    sizeMessage: 'size mismatch',
  });
  expect(await fs.readFile(destination, 'utf8')).toBe('abcdefghijklmnop');
});
