import * as fs from 'fs';
import * as path from 'path';
import { Injectable } from '@nestjs/common';

import {
  ClientUpdateMeta,
  CompletedUploadMarker,
} from '../../application/models/client-update-meta.record';
import { ClientUpdatesPathsService } from './client-updates-paths.service';

@Injectable()
export class ClientUpdatesUploadStoreService {
  constructor(private readonly paths: ClientUpdatesPathsService) {}

  getUploadsRoot(): string {
    return this.paths.getUploadsRoot();
  }

  getCompletedUploadsRoot(): string {
    return path.join(this.getUploadsRoot(), '.completed');
  }

  getCompletedMarkerPath(uploadId: string): string {
    return path.join(this.getCompletedUploadsRoot(), `${uploadId}.json`);
  }

  async readCompletedMarker(
    uploadId: string,
  ): Promise<CompletedUploadMarker | null> {
    try {
      const raw = await fs.promises.readFile(
        this.getCompletedMarkerPath(uploadId),
        'utf-8',
      );
      const parsed = JSON.parse(
        raw.replace(/^\uFEFF/, ''),
      ) as Partial<CompletedUploadMarker>;
      if (!parsed || typeof parsed !== 'object') return null;
      if ((parsed.uploadId || '').trim() !== uploadId) return null;
      const meta = parsed.meta;
      if (!meta || typeof meta !== 'object') return null;
      if (
        typeof meta.version !== 'string' ||
        typeof meta.publishedAt !== 'string'
      ) {
        return null;
      }
      return {
        uploadId,
        completedAt:
          typeof parsed.completedAt === 'string'
            ? parsed.completedAt
            : new Date().toISOString(),
        meta: meta,
      };
    } catch {
      return null;
    }
  }

  async writeCompletedMarker(
    uploadId: string,
    meta: ClientUpdateMeta,
  ): Promise<void> {
    await fs.promises.mkdir(this.getCompletedUploadsRoot(), {
      recursive: true,
    });
    const marker: CompletedUploadMarker = {
      uploadId,
      completedAt: new Date().toISOString(),
      meta,
    };
    await fs.promises.writeFile(
      this.getCompletedMarkerPath(uploadId),
      JSON.stringify(marker, null, 2),
    );
  }
}
