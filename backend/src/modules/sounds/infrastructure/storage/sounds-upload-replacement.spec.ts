import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { SoundManifest } from '../../application/read-models/sound-manifest.record';
import { SoundsUploadManager } from './sounds-upload.manager';
import { removeUnusedFilesForSoundId } from './sounds-storage-maintenance';
import { probeSoundDurationSeconds } from './sounds-audio.utils';

jest.mock('./sounds-audio.utils', () => ({
  probeSoundDurationSeconds: jest.fn().mockResolvedValue(1),
  detectSoundSilence: jest.fn().mockResolvedValue(false),
  transcodeSoundToStableWav: jest.fn(async (input: string) => ({
    outputPath: input,
    tempDir: null,
  })),
}));

describe('uploading a replacement ambience', () => {
  let root: string;
  let manifest: SoundManifest;
  let upload: SoundsUploadManager;
  const notifyUpdated = jest.fn();
  const removeUnusedFiles = jest.fn();

  beforeEach(async () => {
    root = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'lila-replacement-'),
    );
    manifest = { updatedAt: '', sounds: {}, disabled: [] };
    jest.mocked(probeSoundDurationSeconds).mockResolvedValue(1);
    notifyUpdated.mockReset().mockResolvedValue(undefined);
    removeUnusedFiles
      .mockReset()
      .mockImplementation((id, hash) =>
        removeUnusedFilesForSoundId(root, () => {}, id, hash, { strict: true }),
      );
    upload = new SoundsUploadManager({
      dataRoot: root,
      normalizeSoundKey: () => 'TableAmbience1',
      readManifest: async () => manifest,
      writeManifest: async (next) => {
        manifest = next;
      },
      removeUnusedFiles,
      notifyUpdated,
      storageError: () => new Error('Storage failure'),
      ensureStorageCapacity: async () => {},
      warn: () => {},
    });
  });

  afterEach(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  async function replace(content: string) {
    const input = path.join(root, 'incoming.wav');
    await fs.promises.writeFile(input, content);
    return upload.setSound(
      'TableAmbience1',
      input,
      'ambience.wav',
      'audio/wav',
    );
  }

  it('replaces A with B, keeping a single manifest entry and only B on disk', async () => {
    const a = await replace('sound A');
    const b = await replace('sound B');
    expect(b.sha256).not.toBe(a.sha256);
    expect(Object.keys(manifest.sounds)).toEqual(['TableAmbience1']);
    expect(manifest.sounds.TableAmbience1).toEqual(b);
    const directory = path.join(root, 'TableAmbience1');
    expect(await fs.promises.readdir(directory)).toEqual([`${b.sha256}.wav`]);
    expect(
      await fs.promises.readFile(
        path.join(directory, `${b.sha256}.wav`),
        'utf8',
      ),
    ).toBe('sound B');
    await replace('sound B');
    expect(await fs.promises.readdir(directory)).toEqual([`${b.sha256}.wav`]);
  });

  it('keeps A if the proposed replacement is invalid', async () => {
    const a = await replace('sound A');
    jest.mocked(probeSoundDurationSeconds).mockResolvedValue(0);
    await expect(replace('invalid B')).rejects.toThrow('Son trop court');
    expect(manifest.sounds.TableAmbience1).toEqual(a);
    expect(
      await fs.promises.readdir(path.join(root, 'TableAmbience1')),
    ).toEqual([`${a.sha256}.wav`]);
  });

  it('reports incomplete cleanup instead of claiming a successful replacement', async () => {
    await replace('sound A');
    notifyUpdated.mockClear();
    removeUnusedFiles.mockRejectedValue(new Error('Access denied'));
    await expect(replace('sound B')).rejects.toThrow(
      'suppression des anciens fichiers a échoué',
    );
    expect(notifyUpdated).not.toHaveBeenCalled();
  });
});
