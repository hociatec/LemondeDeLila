import { Injectable, Logger } from '@nestjs/common';
import { WS_EVENTS } from '../../../../realtime/public-api';
import { UserBadgeCountsService } from '../../../application/services/user-badge-counts.service';
import { NotificationDispatchService } from '../../system/notification-dispatch.service';

@Injectable()
export class NotificationWsBadgeCountsService {
  private readonly logger = new Logger(NotificationWsBadgeCountsService.name);

  constructor(
    private readonly counts: UserBadgeCountsService,
    private readonly notifications: NotificationDispatchService,
  ) {}

  async notifyCounts(userId: number): Promise<void> {
    const counts = await this.counts.getCounts(userId);
    await this.notifications.notifyUser(
      userId,
      WS_EVENTS.notify.counts,
      counts,
    );
  }

  async notifyCountsBestEffort(userId: number): Promise<void> {
    try {
      await this.notifyCounts(userId);
    } catch (err) {
      this.logger.warn(
        `notifyCounts failed for user ${userId}: ${(err as Error).message}`,
      );
    }
  }
}
