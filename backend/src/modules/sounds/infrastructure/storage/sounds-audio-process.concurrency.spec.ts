import { runAudioProcess } from './sounds-audio-process';
import { spawn } from 'child_process';

jest.mock('child_process', () => ({ spawn: jest.fn() }));

describe('audio process concurrency', () => {
  it('keeps ffmpeg/ffprobe executions globally bounded', async () => {
    let active = 0;
    let maximum = 0;
    const spawnMock = jest.mocked(spawn);
    spawnMock.mockImplementation((() => {
      active += 1;
      maximum = Math.max(maximum, active);
      const events = new Map<string, (value?: unknown) => void>();
      const child: any = {
        stdout: { on: () => child.stdout },
        stderr: { on: () => child.stderr },
        on: (event: string, callback: (value?: unknown) => void) => {
          events.set(event, callback);
          if (event === 'close')
            setTimeout(() => {
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
      spawnMock.mockReset();
    }
  });
});
