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
import { bestEffort } from '../../../../platform/observability/public-api';
import { parseStrictInteger } from '../../../../shared/utils/public-api';

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
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Parametres WX invalides.');
    }
    return this.uploads.init({
      releaseId:
        typeof body.releaseId === 'string' && body.releaseId.length <= 128
          ? body.releaseId
          : undefined,
      version:
        typeof body.version === 'string' && body.version.length <= 128
          ? body.version
          : undefined,
      sequence:
        typeof body.sequence === 'number' && Number.isSafeInteger(body.sequence)
          ? body.sequence
          : undefined,
      publishedAt:
        typeof body.publishedAt === 'string' && body.publishedAt.length <= 64
          ? body.publishedAt
          : undefined,
      message:
        typeof body.message === 'string' && body.message.length <= 2_000
          ? body.message
          : undefined,
      minimumVersion:
        typeof body.minimumVersion === 'string'
          ? body.minimumVersion
          : undefined,
      mandatoryAt:
        typeof body.mandatoryAt === 'string' && body.mandatoryAt.length <= 64
          ? body.mandatoryAt
          : undefined,
      sha256:
        typeof body.sha256 === 'string' && body.sha256.length <= 128
          ? body.sha256
          : undefined,
      signature:
        typeof body.signature === 'string' && body.signature.length <= 8_192
          ? body.signature
          : undefined,
      totalBytes:
        typeof body.totalBytes === 'number' && Number.isSafeInteger(body.totalBytes)
          ? body.totalBytes
          : undefined,
      installerSha256:
        typeof body.installerSha256 === 'string'
          ? body.installerSha256.slice(0, 128)
          : undefined,
      installerTotalBytes:
        typeof body.installerTotalBytes === 'number' &&
        Number.isSafeInteger(body.installerTotalBytes)
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
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Parametres WX invalides.');
    }
    const uploadId = typeof body.uploadId === 'string' ? body.uploadId : '';
    if (!uploadId || uploadId.length > 128) {
      throw new BadRequestException('Upload WX invalide.');
    }
    try {
      return await this.uploads.chunk({
        uploadId,
        index: parseStrictInteger(body?.index, { min: 0 }) ?? -1,
        kind:
          typeof body.kind === 'string' && body.kind.length <= 32
            ? body.kind
            : undefined,
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
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Parametres WX invalides.');
    }
    const uploadId = typeof body.uploadId === 'string' ? body.uploadId : '';
    if (!uploadId || uploadId.length > 128) {
      throw new BadRequestException('Upload WX invalide.');
    }
    return this.uploads.complete(uploadId);
  }
}
