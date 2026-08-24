import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  PRIVATE_MESSAGE_REPOSITORY,
  type PrivateMessageRepository,
} from '../../../messaging/application/ports/private-message.repository';
import {
  NOTIFICATION_INBOX_REPOSITORY,
  type NotificationInboxRepository,
} from '../ports/notification-inbox.repository';

@Injectable()
export class UserBadgeCountsService {
  private readonly logger = new Logger(UserBadgeCountsService.name);

  constructor(
    @Inject(NOTIFICATION_INBOX_REPOSITORY)
    private readonly inbox: NotificationInboxRepository,
    @Inject(PRIVATE_MESSAGE_REPOSITORY)
    private readonly messages: PrivateMessageRepository,
  ) {}

  async getCounts(userId: number): Promise<{
    unreadNotifications: number;
    unreadMessages: number;
  }> {
    try {
      const [unreadNotifications, unreadMessages] = await Promise.all([
        this.inbox.countUnread(userId),
        this.messages.countUnreadForRecipient(userId),
      ]);
      return { unreadNotifications, unreadMessages };
    } catch (err) {
      this.logger.warn(
        `getCounts failed for user ${userId}: ${(err as Error).message}`,
      );
      throw err;
    }
  }
}
