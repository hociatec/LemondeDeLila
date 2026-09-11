import * as fs from 'fs';
import {
  detectSoundSilence,
  transcodeSoundToStableWav,
} from './sounds-audio.utils';
import { runAudioProcess } from './sounds-audio-process';

jest.mock('./sounds-audio-process', () => ({
  ...jest.requireActual<typeof import('./sounds-audio-process')>(
    './sounds-audio-process',
  ),
  ffmpegPath: () => 'ffmpeg',
  runAudioProcess: jest.fn(),
}));

it.each(['spawn', 'exit'])(
  'removes the temporary directory when transcoding fails at %s',
  async (stage) => {
    const created = jest.spyOn(fs.promises, 'mkdtemp');
    const process = jest.mocked(runAudioProcess);
    if (stage === 'spawn')
      process.mockRejectedValueOnce(new Error('spawn failed'));
    else
      process.mockResolvedValueOnce({
        code: 1,
        stdout: '',
        stderr: 'invalid media',
      });
    try {
      await expect(
        transcodeSoundToStableWav('input.wav', () => {}),
      ).rejects.toThrow();
      const directory = await created.mock.results[0].value;
      await expect(fs.promises.stat(directory)).rejects.toMatchObject({
        code: 'ENOENT',
      });
    } finally {
      created.mockRestore();
    }
  },
);

it.each([
  { code: 1, stdout: '', stderr: 'max_volume: -5 dB' },
  { code: 0, stdout: '', stderr: 'incomplete analysis' },
])('rejects failed or incomplete silence analysis: %p', async (result) => {
  jest.mocked(runAudioProcess).mockResolvedValueOnce(result);
  await expect(detectSoundSilence('input.wav')).rejects.toThrow();
});
