import * as fs from 'fs';
import * as path from 'path';
import { writeFileAtomic } from '../../../../shared/utils/public-api';
import { Injectable } from '@nestjs/common';

import { ClientUpdateMeta } from '../../application/contracts/client-update-meta.record';
import { ClientUpdatesPathsService } from './client-updates-paths.service';
import { decodeClientUpdateMeta } from './client-update-meta.decoder';
import { getErrorCode } from '@shared/utils/public-api';

@Injectable()
export class ClientUpdatesMetaStoreService {
  private latestMeta: ClientUpdateMeta | null | undefined = undefined;
  private latestMetaMtimeMs: number | null = null;

  constructor(private readonly paths: ClientUpdatesPathsService) {}

  async getLatest(): Promise<ClientUpdateMeta | null> {
    try {
      const stats = await fs.promises.stat(this.paths.getMetaPath());
      const mtimeMs = stats.mtimeMs;
      if (
        this.latestMeta &&
        this.latestMetaMtimeMs != null &&
        this.latestMetaMtimeMs === mtimeMs
      ) {
        return this.latestMeta;
      }

      const raw = await fs.promises.readFile(this.paths.getMetaPath(), 'utf-8');
      const parsed = decodeClientUpdateMeta(
        JSON.parse(raw.replace(/^\uFEFF/, '')),
      );
      if (!parsed) {
        throw new Error('Métadonnées de mise à jour client invalides.');
      }
      this.latestMeta = parsed;
      this.latestMetaMtimeMs = mtimeMs;
      return parsed;
    } catch (error) {
      const errno = getErrorCode(error) ?? '';
      if (errno === 'ENOENT') {
        this.latestMeta = null;
        this.latestMetaMtimeMs = null;
        return null;
      }
      if (this.latestMeta !== undefined) {
        return this.latestMeta;
      }
      this.latestMeta = null;
      this.latestMetaMtimeMs = null;
      return null;
    }
  }

  async saveLatest(meta: ClientUpdateMeta): Promise<void> {
    const metaPath = this.paths.getMetaPath();
    await fs.promises.mkdir(path.dirname(metaPath), { recursive: true });
    await writeFileAtomic(metaPath, JSON.stringify(meta, null, 2));
    this.latestMeta = meta;
    try {
      const stats = await fs.promises.stat(metaPath);
      this.latestMetaMtimeMs = stats.mtimeMs;
    } catch {
      this.latestMetaMtimeMs = Date.now();
    }
  }
}
