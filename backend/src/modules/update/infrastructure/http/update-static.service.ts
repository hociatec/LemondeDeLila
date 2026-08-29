import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import * as express from 'express';
import * as fs from 'fs';

import { WxUpdateReleaseService } from '../persistence/wx-update-release.service';

@Injectable()
export class UpdateStaticService implements OnModuleInit {
  private readonly logger = new Logger(UpdateStaticService.name);

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly releases: WxUpdateReleaseService,
  ) {}

  onModuleInit(): void {
    const instance =
      this.adapterHost.httpAdapter?.getInstance<express.Application>();
    if (!instance || typeof instance.use !== 'function') {
      this.logger.warn('HTTP adapter does not support update middleware');
      return;
    }
    const directory = this.releases.getTargetDir();
    fs.mkdirSync(directory, { recursive: true });
    instance.use(
      '/updates/client-wx',
      express.static(directory, {
        immutable: true,
        maxAge: '365d',
        fallthrough: false,
        dotfiles: 'deny',
        setHeaders: (response) => {
          response.setHeader('X-Content-Type-Options', 'nosniff');
          response.setHeader('Content-Security-Policy', "default-src 'none'");
        },
      }),
    );
  }
}
