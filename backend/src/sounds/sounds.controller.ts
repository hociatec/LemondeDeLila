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
      proto && host ? `${proto}://${host}` : host ? `https://${host}` : null;
    return this.sounds.getPublicManifest(origin);
  }

  @Get('table-ambiences')
  async tableAmbiences() {
    return this.sounds.listTableAmbiences();
  }

  @Get(':soundId/:sha.mp3')
  async getSound(
    @Param('soundId') soundId: string,
    @Param('sha') sha: string,
    @Res() res: Response,
  ) {
    // Backward-compatible route: older clients requested .mp3. We now serve .wav by default.
    // If the server only has .wav, redirect so clients that can follow redirects still work.
    const { entry, filePath, ext } = await this.sounds.resolveSoundFile(
      soundId,
      sha,
    );

    if (ext === '.wav') {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('ETag', `"${entry.sha256}"`);
      return res.redirect(
        301,
        `/api/sounds/${encodeURIComponent(entry.soundId)}/${entry.sha256}.wav`,
      );
    }

    // Helmet sets `Cross-Origin-Resource-Policy: same-origin` by default, which prevents
    // <audio> previews from working when the admin/front-end is hosted on a different origin.
    // Sounds are not sensitive; allow cross-origin loading for media playback.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', `"${entry.sha256}"`);
    return res.sendFile(filePath);
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
    return res.sendFile(filePath);
  }
}
