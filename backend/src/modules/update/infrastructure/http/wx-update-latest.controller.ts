import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Response } from 'express';

import { WxUpdateReleaseService } from '../persistence/wx-update-release.service';
import { getUpdateRequestOrigin } from './update-request-origin';

@Controller('api/client/releases')
export class WxUpdateLatestController {
  constructor(private readonly updates: WxUpdateReleaseService) {}

  @Get('latest')
  latest(
    @Query('current') current?: string,
    @Query('platform') platform?: string,
    @Query('arch') architecture?: string,
    @Req() request?: Request,
  ) {
    if (platform && platform.toLowerCase() !== 'windows') {
      throw new BadRequestException('Plateforme de mise à jour non supportée.');
    }
    if (architecture && architecture.toLowerCase() !== 'x64') {
      throw new BadRequestException(
        'Architecture de mise à jour non supportée.',
      );
    }
    return this.updates.getForClient(
      typeof current === 'string' ? current : null,
      request ? getUpdateRequestOrigin(request) : null,
    );
  }

  @Get('installer')
  async installer(@Req() request: Request, @Res() response: Response) {
    const latest = await this.updates.getForClient(
      null,
      getUpdateRequestOrigin(request),
    );
    const url = latest?.installer?.url;
    if (!url) {
      throw new NotFoundException('Installateur WX indisponible.');
    }
    response.redirect(302, url);
  }
}
