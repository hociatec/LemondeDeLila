import { SoundsController } from './sounds.controller';

describe('SoundsController', () => {
  it('allows cross-origin media loading for mp3 sounds', async () => {
    const sounds: any = {
      resolveSoundFile: jest.fn().mockResolvedValue({
        entry: { sha256: 'abc' },
        filePath: '/tmp/sound.mp3',
      }),
    };
    const controller = new SoundsController(sounds);

    const res: any = {
      setHeader: jest.fn(),
      sendFile: jest.fn(),
    };

    await controller.getSound('RoomJoined', 'abc', res);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cross-Origin-Resource-Policy',
      'cross-origin',
    );
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'audio/mpeg');
    expect(res.sendFile).toHaveBeenCalledWith('/tmp/sound.mp3');
  });
});

