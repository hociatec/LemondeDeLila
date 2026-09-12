import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { CiWxUpdateController } from './ci-wx-update.controller';
import { WxUpdateUploadService } from '../persistence/wx-update-upload.service';

it.each([undefined, {}, { uploadId: 'x'.repeat(129) }])(
  'cleans the received chunk when request metadata is rejected: %j',
  async (body) => {
    const chunk = jest.fn();
    const module = await Test.createTestingModule({
      controllers: [CiWxUpdateController],
      providers: [{ provide: WxUpdateUploadService, useValue: { chunk } }],
    }).compile();
    const directory = await fs.mkdtemp(join(tmpdir(), 'lila-chunk-test-'));
    const filePath = join(directory, 'chunk.tmp');
    try {
      await fs.writeFile(filePath, 'incomplete');
      await expect(
        module.get(CiWxUpdateController).chunk({ path: filePath }, body),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(fs.stat(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(chunk).not.toHaveBeenCalled();
    } finally {
      await fs.rm(filePath, { force: true });
      await fs.rmdir(directory);
      await module.close();
    }
  },
);

it('rejects unknown fields on each WX command boundary', () => {
  const uploads = {
    init: jest.fn(),
    chunk: jest.fn(),
    complete: jest.fn(),
  };
  const controller = new CiWxUpdateController(
    uploads as ConstructorParameters<typeof CiWxUpdateController>[0],
  );
  expect(() =>
    controller.init({ releaseId: 'release', unexpected: true }),
  ).toThrow(BadRequestException);
  expect(() =>
    controller.complete({
      uploadId: '00000000-0000-0000-0000-000000000000',
      unexpected: true,
    }),
  ).toThrow(BadRequestException);
  expect(uploads.init).not.toHaveBeenCalled();
  expect(uploads.complete).not.toHaveBeenCalled();
});
