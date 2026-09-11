import { runAudioProcess } from './sounds-audio-process';

describe('audio process concurrency', () => {
  it('keeps ffmpeg/ffprobe executions globally bounded', async () => {
    const childProcess = require('child_process') as typeof import('child_process');
    let active = 0;
    let maximum = 0;
    jest.spyOn(childProcess, 'spawn').mockImplementation((() => {
      active += 1;
      maximum = Math.max(maximum, active);
      const events = new Map<string, (value?: unknown) => void>();
      const child: any = {
        stdout: { on: () => child.stdout },
        stderr: { on: () => child.stderr },
        on: (event: string, callback: (value?: unknown) => void) => {
          events.set(event, callback);
          if (event === 'close') setTimeout(() => {
            active -= 1;
            callback(0);
          }, 5);
          return child;
        },
        kill: jest.fn(),
      };
      return child;
    }) as never);
    try {
      await Promise.all(
        Array.from({ length: 6 }, () => runAudioProcess('fake-audio-tool', [])),
      );
      expect(maximum).toBeLessThanOrEqual(2);
    } finally {
      jest.restoreAllMocks();
    }
  });
});
