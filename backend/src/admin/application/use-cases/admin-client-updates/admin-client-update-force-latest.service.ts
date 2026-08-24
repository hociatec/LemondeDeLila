import { Injectable } from '@nestjs/common';
import { AdminClientUpdatesSharedService } from './admin-client-updates-shared.service';
import type { AdminClientUpdateForceLatestCommand } from './admin-client-updates.types';

@Injectable()
export class AdminClientUpdateForceLatestService {
  constructor(
    private readonly shared: AdminClientUpdatesSharedService,
  ) {}

  async execute(
    command: AdminClientUpdateForceLatestCommand,
  ): Promise<{ delivered: number; minRequiredVersion: string }> {
    const { latestVersion, latest } =
      await this.shared.requirePublishedLatestVersion();
    const clientUpdates = this.shared.getClientUpdatesService();
    const notifications = this.shared.getNotificationService();

    const message =
      typeof command.message === 'string' && command.message.trim().length > 0
        ? command.message.trim()
        : 'Une mise a jour du client est requise pour continuer.';

    await clientUpdates.saveLatest({
      version: latestVersion,
      publishedAt: latest?.publishedAt ?? new Date().toISOString(),
      message: latest?.message ?? null,
      publicUrl: latest?.publicUrl ?? null,
      minRequiredVersion: latestVersion,
    });

    const recipientIds = await this.shared.listRecipientIds();
    const url = clientUpdates.resolveClientPublicUrl(latest);
    const payload = {
      minRequiredVersion: latestVersion,
      currentVersion: null,
      message,
      publishedAt: latest?.publishedAt ?? null,
      url,
      fromUserId: command.actor.id,
      fromUsername: command.actor.username,
      timestamp: new Date().toISOString(),
    };

    await Promise.all(
      recipientIds.map((userId) =>
        notifications.notifyClientUpdateRequired(userId, payload),
      ),
    );

    return {
      delivered: recipientIds.length,
      minRequiredVersion: latestVersion,
    };
  }
}
