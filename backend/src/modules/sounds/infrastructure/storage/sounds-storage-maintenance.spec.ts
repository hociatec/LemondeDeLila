import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { removeUnusedFilesForSoundId } from './sounds-storage-maintenance';

describe('sound replacement cleanup', () => {
  let root: string;
  let directory: string;
  const warn = jest.fn();

  beforeEach(async () => {
    root = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'lila-sound-cleanup-'),
    );
    directory = path.join(root, 'TableAmbience1');
    await fs.promises.mkdir(directory);
    warn.mockClear();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  it('retains only the newest WAV for that ambience, including repeated replacements', async () => {
    const other = path.join(root, 'TableAmbience2');
    await fs.promises.mkdir(other);
    await fs.promises.writeFile(path.join(other, 'other.wav'), 'unrelated');
    await fs.promises.writeFile(path.join(directory, 'old.wav'), 'old');
    await fs.promises.writeFile(path.join(directory, 'old.mp3'), 'legacy');
    await fs.promises.writeFile(path.join(directory, 'new.wav'), 'new');
    expect(
      await removeUnusedFilesForSoundId(root, warn, 'TableAmbience1', 'new', {
        strict: true,
      }),
    ).toBe(2);
    expect(await fs.promises.readdir(directory)).toEqual(['new.wav']);
    expect(
      await fs.promises.readFile(path.join(directory, 'new.wav'), 'utf8'),
    ).toBe('new');
    await fs.promises.writeFile(path.join(directory, 'latest.wav'), 'latest');
    await removeUnusedFilesForSoundId(root, warn, 'TableAmbience1', 'latest', {
      strict: true,
    });
    expect(await fs.promises.readdir(directory)).toEqual(['latest.wav']);
    expect(await fs.promises.readdir(other)).toEqual(['other.wav']);
  });

  it('fails explicitly when an old file cannot be deleted, preserving the new sound', async () => {
    await fs.promises.writeFile(path.join(directory, 'old.wav'), 'old');
    await fs.promises.writeFile(path.join(directory, 'new.wav'), 'new');
    jest.spyOn(fs.promises, 'rm').mockRejectedValue(new Error('Access denied'));
    await expect(
      removeUnusedFilesForSoundId(root, warn, 'TableAmbience1', 'new', {
        strict: true,
      }),
    ).rejects.toThrow('Anciens fichiers audio non supprimés');
    expect(
      await fs.promises.readFile(path.join(directory, 'new.wav'), 'utf8'),
    ).toBe('new');
    expect(warn).toHaveBeenCalled();
  });

  it('does not report success if the ambience directory cannot be read', async () => {
    jest
      .spyOn(fs.promises, 'readdir')
      .mockRejectedValue(new Error('Access denied'));
    await expect(
      removeUnusedFilesForSoundId(root, warn, 'TableAmbience1', 'new', {
        strict: true,
      }),
    ).rejects.toThrow('Access denied');
  });
});
