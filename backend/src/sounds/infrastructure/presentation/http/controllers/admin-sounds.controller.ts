import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  Put,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as os from 'os';
import * as path from 'path';
import { bestEffort } from '../../../../../common/utils/public-api';
import {
  AdminRoleGuard,
  HttpJwtGuard,
} from '../../../../../common/auth/public-api';
import { SoundsService } from '../../../storage/sounds.service';
import { MulterErrorFilter } from '../filters/multer-error.filter';

type TableAmbienceNameBody = {
  name?: unknown;
};

type TableAmbienceEnabledBody = {
  enabled?: unknown;
};

type UploadedFileLike = {
  path?: string;
  originalname?: string;
};

@Controller('api/admin/sounds')
@UseGuards(HttpJwtGuard, AdminRoleGuard)
export class AdminSoundsController {
  private readonly logger = new Logger(AdminSoundsController.name);

  constructor(private readonly sounds: SoundsService) {}

  @Post('cleanup')
  async cleanup() {
    return this.sounds.cleanupUnusedSounds();
  }

  @Post('reencode')
  async reencodeAll() {
    return this.sounds.reencodeAllSounds();
  }

  @Post('reencode-invalid')
  async reencodeInvalid() {
    return this.sounds.reencodeInvalidSounds();
  }

  @Get('diagnostic')
  async diagnostic() {
    return this.sounds.diagnoseSounds();
  }

  @Get('table-ambiences')
  async listTableAmbiences() {
    return this.sounds.listTableAmbiencesWithFilter({
      includeDisabled: true,
    });
  }

  @Post('table-ambiences')
  async createTableAmbience(@Body() body: TableAmbienceNameBody) {
    return this.sounds.createTableAmbience(
      typeof body?.name === 'string' ? body.name : '',
    );
  }

  @Put('table-ambiences/:soundId')
  async renameTableAmbience(
    @Param('soundId') soundId: string,
    @Body() body: TableAmbienceNameBody,
  ) {
    return this.sounds.renameTableAmbience(
      soundId,
      typeof body?.name === 'string' ? body.name : '',
    );
  }

  @Delete('table-ambiences/:soundId')
  async deleteTableAmbience(@Param('soundId') soundId: string) {
    return this.sounds.deleteTableAmbience(soundId);
  }

  @Put('table-ambiences/:soundId/enabled')
  async setTableAmbienceEnabled(
    @Param('soundId') soundId: string,
    @Body() body: TableAmbienceEnabledBody,
  ) {
    if (typeof body?.enabled !== 'boolean') {
      throw new BadRequestException('Champ "enabled" booléen requis.');
    }
    return this.sounds.setTableAmbienceEnabled(soundId, body.enabled === true);
  }

  @Post(':soundId')
  @UseFilters(MulterErrorFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, os.tmpdir()),
        filename: (_req, file, cb) =>
          cb(
            null,
            `lila-sound-${Date.now()}-${AdminSoundsController.sanitizeFilename(file.originalname)}`,
          ),
      }),
      // WAV files are much larger than MP3. Keep this generous; only admins can upload.
      limits: { fileSize: 250 * 1024 * 1024 },
    }),
  )
  async upload(
    @Param('soundId') soundId: string,
    @UploadedFile() file?: UploadedFileLike,
  ) {
    if (!file?.path) {
      throw new BadRequestException('Fichier manquant (champ "file").');
    }
    try {
      const entry = await this.sounds.setSound(
        soundId,
        file.path,
        file.originalname,
      );
      return { ok: true, sound: entry };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`Sound upload failed (${soundId}): ${message}`, stack);

      // Preserve explicit HTTP exceptions (400/404/500 with message) so the client can display them.
      if (
        err &&
        typeof err === 'object' &&
        'getStatus' in err &&
        typeof (err as { getStatus?: unknown }).getStatus === 'function'
      ) {
        throw err;
      }

      throw new InternalServerErrorException(
        `Upload son échoué: ${message}`.trim(),
      );
    } finally {
      try {
        // best-effort cleanup of temp file
        const fs = await import('fs');
        await bestEffort(
          fs.promises.rm(file.path, { force: true }),
          'suppression de l’upload audio temporaire',
        );
      } catch {
        // ignore
      }
    }
  }

  @Delete(':soundId')
  async clear(@Param('soundId') soundId: string) {
    return this.sounds.clearSound(soundId);
  }

  private static sanitizeFilename(originalName: string): string {
    const base = path.basename(String(originalName || 'sound'));
    const sanitizedControls = Array.from(base, (char) =>
      char.charCodeAt(0) < 32 ? '_' : char,
    ).join('');
    return sanitizedControls
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
  }
}
