import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';

import { WxUpdateReleaseService } from '../persistence/wx-update-release.service';
import { getUpdateRequestOrigin } from './update-request-origin';

@Controller('api/client-wx')
export class WxUpdateManifestController {
  constructor(private readonly updates: WxUpdateReleaseService) {}

  @Get('manifest')
  getManifest(@Query('current') current?: string, @Req() req?: Request) {
    const origin = req ? getUpdateRequestOrigin(req) : null;
    return this.updates.getForClient(
      typeof current === 'string' ? current : null,
      origin,
    );
  }
}
