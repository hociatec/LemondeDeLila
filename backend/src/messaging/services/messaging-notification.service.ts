import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from '../../notification/services/notification.service';
import { UserBadgeCountsService } from '../../notification/services/user-badge-counts.service';
import { MessageDto } from './messaging.service';

@Injectable()
export class MessagingNotificationService {
  private readonly logger = new Logger(MessagingNotificationService.name);

  constructor(
    private readonly notifications: NotificationService,
    private readonly counts: UserBadgeCountsService,
  ) {}

  async notifyMessageSent(recipientId: number, message: MessageDto) {
    const preview = this.buildPreview(message.text);
    try {
      await this.notifications.notifyUser(recipientId, 'messaging.new', {
        messageId: message.id,
        from: message.sender,
        subject: message.subject,
        preview,
        createdAt: message.createdAt,
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
