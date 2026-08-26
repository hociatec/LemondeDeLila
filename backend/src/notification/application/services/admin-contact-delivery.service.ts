import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { getErrorMessage } from '@common/utils/public-api';
import type { AdminContactItem } from '../models/admin-contact.model';
import {
  NOTIFICATION_INBOX_REPOSITORY,
  type NotificationInboxRepository,
} from '../ports/notification-inbox.repository';
import {
  NOTIFICATION_INBOX_NOTIFIER,
  type NotificationInboxNotifier,
} from '../ports/notification-inbox-notifier.port';
import {
  USER_BADGE_COUNTS_NOTIFIER,
  type UserBadgeCountsNotifier,
} from '../ports/user-badge-counts-notifier.port';
import { ADMIN_CONTACT_KIND } from './admin-contact-normalization';

@Injectable()
export class AdminContactDeliveryService {
  private readonly logger = new Logger(AdminContactDeliveryService.name);

  constructor(
    @Inject(NOTIFICATION_INBOX_REPOSITORY)
    private readonly inbox: NotificationInboxRepository,
    @Inject(NOTIFICATION_INBOX_NOTIFIER)
    private readonly notifier: NotificationInboxNotifier,
    @Inject(USER_BADGE_COUNTS_NOTIFIER)
    private readonly counts: UserBadgeCountsNotifier,
  ) {}

  async deliver(
    baseItem: Omit<AdminContactItem, 'id'>,
    recipients: Iterable<number>,
    createdAt: Date,
  ): Promise<AdminContactItem> {
    const firstRowId = randomUUID();
    const rows = Array.from(new Set(recipients)).map((userId, index) => ({
      userId,
      rowId: index === 0 ? firstRowId : randomUUID(),
    }));
    await Promise.all(
      rows.map(({ userId, rowId }) =>
        this.deliverToRecipient(baseItem, userId, rowId, createdAt),
      ),
    );
    return { ...baseItem, id: firstRowId };
  }

  private async deliverToRecipient(
    baseItem: Omit<AdminContactItem, 'id'>,
    userId: number,
    rowId: string,
    createdAt: Date,
  ): Promise<void> {
    const item: AdminContactItem = { ...baseItem, id: rowId };
    await this.inbox.create({
      id: rowId,
      userId,
      kind: ADMIN_CONTACT_KIND,
      createdAt,
      contactId: baseItem.contactId,
      fromUserId: baseItem.fromUserId,
      fromUsername: baseItem.fromUsername,
      toUserId: baseItem.toUserId ?? null,
      message: baseItem.message,
      payload: {
        status: 'open',
        handled: false,
        statusAt: null,
        statusByUserId: null,
        statusByUsername: null,
      },
    });
    await this.notifyRecipient(userId, item);
  }

  private async notifyRecipient(
    userId: number,
    item: AdminContactItem,
  ): Promise<void> {
    try {
      await this.notifier.notifyInboxItem(userId, item);
    } catch (error) {
      this.logger.warn(
        `notify.inbox.item failed for user ${userId}: ${getErrorMessage(error)}`,
      );
    }
    try {
      await this.counts.notifyCounts(userId);
    } catch (error) {
      this.logger.warn(
        `notifyCounts failed for user ${userId}: ${getErrorMessage(error)}`,
      );
    }
  }
}
