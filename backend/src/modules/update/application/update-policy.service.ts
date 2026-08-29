import { Inject, Injectable } from '@nestjs/common';

import { ClientUpdatesService } from '../../client-updates/public-api';
import {
  isVersionGreater,
  isVersionLower,
} from '../../../shared/utils/public-api';
import {
  WX_UPDATE_RELEASE_READER,
  type WxUpdateReleaseReader,
} from './wx-update-release.reader';

export type UpdateNotice = {
  currentVersion: string | null;
  latestVersion: string | null;
  minimumVersion: string | null;
  updateAvailable: boolean | null;
  updateRequired: boolean;
  mandatory: boolean;
  message: string | null;
  publishedAt: string | null;
  url: string | null;
};

@Injectable()
export class UpdatePolicyService {
  constructor(
    private readonly legacyUpdates: ClientUpdatesService,
    @Inject(WX_UPDATE_RELEASE_READER)
    private readonly wxUpdates: WxUpdateReleaseReader,
  ) {}

  getMinimumVersion(product: string | null): Promise<string | null> {
    return product === 'client-wx'
      ? this.wxUpdates.getMinimumVersion()
      : this.legacyUpdates.getMinRequiredVersion();
  }

  async getNotice(
    product: string | null,
    currentVersion: string | null,
    origin: string | null,
  ): Promise<UpdateNotice> {
    if (product === 'client-wx') {
      const manifest = await this.wxUpdates.getForClient(
        currentVersion,
        origin,
      );
      return {
        currentVersion,
        latestVersion: manifest?.version ?? null,
        minimumVersion: manifest?.minimumVersion ?? null,
        updateAvailable: manifest?.updateAvailable ?? null,
        updateRequired: manifest?.updateRequired ?? false,
        mandatory: manifest?.mandatory ?? false,
        message: manifest?.message ?? null,
        publishedAt: manifest?.publishedAt ?? null,
        url: manifest?.artifact.url ?? null,
      };
    }

    const latest = await this.legacyUpdates.getLatest();
    const minimumVersion = await this.legacyUpdates.getMinRequiredVersion();
    const current = (currentVersion || '').trim() || null;
    const latestVersion = latest?.version?.trim() || null;
    const updateAvailable =
      current && latestVersion
        ? isVersionGreater(latestVersion, current)
        : null;
    const updateRequired =
      minimumVersion != null &&
      (!current || isVersionLower(current, minimumVersion) !== false);
    return {
      currentVersion: current,
      latestVersion,
      minimumVersion,
      updateAvailable,
      updateRequired,
      mandatory: updateRequired,
      message: latest?.message ?? null,
      publishedAt: latest?.publishedAt ?? null,
      url: this.legacyUpdates.resolveClientPublicUrlForOrigin(latest, origin),
    };
  }
}
