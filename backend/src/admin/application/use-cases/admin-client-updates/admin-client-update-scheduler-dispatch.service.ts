import { Injectable } from '@nestjs/common';
import { parseVersion } from '../../../../common/utils/version.utils';
import { WS_EVENTS } from '../../../../common/ws/ws-events';
import type { AdminClientUpdatesPort } from '../../ports/admin-client-updates.port';
import type { AdminNotificationPort } from '../../ports/admin-notification.port';
import type { AdminClientUpdateScheduleCommand } from './admin-client-updates.types';

@Injectable()
export class AdminClientUpdateSchedulerDispatchService {
  async sendImminentNotification(input: {
    command: AdminClientUpdateScheduleCommand;
    recipientIds: number[];
    notifications: AdminNotificationPort;
    scheduledAtMs: number;
    imminentMessage: string;
  }): Promise<void> {
    const now = Date.now();
    const etaSeconds = Math.max(
      0,
      Math.round((input.scheduledAtMs - now) / 1000),
    );

    await Promise.all(
      input.recipientIds.map((userId) =>
        input.notifications.notifyUser(
          userId,
          WS_EVENTS.clientUpdate.imminent,
          {
            message: input.imminentMessage,
            etaSeconds,
            scheduledAt: new Date(input.scheduledAtMs).toISOString(),
            requiresAckDialog: true,
            fromUserId: input.command.actor.id,
            fromUsername: input.command.actor.username,
            timestamp: new Date().toISOString(),
          },
        ),
      ),
    );
  }

  async sendForcedUpdate(input: {
    command: AdminClientUpdateScheduleCommand;
    recipientIds: number[];
    notifications: AdminNotificationPort;
    clientUpdates: AdminClientUpdatesPort;
  }): Promise<boolean> {
    const latest = await input.clientUpdates.getLatest();
    const publishedClickOnce =
      await input.clientUpdates.getPublishedClickOnceVersionFromDisk();
    const latestVersion =
      (publishedClickOnce || latest?.version || '').trim() || null;
    if (!latestVersion || parseVersion(latestVersion) == null) {
      return false;
    }

    await input.clientUpdates.saveLatest({
      version: latestVersion,
      publishedAt: latest?.publishedAt ?? new Date().toISOString(),
      message: latest?.message ?? null,
      publicUrl: latest?.publicUrl ?? null,
      minRequiredVersion: latestVersion,
    });

    const url = input.clientUpdates.resolveClientPublicUrl(latest);

    await Promise.all(
      input.recipientIds.map((userId) =>
        input.notifications.notifyUser(userId, WS_EVENTS.clientUpdate.required, {
          message:
            latest?.message ??
            'Une mise a jour du client est requise pour continuer.',
          minRequiredVersion: latestVersion,
          currentVersion: null,
          publishedAt: latest?.publishedAt ?? null,
          url,
          fromUserId: input.command.actor.id,
          fromUsername: input.command.actor.username,
          timestamp: new Date().toISOString(),
        }),
      ),
    );

    return true;
  }
}
