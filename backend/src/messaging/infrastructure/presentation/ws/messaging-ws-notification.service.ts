import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  NOTIFICATION_DISPATCHER,
  USER_BADGE_COUNTS_NOTIFIER,
  type NotificationDispatcher,
  type UserBadgeCountsNotifier,
} from '../../../../notification/public-api';
import type { PrivateMessageRecord } from '../../../application/models/private-message.model';
import { WS_EVENTS } from '../../../../realtime/public-api';
import { MessagePresenterService } from '../../../application/services/message-presenter.service';

@Injectable()
export class MessagingWsNotificationService {
  private readonly logger = new Logger(MessagingWsNotificationService.name);

  constructor(
    @Inject(NOTIFICATION_DISPATCHER)
    private readonly notifications: NotificationDispatcher,
    @Inject(USER_BADGE_COUNTS_NOTIFIER)
    private readonly counts: UserBadgeCountsNotifier,
    private readonly presenter: MessagePresenterService,
  ) {}

  async notifyMessageSent(recipientId: number, message: PrivateMessageRecord) {
    const presented = this.presenter.present(message, recipientId);
    const preview = this.buildPreview(presented.text);
    try {
      await this.notifications.notifyUser(recipientId, WS_EVENTS.messaging.messageSent, {
        messageId: presented.id,
        from: presented.sender,
        subject: presented.subject,
        preview,
        createdAt: presented.createdAt,
      });
    } catch (err) {
      this.logger.warn(
        `Echec notification message pour utilisateur ${recipientId}: ${(err as Error).message}`,
      );
    }
    await this.counts.notifyCounts(recipientId);
  }

  async notifyCountsBestEffort(userId: number) {
    try {
      await this.counts.notifyCounts(userId);
    } catch (err) {
      this.logger.warn(
        `Echec de la mise a jour des compteurs utilisateur ${userId}: ${(err as Error).message}`,
      );
    }
  }

  private buildPreview(text: string): string {
    const trimmed = (text || '').trim();
    return trimmed.length > 0 ? trimmed.slice(0, 200) : '';
  }
}

