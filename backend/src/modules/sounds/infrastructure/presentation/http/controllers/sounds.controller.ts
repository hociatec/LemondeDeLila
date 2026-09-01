import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SoundsService } from '../../../storage/sounds.service';

const SOUND_FILE_SEND_OPTIONS = {
  // Production storage lives under ~/.local/share/..., and Express sendFile()
  // ignores dot-directories by default unless explicitly allowed.
  dotfiles: 'allow',
} as const;

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
      proto && host ? `${proto}://${host}` : host ? `https://${host}` : null;
    return this.sounds.getPublicManifest(origin);
  }

  @Get('table-ambiences')
  async tableAmbiences() {
    return this.sounds.listTableAmbiencesWithFilter({
      includeDisabled: false,
    });
  }

  @Get(':soundId/:sha.wav')
  async getSoundWav(
    @Param('soundId') soundId: string,
    @Param('sha') sha: string,
    @Res() res: Response,
  ) {
    const { entry, filePath } = await this.sounds.resolveSoundFile(
      soundId,
      sha,
    );
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', `"${entry.sha256}"`);
    return res.sendFile(filePath, SOUND_FILE_SEND_OPTIONS);
  }
}
