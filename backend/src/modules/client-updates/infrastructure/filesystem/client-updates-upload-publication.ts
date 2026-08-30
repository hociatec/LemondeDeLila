import { BadRequestException } from '@nestjs/common';
import { getErrorMessage } from '../../../../shared/utils/public-api';
import type { ClientUpdateMeta } from '../../application/contracts/client-update-meta.record';
import type { ClientUpdatesService } from '../../application/use-cases/client-updates/client-updates.service';

export async function publishUploadedClientUpdate(
  updates: ClientUpdatesService,
  zipPath: string,
  meta: ClientUpdateMeta,
): Promise<ClientUpdateMeta> {
  try {
    await updates.applyZip(zipPath);

    let publishedMeta = meta;
    try {
      const published = await updates.getPublishedClickOnceVersionFromDisk();
      if (published) publishedMeta = { ...meta, version: published };
    } catch {
      // Best-effort metadata enrichment; publication itself already succeeded.
    }

    await updates.saveLatest(publishedMeta);
    return publishedMeta;
  } catch (error) {
    throw new BadRequestException(
      `Publication echouee: ${getErrorMessage(error)}`,
    );
  }
}
