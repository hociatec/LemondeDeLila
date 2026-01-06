import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrivateMessage } from '../../messaging/entities/private-message.entity';
import { NotificationService } from './notification.service';
import { NotificationInboxDbService } from './notification-inbox-db.service';

@Injectable()
export class UserBadgeCountsService {
  private readonly logger = new Logger(UserBadgeCountsService.name);

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
    try {
      const [unreadNotifications, unreadMessages] = await Promise.all([
        this.inbox.countUnread(userId),
        this.messages
          .createQueryBuilder('m')
          .where('m.recipient_id = :userId', { userId })
          .andWhere('m.deleted_by_recipient_at IS NULL')
          .andWhere('m.read_by_recipient_at IS NULL')
          .getCount(),
      ]);
      return { unreadNotifications, unreadMessages };
    } catch (err) {
      this.logger.warn(
        `getCounts failed for user ${userId}: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  async notifyCounts(userId: number): Promise<void> {
    const counts = await this.getCounts(userId);
    await this.notifications.notifyUser(userId, 'notify.counts', counts);
  }
}
