import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  BUSINESS_CLOCK,
  type BusinessClock,
  type WsAuthPayload,
} from '../../../../shared/interfaces/public-api';
import {
  NOTIFICATION_INBOX_REPOSITORY,
  type NotificationInboxRepository,
} from '../ports/notification-inbox.repository';
import {
  USER_BADGE_COUNTS_NOTIFIER,
  type UserBadgeCountsNotifier,
} from '../ports/user-badge-counts-notifier.port';
import {
  STAFF_USERS_READER,
  type StaffUsersReader,
} from '../../../user/public-api';
import { businessMsToDate } from '../../../../shared/utils/public-api';
import {
  NotificationAccessDeniedError,
  NotificationContactIdRequiredError,
  NotificationMessageRequiredError,
  NotificationMessageTooLongError,
  NotificationRecipientInvalidError,
} from '../../domain/errors/notification-domain.errors';
import type {
  AdminContactItem,
  AdminContactStatus,
  AdminContactThreadSummary,
} from '../models/admin-contact.model';
export type {
  AdminContactItem,
  AdminContactStatus,
  AdminContactThreadSummary,
} from '../models/admin-contact.model';
import { AdminContactDeliveryService } from './admin-contact-delivery.service';
import { AdminContactQueryService } from './admin-contact-query.service';
import { AdminContactWorkflowService } from './admin-contact-workflow.service';

type ContactIdentity = Pick<WsAuthPayload, 'id' | 'username' | 'roles'>;

/** Stable facade; query, delivery and staff workflow live in focused services. */
@Injectable()
export class AdminContactService {
  private readonly logger = new Logger(AdminContactService.name);

  constructor(
    @Inject(NOTIFICATION_INBOX_REPOSITORY)
    private readonly inbox: NotificationInboxRepository,
    @Inject(USER_BADGE_COUNTS_NOTIFIER)
    private readonly counts: UserBadgeCountsNotifier,
    @Inject(STAFF_USERS_READER)
    private readonly users: StaffUsersReader,
    private readonly delivery: AdminContactDeliveryService,
    private readonly queries: AdminContactQueryService,
    private readonly workflow: AdminContactWorkflowService,
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
  ) {}

  listInbox(
    userId: number,
    limit = 100,
  ): Promise<Array<Record<string, unknown>>> {
    return this.queries.listInbox(userId, limit);
  }

  listThreads(
    userId: number,
    options: { maxItems?: number; limitThreads?: number } = {},
  ): Promise<AdminContactThreadSummary[]> {
    return this.queries.listThreads(userId, options);
  }

  cycleStatusForContact(
    from: ContactIdentity,
    contactId: string,
  ): Promise<{ status: AdminContactStatus }> {
    return this.workflow.cycleForContact(from, this.identifier(contactId));
  }

  cycleStatusForInboxItem(
    from: ContactIdentity,
    userId: number,
    inboxItemId: string,
  ): Promise<{ status: AdminContactStatus }> {
    return this.workflow.cycleForInboxItem(
      from,
      userId,
      this.identifier(inboxItemId),
    );
  }

  setStatusForInboxItem(
    from: ContactIdentity,
    userId: number,
    inboxItemId: string,
    status: unknown,
  ): Promise<void> {
    return this.workflow.setForInboxItem(
      from,
      userId,
      this.identifier(inboxItemId),
      status,
    );
  }

  setStatusForContact(
    from: ContactIdentity,
    contactId: string,
    status: unknown,
  ): Promise<void> {
    return this.workflow.setForContact(
      from,
      this.identifier(contactId),
      status,
    );
  }

  setHandledForContact(
    from: ContactIdentity,
    contactId: string,
    handled: boolean,
  ): Promise<void> {
    return this.workflow.setForContact(
      from,
      this.identifier(contactId),
      handled ? 'handled' : 'open',
    );
  }

  deleteThreadForContact(
    from: ContactIdentity,
    contactId: string,
  ): Promise<void> {
    return this.workflow.deleteThread(from, this.identifier(contactId));
  }

  async deleteInboxItem(userId: number, id: string): Promise<void> {
    const itemId = this.identifier(id);
    const deleted = await this.inbox.delete(userId, itemId);
    this.logger.log(
      JSON.stringify({
        event: 'notification.inbox.deleted',
        userId,
        id: itemId,
        deleted,
      }),
    );
    await this.counts.notifyCounts(userId);
  }

  async markRead(userId: number, id: string): Promise<void> {
    await this.inbox.markRead(userId, this.identifier(id));
    await this.counts.notifyCounts(userId);
  }

  async sendFromUserToStaff(
    from: ContactIdentity,
    message: string,
    contactId?: string,
  ): Promise<AdminContactItem> {
    const clean = this.message(message);
    const createdAt = businessMsToDate(this.clock.now());
    const recipients = new Set<number>([
      from.id,
      ...(await this.staffUserIds()),
    ]);
    return this.delivery.deliver(
      this.item(
        from,
        clean,
        contactId ? this.identifier(contactId) : randomUUID(),
        createdAt,
      ),
      recipients,
      createdAt,
    );
  }

  async replyFromStaffToUser(
    from: ContactIdentity,
    toUserId: number,
    message: string,
    contactId: string,
  ): Promise<AdminContactItem> {
    this.assertStaff(from.roles);
    if (!Number.isSafeInteger(toUserId) || toUserId <= 0) {
      throw new NotificationRecipientInvalidError();
    }
    const cid = this.identifier(contactId);
    const createdAt = businessMsToDate(this.clock.now());
    const recipients = new Set<number>([
      toUserId,
      ...(await this.staffUserIds()),
    ]);
    return this.delivery.deliver(
      { ...this.item(from, this.message(message), cid, createdAt), toUserId },
      recipients,
      createdAt,
    );
  }

  private item(
    from: ContactIdentity,
    message: string,
    contactId: string,
    createdAt: Date,
  ): Omit<AdminContactItem, 'id'> {
    return {
      kind: 'admin_contact',
      contactId,
      createdAt: createdAt.toISOString(),
      message,
      fromUserId: from.id,
      fromUsername: from.username,
      status: 'open',
      handled: false,
    };
  }

  private message(value: string): string {
    const message = String(value || '').trim();
    if (!message) throw new NotificationMessageRequiredError();
    if (message.length > 2000) throw new NotificationMessageTooLongError();
    return message;
  }

  private identifier(value: string): string {
    const identifier = String(value ?? '').trim();
    if (!identifier || identifier.length > 128) {
      throw new NotificationContactIdRequiredError();
    }
    return identifier;
  }

  private async staffUserIds(): Promise<number[]> {
    return (await this.users.listStaff())
      .map((user) => user.id)
      .filter((id) => typeof id === 'number' && id > 0);
  }

  private assertStaff(roles: unknown): void {
    const values = Array.isArray(roles) ? roles.map(String) : [];
    if (
      !values.some((role) =>
        ['ROLE_ADMIN', 'admin', 'ROLE_MODERATOR', 'moderator'].includes(role),
      )
    ) {
      throw new NotificationAccessDeniedError();
    }
  }
}
