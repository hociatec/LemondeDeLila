import { Controller, Get, Query, Req } from '@nestjs/common';
import { ClientUpdatesService } from '../../../../application/use-cases/client-updates/client-updates.service';
import {
  isVersionGreater,
  isVersionLower,
} from '../../../../../../shared/utils/public-api';
import type { Request } from 'express';

@Controller()
export class ClientUpdatesController {
  constructor(private readonly updates: ClientUpdatesService) {}

  private getOrigin(req: Request): string | null {
    const hostHeader =
      (req.headers['x-forwarded-host'] as string | undefined) ||
      req.get('host');
    const host = (hostHeader || '').split(',')[0]?.trim();
    if (!host) return null;
    const protoHeader =
      (req.headers['x-forwarded-proto'] as string | undefined) || req.protocol;
    const proto = (protoHeader || '').split(',')[0]?.trim() || 'https';
    return `${proto}://${host}`;
  }

  // Public endpoint used by clients (informational).
  @Get('client/version')
  async getVersion(@Query('current') current?: string, @Req() req?: Request) {
    const latest = await this.updates.getLatest();
    // Prefer ClickOnce manifest version (what clients will actually download).
    const clickOnce = await this.updates.getPublishedClickOnceVersionFromDisk();
    const latestVersion = clickOnce ?? latest?.version ?? null;
    const minRequiredVersion = await this.updates.getMinRequiredVersion();
    const currentVersion = typeof current === 'string' ? current.trim() : null;
    const origin = req ? this.getOrigin(req) : null;
    const url = this.updates.resolveClientPublicUrlForOrigin(latest, origin);

    const updateAvailable =
      latestVersion && currentVersion
        ? isVersionGreater(latestVersion, currentVersion)
        : null;

    const updateRequired =
      minRequiredVersion && currentVersion
        ? isVersionLower(currentVersion, minRequiredVersion)
        : null;

    return {
      version: latestVersion,
      publishedAt: latest?.publishedAt ?? null,
      message: latest?.message ?? null,
      url,
      minRequiredVersion,
      current: currentVersion,
      updateAvailable,
      updateRequired,
    };
  }
}
