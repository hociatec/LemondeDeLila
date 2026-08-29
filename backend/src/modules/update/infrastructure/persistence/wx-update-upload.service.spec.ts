import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { WxUpdateReleaseService } from './wx-update-release.service';
import { WxUpdateUploadService } from './wx-update-upload.service';

describe('WxUpdateUploadService cleanup', () => {
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
    const service = new WxUpdateUploadService(updates);

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
