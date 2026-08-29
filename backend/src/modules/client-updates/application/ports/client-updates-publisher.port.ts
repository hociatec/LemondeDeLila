import type { ClientUpdateMeta } from '../models/client-update-meta.record';

export type ClientUpdatesPublisherPort = {
  resolveClientPublicUrl(latest: ClientUpdateMeta | null): string | null;
  resolveClientPublicUrlForOrigin(
    latest: ClientUpdateMeta | null,
    origin: string | null,
  ): string | null;
  getPublishedClickOnceVersionFromDisk(): Promise<string | null>;
  writeLandingPage(targetDir: string): Promise<void>;
  getMinRequiredVersion(): Promise<string | null>;
  applyZip(zipPath: string): Promise<void>;
};

export const CLIENT_UPDATES_PUBLISHER_PORT = Symbol(
  'CLIENT_UPDATES_PUBLISHER_PORT',
);
