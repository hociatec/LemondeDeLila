import type { WxUpdateManifestResponse } from '../domain/wx-update-manifest';

export const WX_UPDATE_RELEASE_READER = Symbol('WX_UPDATE_RELEASE_READER');

export interface WxUpdateReleaseReader {
  getMinimumVersion(): Promise<string | null>;
  getForClient(
    currentVersion: string | null,
    origin: string | null,
  ): Promise<WxUpdateManifestResponse | null>;
}
