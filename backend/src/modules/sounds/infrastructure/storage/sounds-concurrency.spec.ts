import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as storage from './sounds-storage.utils';
import { SoundsService } from './sounds.service';
import { probeSoundDurationSeconds } from './sounds-audio.utils';

jest.mock('./sounds-audio.utils', () => ({
  probeSoundDurationSeconds: jest.fn().mockResolvedValue(1),
  detectSoundSilence: jest.fn().mockResolvedValue(false),
  transcodeSoundToStableWav: jest.fn(async (input: string) => ({
    outputPath: input,
    tempDir: null,
  })),
}));

describe('audio storage mutations across service instances', () => {
  let root: string;
  let first: SoundsService;
  let second: SoundsService;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'lila-sound-races-'));
    jest.mocked(probeSoundDurationSeconds).mockResolvedValue(1);
    jest.spyOn(storage, 'resolveSoundsDataRoot').mockReturnValue(root);
    first = new SoundsService({
      notifyAll: jest.fn().mockResolvedValue(undefined),
    } as any);
    second = new SoundsService({
      notifyAll: jest.fn().mockResolvedValue(undefined),
    } as any);
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.rm(root, { recursive: true, force: true });
  });

  async function inputs() {
    const a = path.join(root, 'a.wav'),
      b = path.join(root, 'b.wav');
    await fs.writeFile(a, 'sound A');
    await fs.writeFile(b, 'sound B');
    return [a, b];
  }

  it('preserves both manifest entries when two different sounds are uploaded', async () => {
    const [a, b] = await inputs();
    await Promise.all([
      first.setSound('TableAmbience1', a, 'a.wav'),
      second.setSound('TableAmbience2', b, 'b.wav'),
    ]);
    expect(
      Object.keys((await first.getPublicManifest()).sounds).sort(),
    ).toEqual(['TableAmbience1', 'TableAmbience2']);
  });

  it('leaves exactly the current file after two replacements of the same ambience', async () => {
    const [a, b] = await inputs();
    await Promise.all([
      first.setSound('TableAmbience1', a, 'a.wav'),
      second.setSound('TableAmbience1', b, 'b.wav'),
    ]);
    const manifest = await first.getPublicManifest();
    expect(await fs.readdir(path.join(root, 'TableAmbience1'))).toEqual([
      `${manifest.sounds.TableAmbience1?.sha256}.wav`,
    ]);
  });

  it('allocates distinct ambience IDs and supports nested deletion under the same lock', async () => {
    const created = await Promise.all([
      first.createTableAmbience('A'),
      second.createTableAmbience('B'),
    ]);
    expect(new Set(created.map((item) => item.soundId)).size).toBe(2);
    await first.deleteTableAmbience(created[0].soundId);
    expect((await first.listTableAmbiences()).items).toHaveLength(1);
  });

  it('publishes disabled table ambiences in the audio manifest without losing their preview file', async () => {
    const [a] = await inputs();
    const created = await first.createTableAmbienceWithSound('A', a, 'a.wav');
    await second.setTableAmbienceEnabled(created.soundId, false);
    const disabled = await first.getPublicManifest();
    expect(disabled.disabled).toContain(created.soundId);
    expect(disabled.sounds[created.soundId]).toBeDefined();
    await second.setTableAmbienceEnabled(created.soundId, true);
    expect((await first.getPublicManifest()).disabled).not.toContain(
      created.soundId,
    );
  });

  it.each(['manifest.json', 'table-ambiences.json'])(
    'preserves an unreadable or malformed %s',
    async (name) => {
      const file = path.join(root, name);
      await fs.writeFile(file, '{broken');
      const mutation =
        name === 'manifest.json'
          ? first.setSoundEnabled('TableAmbience1', false)
          : first.createTableAmbience('New');
      await expect(mutation).rejects.toThrow();
      expect(await fs.readFile(file, 'utf8')).toBe('{broken');
    },
  );

  it('rolls back a new ambience on invalid audio and reuses its slot on retry', async () => {
    const [a, b] = await inputs();
    jest.mocked(probeSoundDurationSeconds).mockResolvedValueOnce(0);
    await expect(
      first.createTableAmbienceWithSound('A', a, 'a.wav'),
    ).rejects.toThrow('Son trop court');
    expect(
      (await first.listTableAmbiencesWithFilter({ includeDisabled: true }))
        .items,
    ).toEqual([]);
    const created = await first.createTableAmbienceWithSound('B', b, 'b.wav');
    expect(created).toEqual({
      soundId: 'TableAmbience1',
      name: 'B',
      enabled: true,
    });
    expect(
      (await first.getPublicManifest()).sounds.TableAmbience1,
    ).toBeDefined();
  });
});
