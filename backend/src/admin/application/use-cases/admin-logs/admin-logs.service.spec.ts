import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import { AdminLogsService } from '../../../infrastructure/filesystem/admin-logs.service';

jest.mock('fs', () => ({
  promises: {
    readdir: jest.fn(),
    stat: jest.fn(),
    readFile: jest.fn(),
  },
}));

describe('AdminLogsService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns the tail of the latest log file', async () => {
    const mockedFs = fs.promises as jest.Mocked<typeof fs.promises>;
    mockedFs.readdir.mockResolvedValue(['old.log', 'new.log'] as any);
    mockedFs.stat
      .mockResolvedValueOnce({ mtimeMs: 10 } as any)
      .mockResolvedValueOnce({ mtimeMs: 20 } as any);
    mockedFs.readFile.mockResolvedValue(
      'one\ntwo\nERR three\nERR four' as any,
    );

    const service = new AdminLogsService({
      getLogDir: jest.fn().mockReturnValue('log'),
    } as any);

    await expect(
      service.download({ lines: 1, filter: 'ERR' }),
    ).resolves.toEqual({
      file: 'new.log',
      lines: ['ERR four'],
      total: 2,
    });
  });

  it('throws when log directory is missing', async () => {
    const mockedFs = fs.promises as jest.Mocked<typeof fs.promises>;
    mockedFs.readdir.mockRejectedValue(new Error('missing'));
    const service = new AdminLogsService({
      getLogDir: jest.fn().mockReturnValue('log'),
    } as any);

    await expect(service.download({})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
