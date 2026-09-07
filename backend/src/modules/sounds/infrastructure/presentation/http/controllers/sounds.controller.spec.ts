import { SoundsController } from './sounds.controller';

describe('SoundsController', () => {
  it('returns only enabled table ambiences on public endpoint', async () => {
    const sounds: any = {
      listTableAmbiencesWithFilter: jest.fn().mockResolvedValue({
        updatedAt: '2026-03-02T00:00:00.000Z',
        items: [
          { soundId: 'TableAmbience1', name: 'Ambiance 1', enabled: true },
        ],
      }),
    };
    const controller = new SoundsController(sounds);

    const out = await controller.tableAmbiences();

    expect(sounds.listTableAmbiencesWithFilter).toHaveBeenCalledWith({
      includeDisabled: false,
    });
    expect(out.items).toHaveLength(1);
    expect(out.items[0].soundId).toBe('TableAmbience1');
  });

  it('allows serving wav files from storage paths under dot-directories', async () => {
    const sounds: any = {
      resolveSoundFile: jest.fn().mockResolvedValue({
        entry: { sha256: 'abc' },
        filePath:
          '/home/ubuntu/.local/share/lemonde-de-lila/sounds/TableAmbience1/abc.wav',
      }),
    };
    const controller = new SoundsController(sounds);

    const res: any = {
      setHeader: jest.fn(),
      sendFile: jest.fn(),
    };

    await controller.getSoundWav('TableAmbience1', 'abc', res);

    expect(res.sendFile).toHaveBeenCalledWith(
      '/home/ubuntu/.local/share/lemonde-de-lila/sounds/TableAmbience1/abc.wav',
      { dotfiles: 'allow' },
    );
  });
});
