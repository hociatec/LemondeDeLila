import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

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
}
