import { Controller, Get, Query } from '@nestjs/common';
import { ClientUpdatesService } from './client-updates.service';
import { isVersionGreater, isVersionLower } from '../common/utils/version.utils';

@Controller()
export class ClientUpdatesController {
  constructor(private readonly updates: ClientUpdatesService) {}

  // Public endpoint used by clients (informational).
  @Get('client/version')
  async getVersion(@Query('current') current?: string) {
    const latest = await this.updates.getLatest();
    const latestVersion = latest?.version ?? null;
    const minRequiredVersion = await this.updates.getMinRequiredVersion();
    const currentVersion = typeof current === 'string' ? current.trim() : null;

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
      url: latest?.publicUrl ?? this.updates.getPublicUrl(),
      minRequiredVersion,
      current: currentVersion,
      updateAvailable,
      updateRequired,
    };
  }
}
