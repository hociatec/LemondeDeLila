import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  NOTIFICATION_INBOX_REPOSITORY,
  type NotificationInboxRepository,
} from '../ports/notification-inbox.repository';
import {
  NOTIFICATION_UNREAD_MESSAGE_COUNTER,
  type NotificationUnreadMessageCounter,
} from '../ports/notification-unread-message-counter.port';

@Injectable()
export class UserBadgeCountsService {
  private readonly logger = new Logger(UserBadgeCountsService.name);

  constructor(
    @Inject(NOTIFICATION_INBOX_REPOSITORY)
    private readonly inbox: NotificationInboxRepository,
    @Inject(NOTIFICATION_UNREAD_MESSAGE_COUNTER)
    private readonly messages: NotificationUnreadMessageCounter,
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
