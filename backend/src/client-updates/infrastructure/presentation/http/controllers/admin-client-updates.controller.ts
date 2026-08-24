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
import {
  AdminRoleGuard,
  HttpJwtGuard,
} from '../../../../../common/auth/public-api';
import {
  ClientUpdatesUploadChunkDto,
  ClientUpdatesUploadCompleteDto,
  ClientUpdatesUploadInitDto,
  ClientUpdatesUploadMetaDto,
} from '../dto/client-updates-upload.dto';
import { ClientUpdatesUploadService } from '../../../filesystem/client-updates-upload.service';

type UploadedFileLike = {
  path?: unknown;
};

function getUploadPath(file: UploadedFileLike | undefined): string {
  return typeof file?.path === 'string' ? file.path : '';
}

@Controller('api/admin/client-updates')
@UseGuards(HttpJwtGuard, AdminRoleGuard)
export class AdminClientUpdatesController {
  constructor(private readonly uploads: ClientUpdatesUploadService) {}

  @Get('status')
  async status() {
    return this.uploads.status();
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      dest: os.tmpdir(),
      limits: { fileSize: 600 * 1024 * 1024 }, // 600MB
    }),
  )
  async upload(
    @UploadedFile() file?: UploadedFileLike,
    @Body() body?: ClientUpdatesUploadMetaDto,
  ) {
    const zipPath = getUploadPath(file);
    if (!zipPath) {
      throw new BadRequestException('Fichier manquant (champ "file").');
    }

    try {
      return await this.uploads.uploadSingleZip({
        zipPath,
        version: body?.version,
        message: body?.message,
        minRequiredVersion: body?.minRequiredVersion,
      });
    } finally {
      fs.promises.rm(zipPath, { force: true }).catch(() => {
        /* ignore */
      });
    }
  }

  // Chunked upload to stay under nginx client_max_body_size (default 20m on this server).
  @Post('upload/init')
  async init(@Body() body: ClientUpdatesUploadInitDto) {
    return this.uploads.uploadInit(body);
  }

  @Post('upload/chunk')
  @UseInterceptors(
    FileInterceptor('file', {
      dest: os.tmpdir(),
      limits: { fileSize: 15 * 1024 * 1024 }, // keep < 20m
    }),
  )
  async chunk(
    @UploadedFile() file?: UploadedFileLike,
    @Body() body?: ClientUpdatesUploadChunkDto,
  ) {
    const filePath = getUploadPath(file);
    if (!filePath) {
      throw new BadRequestException('Chunk manquant (champ "file").');
    }
    return this.uploads.uploadChunk({
      uploadId: body?.uploadId ?? '',
      index: body?.index ?? -1,
      filePath,
    });
  }

  @Post('upload/complete')
  async complete(@Body() body: ClientUpdatesUploadCompleteDto) {
    return this.uploads.uploadComplete({ uploadId: body.uploadId });
  }
}
