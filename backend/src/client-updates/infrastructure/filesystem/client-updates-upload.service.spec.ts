import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { ClientUpdatesUploadStorePort } from '../../application/ports/client-updates-upload-store.port';
import type { ClientUpdatesService } from '../../application/use-cases/client-updates/client-updates.service';
import { ClientUpdatesUploadService } from './client-updates-upload.service';

describe('ClientUpdatesUploadService', () => {
  let uploadsRoot: string;

  beforeEach(async () => {
    uploadsRoot = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'client-updates-upload-test-'),
    );
  });

  afterEach(async () => {
    await fs.promises.rm(uploadsRoot, { recursive: true, force: true });
  });

  it('assemble les chunks dans l ordre puis publie et marque l upload', async () => {
    const uploadId = 'upload-1';
    const uploadDir = path.join(uploadsRoot, uploadId);
    await fs.promises.mkdir(uploadDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(uploadDir, 'meta.json'),
      JSON.stringify({
        uploadId,
        version: '1.2.3',
        message: 'Nouvelle version',
        minRequiredVersion: '1.0.0',
        totalBytes: 6,
        createdAt: '2026-08-26T00:00:00.000Z',
        completedAt: null,
      }),
    );
    await fs.promises.writeFile(path.join(uploadDir, '0.part'), 'abc');
    await fs.promises.writeFile(path.join(uploadDir, '1.part'), 'def');

    let publishedArchive = '';
    const updates = {
      applyZip: jest.fn(async (zipPath: string) => {
        publishedArchive = await fs.promises.readFile(zipPath, 'utf-8');
      }),
      getPublishedClickOnceVersionFromDisk: jest.fn(async () => null),
      saveLatest: jest.fn(async () => undefined),
      getPublicUrl: jest.fn(() => '/updates/client-win/'),
    };
    const uploadStore = {
      getUploadsRoot: jest.fn(() => uploadsRoot),
      readCompletedMarker: jest.fn(async () => null),
      writeCompletedMarker: jest.fn(async () => undefined),
    };
    const service = new ClientUpdatesUploadService(
      updates as unknown as ClientUpdatesService,
      uploadStore as unknown as ClientUpdatesUploadStorePort,
    );

    const result = await service.uploadComplete({ uploadId });

    expect(publishedArchive).toBe('abcdef');
    expect(updates.applyZip).toHaveBeenCalledTimes(1);
    expect(updates.saveLatest).toHaveBeenCalledWith(
      expect.objectContaining({ version: '1.2.3' }),
    );
    expect(uploadStore.writeCompletedMarker).toHaveBeenCalledWith(
      uploadId,
      expect.objectContaining({ version: '1.2.3' }),
    );
    expect(result).toEqual({
      ok: true,
      meta: expect.objectContaining({ version: '1.2.3' }),
    });
  });
});
