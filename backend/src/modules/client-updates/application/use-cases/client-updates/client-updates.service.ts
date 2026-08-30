import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';

import { ClientUpdateMeta } from '../../contracts/client-update-meta.record';
import {
  CLIENT_UPDATES_META_STORE_PORT,
  type ClientUpdatesMetaStorePort,
} from '../../ports/client-updates-meta-store.port';
import {
  CLIENT_UPDATES_PATHS_PORT,
  type ClientUpdatesPathsPort,
} from '../../ports/client-updates-paths.port';
import {
  CLIENT_UPDATES_PUBLISHER_PORT,
  type ClientUpdatesPublisherPort,
} from '../../ports/client-updates-publisher.port';

@Injectable()
export class ClientUpdatesService {
  constructor(
    @Inject(CLIENT_UPDATES_PATHS_PORT)
    private readonly paths: ClientUpdatesPathsPort,
    @Inject(CLIENT_UPDATES_META_STORE_PORT)
    private readonly metaStore: ClientUpdatesMetaStorePort,
    @Inject(CLIENT_UPDATES_PUBLISHER_PORT)
    private readonly publisher: ClientUpdatesPublisherPort,
  ) {}

  getTargetDir(): string {
    return this.paths.getTargetDir();
  }

  getPublicUrl(): string | null {
    return this.paths.getPublicUrl();
  }

  resolveClientPublicUrl(latest: ClientUpdateMeta | null): string | null {
    return this.publisher.resolveClientPublicUrl(latest);
  }

  resolveClientPublicUrlForOrigin(
    latest: ClientUpdateMeta | null,
    origin: string | null,
  ): string | null {
    return this.publisher.resolveClientPublicUrlForOrigin(latest, origin);
  }

  async getPublishedClickOnceVersionFromDisk(): Promise<string | null> {
    return this.publisher.getPublishedClickOnceVersionFromDisk();
  }

  async writeLandingPage(targetDir: string): Promise<void> {
    await this.publisher.writeLandingPage(targetDir);
  }

  async getLatest(): Promise<ClientUpdateMeta | null> {
    return this.metaStore.getLatest();
  }

  async saveLatest(meta: ClientUpdateMeta): Promise<void> {
    await this.metaStore.saveLatest(meta);
  }

  async getMinRequiredVersion(): Promise<string | null> {
    return this.publisher.getMinRequiredVersion();
  }

  async applyZip(zipPath: string): Promise<void> {
    await this.publisher.applyZip(zipPath);
  }
}
