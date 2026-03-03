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

  it('allows cross-origin media loading for mp3 sounds', async () => {
    const sounds: any = {
      resolveSoundFile: jest.fn().mockResolvedValue({
        entry: { sha256: 'abc' },
        filePath: '/tmp/sound.mp3',
        ext: '.mp3',
      }),
    };
    const controller = new SoundsController(sounds);

    const res: any = {
      setHeader: jest.fn(),
      sendFile: jest.fn(),
      redirect: jest.fn(),
    };

    await controller.getSound('RoomJoined', 'abc', res);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cross-Origin-Resource-Policy',
      'cross-origin',
    );
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'audio/mpeg');
    expect(res.sendFile).toHaveBeenCalledWith('/tmp/sound.mp3');
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('redirects legacy mp3 requests to wav when the server stores wav', async () => {
    const sounds: any = {
      resolveSoundFile: jest.fn().mockResolvedValue({
        entry: { sha256: 'abc', soundId: 'RoomJoined' },
        filePath: '/tmp/sound.wav',
        ext: '.wav',
      }),
    };
    const controller = new SoundsController(sounds);

    const res: any = {
      setHeader: jest.fn(),
      sendFile: jest.fn(),
      redirect: jest.fn(),
    };

    await controller.getSound('RoomJoined', 'abc', res);

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      '/api/sounds/RoomJoined/abc.wav',
    );
    expect(res.sendFile).not.toHaveBeenCalled();
  });
});
