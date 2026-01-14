import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SoundsService } from './sounds.service';

@Controller('api/sounds')
export class SoundsController {
  constructor(private readonly sounds: SoundsService) {}

  @Get('manifest')
  async manifest(@Req() req: Request) {
    const xfProto = req.headers['x-forwarded-proto'];
    const xfHost = req.headers['x-forwarded-host'];

    const proto =
      typeof xfProto === 'string' && xfProto.trim()
        ? xfProto.split(',')[0].trim()
        : null;
    const host =
      typeof xfHost === 'string' && xfHost.trim()
        ? xfHost.split(',')[0].trim()
        : null;

    const origin =
      proto && host
        ? `${proto}://${host}`
        : host
          ? `https://${host}`
          : null;
    return this.sounds.getPublicManifest(origin);
  }

  @Get(':soundId/:sha.mp3')
  async getSound(
    @Param('soundId') soundId: string,
    @Param('sha') sha: string,
    @Res() res: Response,
  ) {
    const { entry, filePath } = await this.sounds.resolveSoundFile(
      soundId,
      sha,
    );
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', `"${entry.sha256}"`);
    return res.sendFile(filePath);
  }
}
