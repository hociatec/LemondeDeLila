import * as fs from 'fs';
import { writeFileAtomic } from '../../../../shared/utils/public-api';
import * as path from 'path';
import { Injectable } from '@nestjs/common';

import {
  ClientUpdateMeta,
  CompletedUploadMarker,
} from '../../application/contracts/client-update-meta.record';
import { ClientUpdatesPathsService } from './client-updates-paths.service';
import { decodeCompletedUploadMarker } from './client-update-meta.decoder';

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
      return decodeCompletedUploadMarker(
        JSON.parse(raw.replace(/^\uFEFF/, '')),
        uploadId,
      );
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
    await writeFileAtomic(
      this.getCompletedMarkerPath(uploadId),
      JSON.stringify(marker, null, 2),
    );
  }
}
