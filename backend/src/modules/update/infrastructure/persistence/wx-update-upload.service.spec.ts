import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { WxUpdateReleaseService } from './wx-update-release.service';
import { WxUpdateUploadService } from './wx-update-upload.service';
import { WxUpdateUploadStorage } from './wx-update-upload-storage';
import type { RedisDistributedLeaseService } from '../../../../platform/redis/public-api';

const testLeases = {
  acquire: jest.fn().mockResolvedValue({
    isHeld: jest.fn().mockResolvedValue(true),
    release: jest.fn().mockResolvedValue(undefined),
  }),
} as unknown as RedisDistributedLeaseService;

const uploadInput = {
  releaseId: 'release-cleanup',
  version: '1.2.3',
  sequence: 1,
  publishedAt: new Date(0).toISOString(),
  sha256: 'a'.repeat(64),
  signature: 'signature',
  totalBytes: 4,
};

async function cleanupFixture() {
  const root = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'lila-wx-failure-'),
  );
  const publish = jest.fn();
  const service = new WxUpdateUploadService(
    {
      getTargetDir: () => root,
      getMaxArtifactBytes: () => 1024,
      publish,
    } as unknown as WxUpdateReleaseService,
    testLeases,
  );
  return { root, publish, service };
}

describe('WxUpdateUploadService cleanup', () => {
  it('releases the distributed lease when the local completion lock is already held', async () => {
    const { root, service, publish } = await cleanupFixture();
    const lease = await testLeases.acquire('fixture', 900000);
    const release = jest.spyOn(lease!, 'release').mockClear();
    try {
      const { uploadId } = await service.init(uploadInput);
      await fs.promises.writeFile(
        path.join(root, '.uploads', uploadId, '.complete.lock'),
        'held',
      );
      await expect(service.complete(uploadId)).rejects.toThrow('déjà en cours');
      expect(release).toHaveBeenCalledTimes(1);
      expect(publish).not.toHaveBeenCalled();
    } finally {
      await fs.promises.rm(root, { recursive: true, force: true });
    }
  });
  it('removes an uninitialized upload directory when metadata cannot be written', async () => {
    const { root, service } = await cleanupFixture();
    const failure = new Error('metadata write failed');
    const write = jest
      .spyOn(WxUpdateUploadStorage.prototype, 'writeMeta')
      .mockRejectedValueOnce(failure);
    try {
      await expect(service.init(uploadInput)).rejects.toBe(failure);
      expect(await fs.promises.readdir(path.join(root, '.uploads'))).toEqual(
        [],
      );
    } finally {
      write.mockRestore();
      await fs.promises.rm(root, { recursive: true, force: true });
    }
  });

  it('attempts every staging cleanup without masking a publication failure', async () => {
    const { root, service, publish } = await cleanupFixture();
    const failure = new Error('publication failed');
    publish.mockRejectedValueOnce(failure);
    const remove = fs.promises.rm.bind(fs.promises);
    let intercepted: jest.SpyInstance | undefined;
    try {
      const { uploadId } = await service.init(uploadInput);
      const source = path.join(root, 'chunk.tmp');
      await fs.promises.writeFile(source, 'data');
      await service.chunk({ uploadId, index: 0, filePath: source });
      intercepted = jest
        .spyOn(fs.promises, 'rm')
        .mockImplementation(async (target, options) => {
          if (String(target).endsWith('.complete.lock'))
            throw new Error('locked cleanup');
          return remove(target, options);
        });
      await expect(service.complete(uploadId)).rejects.toBe(failure);
      const remaining = await fs.promises.readdir(
        path.join(root, '.uploads', uploadId),
      );
      expect(remaining).not.toContain('combined.zip');
      expect(remaining).not.toContain('installer.zip');
      expect(remaining).toContain('artifact.0.part');
    } finally {
      intercepted?.mockRestore();
      await remove(root, { recursive: true, force: true });
    }
  });

  it('removes uploaded chunks after publication and keeps completion idempotent', async () => {
    const root = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'lila-wx-upload-'),
    );
    const manifest = { releaseId: 'release-1' };
    const publish = jest.fn(async () => manifest);
    const updates = {
      getTargetDir: () => root,
      getMaxArtifactBytes: () => 1024,
      getLatest: jest.fn(async () => manifest),
      publish,
    } as unknown as WxUpdateReleaseService;
    const service = new WxUpdateUploadService(updates, testLeases);

    try {
      const { uploadId } = await service.init({
        releaseId: 'release-1',
        version: '1.2.3',
        sequence: 1,
        publishedAt: new Date(0).toISOString(),
        sha256: 'a'.repeat(64),
        signature: 'signature',
        totalBytes: 4,
      });
      const source = path.join(root, 'chunk.tmp');
      await fs.promises.writeFile(source, 'data');
      await service.chunk({ uploadId, index: 0, filePath: source });

      await expect(service.complete(uploadId)).resolves.toMatchObject({
        ok: true,
      });

      const uploadDir = path.join(root, '.uploads', uploadId);
      expect(await fs.promises.readdir(uploadDir)).toEqual(['meta.json']);
      await expect(service.complete(uploadId)).resolves.toMatchObject({
        ok: true,
        alreadyCompleted: true,
      });
      expect(publish).toHaveBeenCalledTimes(1);
    } finally {
      await fs.promises.rm(root, { recursive: true, force: true });
    }
  });
});
