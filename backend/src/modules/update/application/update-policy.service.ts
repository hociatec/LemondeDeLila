import { BadRequestException, Inject, Injectable } from '@nestjs/common';

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
    @Inject(WX_UPDATE_RELEASE_READER)
    private readonly wxUpdates: WxUpdateReleaseReader,
  ) {}

  getMinimumVersion(product: string | null): Promise<string | null> {
    this.requireSupportedProduct(product);
    return this.wxUpdates.getMinimumVersion();
  }

  async getNotice(
    product: string | null,
    currentVersion: string | null,
    origin: string | null,
  ): Promise<UpdateNotice> {
    this.requireSupportedProduct(product);
    const manifest = await this.wxUpdates.getForClient(currentVersion, origin);
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

  private requireSupportedProduct(product: string | null): void {
    if (product !== 'client-wx') {
      throw new BadRequestException('Produit client non supporté.');
    }
  }
}
