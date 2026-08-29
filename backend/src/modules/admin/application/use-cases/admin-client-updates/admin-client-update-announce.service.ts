import { Injectable } from '@nestjs/common';
import { AdminClientUpdatesSharedService } from './admin-client-updates-shared.service';
import type { AdminClientUpdateAnnounceCommand } from './admin-client-updates.types';

@Injectable()
export class AdminClientUpdateAnnounceService {
  constructor(private readonly shared: AdminClientUpdatesSharedService) {}

  async execute(
    command: AdminClientUpdateAnnounceCommand,
  ): Promise<{ delivered: number }> {
    const latest = await this.shared.getClientUpdatesService().getLatest();
    const recipientIds = await this.shared.listRecipientIds();
    const notifications = this.shared.getNotificationService();

    const message =
      typeof command.message === 'string' && command.message.trim().length > 0
        ? command.message.trim()
        : 'Une mise a jour du client est disponible.';

    const payload = {
      message,
      version: latest?.version?.trim() || command.version?.trim() || null,
      fromUserId: command.actor.id,
      fromUsername: command.actor.username,
      timestamp: new Date().toISOString(),
    };

    await Promise.all(
      recipientIds.map((userId) =>
        notifications.notifyClientUpdateAvailable(userId, payload),
      ),
    );

    return { delivered: recipientIds.length };
  }
}
