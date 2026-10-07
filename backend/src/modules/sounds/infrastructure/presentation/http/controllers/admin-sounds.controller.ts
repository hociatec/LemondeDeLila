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
import { SoundUploadInterceptor } from '../interceptors/sound-upload.interceptor';
import { promises as fs } from 'node:fs';
import { bestEffort } from '../../../../../../platform/observability/public-api';
import {
  AdminRoleGuard,
  HttpJwtGuard,
} from '../../../../../../platform/auth/public-api';
import { SoundsService } from '../../../storage/sounds.service';
import { MulterErrorFilter } from '../filters/multer-error.filter';
import { hasOnlyAllowedKeys } from '../../../../../../platform/validation/public-api';

type TableAmbienceNameBody = {
  name?: unknown;
};

type TableAmbienceEnabledBody = {
  enabled?: unknown;
};

type UploadedFileLike = {
  path?: string;
  originalname?: string;
  mimetype?: string;
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

  @Get('catalog')
  async catalog() {
    return this.sounds.getAdminCatalog();
  }

  @Put(':soundId/enabled')
  async setSoundEnabled(
    @Param('soundId') soundId: string,
    @Body() body: TableAmbienceEnabledBody,
  ) {
    this.requireExactBody(body, ['enabled']);
    if (typeof body?.enabled !== 'boolean') {
      throw new BadRequestException('Champ "enabled" booléen requis.');
    }
    return this.sounds.setSoundEnabled(soundId, body.enabled);
  }

  @Get('table-ambiences')
  async listTableAmbiences() {
    return this.sounds.listTableAmbiencesWithFilter({
      includeDisabled: true,
    });
  }

  @Post('table-ambiences')
  async createTableAmbience(@Body() body: TableAmbienceNameBody) {
    this.requireExactBody(body, ['name']);
    return this.sounds.createTableAmbience(
      typeof body?.name === 'string' ? body.name : '',
    );
  }

  @Put('table-ambiences/:soundId')
  async renameTableAmbience(
    @Param('soundId') soundId: string,
    @Body() body: TableAmbienceNameBody,
  ) {
    this.requireExactBody(body, ['name']);
    return this.sounds.renameTableAmbience(
      soundId,
      typeof body?.name === 'string' ? body.name : '',
    );
  }

  @Post('table-ambiences/with-sound')
  @UseFilters(MulterErrorFilter)
  @UseInterceptors(SoundUploadInterceptor)
  async createTableAmbienceWithSound(
    @Body() body: TableAmbienceNameBody,
    @UploadedFile() file?: UploadedFileLike,
  ) {
    if (!file?.path)
      throw new BadRequestException('Fichier manquant (champ "file").');
    try {
      this.requireExactBody(body, ['name']);
      return await this.sounds.createTableAmbienceWithSound(
        typeof body?.name === 'string' ? body.name : '',
        file.path,
        file.originalname,
        file.mimetype,
      );
    } finally {
      await bestEffort(
        fs.rm(file.path, { force: true }),
        'suppression de l’upload audio temporaire',
      );
    }
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
    this.requireExactBody(body, ['enabled']);
    if (typeof body?.enabled !== 'boolean') {
      throw new BadRequestException('Champ "enabled" booléen requis.');
    }
    return this.sounds.setTableAmbienceEnabled(soundId, body.enabled === true);
  }

  @Post(':soundId')
  @UseFilters(MulterErrorFilter)
  @UseInterceptors(SoundUploadInterceptor)
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
        file.mimetype,
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

      throw new InternalServerErrorException('Upload son échoué.');
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

  private requireExactBody(value: unknown, keys: readonly string[]): void {
    if (!hasOnlyAllowedKeys(value, keys)) {
      throw new BadRequestException('Champs de requête inconnus.');
    }
  }
}
