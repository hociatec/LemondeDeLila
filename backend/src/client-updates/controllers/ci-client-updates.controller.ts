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
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as os from 'os';
import { ClientUpdatesUploadTokenGuard } from '../guards/client-updates-upload-token.guard';
import {
  ClientUpdatesUploadChunkDto,
  ClientUpdatesUploadCompleteDto,
  ClientUpdatesUploadInitDto,
  ClientUpdatesUploadMetaDto,
} from '../dto/client-updates-upload.dto';
import { ClientUpdatesUploadService } from '../services/client-updates-upload.service';

/**
 * CI-only endpoints secured by a shared token (no JWT).
 * Intended for GitHub Actions publishing.
 */
@Controller('api/ci/client-updates')
@UseGuards(ClientUpdatesUploadTokenGuard)
export class CiClientUpdatesController {
  constructor(private readonly uploads: ClientUpdatesUploadService) {}

  @Get('status')
  async status() {
    return this.uploads.status();
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, os.tmpdir()),
        filename: (_req, file, cb) =>
          cb(null, `lila-client-update-${Date.now()}-${file.originalname}`),
      }),
      limits: { fileSize: 600 * 1024 * 1024 }, // 600MB
    }),
  )
  async upload(
    @UploadedFile() file?: any,
    @Body() body?: ClientUpdatesUploadMetaDto,
  ) {
    if (!file?.path) {
      throw new BadRequestException('Fichier manquant (champ "file").');
    }

    const zipPath = file.path;
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

  @Post('upload/init')
  async init(@Body() body: ClientUpdatesUploadInitDto) {
    return this.uploads.uploadInit(body);
  }

  @Post('upload/chunk')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, os.tmpdir()),
        filename: (_req, file, cb) =>
          cb(
            null,
            `lila-client-update-chunk-${Date.now()}-${file.originalname}`,
          ),
      }),
      limits: { fileSize: 15 * 1024 * 1024 }, // keep < 20m
    }),
  )
  async chunk(
    @UploadedFile() file?: any,
    @Body() body?: ClientUpdatesUploadChunkDto,
  ) {
    if (!file?.path) {
      throw new BadRequestException('Chunk manquant (champ "file").');
    }

    return this.uploads.uploadChunk({
      uploadId: body?.uploadId ?? '',
      index: body?.index ?? -1,
      filePath: file.path,
    });
  }

  @Post('upload/complete')
  async complete(@Body() body: ClientUpdatesUploadCompleteDto) {
    return this.uploads.uploadComplete({ uploadId: body.uploadId });
  }
}
