import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SoundsService } from './sounds.service';

@Controller('api/sounds')
export class SoundsController {
  constructor(private readonly sounds: SoundsService) {}

  @Get('manifest')
  async manifest(@Req() req: Request) {
    const origin =
      (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host']
        ? `${String(req.headers['x-forwarded-proto'])}://${String(req.headers['x-forwarded-host'])}`
        : null) || null;
    return this.sounds.getPublicManifest(origin);
  }

  @Get(':soundId/:sha.mp3')
  async getSound(
    @Param('soundId') soundId: string,
    @Param('sha') sha: string,
    @Res() res: Response,
  ) {
    const { entry, filePath } = await this.sounds.resolveSoundFile(soundId, sha);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', `"${entry.sha256}"`);
    return res.sendFile(filePath);
  }
}
