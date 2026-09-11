import { runAudioProcess } from './sounds-audio-process';

it('captures bounded process output and terminates excessive output', async () => {
  await expect(
    runAudioProcess(
      process.execPath,
      ['-e', 'process.stdout.write("ok")'],
      5000,
    ),
  ).resolves.toEqual({ code: 0, stdout: 'ok', stderr: '' });
  await expect(
    runAudioProcess(
      process.execPath,
      ['-e', 'process.stdout.write("x".repeat(2 * 1024 * 1024))'],
      5000,
    ),
  ).rejects.toThrow('output limit');
});

it('terminates a process exceeding its deadline', async () => {
  await expect(
    runAudioProcess(
      process.execPath,
      ['-e', 'setInterval(() => {}, 1000)'],
      100,
    ),
  ).rejects.toThrow('Process timeout');
});
