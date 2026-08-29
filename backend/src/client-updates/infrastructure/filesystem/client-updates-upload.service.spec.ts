import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { ClientUpdatesUploadStorePort } from '../../application/ports/client-updates-upload-store.port';
import type { ClientUpdatesService } from '../../application/use-cases/client-updates/client-updates.service';
import { ClientUpdatesUploadService } from './client-updates-upload.service';

describe('ClientUpdatesUploadService', () => {
  let uploadsRoot: string;

  const createService = () => {
    const updates = {
      applyZip: jest.fn(async () => undefined),
      getPublishedClickOnceVersionFromDisk: jest.fn(async () => null),
      saveLatest: jest.fn(async () => undefined),
      getPublicUrl: jest.fn(() => '/updates/client-win/'),
    };
    const uploadStore = {
      getUploadsRoot: jest.fn(() => uploadsRoot),
      readCompletedMarker: jest.fn(async () => null),
      writeCompletedMarker: jest.fn(async () => undefined),
    };
    return {
      service: new ClientUpdatesUploadService(
        updates as unknown as ClientUpdatesService,
        uploadStore as unknown as ClientUpdatesUploadStorePort,
      ),
      updates,
      uploadStore,
    };
  };

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

  it('rejette les traversées de chemin et les tailles non bornées', async () => {
    const { service } = createService();
    await expect(
      service.uploadComplete({ uploadId: '../../outside' }),
    ).rejects.toThrow('uploadId invalide');
    await expect(
      service.uploadInit({ totalBytes: 601 * 1024 * 1024 }),
    ).rejects.toThrow('totalBytes invalide');
  });

  it('n’écrase jamais un chunk déjà reçu', async () => {
    const { service } = createService();
    const uploadId = 'upload-race';
    const uploadDir = path.join(uploadsRoot, uploadId);
    await fs.promises.mkdir(uploadDir, { recursive: true });
    await fs.promises.writeFile(path.join(uploadDir, 'meta.json'), '{}');
    await fs.promises.writeFile(path.join(uploadDir, '0.part'), 'original');
    const incoming = path.join(uploadsRoot, 'incoming.part');
    await fs.promises.writeFile(incoming, 'replacement');

    await expect(
      service.uploadChunk({ uploadId, index: 0, filePath: incoming }),
    ).resolves.toEqual({ ok: true, duplicate: true });
    await expect(
      fs.promises.readFile(path.join(uploadDir, '0.part'), 'utf8'),
    ).resolves.toBe('original');
  });

  it('refuse une archive assemblée dont la taille annoncée est fausse', async () => {
    const { service, updates } = createService();
    const uploadId = 'upload-size';
    const uploadDir = path.join(uploadsRoot, uploadId);
    await fs.promises.mkdir(uploadDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(uploadDir, 'meta.json'),
      JSON.stringify({
        uploadId,
        version: '1.2.3',
        message: null,
        minRequiredVersion: null,
        totalBytes: 99,
        createdAt: '2026-08-26T00:00:00.000Z',
        completedAt: null,
      }),
    );
    await fs.promises.writeFile(path.join(uploadDir, '0.part'), 'abc');

    await expect(service.uploadComplete({ uploadId })).rejects.toThrow(
      'Taille archive invalide',
    );
    expect(updates.applyZip).not.toHaveBeenCalled();
  });
});
