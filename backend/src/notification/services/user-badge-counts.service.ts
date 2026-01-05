import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrivateMessage } from '../../messaging/entities/private-message.entity';
import { NotificationService } from './notification.service';
import { NotificationInboxDbService } from './notification-inbox-db.service';

@Injectable()
export class UserBadgeCountsService {
  constructor(
    private readonly inbox: NotificationInboxDbService,
    @InjectRepository(PrivateMessage)
    private readonly messages: Repository<PrivateMessage>,
    private readonly notifications: NotificationService,
  ) {}

  async getCounts(userId: number): Promise<{
    unreadNotifications: number;
    unreadMessages: number;
  }> {
    const [unreadNotifications, unreadMessages] = await Promise.all([
      this.inbox.countUnread(userId),
      this.messages.count({
        where: {
          recipient: { id: userId },
          deletedByRecipientAt: null,
          readByRecipientAt: null,
        } as any,
      }),
    ]);
    return { unreadNotifications, unreadMessages };
  }

  async notifyCounts(userId: number): Promise<void> {
    const counts = await this.getCounts(userId);
    await this.notifications.notifyUser(userId, 'notify.counts', counts);
  }
}

