import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_CLIENT_UPDATES_PORT,
  type AdminClientUpdatesPort,
} from '../../ports/admin-client-updates.port';
import {
  ADMIN_NOTIFICATION_PORT,
  type AdminNotificationPort,
} from '../../ports/admin-notification.port';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../../ports/admin-user.repository';

@Injectable()
export class AdminClientUpdatesSharedService {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly users: AdminUserRepository,
    @Inject(ADMIN_NOTIFICATION_PORT)
    private readonly notifications: AdminNotificationPort,
    @Inject(ADMIN_CLIENT_UPDATES_PORT)
    private readonly clientUpdates: AdminClientUpdatesPort,
  ) {}

  async listRecipientIds(): Promise<number[]> {
    return this.users.listIds();
  }

  getClientUpdatesService(): AdminClientUpdatesPort {
    return this.clientUpdates;
  }

  getNotificationService(): AdminNotificationPort {
    return this.notifications;
  }

  async requirePublishedLatestVersion(): Promise<{
    latestVersion: string;
    latest: Awaited<ReturnType<AdminClientUpdatesPort['getLatest']>>;
  }> {
    const latest = await this.clientUpdates.getLatest();
    const publishedClickOnce =
      await this.clientUpdates.getPublishedClickOnceVersionFromDisk();
    const latestVersion =
      (publishedClickOnce || latest?.version || '').trim() || null;
    if (!latestVersion) {
      throw new BadRequestException(
        'Impossible de forcer la mise a jour : aucune version publiee (latest.json manquant).',
      );
    }
    return { latestVersion, latest };
  }
}
