import {
  BadRequestException,
  Controller,
  Body,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as os from 'os';
import { HttpJwtGuard } from '../common/guards/http-jwt.guard';
import { AdminRoleGuard } from '../common/guards/admin-role.guard';
import { SoundsService } from './sounds.service';

@Controller('api/admin/sounds')
@UseGuards(HttpJwtGuard, AdminRoleGuard)
export class AdminSoundsController {
  constructor(private readonly sounds: SoundsService) {}

  @Post('cleanup')
  async cleanup() {
    return this.sounds.cleanupUnusedSounds();
  }

  @Get('table-ambiences')
  async listTableAmbiences() {
    return this.sounds.listTableAmbiences();
  }

  @Post('table-ambiences')
  async createTableAmbience(@Body() body: any) {
    return this.sounds.createTableAmbience(body?.name);
  }

  @Put('table-ambiences/:soundId')
  async renameTableAmbience(@Param('soundId') soundId: string, @Body() body: any) {
    return this.sounds.renameTableAmbience(soundId, body?.name);
  }

  @Delete('table-ambiences/:soundId')
  async deleteTableAmbience(@Param('soundId') soundId: string) {
    return this.sounds.deleteTableAmbience(soundId);
  }

  @Post(':soundId')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, os.tmpdir()),
        filename: (_req, file, cb) =>
          cb(null, `lila-sound-${Date.now()}-${file.originalname}`),
      }),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async upload(@Param('soundId') soundId: string, @UploadedFile() file?: any) {
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
    } finally {
      try {
        // best-effort cleanup of temp file
        const fs = await import('fs');
        fs.promises.rm(file.path, { force: true }).catch(() => undefined);
      } catch {
        // ignore
      }
    }
  }

  @Delete(':soundId')
  async clear(@Param('soundId') soundId: string) {
    return this.sounds.clearSound(soundId);
  }
}
