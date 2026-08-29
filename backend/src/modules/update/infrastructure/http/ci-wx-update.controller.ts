import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as os from 'os';
import { bestEffort } from '../../../../shared/utils/public-api';

import { WxUpdateUploadService } from '../persistence/wx-update-upload.service';
import { UpdateUploadTokenGuard } from './update-upload-token.guard';

type FileLike = { path?: unknown };

@Controller('api/ci/client-wx-updates')
@UseGuards(UpdateUploadTokenGuard)
export class CiWxUpdateController {
  constructor(private readonly uploads: WxUpdateUploadService) {}

  @Get('status')
  status() {
    return this.uploads.status();
  }

  @Post('upload/init')
  init(@Body() body: Record<string, unknown>) {
    return this.uploads.init({
      releaseId:
        typeof body.releaseId === 'string' ? body.releaseId : undefined,
      version: typeof body.version === 'string' ? body.version : undefined,
      sequence: typeof body.sequence === 'number' ? body.sequence : undefined,
      publishedAt:
        typeof body.publishedAt === 'string' ? body.publishedAt : undefined,
      message: typeof body.message === 'string' ? body.message : undefined,
      minimumVersion:
        typeof body.minimumVersion === 'string'
          ? body.minimumVersion
          : undefined,
      mandatoryAt:
        typeof body.mandatoryAt === 'string' ? body.mandatoryAt : undefined,
      sha256: typeof body.sha256 === 'string' ? body.sha256 : undefined,
      signature:
        typeof body.signature === 'string' ? body.signature : undefined,
      totalBytes:
        typeof body.totalBytes === 'number' ? body.totalBytes : undefined,
      installerSha256:
        typeof body.installerSha256 === 'string'
          ? body.installerSha256
          : undefined,
      installerTotalBytes:
        typeof body.installerTotalBytes === 'number'
          ? body.installerTotalBytes
          : undefined,
    });
  }

  @Post('upload/chunk')
  @UseInterceptors(
    FileInterceptor('file', {
      dest: os.tmpdir(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async chunk(
    @UploadedFile() file?: FileLike,
    @Body() body?: Record<string, unknown>,
  ) {
    const filePath = typeof file?.path === 'string' ? file.path : '';
    if (!filePath) throw new BadRequestException('Chunk WX manquant.');
    try {
      return await this.uploads.chunk({
        uploadId: typeof body?.uploadId === 'string' ? body.uploadId : '',
        index: Number(body?.index ?? -1),
        kind: typeof body?.kind === 'string' ? body.kind : undefined,
        filePath,
      });
    } finally {
      await bestEffort(
        fs.promises.rm(filePath, { force: true }),
        'suppression de l’upload WX temporaire',
      );
    }
  }

  @Post('upload/complete')
  complete(@Body() body: Record<string, unknown>) {
    return this.uploads.complete(
      typeof body.uploadId === 'string' ? body.uploadId : '',
    );
  }
}
