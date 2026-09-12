import childProcess, { ChildProcess } from 'child_process';
import { operationalSettings } from '../../../../platform/config/public-api';
import { runAudioProcess } from './sounds-audio-process';

it('rejects overload and removes expired waiters before admitting more work', async () => {
  jest.useFakeTimers();
  const children: ChildProcess[] = [];
  const spawn = jest.spyOn(childProcess, 'spawn').mockImplementation(() => {
    const child = new ChildProcess();
    children.push(child);
    return child;
  });
  try {
    const running = [
      runAudioProcess('audio', [], 120_000),
      runAudioProcess('audio', [], 120_000),
    ];
    await Promise.resolve();
    const queued = Array.from({ length: 16 }, () =>
      runAudioProcess('audio', []),
    );
    const settled = Promise.allSettled(queued);
    await expect(runAudioProcess('audio', [])).rejects.toThrow('saturée');
    expect(spawn).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(
      operationalSettings.soundProcessQueueTimeoutMs,
    );
    expect(
      (await settled).every((result) => result.status === 'rejected'),
    ).toBe(true);
    for (const child of children) child.emit('close', 0);
    await Promise.all(running);
    const next = runAudioProcess('audio', []);
    await Promise.resolve();
    expect(spawn).toHaveBeenCalledTimes(3);
    children[2].emit('close', 0);
    await expect(next).resolves.toMatchObject({ code: 0 });
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.restoreAllMocks();
    jest.useRealTimers();
  }
});
