import * as winston from 'winston';
import fs from 'fs';
import { ServLoggerService } from './serv-logger.service';
import { playingLog } from './playing-logger';

jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({ info: jest.fn(), error: jest.fn() })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    printf: jest.fn(),
  },
  transports: { Console: jest.fn(), File: jest.fn() },
}));

afterEach(() => jest.restoreAllMocks());

it('redacts exception messages, traces and logger contexts before passing them to Winston', () => {
  const previous = process.env.LOG_FILES_ENABLED;
  process.env.LOG_FILES_ENABLED = 'false';
  try {
    const logger = new ServLoggerService();
    const sink = jest.mocked(winston.createLogger).mock.results.at(-1)!.value;
    logger.error(
      'redis://user:private-password@host',
      'Bearer private-token',
      'password=private-context',
    );
    expect(JSON.stringify(sink.error.mock.calls)).not.toMatch(
      /private-password|private-token|private-context/,
    );
    expect(sink.error).toHaveBeenCalledTimes(1);
  } finally {
    if (previous === undefined) delete process.env.LOG_FILES_ENABLED;
    else process.env.LOG_FILES_ENABLED = previous;
  }
});

it('sanitizes the direct gameplay file sink without mutating its input', () => {
  const append = jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
  jest.spyOn(fs, 'existsSync').mockReturnValue(true);
  const payload = {
    token: 'private-token',
    message: 'redis://user:private-password@host',
    roomId: 7,
  };
  playingLog('test', payload);
  expect(append).toHaveBeenCalledTimes(1);
  expect(String(append.mock.calls[0][1])).not.toMatch(
    /private-token|private-password/,
  );
  expect(payload.token).toBe('private-token');
});
